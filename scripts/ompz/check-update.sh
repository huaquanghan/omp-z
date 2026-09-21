#!/usr/bin/env bash
# Check the omp-z remote for updates to the installed ompz build.
#
#   scripts/ompz/check-update.sh          report only
#   scripts/ompz/check-update.sh --yes    pull + rebuild + install
#
# The remote defaults to this repo's `origin` (the omp-z fork); point it at
# upstream instead with OMPZ_REMOTE=upstream (after `git remote add upstream
# https://github.com/can1357/oh-my-pi.git`). A rebuild is also flagged when the
# local tree changed since the installed build — e.g. the zvec patch moved.
#
# Environment:
#   OMPZ_REMOTE   git remote to poll   (default: origin)
#   OMPZ_BRANCH   branch to poll       (default: main)
#   OMPZ_PREFIX   bin directory        (default: ~/.local/bin)
#   OMPZ_STATE    stamp directory      (default: ~/.local/state/ompz)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

REPO_ROOT="$(ompz_repo_root)"
REMOTE="${OMPZ_REMOTE:-origin}"
BRANCH="${OMPZ_BRANCH:-main}"
STATE_DIR="${OMPZ_STATE:-$HOME/.local/state/ompz}"
STAMP="$STATE_DIR/build.json"

APPLY=0
for arg in "$@"; do
	case "$arg" in
		-y | --yes) APPLY=1 ;;
		-h | --help) sed -n '2,16p' "$0"; exit 0 ;;
		*) echo "unknown option: $arg" >&2; exit 2 ;;
	esac
done

echo "==> fetching $REMOTE/$BRANCH"
git -C "$REPO_ROOT" fetch --quiet "$REMOTE" "$BRANCH"

REMOTE_HEAD="$(git -C "$REPO_ROOT" rev-parse "$REMOTE/$BRANCH")"
LOCAL_HEAD="$(git -C "$REPO_ROOT" rev-parse HEAD)"
CUR_TREE="$(ompz_tree_hash "$REPO_ROOT")"
INSTALLED_COMMIT="$(jq -r '.commit // empty' "$STAMP" 2>/dev/null || true)"
INSTALLED_TREE="$(jq -r '.treeHash // empty' "$STAMP" 2>/dev/null || true)"

printf 'remote %s/%s:  %s\n' "$REMOTE" "$BRANCH" "${REMOTE_HEAD:0:12}"
printf 'local HEAD:          %s\n' "${LOCAL_HEAD:0:12}"
printf 'installed ompz:      %s\n' "${INSTALLED_COMMIT:-none}"

NEED_PULL=0
NEED_BUILD=0
git -C "$REPO_ROOT" merge-base --is-ancestor "$REMOTE/$BRANCH" HEAD || NEED_PULL=1
if [[ -z "$INSTALLED_COMMIT" || "$INSTALLED_COMMIT" != "$LOCAL_HEAD" || "$INSTALLED_TREE" != "$CUR_TREE" ]]; then
	NEED_BUILD=1
fi

if [[ "$NEED_PULL" == 0 && "$NEED_BUILD" == 0 ]]; then
	echo "==> ompz is up to date"
	exit 0
fi
[[ "$NEED_PULL" == 1 ]] && echo "==> remote has commits not in local HEAD"
[[ "$NEED_BUILD" == 1 ]] && echo "==> installed build is stale (tree or HEAD changed)"

if [[ "$APPLY" == 0 ]]; then
	echo "run: scripts/ompz/check-update.sh --yes   (pull --rebase --autostash + build + install)"
	exit 0
fi

if [[ "$NEED_PULL" == 1 ]]; then
	echo "==> git pull --rebase --autostash $REMOTE $BRANCH"
	git -C "$REPO_ROOT" pull --rebase --autostash "$REMOTE" "$BRANCH"
fi
"$SCRIPT_DIR/build.sh"
"$SCRIPT_DIR/install.sh"
