#!/usr/bin/env bash
set -euo pipefail

FORGEJO_REMOTE="${FORGEJO_REMOTE:-ssh://git@git.lilfeelz.org:2222/lilfeelz/swole.git}"
GITHUB_REMOTE="${GITHUB_REMOTE:-git@github-lilfeelz:lilfeelz/swole.git}"

echo "Starting swole mirror sync..."

# 1. Gate local changes
if [[ -n $(git status --porcelain) ]]; then
  echo "Error: Working directory has uncommitted changes. Commit or stash first." >&2
  exit 1
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# 2. Push to Forgejo canonical origin (including private data)
echo "Pushing $CURRENT_BRANCH to Forgejo ($FORGEJO_REMOTE)..."
if ! git remote get-url origin >/dev/null 2>&1; then
  git remote add origin "$FORGEJO_REMOTE"
fi
git push origin "$CURRENT_BRANCH"

# 3. Prepare sanitized mirror for GitHub
echo "Filtering private workout data for GitHub mirror..."
TMP_MIRROR=$(mktemp -d -t swole-mirror-XXXXXX)
trap 'rm -rf "$TMP_MIRROR"' EXIT

git clone --quiet --branch "$CURRENT_BRANCH" . "$TMP_MIRROR"
(
  cd "$TMP_MIRROR"
  # Invert paths: removes data/ and .clasp.json completely from all commits
  git filter-repo --invert-paths --path data/ --path .clasp.json --force --quiet
  git remote add github "$GITHUB_REMOTE"
  echo "Pushing sanitized commits to GitHub ($GITHUB_REMOTE)..."
  git push github "$CURRENT_BRANCH":"$CURRENT_BRANCH" --force --quiet
)

echo "✔ Mirror sync complete: Forgejo (canonical) and GitHub (public mirror) updated."
