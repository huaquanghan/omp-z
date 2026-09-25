# Sync upstream/main into fork — 1 PR (post-v18.3.0, PRs #11998 + #13115 + #13119 + #13121)

**Status: SUPERSEDED by `upstream-sync-2026-09-24-r4.md`** (upstream moved
to `9fcb989e25`, 121 commits; its merge of `ef1ea204bc` is staged but
uncommitted). Was: PLANNED — awaiting go-ahead. Verified 2026-09-24 against
`git merge-tree --write-tree` on the current upstream HEAD. Supersedes
`upstream-sync-2026-09-24-r2.md` (13 commits, `76895af436`) — upstream has
since landed PR #13121 (+3 commits, Rust shell fixes), which adds a
natives-prebuilt caveat but **no new conflicts**.

## Fork ↔ upstream status (verified post-fetch)

- `upstream/main` = `b6b3430b38`, **16 commits** past merge-base
  `62bc57be1b` (our tree already contains everything through it, incl.
  v18.3.0).
- local `main` = `origin/main` = `0a39f88659` — **43 ahead / 16 behind**.
- Upstream latest tag still `v18.3.0`; both sides version `18.3.0` →
  **no version bump**. Fork tag `ompz-v18.3.0` sits on `0a39f88659`.
- `check-upstream.sh` reports "up to date" — it compares tags only; this
  delta is post-tag main commits.
- Zero open PRs on the fork; `gh` authenticated as `huaquanghan`.
- `.github/` unchanged on both sides since merge-base → fork CI = upstream
  CI; `pull_request` paths cover `packages/**`, `crates/**`, `bazel/**`.

## What the 16 commits bring

| PR | Commits | Surface |
| --- | --- | --- |
| #11998 (port of #8363) | `45cef58d85` `f00801f31f` `41a17708aa` `5fccbd0dee` | **Passive tool-call `additionalContext`**: new `packages/agent/src/tool-context.ts`; agent-loop/agent/types; extension + hook wrappers; `tools/context.ts`, `session/agent-session.ts`; docs; ~1,000 lines of tests. None of it fork-patched. |
| #13115 | `8d71423f39` `f67480fe2b` `eee4298905` `b96ff9f8c5` | **Honor configured npm registry in `omp update`**: new `src/cli/npm-registry.ts` (258 lines: `loadNpmRegistryResolver`, `fixedNpmRegistry`, `npmRegistryPackageUrl`, `DEFAULT_NPM_REGISTRY`); refactors `fetchLatestManifest` + `getLatestRelease` to take a `registries` resolver; adds `ReleaseInfo.registry` (required); threads `--registry=` into install-arg builders. |
| #13119 | `32bad5f51c` `5ae83b00bd` `767987cfef` `eefe1a8917` `76895af436` | **AutoQA tool-name clamp**: clamp tool names to collector's 128-byte limit; park collector-refused grievances. Touches `cli/grievances-cli.ts`, `tools/report-tool-issue.ts`, `cursor.ts` — no overlap with ours. |
| #13121 | `d2c72b21b7` `70d59d5d4c` `b6b3430b38` | **Embedded-shell descriptor paths**: resolve `/dev/stdin`-style descriptor paths against the shell, not the host; keep descriptor spelling in sed/pgrep/readlink/ls/tail. Rust only: `crates/pi-builtins`, `crates/pi-shell`, `crates/vendor/brush-core` (+604/−220), `packages/natives/CHANGELOG.md`. No TS overlap. |

## Merge result (probe-verified via `git merge-tree` @ `b6b3430b38`)

```
CONFLICT (content): packages/coding-agent/src/cli/update-cli.ts
CONFLICT (content): packages/coding-agent/test/cli/update-cli.test.ts
Auto-merging packages/coding-agent/CHANGELOG.md                    ✓ clean
Auto-merging packages/coding-agent/test/update-cli.test.ts         ✓ clean
```

Both-sides-touched intersection since merge-base is exactly those four
files. Zero zvec patch-surface hits: nothing in `src/zvec/`,
`memory-backend/*`, `internal-urls/memory-protocol.ts`, `tools/memory-*`,
`tools/index.ts`, `learn.ts`, `settings-schema.ts`, `session-advisors.ts`,
`compile-binary.ts`, root `README.md`, `docs/memory.md`.

**Why update-cli conflicts**: our rewrite replaced the npm-registry
`getLatestRelease`/`fetchLatestManifest`/`omp.rename` machinery with a
GitHub `releases/latest` redirect + `ompz-v` tag prefix + spin-suffix
compare; upstream refactored the same region for #13115.
Delete-vs-modify hunks.

**Auto-merged bleed to fix in `update-cli.ts`** (outside conflict markers,
silently landed by merge): the `npm-registry` import block, the required
`registry: string` field on `ReleaseInfo`, and `registry:`/`--registry=`
threading in the install paths. Left as-is it does not compile — our
`getLatestRelease` returns no `registry`.

## Natives caveat (new in r3)

- #13121 changes Rust source that compiles into `pi_natives.*.node`
  (`pi-natives` deps `pi-shell` → `pi-builtins`/`brush-core`), but
  `packages/natives` stays `18.3.0` → npm prebuilts `@18.3.0` were built
  **without** the fix.
