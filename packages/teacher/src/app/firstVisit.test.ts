import { vi } from 'vitest';
import { STORAGE_KEY, LEGACY_STORAGE_KEY } from '@shared/types/storage';
import { redirectFirstVisitToLanding, SEEN_LANDING_KEY, WORKSPACE_STORAGE_KEYS } from './firstVisit';

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

test('the inlined workspace keys match the store', () => {
  expect(WORKSPACE_STORAGE_KEYS).toEqual([STORAGE_KEY, LEGACY_STORAGE_KEY]);
});

test.each(['?utm_source=newsletter&utm_campaign=launch', '#desktop', '?gclid=abc#desktop'])('a first visit to /%s keeps its query and hash on /about', (suffix) => {
  window.history.replaceState({}, '', `/${suffix}`);
  expect(redirectFirstVisitToLanding()).toBe(true);
  expect(window.location.pathname + window.location.search + window.location.hash).toBe(`/about${suffix}`);
});

test('the redirect keeps the existing history state', () => {
  window.history.replaceState({ key: 'abc' }, '', '/');
  expect(redirectFirstVisitToLanding()).toBe(true);
  expect(window.history.state).toEqual({ key: 'abc' });
});

test('search crawlers are left on the tool so / stays indexable', () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)');
  expect(redirectFirstVisitToLanding()).toBe(false);
  expect(window.location.pathname).toBe('/');
  expect(localStorage.getItem(SEEN_LANDING_KEY)).toBeNull();
});

test.each([STORAGE_KEY, LEGACY_STORAGE_KEY])('a returning user with %s stays on the tool', (key) => {
  localStorage.setItem(key, '{}');
  expect(redirectFirstVisitToLanding()).toBe(false);
  expect(window.location.pathname).toBe('/');
  expect(localStorage.getItem(SEEN_LANDING_KEY)).toBeNull();
});

test.each(['/?surface=widget-panel', '/?surface=widget-launcher&utm_source=x', '/?dashboard=1&mode=compact', '/?desktop=1', '/widgets/timer', '/about'])('%s is never redirected', (url) => {
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
