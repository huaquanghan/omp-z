/**
 * Settings declared by this domain (see `config/registry.ts`). Declaration order is the
 * settings-panel order; `config/all-settings.ts` registers every domain.
 */
import { register } from "../config/registry";

// Zvec: file-backed memories under <agent memories dir>/zvec/<bank>, indexed
// and recalled by the `zg` (zvec-grep) CLI. Requires zg on PATH.
export const cfgZvecBank = register({
	id: "zvec.bank",
	type: "string",
	default: undefined,
	ui: {
		tab: "memory",
		group: "Zvec",
		label: "Zvec Bank",
		description: "Shared bank name used when scoping is global. Empty = the shared `default` bank.",
		condition: "zvecActive",
	},
});

export const cfgZvecScoping = register({
	id: "zvec.scoping",
	type: "enum",
	values: ["per-project", "global"] as const,
	default: "per-project",
	ui: {
		tab: "memory",
		group: "Zvec",
		label: "Zvec Scoping",
		description: "per-project = isolated bank per cwd; global = one shared bank for every project",
		options: [
			{
				value: "per-project",
				label: "Per project",
				description: "Project-local zvec bank derived from the working directory",
			},
			{ value: "global", label: "Global", description: "One shared zvec bank for every project" },
		],
		condition: "zvecActive",
	},
});

export const cfgZvecEmbeddingModel = register({
	id: "zvec.embeddingModel",
	type: "string",
	default: undefined,
	ui: {
		tab: "memory",
		group: "Zvec",
		label: "Zvec Embedding Model",
		description: "Embedding model for new indexes (see `zg help models`). Empty = local/potion-code-16m-v2.",
		condition: "zvecActive",
	},
});

export const cfgZvecAutoRecall = register({
	id: "zvec.autoRecall",
	type: "boolean",
	default: true,
	ui: {
		tab: "memory",
		group: "Zvec",
		label: "Zvec Auto Recall",
		description: "Recall relevant memories into the first turn of each session",
		condition: "zvecActive",
	},
});

export const cfgZvecAutoRetain = register({
	id: "zvec.autoRetain",
	type: "boolean",
	default: true,
	ui: {
		tab: "memory",
		group: "Zvec",
		label: "Zvec Auto Retain",
		description: "Retain completed conversation turns into the zvec bank",
		condition: "zvecActive",
	},
});

export const cfgZvecRetainEveryNTurns = register({ id: "zvec.retainEveryNTurns", type: "number", default: 4 });

export const cfgZvecRecallLimit = register({ id: "zvec.recallLimit", type: "number", default: 8 });

export const cfgZvecRecallContextTurns = register({ id: "zvec.recallContextTurns", type: "number", default: 3 });

export const cfgZvecRecallMaxQueryChars = register({
	id: "zvec.recallMaxQueryChars",
	type: "number",
	default: 4000,
});

export const cfgZvecInjectionTokenLimit = register({
	id: "zvec.injectionTokenLimit",
	type: "number",
	default: 5000,
});

export const cfgZvecDebug = register({ id: "zvec.debug", type: "boolean", default: false });
