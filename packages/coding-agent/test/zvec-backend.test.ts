import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { resolveMemoryBackend } from "@oh-my-pi/pi-coding-agent/memory-backend";
import type { AgentSession } from "@oh-my-pi/pi-coding-agent/session/agent-session";
import { zvecBackend } from "@oh-my-pi/pi-coding-agent/zvec/backend";
import { zvecBankDir, zvecMemoriesDir, zvecProjectBankId } from "@oh-my-pi/pi-coding-agent/zvec/paths";
import { parseZgQueryOutput, setZvecZgRunnerForTests, type ZgRunResult } from "@oh-my-pi/pi-coding-agent/zvec/zg";

const tempDirs: string[] = [];

afterEach(async () => {
	setZvecZgRunnerForTests(undefined);
	await Promise.all(tempDirs.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true })));
});

async function makeTempDir(name: string): Promise<string> {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), `${name}-`));
	tempDirs.push(dir);
	return dir;
}

function ok(stdout: string): ZgRunResult {
	return { ok: true, code: 0, stdout, stderr: "" };
}

/** Install a fake zg runner; `query` receives the raw argv. */
function fakeZg(handlers: { query?: (args: string[]) => ZgRunResult; index?: () => ZgRunResult } = {}): void {
	setZvecZgRunnerForTests(async args => {
		if (args[0] === "index") return handlers.index?.() ?? ok("Indexing complete");
		if (args[0] === "query") return handlers.query?.(args) ?? ok("");
		if (args[0] === "status") return ok("✓ Workspace index is ready");
		return { ok: false, code: 1, stdout: "", stderr: `unexpected zg args: ${args.join(" ")}` };
	});
}

async function makeFixture(name: string): Promise<{ agentDir: string; cwd: string; settings: Settings }> {
	const root = await makeTempDir(name);
	const agentDir = path.join(root, "agent");
	const cwd = path.join(root, "project");
	await fs.mkdir(cwd, { recursive: true });
	const settings = Settings.isolated({ "memory.backend": "zvec" });
	await settings.reloadForCwd(cwd);
	return { agentDir, cwd, settings };
}

