#!/usr/bin/env bash
# Builds a release ClassroomWidgets.app for perf/bench.py.
#
#   packages/macos-dashboard/perf/make_bench_app.sh <repo-root> <web-root> <output.app>
#
# <web-root> is a teacher build (pnpm --filter @classroom-widgets/teacher build:desktop),
# passed explicitly so every variant in an A/B run embeds the same web bundle.
# The bundle gets its own identifier (BENCH_BUNDLE_ID, default
# sg.tk.classroomwidgets.perfbench) so benchmarks never touch an installed
# app's preferences or WebKit data. It is ad-hoc signed and not installed.
set -euo pipefail

if [ "$#" -ne 3 ]; then
  echo "usage: $0 <repo-root> <web-root> <output.app>" >&2
  exit 2
fi

REPO="$(cd "$1" && pwd)"
WEB_ROOT="$(cd "$2" && pwd)"
OUT="$3"
BUNDLE_ID="${BENCH_BUNDLE_ID:-sg.tk.classroomwidgets.perfbench}"
MACOS_DIR="$REPO/packages/macos-dashboard"
PRODUCT_NAME="ClassroomWidgets"

if [ ! -f "$WEB_ROOT/index.html" ]; then
  echo "$WEB_ROOT has no index.html" >&2
  exit 1
fi

swift build --package-path "$MACOS_DIR" -c release
BIN_DIR="$(swift build --package-path "$MACOS_DIR" -c release --show-bin-path)"
VERSION="$(python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))["version"])' "$REPO/version.json")"

rm -rf "$OUT"
mkdir -p "$OUT/Contents/MacOS" "$OUT/Contents/Resources/Web"
cp "$BIN_DIR/$PRODUCT_NAME" "$OUT/Contents/MacOS/$PRODUCT_NAME"
cp -R "$WEB_ROOT/." "$OUT/Contents/Resources/Web/"
# Match scripts/build_and_run.sh: no source maps or promo videos in the app.
find "$OUT/Contents/Resources/Web" -name '*.map' -delete
if [ -d "$OUT/Contents/Resources/Web/promo" ]; then
  find "$OUT/Contents/Resources/Web/promo" -maxdepth 1 -type f \( -name '*.webm' -o -name '*.mp4' \) -delete
fi
cp "$MACOS_DIR/Sources/ClassroomWidgetsDashboard/Resources/AppIcon.icns" "$OUT/Contents/Resources/AppIcon.icns"

cat > "$OUT/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>$PRODUCT_NAME</string>
  <key>CFBundleIdentifier</key>
  <string>$BUNDLE_ID</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>CFBundleName</key>
  <string>Classroom Widgets Bench</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>$VERSION</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
  <key>NSCameraUsageDescription</key>
  <string>Classroom Widgets uses the camera for the Visualiser widget.</string>
  <key>NSPrincipalClass</key>
  <string>NSApplication</string>
</dict>
</plist>
PLIST

codesign --force --sign - "$OUT"
echo "$OUT ($BUNDLE_ID, $(git -C "$REPO" rev-parse --short HEAD 2>/dev/null || echo unknown))"
