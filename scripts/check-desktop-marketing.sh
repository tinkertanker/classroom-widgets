#!/usr/bin/env bash
# Run against a running teacher app: bash scripts/check-desktop-marketing.sh [base URL]
# Requires agent-browser. Produces screenshots and an assertion log.
set -euo pipefail
BASE="${1:-http://localhost:3000}"
ROOT="$(git rev-parse --show-toplevel)"
EVIDENCE="${CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR:-$ROOT/.amp/in/artifacts/desktop-marketing}"
mkdir -p "$EVIDENCE"
EVIDENCE="$(realpath "$EVIDENCE")"
exec > >(tee "$EVIDENCE/checks.log") 2>&1
browser() { agent-browser --session desktop-marketing "$@"; }
trap 'browser close >/dev/null 2>&1 || true' EXIT
check() { browser eval "(() => { if (!($1)) throw new Error('$2'); return 'PASS: $2'; })()"; }
settle() { browser eval 'new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))' >/dev/null; }

browser open "$BASE/"
browser set viewport 1280 900 2
browser wait 'button[title="Menu"]'
browser click 'button[title="Menu"]'
check 'document.querySelector("[role=menu] a[href=\"/about#desktop\"]")?.textContent.trim() === "Get desktop apps"' 'Web menu offers all desktop platforms'
check 'document.querySelector("[role=menu] a[href=\"/about#desktop\"]")?.target === "_blank"' 'Download discovery preserves the teaching tab'
browser screenshot "$EVIDENCE/web-menu.png"
browser click '[role=menu] a[href="/about#desktop"]'
browser tab "$(browser tab --json | jq -r '.data.tabs[] | select(.url | endswith("/about#desktop")) | .tabId')"
browser set viewport 1280 900 2
browser wait '#desktop h3'
settle
check 'location.pathname === "/about" && location.hash === "#desktop"' 'Menu opens the existing single marketing page'
check 'document.querySelector("#desktop h3").getBoundingClientRect().top >= 0 && document.querySelector("#desktop h3").getBoundingClientRect().bottom < innerHeight' 'Lazy-loaded desktop anchor lands visibly'
check 'document.querySelectorAll("#desktop article").length === 3 && [...document.querySelectorAll("#desktop article h4")].map(e => e.textContent).join() === "macOS,Windows,Linux"' 'All three platform cards are present'
check '[...document.querySelectorAll("#desktop article a")].every(a => a.href === "https://github.com/tinkertanker/classroom-widgets/releases/latest")' 'Download links use the stable latest release destination'
check 'document.querySelector("#desktop").textContent.includes("student activities stay in the")' 'Desktop scope distinguishes live student activities'
browser screenshot "$EVIDENCE/desktop-downloads.png"
browser eval 'document.querySelector("#desktop figure").parentElement.scrollIntoView({block: "center"})'
browser wait --fn 'document.querySelector("#desktop figure img").naturalWidth === 1200'
settle
browser screenshot "$EVIDENCE/display-callout.png"

browser open "$BASE/about"
browser wait 'a[href="#desktop"]'
settle
check 'document.querySelector("h2").textContent.includes("90% Vibe-Coded")' 'Original marketing hero is preserved'
check 'document.querySelector("section img[alt=\"Classroom Widgets Nibbled Timer app icon\"]").naturalWidth === 512 && document.querySelector("section img[alt=\"Classroom Widgets Nibbled Timer app icon\"]").getBoundingClientRect().bottom < innerHeight' 'Actual app icon is visible in the hero'
browser screenshot "$EVIDENCE/marketing-wide.png"
browser eval 'document.querySelector("footer").scrollIntoView()'
settle
browser screenshot "$EVIDENCE/marketing-footer.png"
browser eval 'window.scrollTo(0, 0)'
browser click 'a[href="#desktop"]'
check 'location.hash === "#desktop" && scrollY > 0' 'Hero CTA scrolls within the single page'

for width in 390 768; do
  browser set viewport "$width" 900 2
  browser open "$BASE/about#desktop"
  browser wait '#desktop h3'
  settle
  check 'document.querySelector("#desktop").getBoundingClientRect().right <= innerWidth' "Desktop section fits at $width pixels"
  check 'document.querySelector("#desktop h3").getBoundingClientRect().top >= 0' "Desktop heading visible at $width pixels"
  browser screenshot "$EVIDENCE/desktop-$width.png"
  browser eval 'document.querySelector("#desktop figure").parentElement.scrollIntoView({block: "center"})'
  browser wait --fn 'document.querySelector("#desktop figure img").naturalWidth === 1200'
  settle
  browser screenshot "$EVIDENCE/display-$width.png"
  browser eval 'window.scrollTo(0, 0)'
  settle
  browser screenshot "$EVIDENCE/hero-$width.png"
done
browser set viewport 1280 900 2
browser open "$BASE/about#desktop"
browser wait '#desktop h3'
browser eval 'document.documentElement.classList.add("dark")'
settle
browser screenshot "$EVIDENCE/desktop-dark.png"
browser eval 'window.scrollTo(0, 0)'
settle
browser screenshot "$EVIDENCE/hero-dark.png"
browser open "$BASE/widgets"
browser wait 'footer img[src="/logo.png"]'
browser eval 'document.querySelector("footer").scrollIntoView()'
settle
browser screenshot "$EVIDENCE/widgets-footer.png"

for query in desktop=1 dashboard=1; do
  browser open "$BASE/?$query&mode=canvas"
  browser wait 'button[title="Menu"]'
  browser click 'button[title="Menu"]'
  check '!document.querySelector("[role=menu] a[href=\"/about#desktop\"]")' "Promotion is absent in installed mode $query"
done
echo 'PASS: desktop marketing browser checks complete'
