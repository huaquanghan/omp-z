import type { StatusLineHost, StatusLineSession } from "@oh-my-pi/pi-tui/status-line/host";
import type { StatusLineSettings } from "@oh-my-pi/pi-tui/status-line/types";
import { settings } from "../config/settings";
import type { SettingPath, SettingValue } from "../config/settings-schema";
import type { AgentSession } from "../session/agent-session";
import { getSessionCompactionBoundaries } from "../session/context-usage-runtime";
import { limitMatchesActiveAccount } from "../slash-commands/helpers/active-oauth-account";
import { resolveActiveRepoContextSync } from "../utils/active-repo-context";
import { GH_COMMAND_TIMEOUT_MS, github } from "../utils/github";
import { calculateTokensPerSecond } from "../utils/token-rate";

/**
 * Session capabilities the host consults beyond the display subset. Every
 * field is optional so display-only sessions (collab guest replicas, test
 * fixtures) still render; a live `AgentSession` satisfies it structurally.
 */
export type StatusLineHostSession = StatusLineSession &
	Partial<Pick<AgentSession, "settings" | "modelRegistry" | "sessionId" | "fetchUsageReports">>;

/**
 * Read `statusLine.*` only when explicitly configured; unconfigured fields
 * come back `undefined` so the active preset's own defaults can apply.
 */
function configured<P extends SettingPath>(path: P): SettingValue<P> | undefined {
	return settings.isConfigured(path) ? settings.get(path) : undefined;
}

/**
 * Live status-line settings for {@link StatusLineComponent.updateSettings}.
 * Fields a preset may own (`separator`, `transparent`, `contextLine`,
 * `sessionAccent`) are gated on {@link settings.isConfigured} — a resolved
 * schema default would otherwise mask the preset's value forever.
 */
export function readStatusLineSettings(): StatusLineSettings {
	return {
		preset: settings.get("statusLine.preset"),
		leftSegments: settings.get("statusLine.leftSegments"),
		rightSegments: settings.get("statusLine.rightSegments"),
		separator: configured("statusLine.separator"),
		showHookStatus: settings.get("statusLine.showHookStatus"),
		segmentOptions: settings.getGroup("statusLine").segmentOptions,
		sessionAccent: configured("statusLine.sessionAccent"),
		transparent: configured("statusLine.transparent"),
		compactThinkingLevel: settings.get("statusLine.compactThinkingLevel"),
		contextLine: configured("statusLine.contextLine"),
	};
}

/** Application policy and runtime services consumed by the portable status renderer. */
export const statusLineHost: StatusLineHost<StatusLineHostSession> = {
	getSettings: () => readStatusLineSettings(),
	gitEnabled: () => settings.get("git.enabled"),
	codexResetFireworksEnabled: () => settings.get("tui.codexResetFireworks"),
	getSettingsRevision: () => settings.revision,
	getSessionSettingsIdentity: session => session.settings,
	getSessionSettingsRevision: session => session.settings?.revision ?? 0,
	goalStatusInFooter: session => (session.settings ?? settings).get("goal.statusInFooter"),
	activeAccount: (session, provider) =>
		session.modelRegistry?.authStorage?.getOAuthAccountIdentity(provider, session.sessionId),
	canFetchUsageReports: session => typeof session.fetchUsageReports === "function",
	fetchUsageReports: (session, signal) => session.fetchUsageReports?.(signal) ?? Promise.resolve(null),
	resolveActiveRepo: resolveActiveRepoContextSync,
	lookupPullRequest: cwd =>
		github.run(cwd, ["pr", "view", "--json", "number,url"], AbortSignal.timeout(GH_COMMAND_TIMEOUT_MS)),
	calculateTokensPerSecond,
	limitMatchesActiveAccount,
	computeCompactionBoundaries: (session, contextWindow, model) => {
		const source = session.settings;
		return getSessionCompactionBoundaries(
			typeof source?.getGroup === "function" ? source : settings,
			contextWindow,
			model,
		);
	},
};
