# Sync upstream/main into fork — 1 PR

**Status: LANDED.** Merge `268dff94f5` pushed to `origin/main`; released as
`ompz-v18.2.11-1`, respun `ompz-v18.2.11-2` (Latest, 2026-09-23). Only
residue: the two plan docs are still untracked — one docs-only PR remains
(see "Residual PR" below).

Merge `can1357/oh-my-pi:main` (`73a11421fe`, **1 commit**) into
`huaquanghan/omp-z:main` via a single merge-commit PR.

## Fork ↔ upstream status (re-checked 2026-09-24)

- `upstream/main` = `73a11421fe` — **unchanged**; still fully contained in
  `main` (merge-base = `73a11421fe`). Latest upstream release `v18.2.11`
  still newest — no new `v*` tag, no new `pi-natives` prebuilts to check.
- `main` = `origin/main` = `003f5ce9f8` — **39 ahead / 0 behind** upstream
  (the +1 vs yesterday is `003f5ce9f8` docs bump pinning `ompz-v18.2.11-2`).
- **Nothing to sync.** The residual docs PR below is the only open work.
- Open PRs on fork: none.

## Fork ↔ upstream status (re-checked 2026-09-23, post-land)

- `upstream/main` = `73a11421fe` — unchanged since the merge; **nothing new
  to sync**.
- `main` = `origin/main` = `268dff94f5` — **38 ahead / 0 behind** upstream;
  merge-base = `73a11421fe` (upstream fully contained).
- Latest upstream tag `v18.2.11`; upstream/main is 58 commits past it.
- Fork release `ompz-v18.2.11-1` is Latest on GitHub; tag pushed.
- Update-channel work `f69583c6a3` + `f60163b991` is on `main`, pushed,
  released — `omp update` now resolves fork `ompz-v*` releases.
- Open PRs on the fork: none.
- Worktree delta: only the two untracked plan docs (this file +
  `ompz-update-channel.md`).

## Fork ↔ upstream status (checked 2026-09-23, second fetch)

- `upstream/main` = `73a11421fe`. Merge-base with local `main` = `e3df2af0a9`.
- Local `main` = `b6acd55032` — **37 ahead / 1 behind** upstream.
- `origin/main` = `cc91fb1ce2` — local `main` is **45 ahead / 0 behind**
  (fast-forwardable). The previous sync merge `b6acd55032` (upstream up to
  `e3df2af0a9`, the delta this file originally planned) **landed locally but
  was never pushed** — so the PR below carries it too.
- `git merge-tree --write-tree --name-only main upstream/main` → **clean,
  zero conflicts**.
- Both sides at `packages/coding-agent` version `18.2.11`; latest upstream
  tag still `v18.2.11`. Post-release main commit — **no new `pi-natives`
  prebuilts needed**, no version bump.
- Upstream delta touches **no** fork patch surface: nothing in `src/zvec/`,
  `scripts/ompz/`, `settings-schema.ts`, `memory-*`, `update-cli.ts`,
  `main.ts`, `packages/natives/`, `crates/`.

## What the 1 commit brings

`73a11421fe` — `feat: per-account codex cyber access program routing and
discovery` (22 files, +525/−26):

- `packages/ai`: new `openai-codex/access-programs.ts` (Daybreak program
  discovery, `applyCodexAccessPrograms` / `dropRejectedCodexAccessPrograms`);
  OAuth account affinity in `auth/select.ts` + `accountIds` on
  `AuthApiKeyOptions`; replay-on-reject in `openai-codex-responses.ts`
  (`openInitialCodexEventStream` try/catch, mid-compaction replay, new
  `#tryDropRejectedAccessPrograms` as first `#recoverStreamError` branch);
  usage reporting in `usage/openai-codex.ts`; auth-gateway dispatch wiring.
- `packages/catalog`: codex multi-account discovery (`discovery/codex.ts`),
  `special.ts`, new `types.ts` fields, discovery test.
- `packages/coding-agent`: `usage-cli.ts` + `model-registry.ts` +
  `command-controller.ts` plumbing.
- `packages/tui`: `usage-dashboard.ts` shows Daybreak-enabled accounts.
- Changelog lines in ai/catalog/coding-agent/tui CHANGELOGs.

## Overlap analysis (3 files — all clean, verified)

