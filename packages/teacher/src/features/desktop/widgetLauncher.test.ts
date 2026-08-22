import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bindWindowWidgetLauncher,
  openWidgetLauncher,
  registerWidgetLauncherOpener,
  resetWidgetLauncherForTests
} from './widgetLauncher';

describe('widgetLauncher', () => {
  afterEach(() => {
    resetWidgetLauncherForTests();
    delete window.openClassroomWidgetLauncher;
  });

  it('opens immediately when an opener is already registered', () => {
    const open = vi.fn();
    const unregister = registerWidgetLauncherOpener(open);

    openWidgetLauncher();

    expect(open).toHaveBeenCalledTimes(1);
    unregister();
  });

  it('flushes a pending open when the opener mounts later', () => {
    const open = vi.fn();

    openWidgetLauncher();
    expect(open).not.toHaveBeenCalled();

    registerWidgetLauncherOpener(open);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('does not call an opener after it unregisters', () => {
    const open = vi.fn();
    const unregister = registerWidgetLauncherOpener(open);

    unregister();
    openWidgetLauncher();

    expect(open).not.toHaveBeenCalled();
  });

  it('binds a window bridge that prepares then opens', () => {
    const prepare = vi.fn();
    const open = vi.fn();
    const unbind = bindWindowWidgetLauncher(prepare);
    registerWidgetLauncherOpener(open);

    window.openClassroomWidgetLauncher?.();

    expect(prepare).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledTimes(1);
    unbind();
    expect(window.openClassroomWidgetLauncher).toBeUndefined();
  });
});
