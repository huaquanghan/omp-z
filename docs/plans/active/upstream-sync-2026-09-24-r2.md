# Sync upstream/main into fork — 1 PR (post-v18.3.0, PRs #11998 + #13115 + #13119)

**Status: PLANNED — awaiting go-ahead.** Verified 2026-09-24 against a real
probe merge in a scratch worktree (`git worktree` + `git merge --no-ff`,
since aborted/removed). Supersedes `upstream-sync-2026-09-24-pr11998.md`
(which covered only the first 4 commits and predicted a clean merge — no
longer true: PR #13115 landed after it and collides with our update-cli
rewrite).

## Fork ↔ upstream status (verified post-fetch)

- `upstream/main` = `76895af436`, 13 commits past merge-base `62bc57be1b`
  (our tree already contains everything through `62bc57be1b`, incl. v18.3.0).
- local `main` = `origin/main` = `0a39f88659` — **43 ahead / 13 behind**.
- Upstream latest tag still `v18.3.0`; both sides version `18.3.0` →
  **no version bump, no new `pi-natives` prebuilts** (delta touches no
  `crates/` / `packages/natives/`).
- `check-upstream.sh` reports "up to date" — it compares tags only; this
  delta is post-tag main commits (same pattern as the 09-23 sync).
- Latest fork tag `ompz-v18.3.0` sits on `0a39f88659`.
- Zero open PRs on the fork; `gh` authenticated as `huaquanghan`.

## What the 13 commits bring

| PR | Commits | Surface |
| --- | --- | --- |
| #11998 (port of #8363) | `45cef58d85` `f00801f31f` `41a17708aa` `5fccbd0dee` | **Passive tool-call `additionalContext`**: new `packages/agent/src/tool-context.ts`; agent-loop/agent/types; extension + hook wrappers; `tools/context.ts`, `session/agent-session.ts`; docs; ~1,000 lines of tests. None of it fork-patched. |
| #13115 | `8d71423f39` `f67480fe2b` `eee4298905` `b96ff9f8c5` | **Honor configured npm registry in `omp update`**: new `src/cli/npm-registry.ts` (258 lines: `loadNpmRegistryResolver`, `fixedNpmRegistry`, `npmRegistryPackageUrl`, `DEFAULT_NPM_REGISTRY`); refactors `fetchLatestManifest` + `getLatestRelease` to take a `registries` resolver; adds `ReleaseInfo.registry` (required); threads `--registry=` into `buildBunInstallArgs` / `buildNpmInstallArgs` / `packageManagerMigrationSteps` / `updateViaBun` / `updateViaNpm`. |
| #13119 | `32bad5f51c` `5ae83b00bd` `767987cfef` `eefe1a8917` `76895af436` | **AutoQA tool-name clamp**: clamp tool names to collector's 128-byte limit; park collector-refused grievances instead of wedging the queue. Touches `cli/grievances-cli.ts`, `tools/report-tool-issue.ts`, `cursor.ts` — no overlap with ours. |

## Merge result (probe-verified, not estimated)

```
Auto-merging packages/coding-agent/CHANGELOG.md                    ✓ clean
CONFLICT (content): packages/coding-agent/src/cli/update-cli.ts    3 hunks (L775–836, L839–852, L857–922)
CONFLICT (content): packages/coding-agent/test/cli/update-cli.test.ts  3 hunks + ~118 upstream-only lines auto-merged in
Auto-merging packages/coding-agent/test/update-cli.test.ts         ✓ clean (two `registry:` fixture fields)
```

Zero zvec patch-surface hits: nothing in `src/zvec/`, `memory-backend/*`,
`internal-urls/memory-protocol.ts`, `tools/memory-*`, `tools/index.ts`,
`learn.ts`, `settings-schema.ts`, `session-advisors.ts`, `compile-binary.ts`,
root `README.md`, `docs/memory.md`. No `.github/` changes → fork CI
(`pull_request` on `packages/**`) runs normally.

**Why update-cli conflicts**: our rewrite replaced the npm-registry
`getLatestRelease`/`fetchLatestManifest`/`omp.rename` machinery with a
GitHub `releases/latest` redirect + `ompz-v` tag prefix + spin-suffix
compare; upstream refactored the same region for #13115. Three
delete-vs-modify hunks.

**Auto-merged bleed to fix in `update-cli.ts`** (outside conflict markers,
silently landed by merge): the `npm-registry` import block (L24–29), the
required `registry: string` field on `ReleaseInfo` (L102), and
`registry:`/`--registry=` threading at L1486–1731. Left as-is it does not
compile — our `getLatestRelease` returns no `registry`.

## Resolution plan

