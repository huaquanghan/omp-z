#!/usr/bin/env bash
# Build the custom ompz binary from this repo (omp-z fork + local patches),
# for the host platform or cross-compiled targets.
#
#   scripts/ompz/build.sh                     host platform only
#   scripts/ompz/build.sh darwin-arm64        one target
#   scripts/ompz/build.sh linux-x64 darwin-arm64
#   scripts/ompz/build.sh --all               every supported target
#
# Supported targets (upstream naming): darwin-arm64, darwin-x64,
# linux-arm64, linux-x64, windows-arm64, windows-x64.
#
# Bytecode compile is disabled (OMP_NO_BYTECODE=1 — see compile-binary.ts):
# on bun 1.4.0 the bytecode bundle crashes at boot with
# `import.meta is only valid inside modules`, on the unpatched tree too.
#
# Output: packages/coding-agent/dist/ompz-<target>[.exe] (+ dist/ompz for host),
#         packages/coding-agent/dist/SHA256SUMS.txt when more than one target.
#
# Environment:
#   CROSS_TARGET   set internally per target; do not set it yourself.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PKG="$REPO_ROOT/packages/coding-agent"
NATIVES_DIR="$REPO_ROOT/packages/natives/native"
NATIVES_VERSION="$(jq -r .version "$REPO_ROOT/packages/natives/package.json")"

ALL_TARGETS="darwin-arm64 darwin-x64 linux-arm64 linux-x64 windows-arm64 windows-x64"

case "$(uname -s)-$(uname -m)" in
	Linux-x86_64)  HOST_TARGET="linux-x64" ;;
	Linux-aarch64) HOST_TARGET="linux-arm64" ;;
	Darwin-arm64)  HOST_TARGET="darwin-arm64" ;;
	Darwin-x86_64) HOST_TARGET="darwin-x64" ;;
	*) HOST_TARGET="" ;;
esac

usage() { sed -n '2,20p' "$0"; }

TARGETS=()
if [[ $# -eq 0 ]]; then
	[[ -n "$HOST_TARGET" ]] || { echo "unsupported host: $(uname -s)-$(uname -m)" >&2; exit 1; }
	TARGETS=("$HOST_TARGET")
fi
for arg in "$@"; do
	case "$arg" in
		--all) TARGETS=($ALL_TARGETS) ;;
		-h | --help) usage; exit 0 ;;
		darwin-arm64 | darwin-x64 | linux-arm64 | linux-x64 | windows-arm64 | windows-x64)
			TARGETS+=("$arg") ;;
		win32-x64) TARGETS+=("windows-x64") ;;
		win32-arm64) TARGETS+=("windows-arm64") ;;
		*) echo "unknown target: $arg" >&2; usage >&2; exit 2 ;;
	esac
done

# Stage prebuilt pi-natives addons per target — `bun add`/`npm install` are
# platform-gated, so fetch the tarballs directly with npm pack.
stage_natives() {
	local target="$1" pkg
	pkg="pi-natives-${target/windows-/win32-}"
	if compgen -G "$NATIVES_DIR/pi_natives.${target/windows-/win32-}*.node" >/dev/null; then
		return
	fi
	echo "==> staging prebuilt @oh-my-pi/$pkg@$NATIVES_VERSION"
	local tmp
	tmp="$(mktemp -d)"
	(
		cd "$tmp" \
		&& npm pack "@oh-my-pi/$pkg@$NATIVES_VERSION" --silent >/dev/null \
		&& tar xzf ./*.tgz \
		&& find package -name 'pi_natives.*.node' -exec cp {} "$NATIVES_DIR/" \;
	)
	rm -rf "$tmp"
	compgen -G "$NATIVES_DIR/pi_natives.${target/windows-/win32-}*.node" >/dev/null \
		|| { echo "no $target addon inside $pkg@$NATIVES_VERSION" >&2; exit 1; }
}

(cd "$REPO_ROOT" && bun install)

BUILT=()
for target in "${TARGETS[@]}"; do
	stage_natives "$target"
	echo "==> building ompz-$target (bytecode disabled)"
	CROSS_TARGET="$target" OMP_NO_BYTECODE=1 bun --cwd="$PKG" run build
	src="$PKG/dist/omp-$target"
	case "$target" in
		windows-*) src="$src.exe"; dest="$PKG/dist/ompz-$target.exe" ;;
		*)         dest="$PKG/dist/ompz-$target" ;;
	esac
	mv -f "$src" "$dest"
	# Keep dist/ompz as the host-platform binary for install.sh.
	if [[ "$target" == "$HOST_TARGET" ]]; then cp -f "$dest" "$PKG/dist/ompz"; fi
	BUILT+=("$dest")
done

if [[ ${#BUILT[@]} -gt 1 ]]; then
	(cd "$PKG/dist" && sha256sum ompz-* > SHA256SUMS.txt)
fi

printf 'built: %s\n' "${BUILT[@]}"
if [[ "$OSTYPE" != msys* && "$OSTYPE" != cygwin* ]]; then
	for f in "${BUILT[@]}"; do case "$f" in *.exe) ;; *) "$f" --version ;; esac; done | sort -u
fi
