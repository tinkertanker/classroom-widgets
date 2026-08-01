import { useCallback, useEffect, useMemo, useState } from 'react';
import { isDesktopDashboardMode } from '@shared/utils/dashboardMode';

export type DashboardWindowMode = 'compact' | 'canvas';
export type CompactWidgetLayout = 'row' | 'column';
const COMPACT_LAYOUT_STORAGE_KEY = 'classroom-dashboard-compact-layout';

type DashboardBridge = {
  setVisible: (visible: boolean) => void;
  toggle: () => void;
  isVisible: () => boolean;
  setWindowMode: (mode: DashboardWindowMode) => void;
  getWindowMode: () => DashboardWindowMode;
  setBackgroundOpacity: (opacity: number) => void;
  getBackgroundOpacity: () => number;
  setWindowChromeVisible: (visible: boolean) => void;
  isWindowChromeVisible: () => boolean;
};

type DashboardTheme = 'light' | 'dark';

declare global {
  interface Window {
    classroomDashboard?: DashboardBridge;
    webkit?: {
      messageHandlers?: {
        classroomDashboard?: {
          postMessage: (message: unknown) => void;
        };
        classroomWidgetPanel?: {
          postMessage: (message: unknown) => void;
        };
      };
    };
  }
}

const getSystemDashboardTheme = (): DashboardTheme => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const getInitialWindowMode = (): DashboardWindowMode => {
  if (typeof window === 'undefined') return 'compact';
  const params = new URLSearchParams(window.location.search);
  const requestedMode = params.get('mode') ?? params.get('windowMode');
  return requestedMode === 'canvas' ? 'canvas' : 'compact';
};

const getInitialCompactLayout = (): CompactWidgetLayout => {
  if (typeof window === 'undefined') return 'row';
  const requestedLayout = new URLSearchParams(window.location.search).get('compactLayout');
  if (requestedLayout === 'row' || requestedLayout === 'column') return requestedLayout;
  try {
    return window.localStorage.getItem(COMPACT_LAYOUT_STORAGE_KEY) === 'column' ? 'column' : 'row';
  } catch {
    return 'row';
  }
};

const clampOpacity = (opacity: number): number => Math.min(1, Math.max(0, opacity));

const getInitialBackgroundOpacity = (): number => {
  if (typeof window === 'undefined') return 1;
  const params = new URLSearchParams(window.location.search);
  const rawOpacity = params.get('backgroundOpacity');
  if (rawOpacity !== null) {
    const opacity = Number(rawOpacity);
    if (Number.isFinite(opacity)) return clampOpacity(opacity);
  }

  // Compatibility with prototypes installed before the continuous slider.
  const appearance = params.get('appearance');
  if (appearance === 'translucent') return 0.58;
  if (appearance === 'transparent') return 0;
  return 1;
};

export function useDesktopDashboardMode() {
  const isDashboardMode = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return isDesktopDashboardMode();
  }, []);
  const [isDashboardVisible, setDashboardVisible] = useState(() => {
    if (!isDashboardMode || typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('visible') !== '0';
  });
  const [windowMode, setWindowModeFromNative] = useState<DashboardWindowMode>(getInitialWindowMode);
  const [compactLayout, setCompactLayout] = useState<CompactWidgetLayout>(getInitialCompactLayout);
  const [backgroundOpacity, setBackgroundOpacity] = useState(getInitialBackgroundOpacity);
  const [windowChromeVisible, setWindowChromeVisible] = useState(true);
  const [dashboardTheme, setDashboardTheme] = useState<DashboardTheme>(getSystemDashboardTheme);

  const setVisible = useCallback((visible: boolean) => {
    setDashboardVisible(visible);
  }, []);

  const toggle = useCallback(() => {
    setDashboardVisible((visible) => !visible);
  }, []);

  const requestWindowMode = useCallback((mode: DashboardWindowMode) => {
    setWindowModeFromNative(mode);
    window.webkit?.messageHandlers?.classroomDashboard?.postMessage({
      type: 'window-mode-requested',
      mode
    });
  }, []);

  useEffect(() => {
    if (!isDashboardMode) return;

    document.documentElement.classList.add('desktop-dashboard-mode');
    document.documentElement.classList.toggle('desktop-dashboard-visible', isDashboardVisible);
    document.documentElement.classList.toggle('desktop-dashboard-hidden', !isDashboardVisible);
    document.documentElement.classList.toggle('desktop-dashboard-compact', windowMode === 'compact');
    document.documentElement.classList.toggle('desktop-dashboard-canvas', windowMode === 'canvas');
    document.documentElement.classList.toggle('desktop-dashboard-widget-row', compactLayout === 'row');
    document.documentElement.classList.toggle('desktop-dashboard-widget-column', compactLayout === 'column');
    document.documentElement.classList.toggle(
      'desktop-dashboard-chrome-hidden',
      windowMode === 'compact' && !windowChromeVisible
    );
    document.documentElement.style.setProperty('--desktop-dashboard-background-opacity', String(backgroundOpacity));

    window.webkit?.messageHandlers?.classroomDashboard?.postMessage({
      type: 'visibility-changed',
      visible: isDashboardVisible
    });

    return () => {
      document.documentElement.classList.remove(
        'desktop-dashboard-mode',
        'desktop-dashboard-visible',
        'desktop-dashboard-hidden',
        'desktop-dashboard-compact',
        'desktop-dashboard-canvas',
        'desktop-dashboard-widget-row',
        'desktop-dashboard-widget-column',
        'desktop-dashboard-chrome-hidden'
      );
      document.documentElement.style.removeProperty('--desktop-dashboard-background-opacity');
    };
  }, [backgroundOpacity, compactLayout, isDashboardMode, isDashboardVisible, windowChromeVisible, windowMode]);

  useEffect(() => {
    if (!isDashboardMode) return;
    try {
      window.localStorage.setItem(COMPACT_LAYOUT_STORAGE_KEY, compactLayout);
    } catch {
      // The in-memory selection still applies when storage is unavailable.
    }
  }, [compactLayout, isDashboardMode]);

  // WKWebView reports the macOS appearance through prefers-color-scheme. Keep
  // this transient so dashboard mode does not overwrite the browser preference.
  useEffect(() => {
    if (!isDashboardMode || typeof window.matchMedia !== 'function') return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applySystemTheme = () => {
      setDashboardTheme(media.matches ? 'dark' : 'light');
    };

    applySystemTheme();
    media.addEventListener('change', applySystemTheme);
    return () => media.removeEventListener('change', applySystemTheme);
  }, [isDashboardMode]);

  useEffect(() => {
    if (!isDashboardMode) return;

    window.classroomDashboard = {
      setVisible,
      toggle,
      isVisible: () => isDashboardVisible,
      setWindowMode: setWindowModeFromNative,
      getWindowMode: () => windowMode,
      setBackgroundOpacity: (opacity) => setBackgroundOpacity(clampOpacity(opacity)),
      getBackgroundOpacity: () => backgroundOpacity,
      setWindowChromeVisible,
      isWindowChromeVisible: () => windowChromeVisible
    };

    return () => {
      delete window.classroomDashboard;
    };
  }, [backgroundOpacity, isDashboardMode, isDashboardVisible, setVisible, toggle, windowChromeVisible, windowMode]);

  return {
    isDashboardMode,
    isDashboardVisible,
    dashboardTheme,
    windowMode,
    compactLayout,
    backgroundOpacity,
    setCompactLayout,
    setDashboardVisible,
    requestWindowMode,
    toggleDashboard: toggle
  };
}
