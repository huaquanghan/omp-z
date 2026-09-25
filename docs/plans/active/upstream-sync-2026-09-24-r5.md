# Sync upstream/main into fork — 1 PR (post-v18.3.0, 138 commits → `740f3e3154`)

**Status: PLANNED — awaiting go-ahead.** Verified 2026-09-24 against a fresh
fetch. Supersedes `upstream-sync-2026-09-24-r4.md` — upstream moved from
`9fcb989e25` to `740f3e3154` (+35 commits; total delta past the staged merge
head is now **138**, not 103). Everything else from r4 stands: the staged
merge-1 is intact, the conflict-risk intersection is **unchanged at the same
17 files**, and the execution path is identical.

## Fork ↔ upstream status (verified post-fetch)

- `upstream/main` = `740f3e3154`, **138 commits** past merge-base
  `62bc57be1b` (v18.3.0, in tree via `663ac2a00c`).
- local `main` = `origin/main` = `0a39f88659` — **43 ahead / 138 behind**.
- `.git/MERGE_HEAD` = `ef1ea204bc`; `git ls-files -u` = 0; staged tree
  `e4004b31db` — r3's resolved merge still valid, covers first 18 commits.
- Upstream latest tag still `v18.3.0`; both sides `18.3.0` → no version bump,
  no new `@oh-my-pi/pi-natives-*` prebuilts needed.
- `check-upstream.sh` still reports "up to date" (tag-only comparison — this
  delta is post-tag main commits).

## What the +35 commits add (r4 pin → `740f3e3154`)

10 fix, 10 docs (mostly changelog credits/dedup), 1 uncataloged fix; PRs
#13000, #13127, #13129, #13130, #13131, #13132, #13160.

