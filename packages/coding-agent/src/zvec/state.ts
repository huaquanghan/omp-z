/**
 * Per-session zvec state: first-turn auto-recall, completed-turn auto-retain,
 * and the recall formatting shared with the backend.
 *
 * Subagents get no state of their own — the backend's stateless paths operate
 * on the same file-backed bank, so recall/retain work without aliasing.
 */

import { logger } from "@oh-my-pi/pi-utils";
import { composeRecallQuery, type HindsightMessage, truncateRecallQuery } from "../hindsight/content";
import { extractMessages } from "../hindsight/transcript";
import type { MemoryPromptPreparation } from "../memory-backend/types";
import type { AgentSession } from "../session/agent-session";
import type { AgentSessionEvent } from "../session/agent-session-events";
import type { ZvecBackendConfig } from "./config";
import { ensureZvecBankIndexed, markZvecBankDirty } from "./indexer";
import { zvecBankDir } from "./paths";
import { newZvecMemoryId, stripMemoryFrontmatter, writeZvecMemory } from "./store";
import {
	dedupeZgHits,
	isMissingIndexError,
	memoryIdFromHitPath,
	parseZgQueryOutput,
	type ZgHit,
	zgQuery,
} from "./zg";

const kZvecSessionState = Symbol("zvec.sessionState");

interface AgentSessionWithZvecState extends AgentSession {
	[kZvecSessionState]?: ZvecSessionState;
}

export function getZvecSessionState(session: AgentSession | undefined): ZvecSessionState | undefined {
	return session ? (session as AgentSessionWithZvecState)[kZvecSessionState] : undefined;
}

export function setZvecSessionState(
	session: AgentSession,
	state: ZvecSessionState | undefined,
): ZvecSessionState | undefined {
	const owned = session as AgentSessionWithZvecState;
	const previous = owned[kZvecSessionState];
	if (state) owned[kZvecSessionState] = state;
	else delete owned[kZvecSessionState];
	return previous;
}

const RECALL_ITEM_CHARS = 700;

/** Render hits as the `<memories>` block injected into the system prompt. */
function formatZvecRecallBlock(hits: readonly ZgHit[], bank: string): string | undefined {
	const items: string[] = [];
	for (const hit of dedupeZgHits(hits)) {
		const content = stripMemoryFrontmatter(hit.content.trim());
		if (!content) continue;
		const id = memoryIdFromHitPath(hit.path);
		const label = id ? `[${id}]` : `[${hit.path}]`;
		const clipped = content.length > RECALL_ITEM_CHARS ? `${content.slice(0, RECALL_ITEM_CHARS)}…` : content;
		items.push(`- ${label} ${clipped}`);
	}
	if (items.length === 0) return undefined;
	return [
		"<memories>",
		`Recalled from zvec memory bank \`${bank}\` (hybrid BM25 + vector):`,
		...items,
		"</memories>",
	].join("\n");
}

function sliceUnretainedMessages(messages: readonly HindsightMessage[], lastRetainedTurn: number): HindsightMessage[] {
	let seen = 0;
	for (let index = 0; index < messages.length; index++) {
		if (messages[index].role !== "user") continue;
		seen += 1;
		if (seen > lastRetainedTurn) return messages.slice(index);
	}
	return [];
}

const RETAIN_USER_CHARS = 1500;
const RETAIN_ASSISTANT_CHARS = 800;
const RETAIN_TOTAL_CHARS = 6000;

/** Bounded `User:`/`Assistant:` transcript for one auto-retained turn window. */
function formatRetentionTranscript(messages: readonly HindsightMessage[]): string | undefined {
	const parts: string[] = [];
	let total = 0;
	for (const message of messages) {
		const content = message.content.trim();
		if (!content) continue;
		const cap = message.role === "user" ? RETAIN_USER_CHARS : RETAIN_ASSISTANT_CHARS;
		const clipped = content.length > cap ? `${content.slice(0, cap)}…` : content;
		const part = `${message.role === "user" ? "User" : "Assistant"}: ${clipped}`;
		if (total + part.length > RETAIN_TOTAL_CHARS) break;
		parts.push(part);
		total += part.length;
	}
	return parts.length > 0 ? parts.join("\n\n") : undefined;
}

export interface ZvecSessionStateOptions {
	sessionId: string;
	config: ZvecBackendConfig;
	session: AgentSession;
	agentDir: string;
	hasRecalledForFirstTurn?: boolean;
}

export class ZvecSessionState {
	readonly sessionId: string;
	readonly config: ZvecBackendConfig;
	readonly session: AgentSession;
	readonly agentDir: string;
	hasRecalledForFirstTurn: boolean;
	lastRecallSnippet?: string;
	lastRetainedTurn = 0;
	#unsubscribe?: () => void;
	#lastError?: string;
	#recallGeneration = 0;

	constructor(options: ZvecSessionStateOptions) {
		this.sessionId = options.sessionId;
		this.config = options.config;
		this.session = options.session;
		this.agentDir = options.agentDir;
		this.hasRecalledForFirstTurn = options.hasRecalledForFirstTurn ?? false;
	}

	get bankDir(): string {
		return zvecBankDir(this.agentDir, this.config.bank);
	}

	get lastError(): string | undefined {
		return this.#lastError;
	}

