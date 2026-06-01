#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

RELEASE_ENV_FILE="${RELEASE_ENV_FILE:-.env.release.local}"
if [ -f "${RELEASE_ENV_FILE}" ]; then
  set -a
  # shellcheck disable=SC1090
  . "${RELEASE_ENV_FILE}"
  set +a
fi

APP_NAME="Classroom Widgets Dashboard"
PRODUCT_NAME="ClassroomWidgetsDashboard"
BUNDLE_ID="com.classroomwidgets.dashboard"
MACOS_DIR="${ROOT_DIR}/packages/macos-dashboard"
APP_BUNDLE="${ROOT_DIR}/dist/${APP_NAME}.app"
INSTALL_APP_BUNDLE="/Applications/${APP_NAME}.app"
APP_CONTENTS="${APP_BUNDLE}/Contents"
APP_MACOS="${APP_CONTENTS}/MacOS"
APP_RESOURCES="${APP_CONTENTS}/Resources"
WEB_RESOURCES="${APP_RESOURCES}/Web"
STAGING_DIR="${ROOT_DIR}/dist/macos-dmg-staging"
ENTITLEMENTS_PATH="${ROOT_DIR}/script/macos-distribution-entitlements.plist"
APP_ICON_PATH="${MACOS_DIR}/Sources/${PRODUCT_NAME}/Resources/AppIcon.icns"
VERSION="$(node -p "require('./package.json').version")"
BUILD_NUMBER="${BUILD_NUMBER:-$(date +%Y%m%d%H%M)}"
DMG_PATH="${DMG_PATH:-}"
SIGNING_IDENTITY="${APPLE_SIGNING_IDENTITY:-}"
DEVELOPMENT_TEAM="${APPLE_TEAM_ID:-}"
API_KEY_PATH="${APPLE_API_KEY_PATH:-}"
API_KEY_ID="${APPLE_API_KEY_ID:-}"
API_ISSUER_ID="${APPLE_API_KEY_ISSUER_ID:-}"
USE_DISTRIBUTION_SIGNING="${USE_DISTRIBUTION_SIGNING:-false}"
USE_NOTARISATION="${USE_NOTARISATION:-false}"

usage() {
  cat <<'EOF'
Usage:
  ./script/build_macos_release.sh [options]

Options:
  --version <version>   Artifact/app version suffix (default: package.json version)
  --build <number>      CFBundleVersion value (default: timestamp)
  --output <path>       DMG output path
  --distribution        Sign app and DMG with a Developer ID Application identity
  --notarise            Submit the signed DMG for notarisation and staple it
  --notarize            Alias for --notarise
  --identity <name>     Developer ID Application identity
  --team <id>           Apple Developer Team ID
  --api-key <path>      App Store Connect API key (.p8) path
  --api-key-id <id>     App Store Connect API key ID
  --api-issuer <id>     App Store Connect issuer ID (omit for Individual keys)

Environment:
  .env.release.local is loaded automatically when present. Supported keys:
  APPLE_SIGNING_IDENTITY, APPLE_TEAM_ID, APPLE_API_KEY_PATH,
  APPLE_API_KEY_ID, APPLE_API_KEY_ISSUER_ID.
EOF
}