| File | Upstream hunk | Fork hunk | Verdict |
| --- | --- | --- | --- |
| `packages/ai/CHANGELOG.md` | +2 lines | +2 lines | disjoint |
| `packages/coding-agent/CHANGELOG.md` | +1 line | +2 lines | disjoint |
| `packages/ai/src/providers/openai-codex-responses.ts` | access-program replay: imports @81, `createCodexRequestContext` @1407, `openInitialCodexEventStream` tail @1635, compaction @1715, `#recoverStreamError` @2558, new method @2715 | retry budget: import @65, handshake wait @1626, whitespace @2623, ws-reconnect @2708, ws-replay @2787, provider-retry @2880 | disjoint hunks |

**Semantic check (done):** fork `d1116b57be`/`a9b15299d2` added
`operationDeadlineExceeded` guards before every `scheduler.wait` retry and a
caller-abort check at the handshake. Upstream's new replay paths are
**delay-free** (rejection arrives before output → immediate reopen), so they
correctly need no deadline guard; all *delayed* retries remain budgeted. The
replay is bounded — `dropRejectedCodexAccessPrograms` strips the program from
the body so it can't loop. `createCodexProviderStreamError` already exists at
HEAD (`openai-codex-responses.ts:4853`). Composition is coherent.

## Plan (executed)

1. ~~Branch + merge `upstream/main`~~ — done as `268dff94f5`, pushed.
2. ~~Release~~ — `ompz-v18.2.11-1` published with 6 binaries + SHA256SUMS.

## Residual PR (the remaining "1 PR")

The only unlanded artifact is documentation: this plan file and
`ompz-update-channel.md` (whose work shipped in `f69583c6a3`/`f60163b991`).
Repo convention commits active plans with their PR.

1. `git checkout -b docs/sync-plans-2026-09-23` off `main`.
2. Update status header in `ompz-update-channel.md` to **landed** (its
   "uncommitted WIP" framing is stale — commits are on `main` and released).
3. `git add docs/plans/active/{upstream-sync-2026-09-23,ompz-update-channel}.md`
   — one commit: `docs(plan): record landed upstream sync + update channel`.
4. Push branch, open PR → `huaquanghan/omp-z:main`.
5. **Squash is safe here** — docs-only, no upstream ancestry in this PR.
   (The earlier merge-commit rule applied to the sync PR, which already
   landed with upstream history preserved.)

## Next sync (standing procedure)

When `upstream/main` moves past `73a11421fe` or a new `v*` tag appears:
re-run `.devin/skills/ompz-upstream/scripts/check-upstream.sh`, merge the
tag/HEAD into `main` (never rebase), verify zvec + build, release per skill.
If a new `v*` tag lands, verify `pi-natives` prebuilts exist on npm first
(`npm view @oh-my-pi/pi-natives-linux-arm64@<version>`).

## PR requirements

- The sync merged directly on `main` (merge commit `268dff94f5`) — upstream
  ancestry is preserved; future syncs keep their merge-base. The residual
  docs PR carries no upstream commits, so either merge strategy is fine.
- Body: `.github/PULL_REQUEST_TEMPLATE.md` sections (What / Why / Testing +
  checklist). Needs **one human-written sentence** from the author per
  CONTRIBUTING.md — ask for it before publishing.
- CHANGELOG: N/A (AGENTS.md: no changelog edits unless asked). Note in
  Testing section.
- CI: `.github/workflows/ci.yml` on PRs to `main` — docs-only diff touches
  no `packages/**`, so expect a trivially green run.

## Verification (already run on the landed merge)

- `bun run check`, zvec gate, upstream codex-access-program tests, update
  channel smoke, and the linux-x64 build smoke all passed before
  `268dff94f5` was pushed and `ompz-v18.2.11-1` released.
- Residual docs PR needs no code verification — review diff only.

## Post-merge

Done: `ompz-v18.2.11-1` released 2026-09-23 (Latest). macOS binaries were
cross-compiled, not run-tested — noted in the release.

## Edge cases / non-goals

- No bytecode re-enable (`OMP_NO_BYTECODE` stays — bun 1.4.0 boot crash).
- `zg` remains a runtime requirement; never vendored.
- Upstream changelog attributions land as-is; fork adds no changelog entries.
- If upstream tags `v18.2.12` before this PR merges, re-run
  `.devin/skills/ompz-upstream/scripts/check-upstream.sh` — a new tag means
  new `pi-natives` prebuilts to verify on npm before building.
