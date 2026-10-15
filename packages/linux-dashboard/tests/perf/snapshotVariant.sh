#!/usr/bin/env bash
# Builds the Linux shell as it is at a git ref and copies what launchBench.cjs
# needs (out/, src/renderer/, assets/, package.json) into a variant directory.
# It uses this checkout's node_modules and leaves the working tree untouched.
# usage: packages/linux-dashboard/tests/perf/snapshotVariant.sh <git-ref> <variant dir>
set -euo pipefail
ref=$1
out=$(realpath -m "$2")
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
echo "$ref ($(git -C "$repo" rev-parse "$ref")) -> $out"
