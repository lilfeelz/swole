#!/usr/bin/env bash
# Publishes Forgejo main and tags to GitHub without data/: filter a temp clone, verify, push.
# Usage: mirror.sh [SOURCE] [TARGET]; defaults are the private Forgejo source and its public GitHub copy.
set -euo pipefail

src="${1:-ssh://git@git.lilfeelz.org:2222/lilfeelz/swole-src.git}"
dst="${2:-git@github-lilfeelz:lilfeelz/swole.git}"
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
