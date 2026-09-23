/**
 * Thin wrapper around the `zg` (zvec-grep) CLI.
 *
 * The zvec backend shells out to zg for indexing and hybrid (BM25 + vector)
 * retrieval; zg owns the index format and the embedding runtime. Every call is
 * best-effort: failures return a result object instead of throwing, so a
 * missing binary or a broken index can never break the agent loop.
 */

export interface ZgRunResult {
	ok: boolean;
	code: number;
	stdout: string;
	stderr: string;
}

export interface ZgRunOptions {
	cwd: string;
	timeoutMs?: number;
	signal?: AbortSignal;
}

export type ZgRunner = (args: string[], options: ZgRunOptions) => Promise<ZgRunResult>;

const DEFAULT_TIMEOUT_MS = 30_000;
const INDEX_TIMEOUT_MS = 120_000;

let runnerOverride: ZgRunner | undefined;

/** Test seam: replace the process-spawning runner (pass `undefined` to restore). */
export function setZvecZgRunnerForTests(runner: ZgRunner | undefined): void {
	runnerOverride = runner;
}

/** Absolute path of the zg binary, or `undefined` when it is not on PATH. */
export function resolveZgBinary(): string | undefined {
	try {
		return Bun.which("zg") ?? undefined;
	} catch {
		return undefined;
	}
}

async function spawnZg(args: string[], options: ZgRunOptions): Promise<ZgRunResult> {
	const binary = resolveZgBinary();
	if (!binary) {
		return { ok: false, code: 127, stdout: "", stderr: "zg (zvec-grep) is not installed or not on PATH." };
	}
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	let proc: Bun.Subprocess<"ignore", "pipe", "pipe">;
	try {
		proc = Bun.spawn([binary, ...args], {
			cwd: options.cwd,
			stdout: "pipe",
			stderr: "pipe",
			env: process.env,
		});
	} catch (error) {
		return { ok: false, code: 1, stdout: "", stderr: error instanceof Error ? error.message : String(error) };
	}
	const killProc = () => {
		try {
			proc.kill();
		} catch {
			// Already exited.
		}
	};
	const timer = setTimeout(killProc, timeoutMs);
	const signal = options.signal;
	if (signal?.aborted) killProc();
	else signal?.addEventListener("abort", killProc, { once: true });
	try {
		const [stdout, stderr, code] = await Promise.all([
			new Response(proc.stdout).text(),
			new Response(proc.stderr).text(),
			proc.exited,
		]);
		return { ok: code === 0, code, stdout, stderr };
	} catch (error) {
		return { ok: false, code: 1, stdout: "", stderr: error instanceof Error ? error.message : String(error) };
	} finally {
		clearTimeout(timer);
		signal?.removeEventListener("abort", killProc);
	}
}

function run(args: string[], options: ZgRunOptions): Promise<ZgRunResult> {
	return (runnerOverride ?? spawnZg)(args, options);
}

/** Build or incrementally refresh the workspace index rooted at `bankDir`. */
export function zgIndex(bankDir: string, embeddingModel: string): Promise<ZgRunResult> {
	return run(["index", bankDir, "--embedding", embeddingModel], { cwd: bankDir, timeoutMs: INDEX_TIMEOUT_MS });
}

/** Run a hybrid query against the index rooted at `bankDir`. */
export function zgQuery(bankDir: string, query: string, limit: number, signal?: AbortSignal): Promise<ZgRunResult> {
	return run(["query", query, "--limit", String(limit), "--preview", "full", "--trace"], {
		cwd: bankDir,
		timeoutMs: DEFAULT_TIMEOUT_MS,
		signal,
	});
}

/** Workspace/index status for the bank directory. */
export function zgStatus(bankDir: string): Promise<ZgRunResult> {
	return run(["status"], { cwd: bankDir, timeoutMs: 15_000 });
}

/** True when zg reports that no index exists yet for the workspace. */
export function isMissingIndexError(result: ZgRunResult): boolean {
	const text = `${result.stderr}\n${result.stdout}`;
	return text.includes("WORKSPACE_INDEX_NOT_FOUND") || text.includes("No zvec-grep index found");
}

/** Memory id encoded in a zg hit path (`memories/<id>.md`), when it is one. */
export function memoryIdFromHitPath(hitPath: string): string | undefined {
	const base = hitPath.split("/").pop() ?? "";
	return base.endsWith(".md") ? base.slice(0, -3) : undefined;
}

/** Collapse per-fragment hits into one entry per memory, best hit first. */
export function dedupeZgHits(hits: readonly ZgHit[]): ZgHit[] {
	const seen = new Set<string>();
	const unique: ZgHit[] = [];
	for (const hit of hits) {
		const key = memoryIdFromHitPath(hit.path) ?? hit.path;
		if (seen.has(key)) continue;
		seen.add(key);
		unique.push(hit);
	}
	return unique;
}

/** One parsed hit from `zg query` agent-markdown output. */
export interface ZgHit {
	path: string;
	startLine?: number;
	endLine?: number;
	matchedBy?: string;
	score?: number;
	content: string;
}

// `#1 matchedBy=fts+vector score=0.0328 cache.md:1-4`
const HIT_HEADER_RE = /^#\d+\s+matchedBy=(\S+)(?:\s+score=([\d.]+))?\s+(.+?)(?::(\d+)-(\d+))?$/;
const NUMBERED_LINE_RE = /^\d+\t(.*)$/;

/**
 * Parse `zg query` agent-markdown output into hits.
 *
 * The format is stable agent-facing output: one `#N matchedBy=… path:range`
 * header per hit followed by numbered content lines. Every un-numbered line in
 * a hit block is a zg annotation (`source:`, `heading:`, `heading_level:`,
 * `trace:`, …) and is dropped — only `N\t<text>` lines are content.
 */
export function parseZgQueryOutput(stdout: string): ZgHit[] {
	const hits: ZgHit[] = [];
	let current: ZgHit | undefined;
	let contentLines: string[] = [];
	const flush = () => {
		if (!current) return;
		current.content = contentLines.join("\n").trim();
		hits.push(current);
		current = undefined;
		contentLines = [];
	};
	for (const rawLine of stdout.split(/\r?\n/)) {
		const header = HIT_HEADER_RE.exec(rawLine.trim());
		if (header) {
			flush();
			current = {
				matchedBy: header[1],
				score: header[2] ? Number.parseFloat(header[2]) : undefined,
				path: header[3] ?? "",
				startLine: header[4] ? Number.parseInt(header[4], 10) : undefined,
				endLine: header[5] ? Number.parseInt(header[5], 10) : undefined,
				content: "",
			};
			continue;
		}
		if (!current) continue;
		const numbered = NUMBERED_LINE_RE.exec(rawLine);
		if (numbered) contentLines.push(numbered[1]);
	}
	flush();
	return hits;
}
