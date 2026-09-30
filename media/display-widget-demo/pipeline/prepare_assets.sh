#!/usr/bin/env bash
# Copies the artwork and fonts the compose page needs into assets/ (git-ignored).
# Artwork comes from the repo itself so it is never duplicated in git; Poppins comes
# from this folder's node_modules (npm ci), the arrow glyph font from the system.
set -euo pipefail
cd "$(dirname "$0")"
REPO="$(cd ../../.. && pwd)"
DEJAVU_TTF="${DEJAVU_TTF:-/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf}"  # apt: fonts-dejavu-core
mkdir -p assets/fonts
cp "$REPO/packages/teacher/public/logo-mark.png" assets/
cp "$REPO/assets/app-icon/menu-bar-glyph.svg" assets/
for w in 400 500 600 700 800; do
  cp "node_modules/@fontsource/poppins/files/poppins-latin-$w-normal.woff2" assets/fonts/
done
cp "$DEJAVU_TTF" assets/fonts/DejaVuSans-Bold.ttf
echo "assets ready"
