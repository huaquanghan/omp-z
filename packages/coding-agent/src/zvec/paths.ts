/**
 * Zvec memory storage layout.
 *
 * Everything lives home-scoped under `<agentDir>/memories/zvec/<bank>/`:
 *
 * - `memories/<id>.md` — one markdown file per memory entry
 * - `.zvec-grep/` — the zg (zvec-grep) workspace index built over that directory
 *
 * The per-project bank id reuses the mnemopi/sharpshooter project segment, so
 * one project keys the same directory across every memory subsystem.
 */

import * as path from "node:path";
import { getMemoriesDir } from "@oh-my-pi/pi-utils";
import { projectBankSegment } from "../mnemopi/config";

/** Root for every zvec bank. */
export function zvecRoot(agentDir: string): string {
	return path.join(getMemoriesDir(agentDir), "zvec");
}

/** Stable per-project bank id derived from `cwd` alone (see {@link projectBankSegment}). */
export function zvecProjectBankId(cwd: string): string {
	return projectBankSegment(path.resolve(cwd || "."));
}

/** Bank directory for one bank id. */
export function zvecBankDir(agentDir: string, bank: string): string {
	return path.join(zvecRoot(agentDir), bank);
}

/** Directory holding one markdown file per memory entry. */
export function zvecMemoriesDir(agentDir: string, bank: string): string {
	return path.join(zvecBankDir(agentDir, bank), "memories");
}

/** Path of one memory entry file. */
export function zvecMemoryFilePath(agentDir: string, bank: string, id: string): string {
	return path.join(zvecMemoriesDir(agentDir, bank), `${id}.md`);
}

/** Directory zg owns inside a bank (index + manifest + locks). */
export function zvecIndexDir(agentDir: string, bank: string): string {
	return path.join(zvecBankDir(agentDir, bank), ".zvec-grep");
}
