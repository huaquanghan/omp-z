/**
 * File-backed zvec memory store.
 *
 * One markdown file per memory entry under the bank's `memories/` directory.
 * The file body is the memory text; a small YAML frontmatter carries the
 * metadata recall needs (id, created, source, session, importance). zg indexes
 * the directory, so the body is what semantic and lexical recall match on.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { zvecMemoriesDir, zvecMemoryFilePath } from "./paths";

export interface ZvecMemoryRecord {
	id: string;
	content: string;
	created: string;
	source?: string;
	session?: string;
	importance?: number;
	context?: string;
	supersededBy?: string;
	invalidatedAt?: string;
}

const MEMORY_FILE_RE = /\.md$/;

/** Keys this store writes into a memory file's frontmatter. */
const FRONTMATTER_KEY_RE = /^(id|created|source|session|importance|context|superseded_by|invalidated_at):\s/;

/**
 * Drop the memory file's YAML frontmatter from a hit fragment.
 *
 * zg indexes the whole file, so a hit can start at the opening delimiter, in
 * the middle of the metadata block, or in the body. Everything up to and
 * including the closing `---` is dropped only when every preceding line is a
 * known frontmatter key, so a body that merely starts with a horizontal rule
 * or a `key: value` line survives intact.
 */
export function stripMemoryFrontmatter(content: string): string {
	const lines = content.split("\n");
	const start = lines[0]?.trim() === "---" ? 1 : 0;
	for (let index = start; index < lines.length; index++) {
		const line = lines[index].trim();
		if (line === "---") {
			const head = lines.slice(start, index);
			if (head.length > 0 && head.every(candidate => FRONTMATTER_KEY_RE.test(candidate.trim()))) {
				return lines.slice(index + 1).join("\n").replace(/^\s+/, "");
			}
			return content;
		}
		if (!FRONTMATTER_KEY_RE.test(line)) return content;
	}
	return content;
}

/** Short, sortable, collision-resistant memory id. */
export function newZvecMemoryId(): string {
	const random = Math.random().toString(36).slice(2, 8);
	return `z-${Date.now().toString(36)}-${random}`;
}

function singleLine(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

function renderMemoryFile(record: ZvecMemoryRecord): string {
	const lines = ["---", `id: ${record.id}`, `created: ${record.created}`];
	if (record.source) lines.push(`source: ${singleLine(record.source)}`);
	if (record.session) lines.push(`session: ${singleLine(record.session)}`);
	if (record.importance !== undefined) lines.push(`importance: ${record.importance}`);
	if (record.context) lines.push(`context: ${singleLine(record.context)}`);
	if (record.supersededBy) lines.push(`superseded_by: ${singleLine(record.supersededBy)}`);
	if (record.invalidatedAt) lines.push(`invalidated_at: ${singleLine(record.invalidatedAt)}`);
	lines.push("---", "", record.content.trim(), "");
	return lines.join("\n");
}

function parseMemoryFile(id: string, raw: string): ZvecMemoryRecord {
	const record: ZvecMemoryRecord = { id, content: raw.trim(), created: "" };
	if (!raw.startsWith("---\n")) return record;
	const end = raw.indexOf("\n---", 4);
	if (end === -1) return record;
	const frontmatter = raw.slice(4, end);
	record.content = raw.slice(end + 4).trim();
	for (const line of frontmatter.split("\n")) {
		const separator = line.indexOf(":");
		if (separator === -1) continue;
		const key = line.slice(0, separator).trim();
		const value = line.slice(separator + 1).trim();
		if (!value) continue;
		switch (key) {
			case "id":
				record.id = value;
				break;
			case "created":
				record.created = value;
				break;
			case "source":
				record.source = value;
				break;
			case "session":
				record.session = value;
				break;
			case "importance": {
				const parsed = Number.parseFloat(value);
				if (Number.isFinite(parsed)) record.importance = parsed;
				break;
			}
			case "context":
				record.context = value;
				break;
			case "superseded_by":
				record.supersededBy = value;
				break;
			case "invalidated_at":
				record.invalidatedAt = value;
				break;
			default:
				break;
		}
	}
	return record;
}

/** Write (or overwrite) one memory entry; returns the file path. */
export async function writeZvecMemory(agentDir: string, bank: string, record: ZvecMemoryRecord): Promise<string> {
	const file = zvecMemoryFilePath(agentDir, bank, record.id);
	await fs.mkdir(path.dirname(file), { recursive: true });
	await Bun.write(file, renderMemoryFile(record));
	return file;
}

/** Read one memory entry by id; `undefined` when it does not exist. */
export async function readZvecMemory(
	agentDir: string,
	bank: string,
	id: string,
): Promise<ZvecMemoryRecord | undefined> {
	try {
		const raw = await Bun.file(zvecMemoryFilePath(agentDir, bank, id)).text();
		return parseMemoryFile(id, raw);
	} catch {
		return undefined;
	}
}

/** All memory entries of a bank, newest first. */
export async function listZvecMemories(agentDir: string, bank: string): Promise<ZvecMemoryRecord[]> {
	const dir = zvecMemoriesDir(agentDir, bank);
	let names: string[];
	try {
		names = await fs.readdir(dir);
	} catch {
		return [];
	}
	const records: ZvecMemoryRecord[] = [];
	for (const name of names) {
		if (!MEMORY_FILE_RE.test(name)) continue;
		const id = name.slice(0, -3);
		const record = await readZvecMemory(agentDir, bank, id);
		if (record) records.push(record);
	}
	records.sort((left, right) => (right.created || "").localeCompare(left.created || ""));
	return records;
}

/** Delete one memory entry; `true` when a file was removed. */
export async function deleteZvecMemory(agentDir: string, bank: string, id: string): Promise<boolean> {
	try {
		await fs.unlink(zvecMemoryFilePath(agentDir, bank, id));
		return true;
	} catch {
		return false;
	}
}

/** Count memory entry files without parsing them. */
export async function countZvecMemories(agentDir: string, bank: string): Promise<number> {
	try {
		const names = await fs.readdir(zvecMemoriesDir(agentDir, bank));
		return names.filter(name => MEMORY_FILE_RE.test(name)).length;
	} catch {
		return 0;
	}
}
