#!/usr/bin/env bash
# Check can1357/oh-my-pi upstream for releases newer than this fork's base.
# Prints base tag, latest upstream tag, commit delta, and the intersection of
# files changed on BOTH sides — the merge-conflict candidates for the zvec
# patch and ompz tooling.
set -euo pipefail

UPSTREAM="https://github.com/can1357/oh-my-pi.git"
cd "$(git rev-parse --show-toplevel)"

git fetch --quiet "$UPSTREAM" 'refs/tags/*:refs/tags/*'

BASE="$(git tag --merged HEAD | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1)"
if command -v gh >/dev/null; then
	LATEST="$(gh release view --repo can1357/oh-my-pi --json tagName --jq .tagName)"
else
	LATEST="$(git tag -l 'v*' | grep -vE 'alpha|beta|rc' | sort -V | tail -1)"
fi
PKG_VERSION="$(jq -r .version packages/coding-agent/package.json)"

echo "fork base tag    : ${BASE:-none}"
echo "pkg version      : $PKG_VERSION"
echo "upstream latest  : $LATEST"

if [[ -z "$BASE" || "$BASE" == "$LATEST" ]]; then
	echo "STATUS           : up to date"
	exit 0
fi

echo "STATUS           : upstream is ahead"
echo
echo "== upstream commits not merged : $(git rev-list --count HEAD..$LATEST)"
echo "== our commits since $BASE   : $(git rev-list --count $BASE..HEAD)"
echo

OURS="$(mktemp)"; THEIRS="$(mktemp)"
trap 'rm -f "$OURS" "$THEIRS"' EXIT
git diff --name-only "$BASE"..HEAD | sort -u > "$OURS"
git diff --name-only "$BASE..$LATEST" | sort -u > "$THEIRS"

echo "== files changed on BOTH sides (conflict candidates):"
comm -12 "$OURS" "$THEIRS" | sed 's/^/   /'
echo
echo "inspect each with: git diff $BASE..$LATEST -- <path>"
echo "patch-surface notes: .devin/skills/ompz-upstream/references/zvec-patch-surface.md"
