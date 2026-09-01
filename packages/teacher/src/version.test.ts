import { afterEach, describe, expect, it } from 'vitest';
import { getReleaseLabel } from './version';

describe('getReleaseLabel', () => {
  afterEach(() => {
    delete window.__CLASSROOM_WIDGETS_MACOS_VERSION__;
  });

  it('identifies browser builds by their web build ID', () => {
    const buildID = import.meta.env.VITE_BUILD_ID?.trim() || 'development';

    expect(getReleaseLabel()).toBe(`Web ${buildID}`);
  });

  it('shows the native bundle version inside the macOS app', () => {
    window.__CLASSROOM_WIDGETS_MACOS_VERSION__ = '0.10.15';

    expect(getReleaseLabel()).toBe('macOS v0.10.15');
  });
});