trash_path() {
  local path="$1"
  if [ ! -e "${path}" ]; then
    return
  fi

  if command -v trash >/dev/null 2>&1; then
    trash "${path}"
    return
  fi

  local fallback_dir="${TMPDIR:-/tmp}/classroom-widgets-trash"
  mkdir -p "${fallback_dir}"
  mv "${path}" "${fallback_dir}/$(basename "${path}").$(date +%s)"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)
      [[ -n "${2:-}" ]] || { echo "--version requires a value" >&2; usage; exit 1; }
      VERSION="${2#v}"
      shift 2
      ;;
    --build)
      [[ -n "${2:-}" ]] || { echo "--build requires a value" >&2; usage; exit 1; }
      BUILD_NUMBER="$2"
      shift 2
      ;;
    --output)
      [[ -n "${2:-}" ]] || { echo "--output requires a value" >&2; usage; exit 1; }
      DMG_PATH="$2"
      shift 2
      ;;
    --distribution|--release|--sign)
      USE_DISTRIBUTION_SIGNING="true"
      shift
      ;;
    --notarise|--notarize)
      USE_NOTARISATION="true"
      USE_DISTRIBUTION_SIGNING="true"
      shift
      ;;
    --identity)
      [[ -n "${2:-}" ]] || { echo "--identity requires a value" >&2; usage; exit 1; }
      SIGNING_IDENTITY="$2"
      shift 2
      ;;
    --team)
      [[ -n "${2:-}" ]] || { echo "--team requires a value" >&2; usage; exit 1; }
      DEVELOPMENT_TEAM="$2"
      shift 2
      ;;
    --api-key)
      [[ -n "${2:-}" ]] || { echo "--api-key requires a value" >&2; usage; exit 1; }
      API_KEY_PATH="$2"
      shift 2
      ;;
    --api-key-id)
      [[ -n "${2:-}" ]] || { echo "--api-key-id requires a value" >&2; usage; exit 1; }
      API_KEY_ID="$2"
      shift 2
      ;;
    --api-issuer)
      [[ -n "${2:-}" ]] || { echo "--api-issuer requires a value" >&2; usage; exit 1; }
      API_ISSUER_ID="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

DMG_PATH="${DMG_PATH:-${ROOT_DIR}/dist/${PRODUCT_NAME}-v${VERSION}-macos.dmg}"

if ! command -v create-dmg >/dev/null 2>&1; then
  echo "create-dmg not found. Install it with: brew install create-dmg" >&2
  exit 1
fi

if [ "${USE_DISTRIBUTION_SIGNING}" = "true" ]; then
  if [ -z "${SIGNING_IDENTITY}" ] || [ -z "${DEVELOPMENT_TEAM}" ]; then
    echo "Distribution signing requested, but identity/team are missing." >&2
    usage
    exit 1
  fi

  if ! security find-identity -p codesigning -v | grep -F "${SIGNING_IDENTITY}" >/dev/null; then
    echo "Signing identity not found in the keychain: ${SIGNING_IDENTITY}" >&2
    exit 1
  fi
fi

if [ "${USE_NOTARISATION}" = "true" ]; then
  if [ -z "${API_KEY_PATH}" ] || [ -z "${API_KEY_ID}" ]; then
    echo "Notarisation requested, but App Store Connect API key details are missing." >&2
    usage
    exit 1
  fi

  if [ ! -f "${API_KEY_PATH}" ]; then
    echo "App Store Connect API key not found at: ${API_KEY_PATH}" >&2
    exit 1
  fi
fi

mkdir -p "${ROOT_DIR}/dist"
trash_path "${APP_BUNDLE}"
trash_path "${STAGING_DIR}"
trash_path "${DMG_PATH}"

echo "Building teacher web assets"
npm run build -w @classroom-widgets/teacher

echo "Building macOS executable"
swift build --package-path "${MACOS_DIR}" -c release

EXECUTABLE="${MACOS_DIR}/.build/release/${PRODUCT_NAME}"
mkdir -p "${APP_MACOS}" "${WEB_RESOURCES}"
cp "${EXECUTABLE}" "${APP_MACOS}/${PRODUCT_NAME}"
chmod +x "${APP_MACOS}/${PRODUCT_NAME}"
cp -R "${ROOT_DIR}/packages/teacher/build/." "${WEB_RESOURCES}/"
if [ -f "${APP_ICON_PATH}" ]; then
  cp "${APP_ICON_PATH}" "${APP_RESOURCES}/AppIcon.icns"
fi