describe("zvec memory backend", () => {
	it("resolves from the memory.backend setting", async () => {
		const settings = Settings.isolated({ "memory.backend": "zvec" });
		expect(await resolveMemoryBackend(settings)).toBe(zvecBackend);
	});

	it("saves a memory file and reports it through status", async () => {
		const { agentDir, cwd, settings } = await makeFixture("zvec-save");
		fakeZg();

		const saved = await zvecBackend.save?.({ agentDir, cwd, settings }, { content: "Keep storage project-scoped." });
		expect(saved?.stored).toBe(1);

		const bank = zvecProjectBankId(cwd);
		const names = await fs.readdir(zvecMemoriesDir(agentDir, bank));
		expect(names).toHaveLength(1);
		const raw = await Bun.file(path.join(zvecMemoriesDir(agentDir, bank), names[0])).text();
		expect(raw).toContain("Keep storage project-scoped.");
		expect(raw).toContain("source: coding-agent-memory-command");

		const status = await zvecBackend.status?.({ agentDir, cwd, settings });
		expect(status?.backend).toBe("zvec");
		expect(status?.workingCount).toBe(1);
		expect(status?.database).toBe(zvecBankDir(agentDir, bank));
	});

	it("returns parsed hits from a zg query", async () => {
		const { agentDir, cwd, settings } = await makeFixture("zvec-search");
		fakeZg();
		await zvecBackend.save?.({ agentDir, cwd, settings }, { content: "The auth service validates JWT tokens." });
		const bank = zvecProjectBankId(cwd);
		const [name] = await fs.readdir(zvecMemoriesDir(agentDir, bank));
		const id = name.slice(0, -3);

		fakeZg({
			query: () =>
				ok(
					[
						"query groups (1):",
						"Q1 [primary]: how does auth work",
						"hits: 1",
						"",
						`#1 matchedBy=fts+vector score=0.0328 memories/${id}.md:1-3`,
						"1\tThe auth service validates JWT tokens.",
						`trace: query "how does auth work": fts #1, vector #1; fused #1`,
						"",
					].join("\n"),
				),
		});

		const result = await zvecBackend.search?.({ agentDir, cwd, settings }, "how does auth work");
		expect(result?.count).toBe(1);
		expect(result?.items[0]?.id).toBe(id);
		expect(result?.items[0]?.content).toBe("The auth service validates JWT tokens.");
		expect(result?.items[0]?.score).toBeCloseTo(0.0328);
	});

	it("strips memory frontmatter and collapses duplicate fragments in search results", async () => {
		const { agentDir, cwd, settings } = await makeFixture("zvec-clean");
		fakeZg();
		await zvecBackend.save?.({ agentDir, cwd, settings }, { content: "The staging cluster is Falcon." });
		const bank = zvecProjectBankId(cwd);
		const [name] = await fs.readdir(zvecMemoriesDir(agentDir, bank));
		const id = name.slice(0, -3);

		fakeZg({
			query: () =>
				ok(
					[
						`#1 matchedBy=fts+vector score=0.5 memories/${id}.md:5-9`,
						"5\timportance: 0.75",
						"6\t---",
						"7\t",
						"8\tThe staging cluster is Falcon.",
						"",
						`#2 matchedBy=fts memories/${id}.md:1-8`,
						"1\t---",
						`2\tid: ${id}`,
						"3\tcreated: 2026-09-19T00:00:00.000Z",
						"4\tsource: coding-agent-retain",
						"5\timportance: 0.75",
						"6\t---",
						"7\t",
						"8\tThe staging cluster is Falcon.",
						"",
					].join("\n"),
				),
		});

		const result = await zvecBackend.search?.({ agentDir, cwd, settings }, "staging");
		expect(result?.count).toBe(1);
		expect(result?.items[0]?.content).toBe("The staging cluster is Falcon.");
	});

	it("builds an index before querying when zg reports a missing index", async () => {
		const { agentDir, cwd, settings } = await makeFixture("zvec-missing-index");
		fakeZg();
		await zvecBackend.save?.({ agentDir, cwd, settings }, { content: "Deployment uses blue-green." });
		const bank = zvecProjectBankId(cwd);
		const [name] = await fs.readdir(zvecMemoriesDir(agentDir, bank));
		const id = name.slice(0, -3);

		const calls: string[] = [];
		let queryCount = 0;
		setZvecZgRunnerForTests(async args => {
			calls.push(args[0]);
			if (args[0] === "index") return ok("Indexing complete");
			if (args[0] === "query") {
				queryCount += 1;
				if (queryCount === 1) {
					return {
						ok: false,
						code: 1,
						stdout: "",
						stderr:
							"Error: No zvec-grep index found for this workspace\nCode: ZVEC_GREP.ENGINE.SERVICE.WORKSPACE_INDEX_NOT_FOUND",
					};
				}
				return ok(`#1 matchedBy=fts memories/${id}.md:1-2\n1\tDeployment uses blue-green.\n`);
			}
			return ok("");
		});

		const result = await zvecBackend.search?.({ agentDir, cwd, settings }, "deployment");
		expect(result?.count).toBe(1);
		expect(calls.filter(call => call === "index").length).toBeGreaterThanOrEqual(1);
		expect(queryCount).toBe(2);
	});

	it("edits and forgets stored memories by id", async () => {
		const { agentDir, cwd, settings } = await makeFixture("zvec-edit");
		fakeZg();
		const saved = await zvecBackend.save?.({ agentDir, cwd, settings }, { content: "Original statement." });
		const id = saved?.ids?.[0];
		if (!id) throw new Error("expected a stored memory id");

		const updated = await zvecBackend.edit?.(
			{ agentDir, cwd, settings },
			{ op: "update", id, content: "Corrected statement." },
		);
		expect(updated?.status).toBe("updated");
		const bank = zvecProjectBankId(cwd);
		const raw = await Bun.file(path.join(zvecMemoriesDir(agentDir, bank), `${id}.md`)).text();
		expect(raw).toContain("Corrected statement.");
		expect(raw).not.toContain("Original statement.");

		const forgotten = await zvecBackend.edit?.({ agentDir, cwd, settings }, { op: "forget", id });
		expect(forgotten?.status).toBe("forgotten");
		await expect(Bun.file(path.join(zvecMemoriesDir(agentDir, bank), `${id}.md`)).exists()).resolves.toBe(false);

		const missing = await zvecBackend.edit?.({ agentDir, cwd, settings }, { op: "forget", id });
		expect(missing?.status).toBe("not_found");
	});

	it("clears the bank directory", async () => {
		const { agentDir, cwd, settings } = await makeFixture("zvec-clear");
		fakeZg();
		await zvecBackend.save?.({ agentDir, cwd, settings }, { content: "Temporary memory." });
		const bank = zvecProjectBankId(cwd);
		await expect(fs.stat(zvecBankDir(agentDir, bank))).resolves.toBeTruthy();

		await zvecBackend.clear(agentDir, cwd, { settings } as AgentSession);
		await expect(fs.stat(zvecBankDir(agentDir, bank))).rejects.toThrow();
	});

	it("injects static guidance without a recall snippet", async () => {
		const { agentDir, settings } = await makeFixture("zvec-instructions");
		const instructions = await zvecBackend.buildDeveloperInstructions(agentDir, settings);
		expect(instructions).toContain("zvec");
		expect(instructions).toContain("recall");
	});
});

describe("zg query output parsing", () => {
	it("parses hits with scores, ranges, and annotation lines", () => {
		const hits = parseZgQueryOutput(
			[
				"query groups (1):",
				"Q1 [primary]: cache invalidation",
				"hits: 2",
				"",
				"#1 matchedBy=fts+vector score=0.0328 cache.md:1-4",
				"heading: context: User-stated project fact",
				"heading_level: 2",
				"source:",
				"1\tLine one about caching.",
				"2\tLine two about invalidation.",
				"trace: query \"cache invalidation\": fts #1, vector #1; fused #1",
				"",
				"#2 matchedBy=fts auth.md:1-2",
				"1\tThe auth service validates JWT tokens.",
				"",
			].join("\n"),
		);
		expect(hits).toHaveLength(2);
		expect(hits[0]).toEqual({
			path: "cache.md",
			startLine: 1,
			endLine: 4,
			matchedBy: "fts+vector",
			score: 0.0328,
			content: "Line one about caching.\nLine two about invalidation.",
		});
		expect(hits[1]?.path).toBe("auth.md");
		expect(hits[1]?.score).toBeUndefined();
	});

	it("returns nothing for output without hits", () => {
		expect(parseZgQueryOutput("query groups (1):\nQ1 [primary]: x\nhits: 0\n")).toEqual([]);
	});
});
