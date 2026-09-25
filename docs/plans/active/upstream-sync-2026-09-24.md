# Sync upstream/main into fork — 1 PR

**Status: SYNC LANDED — housekeeping PR + `ompz-v18.3.0` release
pending** (re-verified 2026-09-24, fourth fetch). The v18.3.0 merge
landed as `663ac2a00c` + post-merge oxlint fix `08fee75553`, both
pushed to `origin/main`. Fork is **42 ahead / 0 behind** — merge-base
is upstream HEAD itself, so there is **no upstream delta left to PR**.
The single expected conflict `docs/memory.md` resolved correctly
("omp supports six memory modes" + zvec row verified in tree).
18.3.0 pi-natives addons staged and sentinel-verified. Remaining
work: land the three untracked plan docs (1 docs PR) and cut the
`ompz-v18.3.0` release.

## Fork ↔ upstream status (verified 2026-09-24, post-fetch)

- `upstream/main` = `62bc57be1b` — tag `v18.3.0` (retagged from
  `dacdef24a3`; local tag re-fetched, matches). Newest upstream tag
  and GitHub release (published 2026-09-24T01:59Z, all binaries +
  SHA256SUMS).
- local `main` = `origin/main` = `08fee75553` — **42 ahead / 0
  behind**. `12dfb7bf8c` carried the first 23-commit window;
  `663ac2a00c` merged the remaining 34-commit v18.3.0 window;
  `08fee75553` is the post-merge oxlint cleanup.
- Latest fork release: `ompz-v18.2.11-2` — **no `ompz-v18.3.0` yet**.
- `packages/natives` version 18.3.0; staged linux-x64 `.node` addons
  (baseline + modern) export `__piNativesV18_3_0` — verified via
  `strings`. Other targets stage from npm prebuilts at build time.
- Worktree: clean except three untracked plan docs (this file,
  `upstream-sync-2026-09-23.md`, `ompz-update-channel.md`).
- `OMPZ.md` still pins `OMPZ_VERSION=ompz-v18.2.11-2` (line 41) —
  bump lands as its own post-release commit per convention.

## What the 34 commits brought (landed)

