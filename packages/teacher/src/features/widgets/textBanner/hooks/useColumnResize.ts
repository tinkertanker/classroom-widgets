import React, { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_COLUMN_HEIGHT,
  EDITOR_MIN_HEIGHT,
  MAX_COLUMN_HEIGHT,
  MIN_COLUMN_HEIGHT
} from '../textBannerTheme';

interface UseColumnResizeOptions {
  isColumnLayout: boolean;
  isEditorOpen: boolean;
  columnHeight: number | undefined;
  widgetRef: React.RefObject<HTMLDivElement>;
  onColumnHeightChange: (height: number) => void;
}

/**
 * Drag and keyboard resizing of the banner's height in column layout.
 * The height is committed through `onColumnHeightChange` when a drag ends.
 */
export function useColumnResize({
  isColumnLayout,
  isEditorOpen,
  columnHeight,
  widgetRef,
  onColumnHeightChange
}: UseColumnResizeOptions) {
  const [pendingHeight, setPendingHeight] = useState<number | null>(null);
  const resizeStartRef = useRef<{ y: number; startHeight: number } | null>(null);

  const adjustColumnHeight = (delta: number) => {
    if (!isColumnLayout) return;
    const current = columnHeight ?? widgetRef.current?.offsetHeight ?? DEFAULT_COLUMN_HEIGHT;
    const next = Math.min(MAX_COLUMN_HEIGHT, Math.max(MIN_COLUMN_HEIGHT, current + delta));
    onColumnHeightChange(next);
  };

  const handleResizeKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 32 : 8;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      adjustColumnHeight(step);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      adjustColumnHeight(-step);
    }
  };

  const pendingHeightRef = useRef<number | null>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);

  // Make sure any in-progress drag listeners are torn down on unmount.
  useEffect(() => {
    return () => {
      resizeCleanupRef.current?.();
      resizeCleanupRef.current = null;
    };
  }, []);

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    if (!isColumnLayout) return;
    e.preventDefault();
    e.stopPropagation();
    const startHeight = widgetRef.current?.offsetHeight ?? columnHeight ?? DEFAULT_COLUMN_HEIGHT;
    resizeStartRef.current = { y: e.clientY, startHeight };
    pendingHeightRef.current = startHeight;
    setPendingHeight(startHeight);

    const handleMove = (ev: MouseEvent) => {
      if (!resizeStartRef.current) return;
      const delta = ev.clientY - resizeStartRef.current.y;
      const next = Math.min(
        MAX_COLUMN_HEIGHT,
        Math.max(MIN_COLUMN_HEIGHT, resizeStartRef.current.startHeight + delta)
      );
      pendingHeightRef.current = next;
      setPendingHeight(next);
    };

    const detach = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      resizeCleanupRef.current = null;
    };

    const handleUp = () => {
      detach();
      const final = pendingHeightRef.current;
      resizeStartRef.current = null;
      pendingHeightRef.current = null;
      setPendingHeight(null);
      if (final !== null) {
        onColumnHeightChange(final);
      }
    };

    resizeCleanupRef.current = detach;
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  };

  const requestedColumnHeight = pendingHeight ?? columnHeight;
  const effectiveColumnHeight = requestedColumnHeight === undefined
    ? undefined
    : Math.max(MIN_COLUMN_HEIGHT, requestedColumnHeight);
  const columnStyle = isColumnLayout
    ? isEditorOpen
      ? { height: `${Math.max(effectiveColumnHeight ?? 0, EDITOR_MIN_HEIGHT)}px` }
      : effectiveColumnHeight
        ? { height: `${effectiveColumnHeight}px` }
        : undefined
    : undefined;

  return {
    pendingHeight,
    effectiveColumnHeight,
    columnStyle,
    handleResizeKeyDown,
    handleResizeMouseDown
  };
}
