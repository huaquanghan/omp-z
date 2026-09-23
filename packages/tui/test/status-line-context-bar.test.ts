import { beforeAll, describe, expect, it } from "bun:test";
import type { SegmentContext } from "../src/status-line/segments";
import { renderSegment } from "../src/status-line/segments";
import type { StatusLineSegmentOptions } from "../src/status-line/types";
import { initTheme, theme } from "../src/theme";

beforeAll(async () => {
	await initTheme();
});

function createContext(contextPercent: number | null, options: StatusLineSegmentOptions = {}): SegmentContext {
	return {
		session: {
			state: { model: { id: "test-model" } },
			isFastModeActive: () => false,
			isAutoThinking: false,
			autoResolvedThinkingLevel: () => undefined,
		} as unknown as SegmentContext["session"],
		width: 120,
		compactThinkingLevel: false,
		options,
		planMode: null,
		loopMode: null,
		prewalk: null,
		goalMode: null,
		vibeMode: null,
		vim: null,
		collab: null,
		stream: null,
		recording: false,
		usageStats: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			orchestrationInput: 0,
			orchestrationOutput: 0,
			orchestrationCacheRead: 0,
			premiumRequests: 0,
			cost: 0,
			tokensPerSecond: null,
		},
		contextPercent,
		contextTokens: 0,
		contextWindow: 200_000,
		autoCompactEnabled: false,
		compactionSpeculation: "idle",
		speculationBlinkOn: true,
		subagentCount: 0,
		activeMs: 0,
		turnElapsedMs: null,
		activeRepo: null,
		worktree: null,
		git: { branch: null, status: null, pr: null },
		usage: null,
	};
}

describe("status line context_bar segment", () => {
	it("renders an 8-cell bar plus the rounded percent", () => {
		expect(Bun.stripANSI(renderSegment("context_bar", createContext(47)).content)).toBe("━━━───── 47%");
		expect(Bun.stripANSI(renderSegment("context_bar", createContext(0)).content)).toBe("──────── 0%");
		expect(Bun.stripANSI(renderSegment("context_bar", createContext(100)).content)).toBe("━━━━━━━━ 100%");
	});

	it("clamps the bar at full while the label reports the raw percent", () => {
		expect(Bun.stripANSI(renderSegment("context_bar", createContext(120)).content)).toBe("━━━━━━━━ 120%");
	});

	it("renders an empty bar with a ? label when the percent is unknown", () => {
		expect(Bun.stripANSI(renderSegment("context_bar", createContext(null)).content)).toBe("──────── ?%");
	});

	it("honors a custom bar width", () => {
		const ctx = createContext(50, { context_bar: { width: 4 } });
		expect(Bun.stripANSI(renderSegment("context_bar", ctx).content)).toBe("━━── 50%");
	});

	it("renders the startup placeholder instead of the bar", () => {
		const ctx = { ...createContext(47), startupPlaceholder: true };
		expect(Bun.stripANSI(renderSegment("context_bar", ctx).content)).toBe("…");
	});

	it("pins a 256-palette color when `color` is a number", () => {
		const ctx = createContext(47, { context_bar: { color: 39 } });
		expect(renderSegment("context_bar", ctx).content).toBe(`\x1b[38;5;39m━━━───── 47%\x1b[39m`);
	});

	it("pins a theme role when `color` names one", () => {
		const ctx = createContext(47, { context_bar: { color: "error" } });
		expect(renderSegment("context_bar", ctx).content).toBe(theme.fg("error", "━━━───── 47%"));
	});

	it("uses the context threshold colors when no color is pinned", () => {
		// 60% of 200k hits the warning level (purple starts at 70%).
		const ctx = createContext(60);
		expect(renderSegment("context_bar", ctx).content).toBe(theme.fg("warning", "━━━━──── 60%"));
	});

	it("falls back to the threshold color on an invalid color value", () => {
		const ctx = createContext(60, { context_bar: { color: "not-a-color" } });
		expect(renderSegment("context_bar", ctx).content).toBe(theme.fg("warning", "━━━━──── 60%"));
	});
});
