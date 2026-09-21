---
name: ompz-upstream
description: Check can1357/oh-my-pi upstream for new releases and merge them into this omp-z fork — fetch tags, assess the zvec-patch conflict surface, merge, rebuild all platform binaries, cut a new ompz release. Use when upstream omp has an update, when asked to sync/merge upstream, bump the base version, or release a new ompz.
version: 1.0.0
argument-hint: "[check|merge|release]"
---

# ompz upstream sync

Sync new `can1357/oh-my-pi` releases into this fork (`huaquanghan/omp-z`), which
carries the zvec memory backend patch plus ompz build tooling on top.

## Context

- Upstream tags: `v*` on `can1357/oh-my-pi`; fork remote: `origin`.
- Fork = upstream base + zvec patch + `OMP_NO_BYTECODE` toggle + `scripts/ompz/`
  + `OMPZ.md`.
- Build: `scripts/ompz/build.sh --all` → `dist/ompz-<target>` x6 + SHA256SUMS.txt.
- Bytecode MUST stay disabled (bun 1.4.0 boot crash) — never re-enable.
- Native addons come from `@oh-my-pi/pi-natives-<tag>@<version>` npm prebuilts;
  a new upstream version needs matching packages on npm — verify with
  `npm view @oh-my-pi/pi-natives-linux-arm64@<new-version>` before building.

## Workflow

1. Run `scripts/check-upstream.sh` (this skill). It prints base tag, latest
   upstream tag, commit delta, and the conflict-risk file intersection.
   - `up to date` → report and stop.
   - If the user only asked to *check*, report the delta and stop — do not merge.
2. For each conflict-risk file, inspect `git diff <base>..<latest> -- <path>`.
   Consult `references/zvec-patch-surface.md` for what each patched file does
   and how to resolve.
3. Merge the tag into `main`: `git merge <latest-tag>`. Never rebase — merge
   confines conflicts to the risky files. `src/zvec/` and `scripts/ompz/` never
   conflict (ours only). Abort with `git merge --abort` if upstream rewrote
   memory-backend wholesale; re-port zvec instead.
4. Verify the merged tree:
   - `bun --cwd packages/coding-agent run test test/zvec-backend.test.ts`
   - `OMP_NO_BYTECODE=1 CROSS_TARGET=linux-x64 bun --cwd packages/coding-agent run build`
   - `dist/omp-linux-x64 --version` shows the new version;
     `strings dist/omp-linux-x64 | grep -c zvec` > 0.
5. Full build: `scripts/ompz/build.sh --all` (6 targets + SHA256SUMS.txt).
6. Bump version literals: `OMPZ.md` examples, banner extension subtitle
   (`~/.omp/agent/extensions/custom-banner.ts`, not committed), release notes.
7. Push `main` (never force-push), tag `ompz-v<version>`, `gh release create`
   with the 6 binaries + SHA256SUMS.txt. Reuse the notes format from the
   `ompz-v18.2.7` release.
8. Report: upstream tag merged, conflicts resolved, test/build results,
   release URL, and anything that could not be verified locally (e.g. macOS
   binaries are cross-compiled, not run-tested).

## Security policy

- Never commit secrets, credentials, `.env`, or local state to the repo.
- Never force-push `main`; never delete or rewrite upstream tags.
- GitHub comments/issues require explicit user confirmation before posting —
  pushing commits, tags, and release assets to the fork is authorized work.
- `zg` stays a documented runtime requirement; never vendor or bundle it.
