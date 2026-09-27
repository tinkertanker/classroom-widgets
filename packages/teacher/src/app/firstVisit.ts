import { STORAGE_KEY, LEGACY_STORAGE_KEY } from '@shared/types/storage';

export const SEEN_LANDING_KEY = 'classroom-widgets:seen-landing';

// Sends a brand-new visitor on a bare `/` to the landing page, once per browser.
// Must run before the router renders, as <App /> writes STORAGE_KEY on mount.
export function redirectFirstVisitToLanding(): boolean {
  if (window.location.pathname !== '/' || window.location.search) return false;

  try {
    const storage = window.localStorage;
    if ([STORAGE_KEY, LEGACY_STORAGE_KEY, SEEN_LANDING_KEY].some((key) => storage.getItem(key) !== null)) {
      return false;
    }
    storage.setItem(SEEN_LANDING_KEY, '1');
  } catch {
    // Without storage we cannot remember the redirect, so never redirect.
    return false;
  }

  window.history.replaceState(window.history.state, '', `/about${window.location.hash}`);
  return true;
}
