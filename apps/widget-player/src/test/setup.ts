import '@testing-library/jest-dom';

import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

Object.defineProperty(window, 'scrollTo', {
  configurable: true,
  value: vi.fn(),
});

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
  delete window.__CLASSROOM_WIDGET_SPEC__;
  delete window.__CLASSROOM_WIDGET_ASSET_BASE_URL__;
  delete window.__CLASSROOM_WIDGET_API_BASE_URL__;
  delete window.ClassroomWidgetsPlayer;
  delete window.webkit;
  vi.restoreAllMocks();
});
