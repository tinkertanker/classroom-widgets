#!/usr/bin/env bash
# Builds the Linux shell as it is at a git ref and copies what launchBench.cjs
# needs (out/, src/renderer/, assets/, package.json) into a variant directory.
# It uses this checkout's node_modules and leaves the working tree untouched.
# With --with-web it also builds the teacher app at the same ref
# (`build:desktop --manifest`, in a clean copy of the whole tree with its own
# pnpm install) into <variant dir>/web, for launchBench.cjs --variant-web-root.
# usage: packages/linux-dashboard/tests/perf/snapshotVariant.sh <git-ref> <variant dir> [--with-web]
set -euo pipefail
ref=$1
out=$(realpath -m "$2")
withWeb=${3:-}
pkg=$(cd "$(dirname "$0")/../.." && pwd)
repo=$(git -C "$pkg" rev-parse --show-toplevel)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
git -C "$repo" archive "$ref" packages/linux-dashboard | tar -x -C "$tmp"
src=$tmp/packages/linux-dashboard
ln -s "$pkg/node_modules" "$src/node_modules"
(cd "$src" && node node_modules/typescript/bin/tsc -p tsconfig.json)
rm -rf "$out"
mkdir -p "$out/src"
cp -r "$src/out" "$out/out"
cp -r "$src/src/renderer" "$out/src/renderer"
cp -r "$src/assets" "$out/assets"
cp "$src/package.json" "$out/package.json"
if [ "$withWeb" = "--with-web" ]; then
  mkdir "$tmp/tree"
  git -C "$repo" archive "$ref" | tar -x -C "$tmp/tree"
  (cd "$tmp/tree" \
    && pnpm install --frozen-lockfile --prefer-offline --filter '@classroom-widgets/teacher...' \
    && pnpm --filter @classroom-widgets/teacher build:desktop --manifest) >&2
  cp -r "$tmp/tree/packages/teacher/build" "$out/web"
fi
echo "$ref ($(git -C "$repo" rev-parse "$ref")) -> $out${withWeb:+ (with web)}"
