# zvec patch surface — merge-conflict map

Files this fork diverges from upstream on. "Ours only" files can never conflict;
the rest conflict when upstream edits the same hunks.

## Never conflicts (ours only)

- `packages/coding-agent/src/zvec/` — entire backend module (backend, config,
  indexer, paths, state, store, zg wrapper)
- `packages/coding-agent/test/zvec-backend.test.ts`
- `scripts/ompz/` — build/install/check-update/install-from-release
- `OMPZ.md`, `docs/zvec-memory-backend.md`, `.devin/`

## Conflict candidates

| Path | What ours adds | Merge guidance |
| --- | --- | --- |
| `src/config/settings-schema.ts` | `zvec` in `memory.backend` enum + `zvec.*` settings (~85 lines) | Highest-churn file upstream. Re-add enum member and the `zvec.*` block on upstream's new shape. |
| `src/internal-urls/memory-protocol.ts` | zvec memory ops (~95 lines) | Largest hunk overlap risk — read upstream diff first. |
| `src/tools/memory-{recall,retain,reflect,edit}.ts`, `learn.ts` | `backend === "zvec"` routing branches | Mostly additive branches; re-apply onto refactored signatures. |
| `src/tools/index.ts` | tool registration entries | Mechanical. |
| `src/memory-backend/types.ts` | `"zvec"` in backend union | Mechanical. |
| `src/memory-backend/resolve.ts` | `case "zvec"` → `ZvecBackend` | If upstream adds backends, keep our case alongside. |
| `src/memory-backend/runtime.ts`, `session/session-advisors.ts` | zvec wiring | Small. |
| `scripts/compile-binary.ts` | `OMP_NO_BYTECODE` env toggle (NOT zvec) | If upstream touches the `bytecode:` line, keep the env guard — bytecode still crashes on bun 1.4.0. |
| `README.md` | ompz banner at top | Upstream README edits land here; keep our banner block, take their body. |
| `docs/memory.md`, `DEVELOPMENT.md` | zvec mentions | Trivial. |

## Resolution rule

Preserve BOTH upstream's refactor and zvec integration: re-apply zvec hooks
onto upstream's new code shape rather than reverting upstream hunks. If
upstream rewrote a subsystem wholesale (e.g. memory-backend replaced), abort
with `git merge --abort` and re-port zvec instead of resolving.
