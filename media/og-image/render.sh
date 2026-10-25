#!/usr/bin/env bash
# Render the versioned JPEG and six-second MP4. See docs/SOCIAL_PREVIEWS.md.
set -euo pipefail
cd "$(dirname "$0")"
node render.mjs "$@"