1. **`src/cli/update-cli.ts`** — resolve all 3 conflict hunks to HEAD
   (keep `fetchLatestReleaseTag`, `OMPZ_SPIN_RE`/`ompzCoreVersion`/
   `compareOmpzVersions`; drop upstream's `fetchLatestManifest` +
   registry-aware `getLatestRelease`). Then reconcile the bleed:
   - Keep `ReleaseInfo.registry` **required**; make our `getLatestRelease`
     return `registry: DEFAULT_NPM_REGISTRY` — truthful: the surviving
     bun/npm manager-takeover path installs upstream's npmjs package.
   - Keep upstream's `registry` threading in `buildBunInstallArgs` /
     `buildNpmInstallArgs` / `packageManagerMigrationSteps` /
     `updateViaBun` / `updateViaNpm` — it is upstream's real #1686 fix and
     applies to those paths.
   - Trim the import to `DEFAULT_NPM_REGISTRY` only; drop
     `loadNpmRegistryResolver`, `NpmRegistry`, `NpmRegistryResolver`,
     `npmRegistryPackageUrl` (all dead once `fetchLatestManifest` is gone).
   - Post-check: `grep -n 'fetchLatestManifest\|loadNpmRegistryResolver\|
     npmRegistryPackageUrl\|NpmRegistry'` → import line only… zero hits.
2. **`src/cli/npm-registry.ts` + `test/cli/npm-registry.test.ts`** — keep
   verbatim (new upstream files, self-contained; `DEFAULT_NPM_REGISTRY`
   consumed by our install-arg builders; zero intra-file divergence keeps
   future merges clean).
3. **`test/cli/update-cli.test.ts`** — resolve to HEAD wholesale
   (`git restore --source=HEAD --worktree` on the conflicted file), then
   verify no `registries:`/`npmjs`/`fixedNpmRegistry`/`stubRegistry`
   leftovers (upstream auto-merged its registry tests into our GitHub-
   redirect tests; all of them exercise machinery we dropped — the module
   itself stays covered by `npm-registry.test.ts`).
4. **`CHANGELOG.md`** — auto-merge stands; confirm `[Unreleased]` carries
   upstream's three entries.
5. **`test/update-cli.test.ts`** — auto-merge stands; the two added
   `registry:` fixture fields are valid under the kept required field.

## The 1 PR — `sync/upstream-2026-09-24-r2` → `huaquanghan/omp-z:main`

1. `git checkout -b sync/upstream-2026-09-24-r2 main`
2. `git merge --no-ff upstream/main` (pinned at `76895af436`; if upstream
   moved, re-merge latest on the same branch — still one PR)
3. Resolve per above; `git add` + commit the merge
4. Verify on the branch:
   - `bun --cwd packages/coding-agent run test test/zvec-backend.test.ts test/cli/update-cli.test.ts test/update-cli.test.ts test/cli/npm-registry.test.ts test/tools/report-tool-issue.test.ts`
   - `bun --cwd packages/agent test test/agent-loop.test.ts test/agent.test.ts` (upstream's new feature coverage)
   - lint/typecheck coding-agent (catches unused imports from the bleed)
   - `OMP_NO_BYTECODE=1 CROSS_TARGET=linux-x64 bun --cwd packages/coding-agent run build`
   - `dist/omp-linux-x64 --version` → `18.3.0`; `strings dist/omp-linux-x64 | grep -c zvec` > 0
5. `git push -u origin sync/upstream-2026-09-24-r2`
6. `gh pr create -R huaquanghan/omp-z --base main` — MUST read
   `CONTRIBUTING.md` + `.github/PULL_REQUEST_TEMPLATE.md` first; preserve
   template sections/checklist; Testing lists step-4 results; the
   contributor-rationale sentence comes from the user (do not generate).
   No changelog attribution needed — upstream commits carry their own
   credits under `[Unreleased]`.
7. **Land with a MERGE commit — never squash/rebase** (preserves upstream
   ancestry; locked rule from `ompz-update-channel.md` + skill).

## Post-land (optional, separate decision)

- Respin `ompz-v18.3.0-1`: `scripts/ompz/build.sh --all` → tag →
  `gh release create` (matches `ompz-v18.2.8-*` spin convention). Skippable:
  no fork-facing fix, upstream itself has not released the delta.
- `OMPZ.md` pin bump as its own post-release commit per convention.

## Non-goals / edges

- Housekeeping-docs PR and `$name`-alias upstream PR stay separate.
- Superseded `upstream-sync-2026-09-24-pr11998.md` joins the housekeeping
  list with this file.
- No rebase, no force-push, no upstream tag edits.
- If upstream rewrote update-cli wholesale next time (it didn't here):
  abort, re-port the ompz update channel instead of resolving.
