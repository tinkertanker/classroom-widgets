import { vi } from 'vitest';
import { WidgetType } from '@shared/types';

async function getShortener() {
  vi.resetModules();
  const { widgetRegistry } = await import('./WidgetRegistry');
  return widgetRegistry.get(WidgetType.LINK_SHORTENER);
}

afterEach(() => {
  delete window.__CLASSROOM_WIDGETS_MACOS__;
  delete window.__CLASSROOM_WIDGETS_WINDOWS__;
  delete window.__CLASSROOM_WIDGETS_LINUX__;
  window.history.replaceState({}, '', '/');
  vi.unstubAllEnvs();
});

test('the web launcher still requires its build-time key', async () => {
  vi.stubEnv('VITE_SHORTIO_API_KEY', '');
  expect((await getShortener())?.features?.hidden).toBe(true);
  vi.stubEnv('VITE_SHORTIO_API_KEY', 'pk_web');
  expect((await getShortener())?.features?.hidden).toBe(false);
});

test.each(['__CLASSROOM_WIDGETS_MACOS__', '__CLASSROOM_WIDGETS_WINDOWS__', '__CLASSROOM_WIDGETS_LINUX__'] as const)('%s advertises floating Link Shortener without a build-time key', async (flag) => {
  window.history.replaceState({}, '', '/?dashboard=1&mode=compact');
  expect((await getShortener())?.compactPanel?.supported).toBe(false);
  window[flag] = true;
  const config = await getShortener();
  expect(config?.compactPanel?.supported).toBe(true);
  expect(config?.features?.hidden).toBe(false);
  expect(config?.maintainAspectRatio).toBe(false);
});
