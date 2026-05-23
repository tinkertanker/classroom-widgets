#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="Classroom Widgets Dashboard"
PRODUCT_NAME="ClassroomWidgetsDashboard"
BUNDLE_ID="com.classroomwidgets.dashboard"
APP_BUNDLE="$ROOT_DIR/dist/$APP_NAME.app"
APP_CONTENTS="$APP_BUNDLE/Contents"
APP_MACOS="$APP_CONTENTS/MacOS"
APP_RESOURCES="$APP_CONTENTS/Resources"
MACOS_DIR="$ROOT_DIR/packages/macos-dashboard"
MODE="${1:-run}"

case "$MODE" in
  run|--debug|debug|--logs|logs|--telemetry|telemetry|--verify|verify) ;;
  *)
    echo "usage: $0 [run|--debug|--logs|--telemetry|--verify]" >&2
    exit 2
    ;;
esac

pkill -x "$PRODUCT_NAME" 2>/dev/null || true

npm run build -w @classroom-widgets/teacher

swift build --package-path "$MACOS_DIR" -c debug

EXECUTABLE="$MACOS_DIR/.build/debug/$PRODUCT_NAME"
rm -rf "$APP_BUNDLE"
mkdir -p "$APP_MACOS" "$APP_RESOURCES/Web"
cp "$EXECUTABLE" "$APP_MACOS/$PRODUCT_NAME"
chmod +x "$APP_MACOS/$PRODUCT_NAME"
cp -R "$ROOT_DIR/packages/teacher/build/." "$APP_RESOURCES/Web/"

cat > "$APP_CONTENTS/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>$PRODUCT_NAME</string>
  <key>CFBundleIdentifier</key>
  <string>$BUNDLE_ID</string>
  <key>CFBundleName</key>
  <string>$APP_NAME</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
  <key>LSUIElement</key>
  <true/>
  <key>NSPrincipalClass</key>
  <string>NSApplication</string>
</dict>
</plist>
PLIST

open_app() {
  /usr/bin/open -n "$APP_BUNDLE"
}

case "$MODE" in
  run)
    open_app
    ;;
  --debug|debug)
    lldb -- "$APP_MACOS/$PRODUCT_NAME"
    ;;
  --logs|logs)
    open_app
    /usr/bin/log stream --info --style compact --predicate "process == \"$PRODUCT_NAME\""
    ;;
  --telemetry|telemetry)
    open_app
    /usr/bin/log stream --info --style compact --predicate "subsystem == \"$BUNDLE_ID\""
    ;;
  --verify|verify)
    open_app
    sleep 2
    pgrep -x "$PRODUCT_NAME" >/dev/null
    echo "$PRODUCT_NAME is running"
    ;;
esac
