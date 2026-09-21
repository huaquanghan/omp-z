/**
 * Zvec backend configuration resolved from `zvec.*` settings.
 *
 * The bank is the only storage decision: `per-project` keys a bank from the
 * working directory (mnemopi-style project segment), `global` uses one shared
 * bank named by `zvec.bank` (default `default`).
 */

import type { Settings } from "../config/settings";
import { zvecProjectBankId } from "./paths";

export type ZvecScoping = "global" | "per-project";

/** Default embedding model for new indexes; tiny model2vec model, fast to build. */
export const ZVEC_DEFAULT_EMBEDDING_MODEL = "local/potion-code-16m-v2";

export interface ZvecBackendConfig {
	bank: string;
	scoping: ZvecScoping;
	embeddingModel: string;
	autoRecall: boolean;
	autoRetain: boolean;
	retainEveryNTurns: number;
	recallLimit: number;
	recallContextTurns: number;
	recallMaxQueryChars: number;
	injectionTokenLimit: number;
	debug: boolean;
}

export function loadZvecConfig(settings: Settings, cwd?: string): ZvecBackendConfig {
	const scoping = settings.get("zvec.scoping") ?? "per-project";
	const configuredBank = settings.get("zvec.bank")?.trim();
	const bank = scoping === "global" ? configuredBank || "default" : zvecProjectBankId(cwd ?? settings.getCwd());
	return {
		bank,
		scoping,
		embeddingModel: settings.get("zvec.embeddingModel")?.trim() || ZVEC_DEFAULT_EMBEDDING_MODEL,
		autoRecall: settings.get("zvec.autoRecall"),
		autoRetain: settings.get("zvec.autoRetain"),
		retainEveryNTurns: Math.max(1, settings.get("zvec.retainEveryNTurns")),
		recallLimit: Math.max(1, settings.get("zvec.recallLimit")),
		recallContextTurns: Math.max(1, settings.get("zvec.recallContextTurns")),
		recallMaxQueryChars: Math.max(200, settings.get("zvec.recallMaxQueryChars")),
		injectionTokenLimit: Math.max(500, settings.get("zvec.injectionTokenLimit")),
		debug: settings.get("zvec.debug"),
	};
}
