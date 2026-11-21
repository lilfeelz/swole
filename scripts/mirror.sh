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

public=
if git ls-remote --exit-code "$dst" refs/heads/main >/dev/null; then
  git fetch -q --no-tags "$dst" refs/heads/main:refs/remotes/public/main
  public=$(git rev-parse refs/remotes/public/main)
else
  status=$?
  [ "$status" -eq 2 ] || exit "$status"
fi
filtered=$(git rev-parse refs/heads/main)
publish=$filtered

if [ -n "$public" ] && ! git merge-base --is-ancestor "$public" "$filtered"; then
  # GitHub signs its own commits. The filter strips signatures, so bridge the
  # reviewed public history without rewriting it or accepting later divergence.
  anchor=35c5ff49ebda0cb992ebce15c7098f3d7fb90aa6
  if [ "$public" = "$anchor" ]; then
    previous=$(awk -v sha="$anchor" '$1 == sha {print $2}' .git/filter-repo/commit-map)
  else
    if ! git merge-base --is-ancestor "$anchor" "$public" ||
       [ "$(git show -s --format=%s "$public")" != "chore(mirror): publish filtered swole source" ]; then
      echo "mirror: unrecognized public history; refusing to update" >&2
      exit 1
    fi
    previous=$(git rev-parse "$public^2")
  fi
  if [ -z "$previous" ] ||
     ! git merge-base --is-ancestor "$previous" "$filtered" ||
     [ "$(git rev-parse "$previous^{tree}")" != "$(git rev-parse "$public^{tree}")" ]; then
    echo "mirror: public tree differs from its verified filtered source" >&2
    exit 1
  fi
  publish=$public
  if [ "$previous" != "$filtered" ]; then
    publish=$(git commit-tree "$filtered^{tree}" -p "$public" -p "$filtered"       -m "chore(mirror): publish filtered swole source")
  fi
fi

git push -q "$dst" "$publish:refs/heads/main" 'refs/tags/*:refs/tags/*'
echo "mirror: pushed main and tags to $dst"
