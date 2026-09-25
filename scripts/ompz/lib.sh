# Shared helpers for the ompz build/install/update scripts.
# Sourced by the sibling scripts; not meant to run standalone.

ompz_repo_root() {
	(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
}

# Content hash of the working tree relative to HEAD: tracked diff + contents of
# untracked (non-ignored) files, excluding .kit/ caches. Catches patch updates
# that don't change the commit — which is the norm for the zvec overlay.
ompz_tree_hash() {
	local repo="$1"
	(
		git -C "$repo" diff --binary HEAD
		git -C "$repo" ls-files --others --exclude-standard -z \
			| { grep -zv '^\.kit/' || true; } \
			| xargs -0 -r sha256sum 2>/dev/null
	) | sha256sum | cut -d' ' -f1
}

# Resolve the version stamped into built binaries (and recorded in build.json):
# an explicit OMPZ_VERSION wins, else the nearest ompz-v* git tag, else the
# workspace package.json version. The `ompz-v` prefix is stripped either way.
ompz_version() {
	local repo="$1" tag
	if [[ -n "${OMPZ_VERSION:-}" ]]; then
		printf '%s\n' "${OMPZ_VERSION#ompz-v}"
		return
	fi
	tag="$(git -C "$repo" describe --tags --match 'ompz-v*' --abbrev=0 2>/dev/null || true)"
	if [[ -n "$tag" ]]; then
		printf '%s\n' "${tag#ompz-v}"
		return
	fi
	jq -r .version "$repo/packages/coding-agent/package.json"
}
