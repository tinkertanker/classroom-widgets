#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

RELEASE_ENV_FILE="${RELEASE_ENV_FILE:-.env.release.local}"
if [ -f "$RELEASE_ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$RELEASE_ENV_FILE"
  set +a
fi

APP_NAME="Classroom Widgets Dashboard"
PRODUCT_NAME="ClassroomWidgetsDashboard"
BUNDLE_ID="com.classroomwidgets.dashboard"
APP_BUNDLE="$ROOT_DIR/dist/$APP_NAME.app"
APP_CONTENTS="$APP_BUNDLE/Contents"
APP_MACOS="$APP_CONTENTS/MacOS"
APP_RESOURCES="$APP_CONTENTS/Resources"
MACOS_DIR="$ROOT_DIR/packages/macos-dashboard"
INSTALL_APP_BUNDLE="/Applications/$APP_NAME.app"
ENTITLEMENTS_PATH="$ROOT_DIR/script/macos-distribution-entitlements.plist"
SIGNING_IDENTITY="${APPLE_SIGNING_IDENTITY:-}"
MODE="${1:-run}"

case "$MODE" in
  run|--debug|debug|--logs|logs|--telemetry|telemetry|--verify|verify) ;;
  *)
    echo "usage: $0 [run|--debug|--logs|--telemetry|--verify]" >&2
    exit 2
    ;;
esac

pkill -x "$PRODUCT_NAME" 2>/dev/null || true

trash_path() {
  local path="$1"
  if [ ! -e "$path" ]; then
    return
  fi

  if command -v trash >/dev/null 2>&1; then
    trash "$path"
    return
  fi

  local fallback_dir="${TMPDIR:-/tmp}/classroom-widgets-trash"
  mkdir -p "$fallback_dir"
  mv "$path" "$fallback_dir/$(basename "$path").$(date +%s)"
}

detect_signing_identity() {
  if [ -n "$SIGNING_IDENTITY" ]; then
    return
  fi

  SIGNING_IDENTITY="$(security find-identity -p codesigning -v 2>/dev/null | awk -F'\"' '/Developer ID Application:/{ print $2; exit }')"
}

npm run build -w @classroom-widgets/teacher

swift build --package-path "$MACOS_DIR" -c debug

EXECUTABLE="$MACOS_DIR/.build/debug/$PRODUCT_NAME"
trash_path "$APP_BUNDLE"
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
  <key>NSCameraUsageDescription</key>
  <string>Classroom Widgets uses the camera for the Visualiser widget.</string>
  <key>NSPrincipalClass</key>
  <string>NSApplication</string>
</dict>
</plist>
PLIST

detect_signing_identity
if [ -n "$SIGNING_IDENTITY" ]; then
  codesign --force --options runtime --timestamp --entitlements "$ENTITLEMENTS_PATH" --sign "$SIGNING_IDENTITY" "$APP_BUNDLE"
else
  codesign --force --deep --sign - "$APP_BUNDLE"
fi

codesign --verify --deep --strict --verbose=2 "$APP_BUNDLE"

install_app() {
  trash_path "$INSTALL_APP_BUNDLE"
  cp -R "$APP_BUNDLE" "$INSTALL_APP_BUNDLE"
}

open_app() {
  install_app
  /usr/bin/open -n "$INSTALL_APP_BUNDLE"
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
    echo "$PRODUCT_NAME is running from $INSTALL_APP_BUNDLE"
    ;;
esac
