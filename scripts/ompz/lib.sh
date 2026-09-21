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
