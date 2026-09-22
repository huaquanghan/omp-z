# Spec: `$name` skill invocation alias (Codex-style)

Status: locked
Slug: `skill-dollar-invocation`
Goal: invoke a skill from the composer with `$name` — fewer keystrokes than `/skill:name`, matching Codex CLI muscle memory. `/skill:name` keeps working everywhere.

## Decisions

1. **Alias, not replace.** Both `$name` and `/skill:name` invoke skills. `/skill:` stays canonical: ACP advertises `skill:<name>` commands, chips expand to `/skill:<name>`, docs/tests remain valid.
2. **Token grammar**: `(^|\s)\$([A-Za-z_][\w-]*(?:\.[\w-]+)*)(?=\s|$)` — glued `$name`, name starts alpha/underscore so `$5`, `$100`, `$HOME` never even parse as candidates.
3. **Exclusions (never skill tokens)**: `$$x`, `${x}`, `$ x`/`$$ x`/`$\tx` (Python-exec sigil, `pythonCommandPrefixLength`), `$` alone. Inside drafts starting with `!`, `$ `-form python, or a non-skill `/cmd`, mid-prompt `$name` is inert — same gate as today via `allowsSkillTokens`.
4. **Invocation still requires a registered skill.** Parse finds a candidate; dispatch fires only when `skillCommands` has `skill:<name>` (`isKnownSkillCommand`). Prose `$var` stays prose.
5. **Same semantics as `/skill:`**: leading `$name args` → name + args; mid-prompt `prose $name prose` → surrounding prose becomes `args`. Steer/followUp/compaction-queue/loop-mode paths inherit via `parseSkillInvocation`.
6. **Chips**: completed `$name` tokens collapse to the `✦ name` chip; chip expansion stays canonical `/skill:<name>` (`skillToken()` unchanged).
7. **Autocomplete**: `$` at token start (line start or after whitespace) opens a skills-only popup; acceptance inserts `$name `, which chip-collapses like today.
8. **Gate**: reuse `skills.enableSkillCommands` (alias is part of the same feature; no new setting in v1).
9. **Unchanged**: `skill://` URLs, `skill:<name>` internal IDs (skillCommands map, usage stats, extension dashboard), `buildSkillPromptMessage`, ACP advertised command names.

## Touch points

| Area | File | Change |
|---|---|---|
| Token regex | `packages/tui/src/prompt/skill-tokens.ts` | Add `SKILL_DOLLAR_TOKEN_RE`; keep `allowsSkillTokens` (local-exec gate already excludes `$ ` forms); doc update |
| Parser | `packages/coding-agent/src/extensibility/skills.ts` | `parseSkillInvocation`: leading `$name` check before `allowsSkillTokens` gate (mirrors `/skill:`), mid-prompt scan tries both regexes |
| Dispatch | `packages/coding-agent/src/modes/controllers/input-controller.ts` | None expected — skill check (L1033) already precedes python check (L1075); verify `$name` doesn't enter `isPythonMode` |
| Chip collapse | `packages/tui/src/prompt/composer-attachments.ts`, `custom-editor.ts` | `collapseSkillTokens`/`#collapseSkillTokens` scan `$` tokens too; `includes("$")` guard alongside `"/skill:"` |
| Autocomplete | `packages/tui/src/autocomplete.ts` | `findTrailingDollarSkillStart` helper; `$` branch in `getSuggestions` before `@`/path fallthrough; `applyCompletion` dollar branch inserting `$name ` |
| Editor triggers | `packages/tui/src/components/editor.ts` | `$` char auto-trigger (whitespace/start-anchored, like `@`/`^`); dollar-context retrigger in backspace/type paths; staleness guard `$` prefix branch in `#autocompletePrefixMatchesCursorText` |
| ACP/RPC | `acp-agent.ts`, `rpc-mode.ts` | Free via `parseSkillInvocation`; advertised commands stay `skill:<name>` |
| Docs | `docs/skills.md`, `docs/slash-command-internals.md` | Document `$name` alias |
| Tests | `skills.test.ts`, `autocomplete.test.ts`, `editor-autocomplete-actions.test.ts`, `custom-editor.test.ts`, `image-references.test.ts` | New `$` cases + exclusions |

## Edge cases (locked)

- `$5`, `$100`, `$HOME`, `$var` → never candidates (alpha-start regex); even `[a-z]` prose only invokes on exact registered name.
- Skill names starting with a digit are unreachable via `$` — `/skill:` covers them.
- `$ code`/`$$ code`/`${x}` → python/prose, never skill. Dispatch order (skill L1033 < python L1075) plus whitespace-gated python sigil keeps this unambiguous.
- Mid-prompt `$name` inside `/cmd`, `!cmd`, `$ code` drafts → blocked by `allowsSkillTokens`/`startsWithLocalExecutionPrefix`.
- Chip expansion submits `/skill:<name>` regardless of which alias was typed — transcript canonical form stays stable.

## Out of scope

- Removing `/skill:` syntax; configurable sigil setting; renaming `skill:` internal IDs or `skill://` URLs; vim `$` motion (unrelated).

