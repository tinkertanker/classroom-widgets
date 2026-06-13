import { useCallback, useEffect, useMemo, useState } from 'react';
import { isDesktopDashboardMode } from '@shared/utils/dashboardMode';
import { useWorkspaceStore } from '../../store/workspaceStore.simple';

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

type DashboardGlassRegion = DashboardInteractiveRegion & {
  radius: number;
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
  '.dashboard-widget-chrome',
  '[data-dashboard-interactive="true"]',
  '[role="dialog"]',
  '.delete-button'
].join(', ');

// Surfaces that get a native NSVisualEffectView blur behind the window,
// so the real desktop shows through (CSS backdrop-filter can only blur
// other web content, never what's behind the transparent window).
const DASHBOARD_GLASS_SELECTOR = [
  '.widget-surface[data-dashboard-glass="true"]',
  '[role="dialog"]'
].join(', ');

const supportsCheckVisibility =
  typeof Element !== 'undefined' && 'checkVisibility' in Element.prototype;

function isElementInteractable(element: Element) {
  // pointer-events is inherited and can be re-enabled by descendants
  // (e.g. .toolbar-container and .toolbar-content disable it, the buttons
  // inside restore it), so only the element's own computed value is
  // meaningful — an ancestor's 'none' must not disqualify the element.
  if (window.getComputedStyle(element).pointerEvents === 'none') {
    return false;
  }

  // Single native call instead of a getComputedStyle walk per ancestor;
  // this runs for every tracked element on every region update.
  if (supportsCheckVisibility) {
    return element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
  }

  let current: Element | null = element;

  while (current && current !== document.documentElement) {
    const style = window.getComputedStyle(current);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
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
  const [isDashboardVisible, setDashboardVisible] = useState(() => {
    if (!isDashboardMode || typeof window === 'undefined') return false;

    return new URLSearchParams(window.location.search).get('visible') !== '0';
  });
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

    // Native positions views and hit-tests from these rects; integer pixels
    // are enough precision and stop sub-pixel float churn from spamming the
    // bridge on every layout tick.
    const roundRect = (rect: DOMRect) => ({
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    });

    const collectRegions = () => {
      if (!isDashboardVisible) return [];

      return Array.from(document.querySelectorAll(DASHBOARD_INTERACTIVE_SELECTOR))
        .filter(isElementInteractable)
        .map((element) => element.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0)
        .map(roundRect);
    };

    // Returns null to mean "leave the native backdrops as they are" — distinct
    // from [] ("remove them"). We never send [] on hide so the native side can
    // fade its existing blur out instead of having it yanked mid-animation.
    const collectGlassRegions = (): DashboardGlassRegion[] | null => {
      if (!isDashboardVisible) return null;

      // Behind-window blur is expensive to recomposite, so don't reposition it
      // every frame of a drag; the post-drop DOM settle publishes the final
      // positions.
      if (useWorkspaceStore.getState().dragState.isDragging) return null;

      const elements = Array.from(document.querySelectorAll(DASHBOARD_GLASS_SELECTOR))
        .filter(isElementInteractable);

      // A surface mid entrance/scale animation reports a transformed rect, so
      // publishing now would place the blur displaced and then snap it. Defer
      // until it settles — animationend reschedules a publish (and reduced
      // motion has no running animation, so this publishes immediately).
      const animating = elements.some((element) =>
        element.getAnimations().some((animation) => animation.playState === 'running')
      );
      if (animating) return null;

      return elements
        .map((element) => ({
          rect: element.getBoundingClientRect(),
          radius: parseFloat(window.getComputedStyle(element).borderTopLeftRadius) || 0
        }))
        .filter(({ rect }) => rect.width > 0 && rect.height > 0)
        .map(({ rect, radius }) => ({
          ...roundRect(rect),
          radius: Math.round(radius)
        }));
    };

    let lastPublishedKey: string | null = null;
    let lastPublishedGlassKey: string | null = null;

    const publishRegions = () => {
      frame = 0;
      const regions = collectRegions();
      const key = regions
        .map((region) => `${region.x},${region.y},${region.width},${region.height}`)
        .join(';');
      if (key !== lastPublishedKey) {
        lastPublishedKey = key;
        setInteractiveRegions(regions);
        window.webkit?.messageHandlers?.classroomDashboard?.postMessage({
          type: 'interactive-regions-changed',
          regions
        });
      }

      const glassRegions = collectGlassRegions();
      if (glassRegions === null) return;
      const glassKey = glassRegions
        .map((region) => `${region.x},${region.y},${region.width},${region.height},${region.radius}`)
        .join(';');
      if (glassKey !== lastPublishedGlassKey) {
        lastPublishedGlassKey = glassKey;
        window.webkit?.messageHandlers?.classroomDashboard?.postMessage({
          type: 'glass-regions-changed',
          regions: glassRegions
        });
      }
    };

    const schedulePublish = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(publishRegions);
    };

    schedulePublish();
    window.addEventListener('resize', schedulePublish);
    window.addEventListener('scroll', schedulePublish, true);
    document.addEventListener('transitionend', schedulePublish, true);
    // The widget entrance/exit effects are CSS animations, not transitions;
    // without this the published rects go stale after each show.
    document.addEventListener('animationend', schedulePublish, true);

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
      document.removeEventListener('animationend', schedulePublish, true);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [isDashboardMode, isDashboardVisible]);

  // WKWebView reports the macOS appearance through prefers-color-scheme, so
  // the desktop overlay follows the system (including automatic light/dark
  // switching) instead of the manually toggled in-app theme.
  useEffect(() => {
    if (!isDashboardMode) return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applySystemTheme = () => {
      useWorkspaceStore.getState().setTheme(media.matches ? 'dark' : 'light');
    };

    applySystemTheme();
    media.addEventListener('change', applySystemTheme);
    return () => media.removeEventListener('change', applySystemTheme);
  }, [isDashboardMode]);

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

  // Toggling is owned by the native global hotkey (default ⌥⌘D). A duplicate
  // web handler on the same combo would double-fire while the overlay is
  // focused (both fire, cancelling out), so there is intentionally none here.

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
