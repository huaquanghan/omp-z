/**
 * One `/skill:<name>` token delimited by whitespace or line edges. Group 1 is
 * the leading delimiter (empty at line start), group 2 the bare skill name.
 * Global so callers can walk every token; reset `lastIndex` before reuse.
 */
export const SKILL_TOKEN_RE = /(^|\s)\/skill:([^\s/]+)(?=\s|$)/g;

/**
 * One `$<name>` skill token (Codex-style alias for `/skill:<name>`), delimited
 * by whitespace or line edges. The name must start with a letter or underscore
 * so prose like `$5`, `$100`, or `${VAR}` never parses as a candidate, and the
 * glued form keeps the Python-exec sigils (`$ `, `$$ `, `$\t`) untouched —
 * those require whitespace after `$`, which this token never has. Group 1 is
 * the leading delimiter (empty at line start), group 2 the bare skill name.
 * Global so callers can walk every token; reset `lastIndex` before reuse.
 */
export const SKILL_DOLLAR_TOKEN_RE = /(^|\s)\$([A-Za-z_][\w-]*(?:\.[\w-]+)*)(?=\s|$)/g;

/**
 * Yield every skill token (`/skill:<name>` or `$<name>`) in `text`, earliest
 * first. Both regexes share the same group shape — group 1 is the leading
 * delimiter (empty at line start), group 2 the bare skill name — so consumers
 * can treat matches uniformly. Resets both `lastIndex` cursors up front.
 */
export function* iterSkillTokens(text: string): Generator<RegExpExecArray> {
	SKILL_TOKEN_RE.lastIndex = 0;
	SKILL_DOLLAR_TOKEN_RE.lastIndex = 0;
	let slash = SKILL_TOKEN_RE.exec(text);
	let dollar = SKILL_DOLLAR_TOKEN_RE.exec(text);
	while (slash || dollar) {
		if (slash && (!dollar || slash.index <= dollar.index)) {
			yield slash;
			slash = SKILL_TOKEN_RE.exec(text);
		} else if (dollar) {
			yield dollar;
			dollar = SKILL_DOLLAR_TOKEN_RE.exec(text);
		}
	}
}

/**
 * Whether the (already left-trimmed) draft begins with a TUI local-execution
 * sigil that downstream branches consume verbatim.
 */
function startsWithLocalExecutionPrefix(trimmedStart: string): boolean {
	if (trimmedStart.startsWith("!")) return true;
	if (trimmedStart.charCodeAt(0) !== 36 /* $ */) return false;
	if (trimmedStart.charCodeAt(1) === 123 /* { */) return false;
	const sigilLength = trimmedStart.charCodeAt(1) === 36 /* $ */ ? 2 : 1;
	const next = trimmedStart.charCodeAt(sigilLength);
	if (Number.isNaN(next)) return true;
	return next === 32 /* space */ || next === 9 /* tab */ || next === 10 /* LF */ || next === 13; /* CR */
}

/**
 * Whether `/skill:<name>` tokens in `text` are invocations rather than content
 * belonging to another slash command or local-execution sigil.
 */
export function allowsSkillTokens(text: string): boolean {
	const trimmedStart = text.trimStart();
	if (trimmedStart.startsWith("/skill:")) return true;
	if (trimmedStart.startsWith("/")) return false;
	return !startsWithLocalExecutionPrefix(trimmedStart);
}

/** Whether model mentions may collapse in this draft; local execution consumes its body verbatim. */
export function allowsModelMentions(text: string): boolean {
	return !startsWithLocalExecutionPrefix(text.trimStart());
}