## Verify

- `bun test` on touched test files (tui + coding-agent skills tests).
- Manual: `omp` TUI — `$name` leading + mid-prompt invokes; `$ code` still python; `$$ code` excluded-context python; popup on `$` lists skills only; chip collapse works; `/skill:name` unchanged.

---

# Plan

## Phase 1 — Token grammar + parser (core)

`$name` becomes a parseable skill invocation end-to-end (submit path works before any UI sugar).

- [x] `packages/tui/src/prompt/skill-tokens.ts`: add `SKILL_DOLLAR_TOKEN_RE = /(^|\s)\$([A-Za-z_][\w-]*(?:\.[\w-]+)*)(?=\s|$)/g`; doc that `allowsSkillTokens`/`startsWithLocalExecutionPrefix` already exclude `$ `/`$$ `/`${` leading drafts.
- [x] `packages/coding-agent/src/extensibility/skills.ts`: `parseSkillInvocation` — (a) leading-form check for `$name` placed before the `allowsSkillTokens` gate, mirroring the `/skill:` branch; (b) mid-prompt scan runs `SKILL_DOLLAR_TOKEN_RE` alongside `SKILL_TOKEN_RE` (first match by position wins; do not let a later `/skill:` hide an earlier `$name` or vice versa — pick lowest `match.index`, tie-break whichever scanned).
- [x] Verify dispatch ordering: `input-controller.ts` skill gate (L1033) precedes python gate (L1075); `parsePythonCommandInput("$name")` returns undefined (no whitespace after sigil) — add a comment-free assertion via test, not code.
- [x] Tests `packages/coding-agent/test/skills.test.ts`: `$name`, `$name args`, mid-prompt `fix it $name now`; negatives — `$ code`, `$$ code`, `${X}`, `$5`, `$name` inside `/cmd`, `!cmd`, `$ code` drafts; unknown `$name` parses but fails `isKnownSkillCommand`.

Check: `bun test packages/coding-agent/test/skills.test.ts`

## Phase 2 — Chip collapse (display)

`$name` renders as `✦ name` chip like `/skill:name`.

- [x] `packages/tui/src/prompt/composer-attachments.ts`: `collapseSkillTokens` — run both regexes (or a combined scan), same `isKnown` gate; expansion stays `skillToken(name)` = `/skill:<name>`.
- [x] `packages/tui/src/prompt/custom-editor.ts` `#collapseSkillTokens`: scan lines containing `$` too (guard `includes("$")`); same end-of-line/last-line "incomplete token" rule as the `/skill:` loop.
- [x] Tests: `custom-editor.test.ts` (typed `$name ` snaps to chip; `$nope ` stays literal; `$HOME ` stays literal), `image-references.test.ts` if `collapseSkillTokens` cases exist there.

Check: `bun test packages/tui/test/custom-editor.test.ts packages/tui/test/image-references.test.ts`

## Phase 3 — Autocomplete + editor triggers

`$` at token start opens a skills-only popup; acceptance inserts `$name `.

- [x] `packages/tui/src/autocomplete.ts`: `findTrailingDollarSkillStart(text)` helper (`(?:^|\s)\$([\w-]*)$`, exclude `$$`/`${`); `$` branch in `getSuggestions` before `@`/path fallthrough returning skill items only; `applyCompletion` dollar branch replacing the `$token` span with `$name `.
- [x] `packages/tui/src/components/editor.ts`: auto-trigger on typed `$` when at line start or after whitespace (mirror `@`/`^` blocks ~L2780-2796); retrigger contexts in backspace/type paths (mirror MENTION_CONTEXT_RE sites ~L3118, L3291, L3630); `$`-prefix staleness branch in `#autocompletePrefixMatchesCursorText`.
- [x] Tests: `autocomplete.test.ts`, `editor-autocomplete-actions.test.ts` — popup items on bare `$`, `$par` filtering, accept inserts `$name `, `$ code`/`$5`/`${` produce no popup items.

Check: `bun test packages/tui/test/autocomplete.test.ts packages/tui/test/editor-autocomplete-actions.test.ts`

## Phase 4 — Docs + repo gate

- [x] `docs/skills.md`, `docs/slash-command-internals.md`: document the `$name` alias + exclusions table.
- [x] `bun run check` (oxlint + oxfmt + tsgo) clean on touched packages.

## Waves

- **Wave 1**: Phase 1 (parser is the single source of truth; everything else builds on it).
- **Wave 2**: Phases 2 + 3 in parallel — disjoint files (`prompt/` vs `autocomplete.ts`/`components/editor.ts`).
- **Wave 3**: Phase 4.

## Risks / watch items

- Mid-prompt regex ordering in Phase 1: two regexes scanning one string — must pick earliest token deterministically.
- `collapseSkillTokens` receives `isKnown` keyed on bare name — dollar path uses identical gate, no signature change.
- Upstream merge surface: `autocomplete.ts`/`editor.ts` are upstream-active files; keep `$` diffs small and self-contained (new helper functions, new branch blocks) to ease `ompz-upstream` merges.
