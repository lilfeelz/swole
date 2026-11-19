#!/usr/bin/env bash
# Publishes a private source repository to a public mirror without data/.
# Usage: mirror.sh SOURCE TARGET (or set SWOLE_SOURCE and SWOLE_TARGET).
set -euo pipefail

src="${1:-${SWOLE_SOURCE:-}}"
dst="${2:-${SWOLE_TARGET:-}}"
if [ -z "$src" ] || [ -z "$dst" ]; then
  echo "mirror: pass SOURCE and TARGET, or set SWOLE_SOURCE and SWOLE_TARGET" >&2
  exit 2
fi
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

git clone -q --no-local "$src" "$tmp/repo"
cd "$tmp/repo"
git filter-repo --force --quiet --invert-paths --path data/

leaks=$(git log --all --format= --name-only | grep -E '^data/|(^|/)\.clasprc\.json$' | sort -u || true)
if [ -n "$leaks" ]; then
  printf 'mirror: refusing to push, found:\n%s\n' "$leaks" >&2
  exit 1
fi

# filter-repo is deterministic, so the rewritten history fast-forwards the last mirror
# once GitHub main holds the same filtered commit.
git push -q "$dst" refs/heads/main:refs/heads/main 'refs/tags/*:refs/tags/*'
echo "mirror: pushed main and tags to $dst"
