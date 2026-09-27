import { vi } from 'vitest';
import { STORAGE_KEY, LEGACY_STORAGE_KEY } from '@shared/types/storage';
import { redirectFirstVisitToLanding, SEEN_LANDING_KEY } from './firstVisit';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  window.history.replaceState({}, '', '/');
});

test('a first visit to / moves to /about once, so Start Teaching then opens the tool', () => {
  expect(redirectFirstVisitToLanding()).toBe(true);
  expect(window.location.pathname).toBe('/about');

  window.history.replaceState({}, '', '/');
  expect(redirectFirstVisitToLanding()).toBe(false);
  expect(window.location.pathname).toBe('/');
});

test.each([STORAGE_KEY, LEGACY_STORAGE_KEY])('a returning user with %s stays on the tool', (key) => {
  localStorage.setItem(key, '{}');
  expect(redirectFirstVisitToLanding()).toBe(false);
  expect(window.location.pathname).toBe('/');
  expect(localStorage.getItem(SEEN_LANDING_KEY)).toBeNull();
});

test.each(['/?surface=widget-panel', '/?dashboard=1&mode=compact', '/widgets/timer', '/about'])('%s is never redirected', (url) => {
  window.history.replaceState({}, '', url);
  expect(redirectFirstVisitToLanding()).toBe(false);
  expect(window.location.pathname + window.location.search).toBe(url);
  expect(localStorage.getItem(SEEN_LANDING_KEY)).toBeNull();
});

test.each(['getItem', 'setItem'] as const)('blocked storage (%s throws) keeps the tool instead of redirecting every visit', (method) => {
  vi.spyOn(Storage.prototype, method).mockImplementation(() => {
    throw new DOMException('blocked', 'SecurityError');
  });
  expect(redirectFirstVisitToLanding()).toBe(false);
  expect(window.location.pathname).toBe('/');
});
