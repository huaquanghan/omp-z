/**
 * Zvec backend configuration resolved from `zvec.*` settings.
 *
 * The bank is the only storage decision: `per-project` keys a bank from the
 * working directory (mnemopi-style project segment), `global` uses one shared
 * bank named by `zvec.bank` (default `default`).
 */

import type { Settings } from "../config/settings";
import { zvecProjectBankId } from "./paths";
import {
	cfgZvecAutoRecall,
	cfgZvecAutoRetain,
	cfgZvecBank,
	cfgZvecDebug,
	cfgZvecEmbeddingModel,
	cfgZvecInjectionTokenLimit,
	cfgZvecRecallContextTurns,
	cfgZvecRecallLimit,
	cfgZvecRecallMaxQueryChars,
	cfgZvecRetainEveryNTurns,
	cfgZvecScoping,
} from "./settings";

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
	const scoping = cfgZvecScoping.get(settings) ?? "per-project";
	const configuredBank = cfgZvecBank.get(settings)?.trim();
	const bank = scoping === "global" ? configuredBank || "default" : zvecProjectBankId(cwd ?? settings.getCwd());
	return {
		bank,
		scoping,
		embeddingModel: cfgZvecEmbeddingModel.get(settings)?.trim() || ZVEC_DEFAULT_EMBEDDING_MODEL,
		autoRecall: cfgZvecAutoRecall.get(settings),
		autoRetain: cfgZvecAutoRetain.get(settings),
		retainEveryNTurns: Math.max(1, cfgZvecRetainEveryNTurns.get(settings)),
		recallLimit: Math.max(1, cfgZvecRecallLimit.get(settings)),
		recallContextTurns: Math.max(1, cfgZvecRecallContextTurns.get(settings)),
		recallMaxQueryChars: Math.max(200, cfgZvecRecallMaxQueryChars.get(settings)),
		injectionTokenLimit: Math.max(500, cfgZvecInjectionTokenLimit.get(settings)),
		debug: cfgZvecDebug.get(settings),
	};
}