cat > "${APP_CONTENTS}/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "https://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key>
  <string>${APP_NAME}</string>
  <key>CFBundleExecutable</key>
  <string>${PRODUCT_NAME}</string>
  <key>CFBundleIdentifier</key>
  <string>${BUNDLE_ID}</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>CFBundleName</key>
  <string>${APP_NAME}</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>${VERSION}</string>
  <key>CFBundleVersion</key>
  <string>${BUILD_NUMBER}</string>
  <key>LSApplicationCategoryType</key>
  <string>public.app-category.education</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
  <key>LSUIElement</key>
  <true/>
  <key>NSCameraUsageDescription</key>
  <string>Classroom Widgets uses the camera for the Visualiser widget.</string>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSPrincipalClass</key>
  <string>NSApplication</string>
</dict>
</plist>
PLIST

if [ "${USE_DISTRIBUTION_SIGNING}" = "true" ]; then
  echo "Signing app with ${SIGNING_IDENTITY}"
  codesign --force --options runtime --timestamp --entitlements "${ENTITLEMENTS_PATH}" --sign "${SIGNING_IDENTITY}" "${APP_BUNDLE}"
  codesign --verify --deep --strict --verbose=2 "${APP_BUNDLE}"
else
  echo "Applying ad hoc app signature for local packaging"
  codesign --force --deep --sign - "${APP_BUNDLE}"
  codesign --verify --deep --strict --verbose=2 "${APP_BUNDLE}"
fi

echo "Installing app to ${INSTALL_APP_BUNDLE}"
trash_path "${INSTALL_APP_BUNDLE}"
cp -R "${APP_BUNDLE}" "${INSTALL_APP_BUNDLE}"

mkdir -p "${STAGING_DIR}"
cp -R "${APP_BUNDLE}" "${STAGING_DIR}/"

echo "Creating DMG at ${DMG_PATH}"
if ! create-dmg \
  --volname "${APP_NAME}" \
  --window-pos 200 120 \
  --window-size 560 360 \
  --icon-size 120 \
  --text-size 12 \
  --icon "${APP_NAME}.app" 160 190 \
  --app-drop-link 390 190 \
  --hide-extension "${APP_NAME}.app" \
  --no-internet-enable \
  "${DMG_PATH}" \
  "${STAGING_DIR}/"; then
  echo "create-dmg failed; retrying without Finder AppleScript prettifying." >&2
  trash_path "${DMG_PATH}"
  create-dmg \
    --skip-jenkins \
    --volname "${APP_NAME}" \
    --window-pos 200 120 \
    --window-size 560 360 \
    --icon-size 120 \
    --text-size 12 \
    --icon "${APP_NAME}.app" 160 190 \
    --app-drop-link 390 190 \
    --hide-extension "${APP_NAME}.app" \
    --no-internet-enable \
    "${DMG_PATH}" \
    "${STAGING_DIR}/"
fi

if [ "${USE_DISTRIBUTION_SIGNING}" = "true" ]; then
  echo "Signing DMG with ${SIGNING_IDENTITY}"
  codesign --force --options runtime --timestamp --sign "${SIGNING_IDENTITY}" "${DMG_PATH}"
  codesign --verify --strict --verbose=2 "${DMG_PATH}"
fi

if [ "${USE_NOTARISATION}" = "true" ]; then
  NOTARY_CMD=(
    xcrun notarytool submit "${DMG_PATH}"
    --key "${API_KEY_PATH}"
    --key-id "${API_KEY_ID}"
    --wait
  )

  if [ -n "${API_ISSUER_ID}" ]; then
    NOTARY_CMD+=(--issuer "${API_ISSUER_ID}")
  fi

  echo "Submitting DMG for notarisation"
  "${NOTARY_CMD[@]}"
  xcrun stapler staple "${DMG_PATH}"
  xcrun stapler validate "${DMG_PATH}"
fi

trash_path "${STAGING_DIR}"

echo "Built:"
echo "  - ${APP_BUNDLE}"
echo "  - ${INSTALL_APP_BUNDLE}"
echo "  - ${DMG_PATH}"
