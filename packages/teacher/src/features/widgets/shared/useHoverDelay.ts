import { useCallback, useEffect, useRef, useState } from 'react';

export interface HoverDelay {
  /** True while hovered, and for `delayMs` after the pointer leaves. */
  visible: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

/**
 * Hover state with a delayed hide, used by the widget wrappers to keep their
 * delete/trash affordance reachable for a moment after the pointer leaves.
 *
 * The delay is per call site on purpose — the canvas wrapper gives the pointer
 * longer to travel to a button that sits outside the widget's own bounds than
 * the column wrapper does.
 */
export function useHoverDelay(delayMs: number): HoverDelay {
  const [visible, setVisible] = useState(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPendingHide = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const onMouseEnter = useCallback(() => {
    cancelPendingHide();
    setVisible(true);
  }, [cancelPendingHide]);

  const onMouseLeave = useCallback(() => {
    cancelPendingHide();
    hideTimeoutRef.current = setTimeout(() => {
      hideTimeoutRef.current = null;
      setVisible(false);
    }, delayMs);
  }, [cancelPendingHide, delayMs]);

  // Drop any pending hide on unmount so the timer can't fire against a gone component
  useEffect(() => cancelPendingHide, [cancelPendingHide]);

  return { visible, onMouseEnter, onMouseLeave };
}
