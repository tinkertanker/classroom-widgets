import { useCallback, useEffect, useMemo, useState } from 'react';
import { isDesktopDashboardMode } from '@shared/utils/dashboardMode';

type DashboardBridge = {
  setVisible: (visible: boolean) => void;
  toggle: () => void;
  isVisible: () => boolean;
  isInteractiveAt: (x: number, y: number) => boolean;
};

type DashboardInteractiveRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
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

const DASHBOARD_INTERACTIVE_SELECTOR = [
  '.widget-wrapper',
  '.toolbar-container button',
  '.toolbar-container a',
  '.toolbar-container input',
  '.toolbar-container select',
  '.toolbar-container textarea',
  '[data-dashboard-interactive="true"]',
  '[role="dialog"]',
  '.delete-button'
].join(', ');

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  return Boolean(
    target.closest('input, textarea, select, [contenteditable="true"]')
  );
}

function isElementInteractable(element: Element) {
  let current: Element | null = element;

  while (current && current !== document.documentElement) {
    const style = window.getComputedStyle(current);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.pointerEvents === 'none' ||
      Number(style.opacity) === 0
    ) {
      return false;
    }
    current = current.parentElement;
  }

  return true;
}

export function useDesktopDashboardMode() {
  const isDashboardMode = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return isDesktopDashboardMode();
  }, []);
  const [isDashboardVisible, setDashboardVisible] = useState(isDashboardMode);
  const [interactiveRegions, setInteractiveRegions] = useState<DashboardInteractiveRegion[]>([]);

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

    let frame = 0;

    const collectRegions = () => {
      if (!isDashboardVisible) return [];

      return Array.from(document.querySelectorAll(DASHBOARD_INTERACTIVE_SELECTOR))
        .filter(isElementInteractable)
        .map((element) => element.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0)
        .map((rect) => ({
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height
        }));
    };

    const publishRegions = () => {
      frame = 0;
      const regions = collectRegions();
      setInteractiveRegions(regions);
      window.webkit?.messageHandlers?.classroomDashboard?.postMessage({
        type: 'interactive-regions-changed',
        regions
      });
    };

    const schedulePublish = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(publishRegions);
    };

    schedulePublish();
    window.addEventListener('resize', schedulePublish);
    window.addEventListener('scroll', schedulePublish, true);
    document.addEventListener('transitionend', schedulePublish, true);

    const resizeObserver = new ResizeObserver(schedulePublish);
    resizeObserver.observe(document.documentElement);
    document
      .querySelectorAll(DASHBOARD_INTERACTIVE_SELECTOR)
      .forEach((element) => resizeObserver.observe(element));

    const mutationObserver = new MutationObserver(schedulePublish);
    mutationObserver.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true
    });

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      window.removeEventListener('resize', schedulePublish);
      window.removeEventListener('scroll', schedulePublish, true);
      document.removeEventListener('transitionend', schedulePublish, true);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
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

        return interactiveRegions.some((region) => (
          x >= region.x &&
          x <= region.x + region.width &&
          y >= region.y &&
          y <= region.y + region.height
        ));
      }
    };

    return () => {
      delete window.classroomDashboard;
    };
  }, [interactiveRegions, isDashboardMode, isDashboardVisible, setVisible, toggle]);

  return {
    isDashboardMode,
    isDashboardVisible,
    setDashboardVisible,
    toggleDashboard: toggle
  };
}
