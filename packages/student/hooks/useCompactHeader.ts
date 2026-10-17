import { useEffect, useRef, useState } from 'react';

// Constants for header behavior
const SCROLL_THRESHOLD_ENTER = 100; // pixels before header becomes compact
const SCROLL_THRESHOLD_EXIT = 50; // pixels before header exits compact mode (hysteresis)
const COMPACT_HEADER_HEIGHT_MOBILE = 56; // height in pixels for mobile compact mode

/**
 * The sticky join header turns compact once the page scrolls, and publishes
 * its height as the --header-height CSS variable for the content spacer.
 */
export function useCompactHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

  // Handle scroll state updates with throttling and hysteresis
  useEffect(() => {
    let rafId: number | null = null;

    const handleScroll = () => {
      if (rafId) return; // Throttle updates

      rafId = requestAnimationFrame(() => {
        const scrollPosition = window.scrollY;

        setIsScrolled(prevIsScrolled => {
          // Hysteresis: different thresholds for entering and exiting compact mode
          if (!prevIsScrolled && scrollPosition > SCROLL_THRESHOLD_ENTER) {
            return true; // Enter compact mode
          } else if (prevIsScrolled && scrollPosition < SCROLL_THRESHOLD_EXIT) {
            return false; // Exit compact mode
          }
          return prevIsScrolled; // No change
        });

        rafId = null;
      });
    };

    // Initial check
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Handle header height measurements with ResizeObserver
  useEffect(() => {
    if (!headerRef.current) return;

    const updateHeaderHeight = () => {
      if (!headerRef.current) return;

      const height = headerRef.current.offsetHeight;
      const isMobile = window.innerWidth <= 640;

      // Apply different heights based on state and device
      const finalHeight = (isMobile && isScrolled)
        ? COMPACT_HEADER_HEIGHT_MOBILE
        : height;

      document.documentElement.style.setProperty('--header-height', `${finalHeight}px`);
    };

    // Use ResizeObserver for accurate measurements
    const resizeObserver = new ResizeObserver(updateHeaderHeight);
    resizeObserver.observe(headerRef.current);

    // Also update on window resize for responsive changes
    window.addEventListener('resize', updateHeaderHeight);
    updateHeaderHeight(); // Initial measurement

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateHeaderHeight);
    };
  }, [isScrolled]); // Re-measure when scroll state changes

  return { headerRef, isScrolled };
}