| Area | What |
| --- | --- |
| Advisor (5 fixes) | Bound expanded edit diffs (#13129), auto-thinking advisors follow live effort (#13130), keep advisor context across per-turn prune (#13131), end review after advise-only turn (#13132), re-prime from pruned transcript after prefix rebase. **All hit `session-advisors.ts` + advisor tests.** |
| Extensions shim | #13127 — canonical `pi` subpath requires on host copy in legacy-pi shim (2 commits). |
| Catalog | #13160 + `6559ba5c47` — route Devin Fusion pairings through lead models; `rules.json`/`models.json` regenerated upstream → **take verbatim**. |
| vcs | `dbf5586582` — normalize worktree metadata paths on Windows (`crates/pi-vcs/src/git/mutate.rs` — Rust, same natives caveat). |
| yolo | `1eb47af21a` — auto reasoning level fix. |

New overlap vs our surface from this increment: **`session-advisors.ts`** (now
8 upstream commits touch it in the merge-2 range — hottest file alongside
`custom-editor.ts`) and additive `coding-agent/CHANGELOG.md`. No `.github/`,
root `package.json`, `bun.lock`, or `scripts/compile-binary.ts` changes — CI
drift and dep-review conclusions from r4 unchanged.

## Merge-2 conflict-risk surface — recomputed, still 17 files

Intersection of `ef1ea204bc..740f3e3154` upstream-changed (153 files) with
our-side-vs-`ef1ea204bc` (100 files, staged tree `e4004b31db`):

- **Zvec surface (7):** `settings-schema.ts`, `tools/index.ts`,
  `session-advisors.ts`, `main.ts`, `tools/learn.ts`,
  `tools/memory-retain.ts`, `modes/interactive-mode.ts`.
- **Non-zvec (10):** `tui/src/prompt/custom-editor.ts` (**highest risk** —
  space-hold extraction vs our `$name` alias code), `tui/src/components/
  editor.ts`, `tui/test/custom-editor.test.ts`, `ai/src/error/flags.ts`,
  `settings-stream-fn.ts` + test, `turn-recovery.ts`, `ai`/`coding-agent`/
  `utils` CHANGELOGs.

Resolution policy per r4's table: re-apply our hooks onto upstream's new
shape, never revert upstream hunks; `rules.json`/`models.json` verbatim.
`src/zvec/**`, `scripts/ompz/**`, `OMPZ.md`, `docs/zvec-memory-backend.md`
are ours-only — zero risk.

## The 1 PR — `sync/upstream-2026-09-24-r5` → `huaquanghan/omp-z:main`

1. `git checkout -b sync/upstream-2026-09-24-r5` — carries index +
   `MERGE_HEAD` onto the branch; `main` stays at `0a39f88659`.
2. Commit staged merge-1 (parents `0a39f88659` + `ef1ea204bc`):
   `git commit --no-edit`; match `663ac2a00c` message style.
3. `git merge upstream/main` (pins `740f3e3154`). Resolve the 17-file surface
   per r4's table; `git add` + `git commit --no-edit`.
4. Verify on the branch:
   - `bun --cwd packages/coding-agent run test test/zvec-backend.test.ts test/cli/update-cli.test.ts test/update-cli.test.ts test/cli/npm-registry.test.ts test/tools/report-tool-issue.test.ts`
   - `bun --cwd packages/agent test test/agent-loop.test.ts test/agent.test.ts`
   - `bun --cwd packages/coding-agent test test/btw-follow-up.test.ts test/interactive-mode-lsp-startup.test.ts test/settings-stream-fn.test.ts`
   - **Advisor (new for r5):** `bun --cwd packages/coding-agent test test/advisor/advisor.test.ts test/advisor-advise-terminal.test.ts test/advisor-auto-thinking.test.ts test/advisor-headless-fallback-drain.test.ts test/agent-session-advisor-suppression.test.ts`
   - `bun --cwd packages/tui test test/custom-editor.test.ts test/custom-editor-vim.test.ts test/editor.test.ts test/editor-autocomplete-actions.test.ts`
   - `bun check` + oxfmt/oxlint on resolved files
   - `OMP_NO_BYTECODE=1 CROSS_TARGET=linux-x64 bun --cwd packages/coding-agent run build`
   - `dist/omp-linux-x64 --version` → `18.3.0`; `strings dist/omp-linux-x64 | grep -c zvec` > 0
   - Rust: delta now touches `pi-natives/{task,vcs}.rs`, `pi-shell/shell.rs`,
     `pi-vcs/git/mutate.rs`, `brush-core` — covered by PR CI; local
     `cargo test` optional.
5. `git push -u origin sync/upstream-2026-09-24-r5`
6. `gh pr create -R huaquanghan/omp-z --base main` — MUST read
   `CONTRIBUTING.md` + `.github/PULL_REQUEST_TEMPLATE.md` first; preserve
   template sections/checklist; Testing lists step-4 results; contributor-
   rationale sentence comes from the user (never generate). No changelog
   attribution — upstream commits carry their own credits.
7. **Land with a MERGE commit — never squash/rebase.**

## Fallback

`git merge --abort` → clean `main`, then a single `git merge upstream/main`
against the full 22-file `62bc57be1b`-based intersection — only if step-4
failures trace to the staged resolution itself.

## Natives caveat (r5)

Same as r4, now also including `crates/pi-vcs/src/git/mutate.rs`: npm
prebuilts stay `18.3.0`, so all Rust fixes wait for the next upstream tag +
matching `@oh-my-pi/pi-natives-*` packages. PR CI still compiles/tests them.

## Post-land (optional, separate decisions)

- Respin `ompz-v18.3.0-1`: `scripts/ompz/build.sh --all` → tag → release
  (TS fixes ship; Rust fixes excluded per caveat).
- `OMPZ.md` pin bump as its own post-release commit.
- Housekeeping PR for accumulated `docs/plans/active/*.md` (r2–r5, pr11998,
  etc.) per `sync-housekeeping-2026-09-24.md`.

## Non-goals / edges

- `$name`-alias upstream PR (`upstream-pr-skill-dollar-2026-09-24.md`) stays
  separate — land this sync first if both proceed.
- No rebase, no force-push `main`, no upstream tag edits.
- If upstream rewrote a subsystem wholesale (it didn't): abort, re-port zvec.
