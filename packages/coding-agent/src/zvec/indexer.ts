/**
 * Shared zg index bookkeeping.
 *
 * Index refreshes are per-bank, deduplicated across concurrent callers, and
 * skipped while a bank holds no memory files. A bank is dirty after a write
 * and clean once zg reports a successful (incremental) index run; a bank with
 * memories but no index yet is indexed on first use.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { logger } from "@oh-my-pi/pi-utils";
import { countZvecMemories } from "./store";
import { zgIndex } from "./zg";

const dirtyBanks = new Set<string>();
const inFlight = new Map<string, Promise<void>>();

/** Mark a bank's index stale after a memory write or edit. */
export function markZvecBankDirty(bankDir: string): void {
	dirtyBanks.add(bankDir);
}

async function indexExists(bankDir: string): Promise<boolean> {
	try {
		await fs.stat(path.join(bankDir, ".zvec-grep", "index.zvec"));
		return true;
	} catch {
		return false;
	}
}

async function runIndex(bankDir: string, embeddingModel: string, debug: boolean): Promise<void> {
	const result = await zgIndex(bankDir, embeddingModel);
	if (result.ok) {
		dirtyBanks.delete(bankDir);
		return;
	}
	if (debug) logger.debug("Zvec: index refresh failed", { bankDir, stderr: result.stderr.slice(0, 500) });
}

/**
 * Ensure the bank's zg index is current.
 *
 * `force` rebuilds even when the bank looks clean (used after a query failed
 * with a missing index). Concurrent callers share one in-flight run.
 */
export async function ensureZvecBankIndexed(options: {
	agentDir: string;
	bank: string;
	bankDir: string;
	embeddingModel: string;
	force?: boolean;
	debug?: boolean;
}): Promise<void> {
	const { bankDir, embeddingModel, force = false, debug = false } = options;
	const pending = inFlight.get(bankDir);
	if (pending) {
		await pending;
		if (!force) return;
	} else if (!force && !dirtyBanks.has(bankDir) && (await indexExists(bankDir))) {
		return;
	}
	if ((await countZvecMemories(options.agentDir, options.bank)) === 0) {
		dirtyBanks.delete(bankDir);
		return;
	}
	const promise = runIndex(bankDir, embeddingModel, debug).finally(() => {
		inFlight.delete(bankDir);
	});
	inFlight.set(bankDir, promise);
	await promise;
}