- `scripts/ompz/build.sh` stages prebuilt tarballs (uses a local
  `packages/natives/native/*.node` only if already present) → a respin
  would ship TS fixes (#11998/#13115/#13119) but **not** the shell fix.
- Fork CI still validates the Rust delta on the PR: `Validate Rust
  workspace (bazel)` runs Rust tests + clippy + rustfmt, and `Build native
  addons (bazel)` compiles all Linux-hosted targets.
- **Recommendation: accept.** Upstream itself has not released the fix;
  it reaches our binary automatically at the next upstream tag (matching
  `@oh-my-pi/pi-natives-*@<new>` prebuilts). Alternative — build addons
  from source via `bun scripts/bazel-natives.ts` for all 6 targets — is
  heavy and diverges from the pinned npm version; only do it if the shell
  fix is urgently needed in an ompz respin.

## Resolution plan

1. **`src/cli/update-cli.ts`** — resolve all conflict hunks to HEAD
   (keep `fetchLatestReleaseTag`, `OMPZ_SPIN_RE`/`ompzCoreVersion`/
   `compareOmpzVersions`; drop upstream's `fetchLatestManifest` +
   registry-aware `getLatestRelease`). Then reconcile the bleed:
   - Keep `ReleaseInfo.registry` **required**; make our `getLatestRelease`
     return `registry: DEFAULT_NPM_REGISTRY` — truthful: the surviving
     bun/npm manager-takeover path installs upstream's npmjs package.
   - **Dedupe registries**: our file already defines
     `const NPM_REGISTRY = "https://registry.npmjs.org/"` (L45) used in
     the two `--registry=` args — drop it and use the imported
     `DEFAULT_NPM_REGISTRY` everywhere (one source of truth).
   - Keep upstream's `registry` threading in `buildBunInstallArgs` /
     `buildNpmInstallArgs` / `packageManagerMigrationSteps` /
     `updateViaBun` / `updateViaNpm` — it is upstream's real #1686 fix.
   - Trim the import to `DEFAULT_NPM_REGISTRY` only; drop
     `loadNpmRegistryResolver`, `NpmRegistry`, `NpmRegistryResolver`,
     `npmRegistryPackageUrl` (dead once `fetchLatestManifest` is gone).
   - Post-check: `grep -n 'fetchLatestManifest\|loadNpmRegistryResolver\|
     npmRegistryPackageUrl\|NpmRegistry'` → import line only.
2. **`src/cli/npm-registry.ts` + `test/cli/npm-registry.test.ts`** — keep
   verbatim (new upstream files, self-contained; zero intra-file
   divergence keeps future merges clean).
3. **`test/cli/update-cli.test.ts`** — resolve to HEAD wholesale
   (`git restore --source=HEAD --worktree` on the conflicted file), then
   verify no `registries:`/`npmjs`/`fixedNpmRegistry`/`stubRegistry`
   leftovers (upstream auto-merged its registry tests into our GitHub-
   redirect tests; all of them exercise machinery we dropped — the module
   itself stays covered by `npm-registry.test.ts`).
4. **`CHANGELOG.md`** — auto-merge stands; confirm `[Unreleased]` carries
   upstream's entries.
5. **`test/update-cli.test.ts`** — auto-merge stands; the two added
   `registry:` fixture fields are valid under the kept required field.
6. **Rust delta** — take upstream verbatim (ours untouched since
   merge-base). No Cargo.toml/lock changes in the delta → no dependency
   review needed.

## The 1 PR — `sync/upstream-2026-09-24-r3` → `huaquanghan/omp-z:main`

1. `git checkout -b sync/upstream-2026-09-24-r3 main`
2. `git merge --no-ff upstream/main` (pinned at `b6b3430b38`; if upstream
   moved, re-merge latest on the same branch — still one PR)
3. Resolve per above; `git add` + commit the merge
4. Verify on the branch:
   - `bun --cwd packages/coding-agent run test test/zvec-backend.test.ts test/cli/update-cli.test.ts test/update-cli.test.ts test/cli/npm-registry.test.ts test/tools/report-tool-issue.test.ts`
   - `bun --cwd packages/agent test test/agent-loop.test.ts test/agent.test.ts` (upstream's new feature coverage)
   - lint/typecheck coding-agent (catches unused imports from the bleed)
   - `OMP_NO_BYTECODE=1 CROSS_TARGET=linux-x64 bun --cwd packages/coding-agent run build`
   - `dist/omp-linux-x64 --version` → `18.3.0`;
     `strings dist/omp-linux-x64 | grep -c zvec` > 0
   - Rust side is covered by PR CI (bazel tests + addon build); local
     `cargo test -p pi-builtins -p pi-shell` optional if toolchain present.
5. `git push -u origin sync/upstream-2026-09-24-r3`
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
  `gh release create`. Ships the TS fixes; the #13121 shell fix only
  reaches the binary if natives are built from source (see caveat).
- `OMPZ.md` pin bump as its own post-release commit per convention.

## Non-goals / edges

- Housekeeping-docs PR and `$name`-alias upstream PR stay separate.
- Superseded `upstream-sync-2026-09-24-pr11998.md` and `-r2.md` join the
  housekeeping list with this file.
- No rebase, no force-push, no upstream tag edits.
- If upstream rewrote update-cli wholesale next time (it didn't here):
  abort, re-port the ompz update channel instead of resolving.
