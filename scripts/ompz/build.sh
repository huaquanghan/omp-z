#!/usr/bin/env bash
# Build the custom ompz binary from this repo (omp-z fork + local patches).
#
# Bytecode compile is disabled (OMP_NO_BYTECODE=1 — see compile-binary.ts):
# on bun 1.4.0 the bytecode bundle crashes at boot with
# `import.meta is only valid inside modules`, on the unpatched tree too.
#
# Output: packages/coding-agent/dist/ompz
#
# Environment:
#   CROSS_TARGET   forwarded to the upstream build (e.g. linux-x64, darwin-arm64)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PKG="$REPO_ROOT/packages/coding-agent"
NATIVES_DIR="$REPO_ROOT/packages/natives/native"

# Prebuilt pi-natives addon, staged from npm — the bazel/rust source build is
# not required for the binary pipeline.
case "$(uname -s)-$(uname -m)" in
	Linux-x86_64)  PLATFORM_TAG="linux-x64" ;;
	Linux-aarch64) PLATFORM_TAG="linux-arm64" ;;
	Darwin-arm64)  PLATFORM_TAG="darwin-arm64" ;;
	Darwin-x86_64) PLATFORM_TAG="darwin-x64" ;;
	*) echo "unsupported platform: $(uname -s)-$(uname -m)" >&2; exit 1 ;;
esac

if ! compgen -G "$NATIVES_DIR/pi_natives.$PLATFORM_TAG*.node" >/dev/null; then
	NATIVES_VERSION="$(jq -r .version "$REPO_ROOT/packages/natives/package.json")"
	echo "==> staging prebuilt @oh-my-pi/pi-natives@$NATIVES_VERSION ($PLATFORM_TAG)"
	TMP="$(mktemp -d)"
	trap 'rm -rf "$TMP"' EXIT
	(cd "$TMP" && bun add "@oh-my-pi/pi-natives@$NATIVES_VERSION" >/dev/null)
	found=0
	while IFS= read -r f; do cp "$f" "$NATIVES_DIR/"; found=1; done \
		< <(find "$TMP/node_modules" -name "pi_natives.$PLATFORM_TAG*.node")
	[[ "$found" == 1 ]] || { echo "no prebuilt addon for $PLATFORM_TAG in pi-natives@$NATIVES_VERSION" >&2; exit 1; }
fi

(cd "$REPO_ROOT" && bun install)

echo "==> building omp (bytecode disabled)"
OMP_NO_BYTECODE=1 bun --cwd="$PKG" run build

OUT="$PKG/dist/omp"
[[ "$OSTYPE" == darwin* ]] || true
if [[ -n "${CROSS_TARGET:-}" && -x "$PKG/dist/omp-$CROSS_TARGET" ]]; then
	OUT="$PKG/dist/omp-$CROSS_TARGET"
fi
mv -f "$OUT" "$PKG/dist/ompz"
echo "==> built $PKG/dist/ompz"
"$PKG/dist/ompz" --version
