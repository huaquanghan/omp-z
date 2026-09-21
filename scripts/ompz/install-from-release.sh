#!/usr/bin/env bash
# Install the latest ompz release binary from GitHub — stock `omp` untouched.
#
#   curl -fsSL https://raw.githubusercontent.com/huaquanghan/omp-z/main/scripts/ompz/install-from-release.sh | bash
#
# Environment:
#   OMPZ_PREFIX    install directory          (default: ~/.local/bin)
#   OMPZ_VERSION   release tag to install     (default: latest release)
#   OMPZ_REPO      GitHub repo to pull from   (default: huaquanghan/omp-z)
set -euo pipefail

REPO="${OMPZ_REPO:-huaquanghan/omp-z}"
PREFIX="${OMPZ_PREFIX:-$HOME/.local/bin}"
VERSION="${OMPZ_VERSION:-latest}"

case "$(uname -s)-$(uname -m)" in
	Linux-x86_64)  ASSET="ompz-linux-x64" ;;
	Linux-aarch64) ASSET="ompz-linux-arm64" ;;
	Darwin-arm64)  ASSET="ompz-darwin-arm64" ;;
	Darwin-x86_64) ASSET="ompz-darwin-x64" ;;
	*)
		echo "unsupported platform: $(uname -s)-$(uname -m)" >&2
		echo "windows: download ompz-windows-*.exe from https://github.com/$REPO/releases" >&2
		exit 1 ;;
esac

if [[ "$VERSION" == "latest" ]]; then
	BASE_URL="https://github.com/$REPO/releases/latest/download"
else
	BASE_URL="https://github.com/$REPO/releases/download/$VERSION"
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "==> downloading $ASSET ($VERSION)"
curl -fsSL --progress-bar -o "$TMP/$ASSET" "$BASE_URL/$ASSET"
curl -fsSL -o "$TMP/SHA256SUMS.txt" "$BASE_URL/SHA256SUMS.txt" 2>/dev/null || true

if [[ -s "$TMP/SHA256SUMS.txt" ]] && grep -q " $ASSET\$" "$TMP/SHA256SUMS.txt"; then
	(cd "$TMP" && grep " $ASSET\$" SHA256SUMS.txt | sha256sum -c -)
else
	echo "warning: no checksum entry for $ASSET — skipping verification" >&2
fi

mkdir -p "$PREFIX"
install -m 0755 "$TMP/$ASSET" "$PREFIX/ompz"
echo "==> installed $PREFIX/ompz"
"$PREFIX/ompz" --version

case ":$PATH:" in
	*":$PREFIX:"*) ;;
	*) echo "note: $PREFIX is not on PATH — add it or run $PREFIX/ompz directly" ;;
esac