| Group | Commits | Surface |
| --- | --- | --- |
| **v18.3.0 bump + changelog rewrite** | `dacdef24a3`, `3642216898` | ~15 `package.json` version fields → 18.3.0; changelogs regenerated |
| **Post-retag fixes** (3 commits, tag moved to include them) | `3a7b072844`, `7e7479538a`, `62bc57be1b` | applefm stub clippy allows (unbreaks bazel Rust-validate on Linux — the reason `v18.3.0` moved); clinepass reference-isolation test; credential-resolver mocks in web-search xAI/Gemini tests. No zvec surface. |
| **Anthropic stack** | `7106a00f61`, `7d5e994e59`, `d0d43027d5`, `6a527ba064`, `b889334481`, `51d91333cd` | On-demand compaction + credential-aware auth; tool state tracking; message-index request controls; control-baseline two-tier LRU; `AuthStorage` deprecated compat methods. `packages/ai/src/providers/anthropic*.ts` |
| **Job/proc control** | `4eeef6864d`, `37926b38cb`, `6e2eb2ef88` | `proc://<id>/kill` explicit cancellation; background job management + `wait` coordination; interrupts respect wait mode |
| **Extensions: ephemeral turns** | `b1622ec3c5`, `eca061587a`, `607a454913`, `278ede4dff`, `09aa753fd2` + docs/tests | Bounded side turns with tool opt-out, abort-provider-hooks, recursion guards (PR #11657) |
| **Branding** | `6647b0bf14`, `d35a906723` | "Oh My Pi" → "omp" — the `docs/memory.md` conflict source |
| **Natives/crates** | `fa37f057c0`, `8b15532a7b` + version bump | `pi-natives` `lib.rs`/`power.rs`/jev test/`LICENSE.ctok`; `pi-builtins` rg output-file skip + windows test targets; `pi-shell`, `pi-vcs` mutate, `pi-voice` linux → **18.3.0 addon differs from 18.2.11** |
| **Misc fixes/tests** | `5f72b6758b`, `618332b756`, `8b09734d93`, `72cb86e549`, `9e7bde225c`, `4c25f77b41`, `093383ef7d` | Config runner-kind routing; runtime resolver canonicalization; browser screenshot rasterizer tolerance; Bedrock Converse guard; compat capability-policy tests |

## Overlap analysis (resolved — verified in tree)

Merge-tree predicted one conflict, **`docs/memory.md`**, everything
else auto-merged:

- Upstream hunk: `Oh My Pi supports five memory modes` → `omp
  supports five memory modes` (rebrand).
- Fork hunk: `five` → `six` + appended `zvec` row to the backend
  table.
- **Resolution landed:** `omp supports six memory modes` + zvec row —
  confirmed present at `docs/memory.md:3,12`.

Semantic check held: the upstream delta touched nothing in the zvec
core (`src/zvec/`, `memory-backend/*`, `internal-urls/
memory-protocol.ts`, `tools/memory-*`, `learn.ts`, `update-cli.ts`,
`main.ts`, `scripts/ompz/`, `compile-binary.ts`).

## pi-natives gate — RESOLVED (staged + verified)

- npm `@oh-my-pi/pi-natives-*@18.3.0` live for all six targets
  (verified earlier); upstream `v18.3.0` GitHub release shipped.
- Merged `packages/natives` is at 18.3.0 and `native/index.js`
  exports `__piNativesV18_3_0`; the loader throws at load time on a
  stale addon. Staged linux-x64 baseline + modern `.node` files both
  carry the `__piNativesV18_3_0` sentinel — verified via `strings`.
- `scripts/ompz/build.sh` `stage_natives` skips staging only when a
  matching `.node` is already present; the five non-linux targets
  fetch fresh 18.3.0 prebuilts from npm during `--all`.
- No cargo/bazel on this machine — prebuilts are the only path, and
  they exist. macOS binaries are cross-compiled, not run-tested
  (same caveat as every prior ompz release).

## Plan — 1 PR (docs housekeeping)

The code sync is already public history on `origin/main` — **0
behind**, nothing left to merge. The single remaining PR is the
plan-docs commit the repo convention lands with each sync:

Branch `docs/sync-plans-18.3.0` off `main` (`08fee75553`):

1. `git checkout -b docs/sync-plans-18.3.0`
2. `git add docs/plans/active/ompz-update-channel.md
   docs/plans/active/upstream-sync-2026-09-23.md
   docs/plans/active/upstream-sync-2026-09-24.md`
3. `git commit` — `docs(plan): record upstream sync + update-channel
   plans`
4. Push branch; `gh pr create -R huaquanghan/omp-z` → base `main`.
   PR diff = 3 new plan docs only.
5. Land with a merge commit for consistency with prior syncs
   (squash would also be safe — this diff carries no upstream
   ancestry).

## PR requirements

- Body: `.github/PULL_REQUEST_TEMPLATE.md` sections preserved. Needs
  **one human-written sentence** from the author per CONTRIBUTING.md
  — obtain from the user before publishing.
- CHANGELOG: N/A — docs-only, no user-facing change.
- CI: none on fork; PR is a review/records artifact.

## Release — `ompz-v18.3.0` (post-merge, on main)

1. Pre-release sanity: `bun run check` in `packages/coding-agent`
   (oxlint + oxfmt + tsgo) and `bun test test/zvec-backend.test.ts`
   (skill gate; zvec path is addon-independent).
2. `scripts/ompz/build.sh --all` → 6 `dist/ompz-<target>` +
   `SHA256SUMS.txt`. Smoke: `dist/ompz-linux-x64 --version` = 18.3.0;
   `strings dist/ompz-linux-x64 | grep -c zvec` > 0.
3. `git tag ompz-v18.3.0` on main; push tag; `gh release create` with
   the 6 binaries + SHA256SUMS — reuse the `ompz-v18.2.11-2` notes
   format.
4. `docs(ompz): bump pinned release example to ompz-v18.3.0`
   (OMPZ.md line 41) — standalone post-release commit per
   convention (`003f5ce9f8`, `cc91fb1ce2`, …).
5. Banner extension subtitle in
   `~/.omp/agent/extensions/custom-banner.ts` (local, not committed).

## Edge cases / non-goals

- No bytecode re-enable (`OMP_NO_BYTECODE` stays — bun 1.4.0 boot
  crash). `zg` stays a runtime requirement; never vendored.
- If upstream pushes again before the release: `git fetch upstream`,
  `git merge upstream/main` on main, re-verify — the docs PR is
  independent of the release cut.
- Never ship binaries against stale addons: the `__piNativesV18_3_0`
  sentinel throws at load if an 18.2.11 `.node` is staged — linux-x64
  verified; build.sh stages the other five fresh from npm.
