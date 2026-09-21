#!/usr/bin/env bash
# Install the custom build as `ompz` on PATH; stock `omp` is left untouched.
# Records a build stamp used by check-update.sh.
#
#   scripts/ompz/install.sh
#
# Environment:
#   OMPZ_PREFIX   bin directory (default: ~/.local/bin)
#   OMPZ_STATE    state directory for the build stamp (default: ~/.local/state/ompz)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

REPO_ROOT="$(ompz_repo_root)"
SRC="$REPO_ROOT/packages/coding-agent/dist/ompz"
PREFIX="${OMPZ_PREFIX:-$HOME/.local/bin}"
STATE_DIR="${OMPZ_STATE:-$HOME/.local/state/ompz}"
DEST="$PREFIX/ompz"

if [[ ! -x "$SRC" ]]; then
	echo "missing $SRC — run scripts/ompz/build.sh first" >&2
	exit 1
fi

mkdir -p "$PREFIX" "$STATE_DIR"
install -m 0755 "$SRC" "$DEST"

COMMIT="$(git -C "$REPO_ROOT" rev-parse HEAD)"
TREE_HASH="$(ompz_tree_hash "$REPO_ROOT")"
VERSION="$(jq -r .version "$REPO_ROOT/packages/coding-agent/package.json")"

cat > "$STATE_DIR/build.json" <<EOF
{
	"commit": "$COMMIT",
	"treeHash": "$TREE_HASH",
	"version": "$VERSION",
	"builtAt": "$(date -u +%FT%TZ)",
	"bun": "$(bun --version)"
}
EOF

echo "installed $DEST (omp $VERSION @ ${COMMIT:0:12})"
echo "stock omp unchanged: $(command -v omp || echo 'not on PATH')"
