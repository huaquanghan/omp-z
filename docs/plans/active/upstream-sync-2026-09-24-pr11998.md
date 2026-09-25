# Sync upstream/main into fork — 1 PR (upstream PR #11998, passive tool context)

**Status: PLANNED — awaiting go-ahead.** Verified 2026-09-24 (fresh fetch):
`upstream/main` moved +4 commits; fork is **43 ahead / 4 behind**.
`git merge-tree` predicts a clean merge — the 1 PR is a merge-commit sync
PR on the fork.

## Fork ↔ upstream status (verified 2026-09-24, post-fetch)

- `upstream/main` = `5fccbd0dee` — merge of upstream PR #11998
  (`rebase-8363`), 4 commits past `v18.3.0` (`62bc57be1b`).
- local `main` = `origin/main` = `0a39f88659` — **43 ahead / 4 behind**;
  merge-base = `62bc57be1b` (previous upstream HEAD, already merged).
- Both sides `packages/*` version `18.3.0`; upstream changelog entry sits
  under `[Unreleased]` → post-release work, **no version bump, no new
  `pi-natives` prebuilts** (delta touches no `crates/`, `packages/natives/`).
- Latest tags: upstream `v18.3.0`, fork `ompz-v18.3.0` (released
  2026-09-24T04:38Z, tag on `0a39f88659`).
- `check-upstream.sh` reports "up to date" — it compares tags only; this
  delta is post-tag main commits (same pattern as the 09-23 1-commit sync).
- `gh` authenticated as `huaquanghan` (repo scope); **zero open PRs** on the
  fork; `origin` + `upstream` remotes OK.
- Worktree: clean except untracked plan docs (this file joins the
  housekeeping PR's list).

## What the 4 commits bring (upstream PR #11998, port of #8363)

One feature: **passive tool-call `additionalContext`**. Trusted
handler-authored context (`beforeToolCall` return value,
`AgentToolContext.addAdditionalContext`, `tool_call` handler results) is
injected as a developer message after settled tool results, before the next
provider request; untrusted tool output stays in the ordinary tool result.

| Commit | Surface |
| --- | --- |
| `45cef58d85` feat(extensions): support passive tool-call additionalContext (#8363) | new `packages/agent/src/tool-context.ts`; `agent-loop.ts`/`agent.ts`/`types.ts`; extension + hook wrappers; Cursor bridge; docs (`extensions.md`, `hooks.md`, `authoring-hooks.md`); ~1,000 lines of tests |
| `f00801f31f` fix(agent): route passive context via ToolCallContext, gate on success | loop-owned `addAdditionalContext` sink; context dropped when the call's final result is an error (approval denials no longer leak); Cursor-bridge injection incl. provider-error path |
| `41a17708aa` fix(agent): order tool-reported passive context before hook context | ordering fix on every path |
| `5fccbd0dee` Merge PR #11998 | — |

27 files, +1361/−85. Risk to fork: **low** — agent-loop/extension plumbing
only, none of it fork-patched.

## Overlap analysis — clean

- `git merge-tree --write-tree --name-only main upstream/main` → exit 0, no
  conflicted paths.
- Both-sides-touched intersection since merge-base:
  **`packages/coding-agent/CHANGELOG.md` only** — different hunks,
  auto-merges.
- Zero zvec patch-surface hits: nothing in `src/zvec/`, `memory-backend/*`,
  `internal-urls/memory-protocol.ts`, `tools/memory-*`, `tools/index.ts`,
  `learn.ts`, `settings-schema.ts`, `session/session-advisors.ts`,
  `update-cli.ts`, `compile-binary.ts`, root `README.md`, `docs/memory.md`.
- Upstream does touch `src/tools/context.ts` and `session/agent-session.ts`
  — fork has NOT modified either since merge-base (intersection verified).
- No `.github/` changes in the delta → fork CI (`pull_request` paths cover
  `packages/**`) will run normally on the PR.

## The 1 PR — `sync/upstream-2026-09-24` → `huaquanghan/omp-z:main`

1. `git checkout -b sync/upstream-2026-09-24 main` (at `0a39f88659`)
2. `git merge upstream/main` — clean per merge-tree; expected commit
   `Merge remote-tracking branch 'upstream/main'`
3. Verify on the branch:
   - `bun --cwd packages/coding-agent run test test/zvec-backend.test.ts`
   - `bun --cwd packages/agent test test/agent-loop.test.ts test/agent.test.ts`
     (upstream's new coverage for the feature)
   - `OMP_NO_BYTECODE=1 CROSS_TARGET=linux-x64 bun --cwd packages/coding-agent run build`
   - `dist/omp-linux-x64 --version` shows `18.3.0`;
     `strings dist/omp-linux-x64 | grep -c zvec` > 0
4. `git push -u origin sync/upstream-2026-09-24`
5. `gh pr create -R huaquanghan/omp-z --base main` — preserve template
   sections (What / Why / Testing + checklist); Testing lists step-3
   results. CONTRIBUTING.md author sentence supplied by the user at PR
   time. CHANGELOG attribution N/A — upstream commits carry their own
   credits (`[Unreleased]` entry already attributes #11998 / @H4vC).
6. **Land with a MERGE commit — never squash/rebase.** Squashing discards
   upstream ancestry → every future sync loses its merge-base and
   re-conflicts (locked rule from `ompz-update-channel.md`; `ompz-upstream`
   skill: never rebase).

## Post-land (optional, separate decision)

- Respin release `ompz-v18.3.0-1`: `scripts/ompz/build.sh --all` (6 targets
  + `SHA256SUMS.txt`) → tag `ompz-v18.3.0-1` → `gh release create` — matches
  the `ompz-v18.2.11-1/-2` convention for post-release syncs. Skippable:
  delta is additive extension-API surface, no fork-facing fix; upstream
  itself has not released it.
- `OMPZ.md` pin bump lands as its own post-release commit per convention.

## Edge cases / non-goals

- If `upstream/main` moves again before landing: `git merge upstream/main`
  on the same branch again — still one PR.
- The housekeeping docs PR (`sync-housekeeping-2026-09-24.md`) and the
  upstream `$name`-alias PR (`upstream-pr-skill-dollar-2026-09-24.md`) stay
  separate — not part of this PR.
- No rebase, no force-push, no upstream tag edits (skill security policy).
