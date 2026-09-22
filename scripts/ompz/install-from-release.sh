#!/usr/bin/env bash
# Install the latest ompz release binary from GitHub — stock `omp` untouched.
#
#   curl -fsSL https://raw.githubusercontent.com/huaquanghan/omp-z/main/scripts/ompz/install-from-release.sh | bash
#
# Environment:
#   OMPZ_PREFIX    install directory          (default: ~/.local/bin)
#   OMPZ_VERSION   release tag to install     (default: latest release)
#   OMPZ_REPO      GitHub repo to pull from   (default: huaquanghan/omp-z)
#   NO_COLOR       disable colored output     (also auto-off when not a TTY)
set -euo pipefail

REPO="${OMPZ_REPO:-huaquanghan/omp-z}"
PREFIX="${OMPZ_PREFIX:-$HOME/.local/bin}"
VERSION="${OMPZ_VERSION:-latest}"

# --- pretty output ---------------------------------------------------------
if [[ -t 2 && -z "${NO_COLOR:-}" ]]; then
	BOLD=$'\033[1m'; DIM=$'\033[2m'; GREEN=$'\033[32m'; CYAN=$'\033[36m'; YELLOW=$'\033[33m'; RED=$'\033[31m'; RESET=$'\033[0m'
	TTY=1
else
	BOLD=""; DIM=""; GREEN=""; CYAN=""; YELLOW=""; RED=""; RESET=""; TTY=0
fi

step() { printf '%s==>%s %s\n' "$CYAN" "$RESET" "$*" >&2; }
ok()   { printf ' %s✓%s %s\n' "$GREEN" "$RESET" "$*" >&2; }
warn() { printf ' %s!%s %s\n' "$YELLOW" "$RESET" "$*" >&2; }
die()  { printf ' %s✗%s %s\n' "$RED" "$RESET" "$*" >&2; exit 1; }

human_bytes() { # bytes -> "197 MiB"
	local b="$1"
	if   (( b >= 1048576 )); then awk -v b="$b" 'BEGIN{printf "%.0f MiB", b/1048576}'
	elif (( b >= 1024 ));    then awk -v b="$b" 'BEGIN{printf "%.0f KiB", b/1024}'
	else printf '%s B' "$b"; fi
}

stat_size() { stat -c %s "$1" 2>/dev/null || stat -f %z "$1" 2>/dev/null || echo 0; }

# " · ━━━━━━━━━───── 47% · 92/197 MiB · ϟ"
bar_frame() { # <cur-bytes> <total-bytes>
	local cur="$1" total="$2" pct filled i filled_bar="" empty_bar=""
	pct=$(( total > 0 ? cur * 100 / total : 0 ))
	if (( pct > 100 )); then pct=100; fi
	filled=$(( pct * 36 / 100 ))
	for (( i = 0; i < filled; i++ ));   do filled_bar+="━"; done
	for (( i = filled; i < 36; i++ )); do empty_bar+="─"; done
	printf '\r %s·%s %s%s%s%s %s%3d%%%s %s·%s %s/%s MiB %s·%s %sϟ%s\033[K' \
		"$DIM" "$RESET" \
		"$GREEN" "$filled_bar" "$DIM" "$empty_bar" \
		"$BOLD" "$pct" "$RESET" \
		"$DIM" "$RESET" "$(( cur / 1048576 ))" "$(( total / 1048576 ))" \
		"$DIM" "$RESET" "$CYAN" "$RESET" >&2
}

# Redraw bar_frame in place while <pid> runs; leaves the final frame on screen.
dl_bar() { # <pid> <file> <total>
	local pid="$1" file="$2" total="$3"
	while kill -0 "$pid" 2>/dev/null; do
		bar_frame "$(stat_size "$file")" "$total"
		sleep 0.12
	done
	bar_frame "$(stat_size "$file")" "$total"
	printf '\n' >&2
}

# " · ⠋ verifying checksum" — spins while <pid> runs, returns its exit code
spinner() { # <pid> <label>
	local pid="$1" label="$2" i=0
	local chars='⠋⠙⠹⠸⠼⠴⦦⠧⠇⠏'
	while kill -0 "$pid" 2>/dev/null; do
		printf '\r %s·%s %s%s%s %s\033[K' \
			"$DIM" "$RESET" "$CYAN" "${chars:i++%10:1}" "$RESET" "$label" >&2
		sleep 0.08
	done
	printf '\r\033[K' >&2
	wait "$pid"
}

