import { beforeAll, describe, expect, it } from "bun:test";
import type { SegmentContext } from "../src/status-line/segments";
import { renderSegment } from "../src/status-line/segments";
import type { StatusLineSegmentOptions } from "../src/status-line/types";
import { initTheme, theme } from "../src/theme";

beforeAll(async () => {
	await initTheme();
});

function createContext(tokensPerSecond: number | null, options: StatusLineSegmentOptions = {}): SegmentContext {
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
			tokensPerSecond,
		},
		contextPercent: 0,
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

describe("status line token_rate segment", () => {
	it("renders tok/s by default", () => {
		const rendered = renderSegment("token_rate", createContext(87.3));
		expect(Bun.stripANSI(rendered.content)).toBe(`${theme.icon.throughput} 87.3 tok/s`.trim());
	});

	it("renders tokens per minute with the slim k-format when unit is tpm", () => {
		// 87.3 tok/s * 60 = 5238 tpm → "5.2k tpm"
		const ctx = createContext(87.3, { token_rate: { unit: "tpm" } });
		expect(Bun.stripANSI(renderSegment("token_rate", ctx).content)).toBe(`${theme.icon.throughput} 5.2k tpm`.trim());
	});

	it("formats tpm edges like slim: raw below 1k, one decimal below 10k, whole above", () => {
		const tpm = (tps: number) =>
			Bun.stripANSI(renderSegment("token_rate", createContext(tps, { token_rate: { unit: "tpm" } })).content);
		expect(tpm(10)).toContain("600 tpm"); // 600 < 1k → raw
		expect(tpm(25)).toContain("1.5k tpm"); // 1500 → 1.5k
		expect(tpm(200)).toContain("12k tpm"); // 12000 → 12k
	});

	it("hides when no rate is available", () => {
		expect(renderSegment("token_rate", createContext(null))).toEqual({ content: "", visible: false });
	});

	it("splits icon and value colors when iconColor/valueColor are set", () => {
		const ctx = createContext(87.3, {
			token_rate: { unit: "tpm", icon: "ϟ", iconColor: 93, valueColor: 247 },
		});
		expect(renderSegment("token_rate", ctx).content).toBe(`\x1b[38;5;93mϟ\x1b[39m \x1b[38;5;247m5.2k tpm\x1b[39m`);
	});

	it("honors a theme-role valueColor", () => {
		const ctx = createContext(87.3, { token_rate: { valueColor: "warning" } });
		const rendered = renderSegment("token_rate", ctx).content;
		expect(rendered).toContain(`${theme.getFgAnsi("warning")}87.3 tok/s`);
	});

	it("drops the icon when icon is an empty string", () => {
		const ctx = createContext(87.3, { token_rate: { icon: "", valueColor: 247 } });
		expect(renderSegment("token_rate", ctx).content).toBe(`\x1b[38;5;247m87.3 tok/s\x1b[39m`);
	});
});
