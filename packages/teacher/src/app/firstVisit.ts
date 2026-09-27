import { isDesktopDashboardMode } from '@shared/utils/dashboardMode';

// Inlined from @shared/types/storage (STORAGE_KEY, LEGACY_STORAGE_KEY) to keep
// the entry chunk small; the test checks they still match.
export const WORKSPACE_STORAGE_KEYS = ['classroom-widgets-storage-v2', 'workspace-storage'];
export const SEEN_LANDING_KEY = 'classroom-widgets:seen-landing';

const CRAWLER_PATTERN = /bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|embedly|linkedinbot|twitterbot|whatsapp|slackbot/i;

// Sends a brand-new visitor on `/` to the landing page, once per browser.
// Must run before the router renders, as <App /> writes the workspace key on mount.
export function redirectFirstVisitToLanding(): boolean {
  const { pathname, search, hash } = window.location;
  if (pathname !== '/') return false;
  // Desktop app webviews always load with one of these params.
  if (new URLSearchParams(search).has('surface') || isDesktopDashboardMode(search)) return false;
  // Crawlers keep indexing the tool at `/` instead of About's canonical `/about`.
  if (CRAWLER_PATTERN.test(navigator.userAgent)) return false;

  try {
    const storage = window.localStorage;
    if ([...WORKSPACE_STORAGE_KEYS, SEEN_LANDING_KEY].some((key) => storage.getItem(key) !== null)) {
      return false;
    }
    storage.setItem(SEEN_LANDING_KEY, '1');
  } catch {
    // Without storage we cannot remember the redirect, so never redirect.
    return false;
  }

  window.history.replaceState(window.history.state, '', `/about${search}${hash}`);
  return true;
}
