import { beforeAll, describe, expect, it } from "bun:test";
import { StatusLineComponent } from "../src/status-line/component";
import type { StatusLineHost, StatusLineSession } from "../src/status-line/host";
import { getPreset } from "../src/status-line/presets";
import { getSeparator } from "../src/status-line/separators";
import { initTheme, theme } from "../src/theme";

beforeAll(async () => {
	await initTheme();
});

const stubSession = {
	state: { model: { id: "test-model", contextWindow: 200_000 }, messages: [] },
	messages: [],
	isStreaming: false,
	isAutoThinking: false,
	sessionManager: {
		getSessionName: () => undefined,
		getSessionId: () => "test",
		getUsageStatistics: () => ({
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
		}),
	},
	modelRegistry: { isUsingOAuth: () => false },
	getContextUsage: () => undefined,
	autoResolvedThinkingLevel: () => undefined,
	isFastModeActive: () => false,
	getAsyncJobSnapshot: () => ({ running: [] }),
	getGoalModeState: () => undefined,
} as unknown as StatusLineSession;

const stubHost: StatusLineHost = {
	getSettings: () => ({}),
	gitEnabled: () => false,
	codexResetFireworksEnabled: () => false,
	getSettingsRevision: () => 0,
	getSessionSettingsIdentity: () => undefined,
	getSessionSettingsRevision: () => 0,
	goalStatusInFooter: () => false,
	activeAccount: () => undefined,
	canFetchUsageReports: () => false,
	fetchUsageReports: () => Promise.resolve(null),
	resolveActiveRepo: () => null,
	lookupPullRequest: () => Promise.resolve({ stdout: "", exitCode: 1 }),
	calculateTokensPerSecond: () => null,
	limitMatchesActiveAccount: () => false,
	computeCompactionBoundaries: () => null,
};

describe("ompz status line preset", () => {
	it("declares the slim single-line segments and options", () => {
		const preset = getPreset("ompz");
		expect(preset.leftSegments).toEqual(["pi", "model", "context_bar", "token_rate", "git"]);
		expect(preset.rightSegments).toEqual([]);
		expect(preset.separator).toBe("dot");
		expect(preset.transparent).toBe(true);
		expect(preset.contextLine).toBe("off");
		expect(preset.sessionAccent).toBe(false);
	});

	it("resolves the dot separator to a middle dot", () => {
		expect(getSeparator("dot", theme)).toEqual({ left: "·", right: "·" });
	});

	it("applies preset-owned defaults unless the caller overrides them", () => {
		const component = new StatusLineComponent(stubSession, stubHost);
		try {
			component.updateSettings({ preset: "ompz" });
			const effective = component.getEffectiveSettingsForTest();
			expect(effective.separator).toBe("dot");
			expect(effective.transparent).toBe(true);
			expect(effective.contextLine).toBe("off");
			expect(effective.sessionAccent).toBe(false);
			expect(effective.segmentOptions.token_rate?.unit).toBe("tpm");

			// Explicit caller settings still win over preset fields.
			component.updateSettings({ preset: "ompz", transparent: false, separator: "pipe", contextLine: "annotated" });
			const overridden = component.getEffectiveSettingsForTest();
			expect(overridden.transparent).toBe(false);
			expect(overridden.separator).toBe("pipe");
			expect(overridden.contextLine).toBe("annotated");
		} finally {
			component.dispose();
		}
	});

	it("keeps other presets untouched by ompz defaults", () => {
		const component = new StatusLineComponent(stubSession, stubHost);
		try {
			component.updateSettings({ preset: "default" });
			const effective = component.getEffectiveSettingsForTest();
			expect(effective.separator).toBe("powerline-thin");
			expect(effective.transparent).toBeUndefined();
			expect(effective.contextLine).toBeUndefined();
			expect(effective.sessionAccent).toBeUndefined();
		} finally {
			component.dispose();
		}
	});
});
