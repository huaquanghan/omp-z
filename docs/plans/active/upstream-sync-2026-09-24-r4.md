# Sync upstream/main into fork — 1 PR (post-v18.3.0, 121 commits → `9fcb989e25`)

**Status: PLANNED — awaiting go-ahead.** Verified 2026-09-24 against a fresh
fetch. Supersedes `upstream-sync-2026-09-24-r3.md` — upstream moved from
`b6b3430b38` (16 commits) through `ef1ea204bc` to `9fcb989e25` (121 commits
past the v18.3.0 merge-base). **A merge is already in progress**: the r3
session ran `git merge` when upstream HEAD was `ef1ea204bc`, resolved every
conflict, and staged the result — but never committed. This plan keeps that
work and lands the whole sync as **one PR containing two merge commits**.

## Fork ↔ upstream status (verified post-fetch)

- `upstream/main` = `9fcb989e25`, **121 commits** past merge-base
  `62bc57be1b` (v18.3.0, already in our tree via `663ac2a00c`).
- local `main` = `origin/main` = `0a39f88659` — **43 ahead / 121 behind**.
- `.git/MERGE_HEAD` = `ef1ea204bc` (upstream HEAD at merge start, "Merge PR
  #13092"). `git ls-files -u` = 0 → all conflicts resolved and staged;
  `git write-tree` = `e4004b31db`. The staged merge covers the first ~18
  upstream commits; **103 remain**.
- Upstream latest tag still `v18.3.0`; both sides version `18.3.0` →
  **no version bump**. `ompz-v18.3.0` release already published on
  `0a39f88659`.
- `check-upstream.sh` reports "up to date" — tag-only comparison; this
  delta is post-tag main commits.
- Zero open PRs on the fork; `gh` authenticated as `huaquanghan`.
- `.github/`, root `package.json`, `bun.lock`, `scripts/compile-binary.ts`
  untouched by the delta → no CI drift, no dep review, `OMP_NO_BYTECODE`
  toggle safe. Only manifest change: `packages/collab-web/package.json`.

## Staged merge-1 resolution — verified, keep it

Spot-checked against the r3 resolution plan:

- `src/cli/update-cli.ts`: keeps our `fetchLatestReleaseTag` +
  `OMPZ_SPIN_RE`/`ompzCoreVersion` machinery; imports only
  `DEFAULT_NPM_REGISTRY` from upstream's new `npm-registry.ts`; no
  `loadNpmRegistryResolver`/`fetchLatestManifest` leftovers. Bleed reconciled
  (`ReleaseInfo.registry` returned as `DEFAULT_NPM_REGISTRY`).
- `test/cli/update-cli.test.ts`: resolved to HEAD wholesale (0 diff vs
  HEAD, no `stubRegistry`/`registries:` leftovers).
- New upstream files staged verbatim: `cli/npm-registry.ts`,
  `test/cli/npm-registry.test.ts`, `agent/src/tool-context.ts`.
- 52 files staged, +2776/−374 — matches the `62bc57be1b..ef1ea204bc`
  surface (PRs #11998 tool-context, #13115 npm-registry, #13119 AutoQA
  clamp, #13121 shell descriptor paths, #13092 google billing-429).

Compile correctness is unverified — the branch-level test pass below is the
gate. If it fails badly, fall back to the abort path (see Fallback).

## What the remaining 103 commits bring

No `feat` commits — 53 fix, 11 docs, 5 chore, 3 style, 2 test, 1 refactor,
1 perf, plus PR merges. Largest items:

| Area | What |
| --- | --- |
| Push-to-talk (`9e479ac12f`) | Space-hold recognizer moved out of `CustomEditor` into shared `pi-tui/space-hold`; `Input` gains dictation surface; `STTController` split start/stop; `MicCursor` extracted from `interactive-mode.ts`. Rewrites `custom-editor.ts` (−140 lines) and `interactive-mode.ts` (113 lines). |
| xd:// devices | Pending file/read links for home/archive/db paths; device-card renderers via host resolver; named memory tools by device URL. |
| Memory write errors | `3050f115ee`/`32ed87bbfe` — failed Mnemopi retain writes reported, storage error included. Touches `memory-retain.ts` + `learn.ts` (zvec-routing files). |
| Anthropic/catalog | `5b51c384b4` server-side fallback chain sourced from catalog rules; Opus 5.5 forced-tool-choice downgrade (`2bb32840f7`+`98d3b2a0ff`) — KDL/`rules.json` upstream-regenerated, take verbatim. |
| Advisor drain | `be9c959a04`/`d5aa0852f8`/`517caa8246` — wait through fallback recovery in headless drain; scope to print mode. Touches `session-advisors.ts`. |
| Usage | Scoped capacity windows, live Codex plan display (`86d0f88f67`, `a843e1e6d8`, `762dc49c81`, `0e93d79cbb`). |
| Shell/natives | Deleted-cwd recovery (brush-core), pre-aborted signals (`pi-natives/task.rs`), vcs.rs, shell.rs. Rust only — see natives caveat. |
| Misc | LSP mux daemon keep-alive, xai-oauth SuperGrok ranking, browser-relay multi-instance, collab-web ghost/large-session, setup-wizard Gemini probe, retry-fallback fixes, OpenRouter output cap. |

## Merge-2 conflict-risk surface (`ef1ea204bc..upstream/main` ∩ ours)

17 files. Both-sides-touched ≠ certain conflict — several are additive or
in different hunks.

**Zvec patch surface (7)** — re-apply zvec hooks onto upstream's new shape,
never revert upstream hunks:

| File | Upstream Δ | Our Δ | Note |
| --- | --- | --- | --- |
| `src/config/settings-schema.ts` | 2 | ~85 (zvec block) | Trivial — likely clean or 1-line. |
| `src/tools/index.ts` | 8 | registration lines | Mechanical. |
| `src/session/session-advisors.ts` | 11 | zvec wiring | Advisor-drain refactor vs our wiring. |
| `src/main.ts` | +22 | wiring | Small. |
| `src/tools/learn.ts` | 42 | `backend === "zvec"` branch | Upstream write-error refactor — keep their error reporting, re-add our branch. |
| `src/tools/memory-retain.ts` | 51 | same | Same pattern. |
| `src/modes/interactive-mode.ts` | 113 | zvec wiring | MicCursor extraction + push-to-talk. Biggest zvec-surface file; our hunks likely disjoint from the extracted region. |

**Non-zvec (10):**

| File | Note |
| --- | --- |
| `packages/tui/src/prompt/custom-editor.ts` | **Highest-risk file in the merge.** Upstream moved space-hold out (−140); our `$name` skill-alias popup/token code lives here (18 lines). Re-apply our `$`-token logic onto their new shape; check whether token handling moved to `space-hold`/Input. |
| `packages/tui/src/components/editor.ts` | 6 vs our 34 — cursorOverride measuring. |
| `packages/tui/test/custom-editor.test.ts` | 17 vs our 32 — merge both test additions. |
| `packages/ai/src/error/flags.ts` | 3 vs our 16 — likely clean. |
| `src/session/settings-stream-fn.ts` + test | 51 vs our 5 — upstream refactor; re-apply ours. |
| `src/session/turn-recovery.ts` | +32 vs our 10 — advisor recovery changes. |
| `packages/{ai,coding-agent,utils}/CHANGELOG.md` | Additive `[Unreleased]` entries; auto-merge or trivial. |

Zero conflict risk (ours-only, per `zvec-patch-surface.md`): `src/zvec/**`,
`scripts/ompz/**`, `OMPZ.md`, `docs/zvec-memory-backend.md`.

## The 1 PR — `sync/upstream-2026-09-24-r4` → `huaquanghan/omp-z:main`

1. `git checkout -b sync/upstream-2026-09-24-r4` — carries index +
   `MERGE_HEAD` onto the branch; `main` stays at `0a39f88659`.
2. Commit the staged merge (parents: `0a39f88659` + `ef1ea204bc`):
   `git commit --no-edit` (message: `Merge remote-tracking branch
   'upstream/main' (@ef1ea204bc, sync r4 part 1)`; match `663ac2a00c`
   style).
3. `git merge upstream/main` (pins `9fcb989e25`; merge-base auto-becomes
   `ef1ea204bc`). Resolve the 17-file surface per the table above;
   `git add` + `git commit --no-edit`.
4. Verify on the branch:
   - `bun --cwd packages/coding-agent run test test/zvec-backend.test.ts test/cli/update-cli.test.ts test/update-cli.test.ts test/cli/npm-registry.test.ts test/tools/report-tool-issue.test.ts test/cli/update-cli.test.ts`
   - `bun --cwd packages/agent test test/agent-loop.test.ts test/agent.test.ts` (tool-context feature)
   - `bun --cwd packages/coding-agent test test/btw-follow-up.test.ts test/interactive-mode-lsp-startup.test.ts test/settings-stream-fn.test.ts` (merge-2 surface)
   - `bun --cwd packages/tui test test/custom-editor.test.ts test/editor-autocomplete-actions.test.ts` (push-to-talk + $-alias)
   - `bun check` + oxfmt/oxlint on resolved files (catches merge bleed)
   - `OMP_NO_BYTECODE=1 CROSS_TARGET=linux-x64 bun --cwd packages/coding-agent run build`
   - `dist/omp-linux-x64 --version` → `18.3.0`;
     `strings dist/omp-linux-x64 | grep -c zvec` > 0
   - Rust: 4 crates files changed → covered by PR CI (bazel rust tests +
     addon build); local `cargo test -p pi-natives -p pi-shell` optional.
5. `git push -u origin sync/upstream-2026-09-24-r4`
6. `gh pr create -R huaquanghan/omp-z --base main` — MUST read
   `CONTRIBUTING.md` + `.github/PULL_REQUEST_TEMPLATE.md` first; preserve
   template sections/checklist; Testing lists step-4 results; the
   contributor-rationale sentence comes from the user (never generate).
   No changelog attribution — upstream commits carry their own credits.
7. **Land with a MERGE commit — never squash/rebase** (preserves upstream
   ancestry; locked rule from `ompz-update-channel.md` + skill).

## Fallback — abort path (only if staged merge proves broken)

`git merge --abort` returns to clean `main`; then single
`git merge upstream/main` resolves the full 22-file intersection
(`62bc57be1b`-based) at once — re-doing update-cli + npm-registry bleed per
r3's resolution plan plus the 17-file r4 surface. Prefer only if step-4
failures trace to the staged resolution itself.

## Natives caveat (unchanged, now larger)

- Delta touches `crates/pi-natives/{task,vcs}.rs`, `pi-shell/shell.rs`,
  `brush-core/shell.rs` (plus merge-1's descriptor-path fix) — all compile
  into `pi_natives.*.node`, but `packages/natives` stays `18.3.0` → npm
  prebuilts lack every fix. **Accept**: fixes reach binaries at the next
  upstream tag with matching `@oh-my-pi/pi-natives-*@<new>` prebuilts.
  Fork CI still validates the Rust on the PR.

## Post-land (optional, separate decisions)

- Respin `ompz-v18.3.0-1`: `scripts/ompz/build.sh --all` → tag → release.
  Ships all TS fixes; Rust fixes excluded per caveat.
- `OMPZ.md` pin bump as its own post-release commit per convention.
- Housekeeping PR for the accumulated `docs/plans/active/*.md` (r2, r3,
  pr11998, this file, etc.) — per `sync-housekeeping-2026-09-24.md`.

## Non-goals / edges

- `$name`-alias upstream PR (`upstream-pr-skill-dollar-2026-09-24.md`)
  stays separate — note its custom-editor.ts hunks are exactly what
  merge-2 re-applies, so land this sync first if both proceed.
- No rebase, no force-push `main`, no upstream tag edits.
- If upstream rewrote a subsystem wholesale (it didn't — push-to-talk is a
  refactor, not a memory-backend replacement): abort, re-port zvec.
