#!/usr/bin/env bash
# Renders card.html to packages/teacher/public/og-image.jpg (1200x630), the
# og:image / twitter:image for widgets.tk.sg. Needs agent-browser and ImageMagick.
set -euo pipefail
cd "$(dirname "$0")"
OUT="../../packages/teacher/public/og-image.jpg"
agent-browser --session og-card open "file://$PWD/card.html"
agent-browser --session og-card set viewport 1200 630 1
agent-browser --session og-card wait 1500
agent-browser --session og-card screenshot /tmp/og-card.png
agent-browser --session og-card close
# Strip metadata and keep the file small for link unfurlers.
magick /tmp/og-card.png -strip -sampling-factor 4:2:0 -quality 88 "$OUT"
identify "$OUT"
