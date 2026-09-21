# Zvec memory backend

Oh My Pi can use the [`zg` (zvec-grep)](https://github.com/zvec-ai/zvec-grep) CLI as a local long-term memory backend. Memories are plain markdown files; zg builds a hybrid BM25 + vector index over them and answers recall queries.

Set:

```yaml
memory:
  backend: zvec
```

`zg` must be on `PATH` (`zg --version`). Without it the backend stays inert and reports the missing binary through `/memory stats` and `/memory diagnose`.

## How it works

1. Memories are written as one markdown file per entry under `<agent memories dir>/zvec/<bank>/memories/<id>.md`, with a small YAML frontmatter (`id`, `created`, `source`, `session`, `importance`).
2. `zg index <bank dir>` builds or incrementally refreshes the index in `<bank dir>/.zvec-grep/`. Indexing runs in the background after a write and is deduplicated per bank.
3. Recall runs `zg query <query> --limit N --preview full --trace` with the bank directory as the workspace and parses the agent-markdown hits.
4. The first turn of a session recalls with the user's prompt (plus `zvec.recallContextTurns` of prior context) and injects the hits as a `<memories>` block; `agent_end` retains completed turns every `zvec.retainEveryNTurns` user turns.
5. Compaction asks the backend for extra context, which recalls against the last user message.

Recalled memory is background context, not instructions. Current user messages and tool output take precedence when they conflict.

## Agent tools

Selecting zvec makes these discoverable tools available:

- `recall` — hybrid search over the bank. Results include memory ids.
- `retain` — store durable facts explicitly.
- `reflect` — synthesize an answer across recalled memories.
- `memory_edit` — `update`, `forget`, or `invalidate` a memory by id.
- `learn` — retain a lesson (and optionally mint a managed skill) when `autolearn.enabled: true`.

Read the full entry with `read memory://<memory-id>` before `memory_edit update`; recall output is clipped per item.

## Settings

| Setting                       | Default                      | Description                                                                                                                                  |
| ----------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `memory.backend`              | `off`                        | Set to `zvec` to enable this backend.                                                                                                        |
| `zvec.bank`                   | unset                        | Shared bank name used when scoping is `global`. Unset → the shared `default` bank.                                                           |
| `zvec.scoping`                | `per-project`                | `per-project` = bank derived from the working directory; `global` = one shared bank for every project.                                       |
| `zvec.embeddingModel`         | `local/potion-code-16m-v2`   | Embedding model for new indexes (see `zg help models`). Existing indexes keep their stored model.                                            |
| `zvec.autoRecall`             | `true`                       | Recall relevant memories into the first turn of each session.                                                                                |
| `zvec.autoRetain`             | `true`                       | Retain completed conversation turns into the bank.                                                                                           |
| `zvec.retainEveryNTurns`      | `4`                          | Minimum user turns between automatic retain writes.                                                                                          |
| `zvec.recallLimit`            | `8`                          | Maximum hits per recall query.                                                                                                               |
| `zvec.recallContextTurns`     | `3`                          | Prior user-bounded turns included in recall queries.                                                                                         |
| `zvec.recallMaxQueryChars`    | `4000`                       | Maximum composed recall query length.                                                                                                        |
| `zvec.injectionTokenLimit`    | `5000`                       | Approximate token budget for the injected memory block.                                                                                      |
| `zvec.debug`                  | `false`                      | Log backend failures (index refresh, recall query) at debug level.                                                                           |

## Scoping

- `per-project` (default) keys the bank from the working directory alone — its basename plus a stable hash of its absolute path — so every worktree of one repository resolves to the same bank.
- `global` uses one shared bank named by `zvec.bank` (default `default`).

## Slash commands

`/memory view`, `/memory stats`, `/memory diagnose`, `/memory clear`, `/memory enqueue`, and `/memory queue` route through the backend:

- `view` — the injected payload (static guidance plus the last recall snippet).
- `stats` — bank path, memory count, embedding model, and `zg status` output.
- `diagnose` — index presence, zg binary, last recall error, and `zg status`.
- `clear` — deletes the bank directory, including the derived index.
- `enqueue` / `sync` — retains the current session and rebuilds the index now.
- `queue` — stored memory count and index presence.

## Operational notes

- The index is derived state: deleting `.zvec-grep/` inside a bank is safe; the next recall or `/memory enqueue` rebuilds it.
- Subagents do not own recall/retain loops; their `recall`/`retain`/`memory_edit` calls operate on the same file-backed bank.
- Backend startup is best-effort. If zg is missing or the bank cannot be created, the session continues with the backend inert and logs a warning.
