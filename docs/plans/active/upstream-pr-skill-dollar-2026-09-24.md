# 1 PR into upstream `can1357/oh-my-pi` — `$name` skill alias

**Status: PLAN — awaiting user confirmation on direction + PR body.**
Re-verified 2026-09-24 (2nd check, fresh fetch): `upstream/main` still
`740f3e3154` — unchanged since first verification. Fork now **48 ahead**
(+2 fork-specific `scripts/ompz/install-from-release.sh` polish commits
`6041010164`+`15bdd8f275`); delta classification unchanged. Upstream PRs
#12779/#12786 still OPEN; no duplicate `$name`-alias PR exists upstream
(closest: #12535, different feature). Zero open PRs on the fork.

## Fork ↔ upstream status (verified 2026-09-24, post-fetch)

- `upstream/main` = `740f3e3154` — moved past tag `v18.3.0` (`62bc57be1b`)
  via post-release merges (PRs #13131, #13132, farm worktree-paths fix).
  Local `main` already contains it — **0 behind / 48 ahead**.
- `huaquanghan/omp-z` is a GitHub fork of `can1357/oh-my-pi` — an upstream PR
  ships from a fork branch.
- Fork-original upstreamable work in the 48-commit delta: exactly **one**
  feature — `724ed040d4` (`$name` skill alias).
  `08fee75553` (unused-import cleanup) is now a **no-op**: upstream
  independently removed the same `getBundledModels` import;
  `git diff upstream/main main -- cline-pass-compat.test.ts` is empty.

## Delta classification (46 commits)

| Class | Commits | Disposition |
| --- | --- | --- |
| Already merged upstream (cherry-picks) | `352d221465`→`7e683e5668` (subagent stream-retry), `b5dae7a17f`→`3814a661d0` (oxfmt) | nothing to do |
| Cherry-picked from **open** upstream PRs by other authors | `1ade8710cf`+`10c204437c` → **PR #12779** (EPIPE, HJXArthurAtlas); `a9b15299d2`+`d1116b57be`+`1a6cd261d6` → **PR #12786** (retry deadline, geoyws) | do NOT resubmit — would duplicate their PRs (both still OPEN as of today) |
| Inapplicable / now-identical upstream | `34c20a5117` (fixtures for test files that don't exist upstream), `f60163b991` (AuthStorage.keys), `08fee75553` (upstream made the same removal) | drop |
| Fork-specific by design | zvec backend `304bc272c6`+`5d568b764a`; ompz build/install/update/banner/statusline/skills/docs (~20 commits); `docs(ompz)` version bumps; 11 merge commits | stays in fork |
| **Upstreamable** | **`724ed040d4`** feat(skills): `$name` alias | this PR |

## The PR

- **Title**: `feat(skills): accept $name as Codex-style alias for /skill:name`
- **Branch**: `feat/skill-dollar-alias` off `upstream/main` on
  `huaquanghan/omp-z` → PR head `huaquanghan:feat/skill-dollar-alias`,
  base `can1357/oh-my-pi:main`.
- **Content**: `724ed040d4` minus the internal plan doc — 12 files,
  +553/−44 (src + 4 test files + 2 docs). Cherry-pick **re-verified clean
  today** on `740f3e3154` in a scratch worktree (auto-merge, no conflicts).
- **Semantics check**: upstream `skill-tokens.ts` treats `$`/`$$`/`!` followed
  by whitespace as local-execution sigils (`startsWithLocalExecutionPrefix`).
  The alias is glued `$<name>` (letter/underscore start, never whitespace) —
  disjoint by construction; upstream diff to that file is purely additive.
- **Excluded**: `docs/plans/active/skill-dollar-invocation.md` (internal
  plan doc, must not go upstream).
- **Excluded**: `08fee75553` — no longer a delta at all.

### Steps

1. `git fetch upstream && git checkout -b feat/skill-dollar-alias upstream/main`
2. `git cherry-pick -n 724ed040d4` — verified conflict-free; auto-merge
   keeps upstream's `/annotate` section in `docs/slash-command-internals.md`
   (the file drifted upstream since this commit's parent — do NOT use
   file-level `git checkout 724ed040d4 -- …`, it would revert `/annotate`).
3. `git rm --cached docs/plans/active/skill-dollar-invocation.md` and
   delete the file — internal plan doc stays out of the upstream diff.
4. Commit the remaining 12 files, verify on the branch:
   - `bun install`
   - `bun --cwd packages/tui test test/autocomplete.test.ts test/custom-editor.test.ts test/editor-autocomplete-actions.test.ts`
   - `bun --cwd packages/coding-agent test test/skills.test.ts`
   - `bun check` (PR-template checklist item) + oxfmt on touched files
5. `git push -u origin feat/skill-dollar-alias`
6. `gh pr create --repo can1357/oh-my-pi --base main --head huaquanghan:feat/skill-dollar-alias` using upstream's template (`What` / `Why` / `Testing` + checklist).
7. After creation: changelog attribution — external contribution adds PR
   link + contributor credit once GitHub assigns the number
   (AGENTS.md + template checklist).

### Gates before `gh pr create`

- CONTRIBUTING.md: body MUST contain ≥1 sentence in the user's own words —
  need it from the user, never generate a substitute.
- CONTRIBUTING.md: changes spanning several packages are "discuss in Discord
  first" territory — this patch spans `pi-tui` + `coding-agent` and adds
  user-facing syntax, so flag the rejection risk in the body/plan.
- AGENTS.md GitHub rules: show the proposed PR title/body and get explicit
  confirmation before creating. Do not open a GitHub issue for this work
  (robomp picks up actionable issues).
- AI-assisted clause: user reviews every changed file and runs the checks
  themselves before submitting under their name.

## If "update code into it" meant the fork instead

Nothing to merge (0 behind) and `ompz-v18.3.0` is already released
(2026-09-24T04:38Z). Only remaining fork-side work: land the ~10 untracked
plan docs in `docs/plans/active/` as 1 docs-only housekeeping PR — see
`sync-housekeeping-2026-09-24.md`.

## Open questions for user

1. Direction: upstream contribution PR (this doc) vs fork housekeeping PR?
2. The own-words sentence for the PR body?
3. Confirm the `$name` alias is wanted upstream (it's fork-original UX; the
   maintainer has not asked for it — CONTRIBUTING.md suggests Discord
   discussion first for cross-package changes).
