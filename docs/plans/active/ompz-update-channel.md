# Route `omp update` at fork releases

**Status: LANDED.** `f69583c6a3` + `f60163b991` on `main`, released in
`ompz-v18.2.11-1` (2026-09-23).

Point the self-update channel and the startup version check at
`huaquanghan/omp-z` GitHub releases (`ompz-v*` tags, `ompz-*` binary assets)
instead of upstream `can1357/oh-my-pi` npm/Homebrew/mise channels the fork
does not publish.

## Fork ↔ upstream status (checked 2026-09-23, post-fetch)

- `upstream/main` moved to `eeaff20e2f` (PR #12919 "CI uplifts") — fork is
  now **6 behind / 33 ahead**.
- The 6 new commits are **CI-only**: `.github/workflows/ci.yml`,
  `.github/actions/{bazel-cache,bun-install,native-artifacts,setup-system-deps}`,
  `infra/runner.Dockerfile`, `infra/docs/03-runner-image.md`,
  `scripts/ci-test-ts.{ts,test.ts}`, `docs/natives-build-release-debugging.md`.
  Highlights: prebuilt cargo-deny binary (~135 s saved), shared caches saved
  only on main, `release_dry_run` dispatch added then reverted.
- **Zero file overlap** with the fork's 33-commit delta — `git merge-tree`
  confirms a clean merge. Nothing touches `packages/`, `src/zvec/`, or the
  WIP files.
- Latest upstream release `v18.2.11` is merged; `ompz-v18.2.11` released the
  same day. Releases are aligned — the 6 commits are post-release CI work,
  no version bump, no new `pi-natives` prebuilts needed.
- The pending work is the **uncommitted WIP on `main`** (5 files) implementing
  this change — that is what the 1 PR lands.

## Sync step (before the PR branch)

Merge `upstream/main` into `main` directly and push — it is a clean CI-only
sync with no review value. Per `ompz-upstream` skill, upstream merges land on
`main`, never rebase.

    git checkout main && git merge upstream/main   # clean
    git push origin main

Alternative (if all changes must go through PR review): merge `upstream/main`
into the PR branch instead. Then the PR **must be merge-committed, not
squash-merged** — squashing discards upstream ancestry and every future
upstream sync loses its merge-base and re-conflicts.

## Why

Today's ompz binaries run upstream's update logic: `omp update` resolves
`can1357/oh-my-pi` releases and npm dist-tags, so it would overwrite an ompz
install with upstream `omp`. The startup version check in `main.ts` has the
same wrong target. Additionally, upstream's auth-storage refactor
(`9013268ba1`, merged) removed `setRuntimeApiKey`, leaving a stale call in a
committed test — **`check:types` is broken on `main` at HEAD** even without
the WIP.

## Locked decisions

- Release discovery via the `releases/latest` HTML redirect on the fork repo
  → `ompz-v*` tag. No npm registry, no GitHub API rate limit.
- Fork ships standalone binaries only → Homebrew/mise *detection* removed from
  `resolveUpdateTarget`; `installerHint()` points at the fork installer /
  release page.
- `update.channel` keeps `stable|canary`; canary resolves the latest release
  (fork has no canary channel — harmless alias, smaller diff).
- `compareOmpzVersions()` handles the `X.Y.Z-N` release-spin suffix
  (`ompz-v18.2.10-1`) that `Bun.semver.order` cannot.
- Shim forwarders and takeover now emit/install `ompz.exe` (was `omp.exe`).

## Changes

Already in the working tree (uncommitted):

- `src/cli/update-cli.ts` — `REPO` → `huaquanghan/omp-z`, `RELEASE_TAG_PREFIX`
  → `ompz-v`, `OMPZ_CLI` → `ompz`; `getLatestRelease` resolves the
  `releases/latest` redirect instead of npm dist-tags; `getReleaseBinaryAsset`
  tags with `ompz-v`; removed `getHomebrewFormulaPrefix`/`getMiseBinDirs`/
  `getMiseDataDir` probes; `installerHint()` → fork install script / release
  page; shim-forwarder bodies and takeover paths use `OMPZ_CLI`.
- `src/main.ts` — startup check compares via `compareOmpzVersions`.
- `test/cli/update-cli.test.ts` — rewrite: redirect-stubbed `getLatestRelease`
  cases (tag parse, `-N` suffix kept, no-redirect throws).
- `test/update-cli.test.ts`, `test/agent-session-retry-recovery.test.ts` —
  partially updated.

Remaining fixes before commit:

1. **`test/agent-session-retry-recovery.test.ts:509`** — WIP calls
   `authStorage.setRuntime(...)`, which does not exist on `AuthStorage`
   (tsgo error). Use upstream's spelling: `authStorage.keys.setRuntime(...)`.
   This also un-breaks `check:types` on `main`.
2. **`test/update-cli.test.ts`** — 4 failures, all mechanical `omp`→`ompz`
   expectation updates in the shim-takeover / binary-replacement tests:
   - `restores the previous binary …` — expects `"restored previous omp
     binary"`, code now emits `ompz` (~line 1220; same class of message at
     ~1655).
   - `script-shim takeover` ×3 — fixture names/assertions still `omp.exe`,
     `omp.ps1`, `omp.cmd`, `omp.bat`; code now writes `ompz.*` (~lines
     1277–1660). Rename fixtures + expected forwarder bodies.
3. **Decision point — manager-method residue**: `resolveUpdateTargetFromPath`
   can still return `brew|mise|nix|bun|npm` (line ~722) via the bun/npm
   bin-dir probes kept for symlinked launchers. Those paths run upstream
   package-manager commands (`npm i -g @oh-my-pi/pi-coding-agent`,
   `brew upgrade can1357/tap/omp`, …) — i.e. they would install **upstream**
   over an ompz binary sitting in a manager's bin dir. Recommend collapsing
   all manager results to `{ method: "binary" }` at the resolved path for the
   fork; optionally delete the now-unreachable manager command builders
   (~lines 1440–1610). Alternative: leave as-is (exotic edge).

## Verification

- `cd packages/coding-agent && bun run check` — oxlint + oxfmt --check + tsgo.
- `bun test test/update-cli.test.ts test/cli/update-cli.test.ts
  test/agent-session-retry-recovery.test.ts` — all green (was 4 fail + 1
  typecheck error).
- Live smoke (exercises the real path per CONTRIBUTING):
  `bun src/cli.ts update --check` → resolves `ompz-v18.2.11` via the fork's
  `releases/latest` redirect; reports up-to-date or offers the update.
- Build smoke: `OMP_NO_BYTECODE=1 CROSS_TARGET=linux-x64 bun run build`, then
  `dist/omp-linux-x64 --version` and `update --check` on the binary.
- Zvec regression (skill gate): `bun run test test/zvec-backend.test.ts`.

## PR (single PR → `huaquanghan/omp-z:main`)

- Sync first (above), then branch `fix/ompz-update-channel` off updated
  `main`. Three commits:
  1. `fix(test): use keys.setRuntime for auth-storage refactor` — un-breaks
     `check:types` on main.
  2. `feat(ompz): route update channel to fork releases` — update-cli +
     main.ts + test updates (+ manager-method collapse if approved).
  3. `docs(plan): ompz update channel` — this file (repo convention: active
     plans are committed with their PR).
- PR body follows `.github/PULL_REQUEST_TEMPLATE.md` (What / Why / Testing +
  checklist). Needs **one human-written sentence** from the author per
  CONTRIBUTING.md.
- CI: `.github/workflows/ci.yml` runs on PRs to `main` touching `packages/**`.
- CHANGELOG: skip — AGENTS.md says never update changelogs unless explicitly
  asked; mark the template item N/A in Testing.

## Post-merge (recommended follow-up)

Cut `ompz-v18.2.11-1` so existing installs can self-update onto the fixed
channel: `scripts/ompz/build.sh --all` (6 targets + SHA256SUMS.txt), tag,
`gh release create`. Without a new release the fix never reaches installed
binaries — and every `omp update` on current builds keeps pulling upstream.

## Edge cases / non-goals

- `mcp-schema.json` `$id` and `mcp/types.ts` still reference the upstream raw
  URL — schema identity, not update routing. Out of scope.
- Windows recovery hint points at the release page (fork has no install.ps1).
- Plugin update (`omp update -l`) path untouched.
- No re-enable of bytecode (`OMP_NO_BYTECODE` stays — bun 1.4.0 boot crash).
