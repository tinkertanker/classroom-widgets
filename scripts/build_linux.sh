#!/usr/bin/env bash
# Builds the teacher web app and the Electron Linux tray app.
#
#   ./scripts/build_linux.sh                 # build, then launch
#   ./scripts/build_linux.sh --publish       # AppImage + .deb in packages/linux-dashboard/dist
#   ./scripts/build_linux.sh --no-run        # build only
#   ./scripts/build_linux.sh --skip-web      # reuse the existing teacher build
set -euo pipefail

publish=0
no_run=0
skip_web=0
for arg in "$@"; do
  case "$arg" in
    --publish) publish=1 ;;
    --no-run) no_run=1 ;;
    --skip-web) skip_web=1 ;;
    *) echo "Unknown flag: $arg" >&2; exit 1 ;;
  esac
done

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
package_dir="$repo_root/packages/linux-dashboard"

if [[ "$skip_web" -eq 0 ]]; then
  (cd "$repo_root" && pnpm --filter @classroom-widgets/teacher build)
fi

if [[ ! -f "$repo_root/packages/teacher/build/index.html" ]]; then
  echo "packages/teacher/build/index.html is missing; run the teacher build first." >&2
  exit 1
fi

if [[ ! -d "$package_dir/node_modules" ]]; then
  if [[ -f "$package_dir/package-lock.json" ]]; then
    (cd "$package_dir" && npm ci)
  else
    (cd "$package_dir" && npm install)
  fi
fi

(cd "$package_dir" && npm run build)

pkill -f "$package_dir/node_modules/electron/dist/electron" || true
pkill -x classroom-widgets || true

version="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$repo_root/version.json','utf8')).version)")"

if [[ "$publish" -eq 1 ]]; then
  (cd "$package_dir" && npm run dist -- -c.extraMetadata.version="$version")
  echo "Published to $package_dir/dist"
else
  if [[ "$no_run" -eq 0 ]]; then
    (cd "$package_dir" && nohup npm start -- ${CLASSROOM_WIDGETS_ELECTRON_FLAGS:-} >/dev/null 2>&1 &)
    echo "Launched the app (look for the Classroom Widgets icon in the system tray)."
  fi
fi
