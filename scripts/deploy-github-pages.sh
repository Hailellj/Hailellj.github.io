#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PUBLISH_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$PUBLISH_DIR"
}
trap cleanup EXIT

cd "$ROOT_DIR"
npm run build:github

git clone \
  --branch gh-pages \
  --single-branch \
  https://github.com/Hailellj/Hailellj.github.io.git \
  "$PUBLISH_DIR/site"

rsync -a --delete --exclude=.git out/ "$PUBLISH_DIR/site/"

cd "$PUBLISH_DIR/site"
git add -A

if git diff --cached --quiet; then
  echo "GitHub Pages is already up to date."
  exit 0
fi

git commit -m "Deploy resume site"
git push origin gh-pages