	attachSessionListeners(): void {
		this.#unsubscribe?.();
		this.#unsubscribe = this.session.subscribe((event: AgentSessionEvent) => {
			if (event.type === "agent_start") {
				void this.maybeRecallOnAgentStart().catch(error => {
					logger.warn("Zvec: agent_start recall failed", { error: String(error) });
				});
			} else if (event.type === "agent_end") {
				void this.maybeRetainOnAgentEnd().catch(error => {
					logger.warn("Zvec: agent_end retention failed", { error: String(error) });
				});
			}
		});
	}

	dispose(): void {
		this.#unsubscribe?.();
		this.#unsubscribe = undefined;
	}

	async ensureIndexed(force = false): Promise<void> {
		await ensureZvecBankIndexed({
			agentDir: this.agentDir,
			bank: this.config.bank,
			bankDir: this.bankDir,
			embeddingModel: this.config.embeddingModel,
			force,
			debug: this.config.debug,
		});
	}

	async recallHits(query: string): Promise<ZgHit[]> {
		const trimmed = query.trim();
		if (!trimmed) return [];
		await this.ensureIndexed();
		let result = await zgQuery(this.bankDir, trimmed, this.config.recallLimit);
		if (!result.ok && isMissingIndexError(result)) {
			await this.ensureIndexed(true);
			result = await zgQuery(this.bankDir, trimmed, this.config.recallLimit);
		}
		if (!result.ok) {
			this.#lastError = result.stderr.trim() || `zg query exited with code ${result.code}`;
			if (this.config.debug) logger.debug("Zvec: recall query failed", { error: this.#lastError });
			return [];
		}
		return parseZgQueryOutput(result.stdout);
	}

	async recallBlock(query: string): Promise<string | undefined> {
		const hits = await this.recallHits(query);
		return formatZvecRecallBlock(hits, this.config.bank);
	}

	async beforeAgentStartPrompt(promptText: string): Promise<MemoryPromptPreparation | undefined> {
		if (!this.config.autoRecall || this.hasRecalledForFirstTurn) return undefined;
		const latest = promptText.trim();
		if (!latest) return undefined;
		const generation = ++this.#recallGeneration;
		const history = extractMessages(this.session.sessionManager);
		const query = composeRecallQuery(
			latest,
			[...history, { role: "user", content: latest }],
			this.config.recallContextTurns,
		);
		const context = await this.recallBlock(truncateRecallQuery(query, latest, this.config.recallMaxQueryChars));
		return {
			context,
			commit: () => {
				if (this.#recallGeneration !== generation) return false;
				this.hasRecalledForFirstTurn = true;
				if (context) this.lastRecallSnippet = context;
				return true;
			},
		};
	}

	async maybeRecallOnAgentStart(): Promise<void> {
		if (!this.config.autoRecall || this.hasRecalledForFirstTurn) return;
		const messages = extractMessages(this.session.sessionManager);
		const lastUser = messages.findLast(message => message.role === "user");
		if (!lastUser) return;
		const query = composeRecallQuery(lastUser.content, messages, this.config.recallContextTurns);
		const context = await this.recallBlock(
			truncateRecallQuery(query, lastUser.content, this.config.recallMaxQueryChars),
		);
		this.hasRecalledForFirstTurn = true;
		if (!context) return;
		this.lastRecallSnippet = context;
		try {
			await this.session.refreshBaseSystemPrompt();
		} catch (error) {
			if (this.config.debug) logger.debug("Zvec: prompt refresh after recall failed", { error: String(error) });
		}
	}

	async maybeRetainOnAgentEnd(): Promise<void> {
		if (!this.config.autoRetain) return;
		const messages = extractMessages(this.session.sessionManager);
		const userTurns = messages.filter(message => message.role === "user").length;
		if (userTurns - this.lastRetainedTurn < this.config.retainEveryNTurns) return;
		await this.retainMessages(sliceUnretainedMessages(messages, this.lastRetainedTurn), userTurns);
	}

	async forceRetainCurrentSession(): Promise<void> {
		const messages = extractMessages(this.session.sessionManager);
		const userTurns = messages.filter(message => message.role === "user").length;
		await this.retainMessages(sliceUnretainedMessages(messages, this.lastRetainedTurn), userTurns);
	}

	async retainMessages(messages: readonly HindsightMessage[], userTurns: number): Promise<void> {
		const transcript = formatRetentionTranscript(messages);
		if (!transcript) return;
		await this.saveMemory({
			content: transcript,
			source: "coding-agent-transcript",
			importance: 0.65,
			context: `session ${this.sessionId}, through user turn ${userTurns}`,
		});
		this.lastRetainedTurn = Math.max(this.lastRetainedTurn, userTurns);
	}

	async saveMemory(input: {
		content: string;
		source?: string;
		importance?: number;
		context?: string;
	}): Promise<string | undefined> {
		const content = input.content.trim();
		if (!content) return undefined;
		const id = newZvecMemoryId();
		try {
			await writeZvecMemory(this.agentDir, this.config.bank, {
				id,
				content,
				created: new Date().toISOString(),
				source: input.source ?? "coding-agent-retain",
				session: this.sessionId,
				importance: input.importance,
				context: input.context,
			});
		} catch (error) {
			this.#lastError = String(error);
			logger.warn("Zvec: memory write failed", { error: String(error) });
			return undefined;
		}
		markZvecBankDirty(this.bankDir);
		void this.ensureIndexed().catch(() => {});
		return id;
	}
}
