import { useCallback, useEffect, useMemo, useState } from 'react';

type DashboardBridge = {
  setVisible: (visible: boolean) => void;
  toggle: () => void;
  isVisible: () => boolean;
  isInteractiveAt: (x: number, y: number) => boolean;
};

declare global {
  interface Window {
    classroomDashboard?: DashboardBridge;
    webkit?: {
      messageHandlers?: {
        classroomDashboard?: {
          postMessage: (message: unknown) => void;
        };
      };
    };
  }
}

const DASHBOARD_QUERY_KEYS = ['dashboard', 'desktop'];

function readDashboardModeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return DASHBOARD_QUERY_KEYS.some((key) => {
    const value = params.get(key);
    return value === '1' || value === 'true';
  });
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  return Boolean(
    target.closest('input, textarea, select, [contenteditable="true"]')
  );
}

export function useDesktopDashboardMode() {
  const isDashboardMode = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return readDashboardModeFromUrl();
  }, []);
  const [isDashboardVisible, setDashboardVisible] = useState(isDashboardMode);

  const setVisible = useCallback((visible: boolean) => {
    setDashboardVisible(visible);
  }, []);

  const toggle = useCallback(() => {
    setDashboardVisible((visible) => !visible);
  }, []);

  useEffect(() => {
    if (!isDashboardMode) return;

    document.documentElement.classList.toggle('desktop-dashboard-mode', true);
    document.documentElement.classList.toggle('desktop-dashboard-visible', isDashboardVisible);
    document.documentElement.classList.toggle('desktop-dashboard-hidden', !isDashboardVisible);

    window.webkit?.messageHandlers?.classroomDashboard?.postMessage({
      type: 'visibility-changed',
      visible: isDashboardVisible
    });

    return () => {
      document.documentElement.classList.remove(
        'desktop-dashboard-mode',
        'desktop-dashboard-visible',
        'desktop-dashboard-hidden'
      );
    };
  }, [isDashboardMode, isDashboardVisible]);

  useEffect(() => {
    if (!isDashboardMode) return;

    const resetDashboardScroll = () => {
      const board = document.querySelector('.board-scroll-container');
      if (board instanceof HTMLElement) {
        board.scrollLeft = 0;
        board.scrollTop = 0;
      }
    };

    resetDashboardScroll();
    const frame = window.requestAnimationFrame(resetDashboardScroll);
    return () => window.cancelAnimationFrame(frame);
  }, [isDashboardMode]);

  useEffect(() => {
    if (!isDashboardMode) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;

      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.code === 'Space') {
        event.preventDefault();
        toggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDashboardMode, toggle]);

  useEffect(() => {
    if (!isDashboardMode) return;

    window.classroomDashboard = {
      setVisible,
      toggle,
      isVisible: () => isDashboardVisible,
      isInteractiveAt: (x: number, y: number) => {
        if (!isDashboardVisible) return false;

        const element = document.elementFromPoint(x, y);
        if (!element) return false;

        return Boolean(
          element.closest(
            [
              '.widget-wrapper',
              '.toolbar-container button',
              '.toolbar-container a',
              '.toolbar-container input',
              '.toolbar-container select',
              '.toolbar-container textarea',
              '[data-dashboard-interactive="true"]',
              '[role="dialog"]',
              '.delete-button'
            ].join(', ')
          )
        );
      }
    };

    return () => {
      delete window.classroomDashboard;
    };
  }, [isDashboardMode, isDashboardVisible, setVisible, toggle]);

  return {
    isDashboardMode,
    isDashboardVisible,
    setDashboardVisible,
    toggleDashboard: toggle
  };
}
