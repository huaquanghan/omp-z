# ompz — custom omp build (omp-z fork + zvec memory)

`ompz` is a custom binary of [oh-my-pi](https://github.com/can1357/oh-my-pi) built
from this repo — upstream base plus the **zvec memory backend**: local markdown
memories indexed by the [`zg` (zvec-grep)](https://github.com/zvec-ai/zvec-grep)
CLI for hybrid BM25 + vector recall, selectable in `/settings` → Memory Backend.

It installs next to stock `omp` under its own name — your existing `omp` is
untouched.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/huaquanghan/omp-z/main/scripts/ompz/install-from-release.sh | bash
```

Downloads the matching binary from the
[latest release](https://github.com/huaquanghan/omp-z/releases/latest),
verifies it against `SHA256SUMS.txt`, and installs to `~/.local/bin/ompz`.

### Manual download

| Platform | Asset |
| --- | --- |
| macOS (Apple Silicon) | `ompz-darwin-arm64` |
| macOS (Intel) | `ompz-darwin-x64` |
| Linux x64 | `ompz-linux-x64` |
| Linux arm64 | `ompz-linux-arm64` |
| Windows x64 | `ompz-windows-x64.exe` |
| Windows arm64 | `ompz-windows-arm64.exe` |

```
https://github.com/huaquanghan/omp-z/releases/latest/download/<asset>
```

`chmod +x` it and put it on your `PATH` as `ompz`.

### Pin a version

```bash
OMPZ_VERSION=ompz-v18.2.10 curl -fsSL https://raw.githubusercontent.com/huaquanghan/omp-z/main/scripts/ompz/install-from-release.sh | bash
```

Other knobs: `OMPZ_PREFIX` (install dir), `OMPZ_REPO` (fork to pull from).

## Requirements

- `zg` on `PATH` — the zvec-grep CLI that builds and queries the index:
  `bun install -g @zvec/zvec-grep` (Node 22+) or `cargo install zvec-grep`.
  Without it the backend degrades gracefully (recall/retain become no-ops).
- Enable the backend once: `ompz config set memory.backend zvec`.
- Optional banner extension: `~/.omp/agent/extensions/custom-banner.ts`.

## Verify

```bash
ompz --version                  # omp/<version>
ompz config list | grep zvec    # zvec.* settings + zvec in memory.backend enum
zg --version
```

## Differences vs upstream `omp`

- `memory.backend` gains the `zvec` value; `zvec.*` settings appear in config.
- Built-in `recall` / `retain` / `reflect` / `memory_edit` tools route to zvec
  when selected — no extra tool names to learn.
- Banks live under `<agent dir>/memories/zvec/<bank>/` and are byte-compatible
  with the [omp-zvec-memory](https://github.com/therealtinhtute/omp-zvec-memory)
  extension banks.
- Binaries are compiled **without bytecode** (`OMP_NO_BYTECODE=1`) — bun 1.4.0's
  bytecode bundle crashes at boot on this tree. Startup is slightly slower;
  everything else is identical.

## Build from source

```bash
git clone git@github.com:huaquanghan/omp-z.git && cd omp-z
scripts/ompz/build.sh                  # host platform → dist/ompz
scripts/ompz/build.sh --all            # every supported target → dist/ompz-<target>
scripts/ompz/install.sh                # install dist/ompz → ~/.local/bin/ompz
scripts/ompz/check-update.sh           # poll origin for new commits; --yes rebuilds
```

Prebuilt `pi-natives` addons are fetched from npm automatically — no bazel or
rust toolchain needed.