case "$(uname -s)-$(uname -m)" in
	Linux-x86_64)  ASSET="ompz-linux-x64" ;;
	Linux-aarch64) ASSET="ompz-linux-arm64" ;;
	Darwin-arm64)  ASSET="ompz-darwin-arm64" ;;
	Darwin-x86_64) ASSET="ompz-darwin-x64" ;;
	*)
		die "unsupported platform: $(uname -s)-$(uname -m) — windows: download ompz-windows-*.exe from https://github.com/$REPO/releases"
		;;
esac

if [[ "$VERSION" == "latest" ]]; then
	BASE_URL="https://github.com/$REPO/releases/latest/download"
else
	BASE_URL="https://github.com/$REPO/releases/download/$VERSION"
fi

# Resolve the tag + asset size up front so the download line can say what it's
# actually fetching. Best-effort — failed lookups just mean quieter output.
TAG_LABEL="$VERSION"
SIZE_LABEL=""
SIZE_BYTES=0
if [[ "$VERSION" == "latest" ]]; then
	# `releases/latest` is an HTML redirect to `releases/tag/<tag>` — HEAD it
	# without following to read the resolved tag off the location header.
	if tag_headers="$(curl -fsSI --max-time 10 "https://github.com/$REPO/releases/latest" 2>/dev/null)"; then
		loc="$(printf '%s' "$tag_headers" | tr -d '\r' | awk 'tolower($1)=="location:"{print $2}' | tail -1)"
		if [[ "$loc" =~ /tag/([^/]+) ]]; then TAG_LABEL="${BASH_REMATCH[1]}"; fi
	fi
fi
if asset_headers="$(curl -fsSIL --max-time 10 "$BASE_URL/$ASSET" 2>/dev/null)"; then
	size="$(printf '%s' "$asset_headers" | tr -d '\r' | awk 'tolower($1)=="content-length:"{print $2}' | tail -1)"
	if [[ "$size" =~ ^[0-9]+$ ]]; then
		SIZE_BYTES="$size"
		SIZE_LABEL=" · $(human_bytes "$size")"
	fi
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

printf '%sompz installer%s\n' "$BOLD" "$RESET" >&2

download() {
	step "downloading $ASSET ${DIM}($TAG_LABEL$SIZE_LABEL)${RESET}"
	if (( TTY && SIZE_BYTES > 0 )); then
		curl -fsSL --retry 3 -o "$TMP/$ASSET" "$BASE_URL/$ASSET" &
		dl_bar $! "$TMP/$ASSET" "$SIZE_BYTES"
		if ! wait $!; then die "download failed — check your connection"; fi
	else
		curl -fsSL --progress-bar --retry 3 -o "$TMP/$ASSET" "$BASE_URL/$ASSET"
	fi
	curl -fsSL -o "$TMP/SHA256SUMS.txt" "$BASE_URL/SHA256SUMS.txt" 2>/dev/null || true
}

verify() {
	if [[ -s "$TMP/SHA256SUMS.txt" ]] && grep -q " $ASSET\$" "$TMP/SHA256SUMS.txt"; then
		if (( TTY )); then
			(cd "$TMP" && grep " $ASSET\$" SHA256SUMS.txt | sha256sum -c - >/dev/null 2>&1) &
			spinner $! "verifying checksum"
		else
			(cd "$TMP" && grep " $ASSET\$" SHA256SUMS.txt | sha256sum -c - >/dev/null 2>&1)
		fi
	else
		return 2 # no checksum to verify against
	fi
}

attempt=1
while true; do
	download
	rc=0; verify || rc=$?
	case "$rc" in
		0)
			ok "checksum verified ${DIM}$(sha256sum "$TMP/$ASSET" | cut -c1-16)…${RESET}"
			break
			;;
		2)
			warn "no checksum entry for $ASSET — skipping verification"
			break
			;;
		*)
			if (( attempt++ < 2 )); then
				warn "checksum mismatch — retrying download"
				rm -f "$TMP/$ASSET"
			else
				die "checksum mismatch after retry — refusing to install a corrupt binary"
			fi
			;;
	esac
done

mkdir -p "$PREFIX"
install -m 0755 "$TMP/$ASSET" "$PREFIX/ompz"
ok "installed $PREFIX/ompz"

if "$PREFIX/ompz" --version >/dev/null 2>&1; then
	ok "$("$PREFIX/ompz" --version)"
fi

case ":$PATH:" in
	*":$PREFIX:"*) ;;
	*) warn "$PREFIX is not on PATH — add it or run $PREFIX/ompz directly" ;;
esac
