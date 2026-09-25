# Fork↔upstream check + housekeeping PR — 2026-09-24

**Status: planned, not executed.** Verified this session: fork is fully
synced (0 behind upstream), `ompz-v18.3.0` already released. The single
remaining PR is docs-only — landing this sync's plan records.

## Verified fork ↔ upstream status (2026-09-24, fresh fetch)

- `upstream/main` = `62bc57be1b` — tag `v18.3.0`, unchanged since the
  sync merge. Newest `v*` tag; upstream GitHub release `v18.3.0` shipped
  2026-09-24T02:21Z.
- `main` = `origin/main` = `0a39f88659` — **43 ahead / 0 behind**.
  Merge-base = `62bc57be1b` = upstream HEAD itself → **no upstream delta
  left to merge.**
- `ompz-v18.3.0` release published 2026-09-24T04:38Z (Latest) — all 6
  binaries + `SHA256SUMS.txt` confirmed on the release; tag sits on
  `0a39f88659` (includes the post-release OMPZ.md pin bump).
- Open PRs on the fork: none. Worktree: clean except three untracked
  plan docs (`ompz-update-channel.md`, `upstream-sync-2026-09-23.md`,
  `upstream-sync-2026-09-24.md`) plus this file.
- CI surface: `.github/workflows/ci.yml` `pull_request` paths cover
  `packages/**`, `crates/**`, `scripts/**`, `bazel/**`, root manifests —
  a `docs/**`-only diff triggers **no** CI jobs. Expected, not a failure.

## Finding

There is no code to update: every `upstream/main` commit through
`v18.3.0` is merged (`663ac2a00c` + oxlint cleanup `08fee75553`) and
released (`ompz-v18.3.0`). The "1 PR" left is the repo-convention commit
landing the sync's plan docs.

## The 1 PR — `docs/sync-plans-18.3.0` → `huaquanghan/omp-z:main`

Docs-only diff: 4 files under `docs/plans/active/`.

1. Refresh the stale status header in `upstream-sync-2026-09-24.md`:
   release is no longer "pending" — `ompz-v18.3.0` published with tag on
   `0a39f88659`; ahead count 42 → 43. Everything else in the doc holds.
2. `git checkout -b docs/sync-plans-18.3.0` off `main` (`0a39f88659`).
3. `git add docs/plans/active/{ompz-update-channel,upstream-sync-2026-09-23,upstream-sync-2026-09-24,sync-housekeeping-2026-09-24}.md`
4. Commit: `docs(plan): record v18.3.0 sync + update-channel plans`
5. Push branch; `gh pr create -R huaquanghan/omp-z --base main`.
6. Land it — **squash is safe** (docs-only, no upstream ancestry in this
   diff); a merge commit is equally fine for consistency with prior
   sync PRs.

### PR body requirements

- `.github/PULL_REQUEST_TEMPLATE.md` sections preserved (What / Why /
  Testing + checklist).
- CONTRIBUTING.md: **≥1 sentence written by the author in their own
  words** explaining what changed and why — must be supplied by the user
  before publishing; never generate a substitute.
- CHANGELOG: N/A — docs-only, no user-facing change (note in Testing).
- Checklist: `bun check` / "Tested locally" are N/A for docs — explain in
  Testing rather than checking blindly.

## Edge cases / non-goals

- If `upstream/main` moves before the PR lands: still safe — a docs PR
  doesn't touch merge ancestry. A new `v*` tag restarts the
  ompz-upstream flow instead (fetch → conflict-surface check → merge →
  `pi-natives` npm gate → `build.sh --all` → release).
- If the intent was the reverse direction (pushing the zvec patch
  upstream to `can1357/oh-my-pi`): that is a different, much larger PR —
  out of scope here; would need its own plan.
- Never rebase/force-push `main`; `OMP_NO_BYTECODE` stays (bun 1.4.0
  boot crash); `zg` stays a runtime requirement, never vendored.
