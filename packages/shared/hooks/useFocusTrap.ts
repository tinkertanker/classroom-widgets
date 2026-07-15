import { useEffect } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ');

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    // Skip elements hidden via display:none (offsetParent is null for those,
    // except position:fixed elements, which dialogs don't nest).
    .filter((el) => el.offsetParent !== null || el === document.activeElement);
}

/**
 * Traps keyboard focus inside `containerRef` while `active` is true.
 *
 * On activation, focus moves to the first focusable element in the container
 * (unless something inside — e.g. an autoFocus input — already has it; the
 * container itself is the fallback, so give it tabIndex={-1}). Tab and
 * Shift+Tab cycle within the container, and on deactivation focus returns to
 * the element that had it before the trap opened.
 */
export function useFocusTrap(containerRef: React.RefObject<HTMLElement>, active: boolean) {
  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    if (!container.contains(document.activeElement)) {
      const focusable = getFocusable(container);
      (focusable[0] ?? container).focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const focusable = getFocusable(container);
      if (focusable.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;

      if (event.shiftKey) {
        if (current === first || !container.contains(current)) {
          event.preventDefault();
          last.focus();
        }
      } else if (current === last || !container.contains(current)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus only if it is still inside the (closing) container or
      // was lost to <body>; don't steal it from wherever the user clicked.
      const current = document.activeElement;
      if (
        previouslyFocused &&
        previouslyFocused.isConnected &&
        (current === null || current === document.body || container.contains(current))
      ) {
        previouslyFocused.focus();
      }
    };
  }, [containerRef, active]);
}
