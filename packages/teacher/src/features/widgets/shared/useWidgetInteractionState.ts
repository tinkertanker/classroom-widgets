import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Pointer-interaction state for the canvas widget wrapper.
 *
 * WidgetWrapper used to track a drag/resize gesture across three unrelated
 * mechanisms: an `isResizing` useState, a `dragMovedRef`, and a `postDragRef`
 * cleared by a zero-delay timeout. They could disagree, and no single place
 * said which combinations were legal. This is the same information as one
 * enumerable machine.
 *
 * Two properties the machine has to keep, both of which shape the API:
 *
 * 1. Most of it must not cause a render. `dragMove` fires on every pointer
 *    move; holding `moved` in React state would re-render the wrapper (and so
 *    the whole widget subtree) dozens of times per second, and the wrapper
 *    deliberately drops its CSS transitions during a drag because that lag is
 *    already visible. So the state lives in a ref and is read synchronously via
 *    `getState()`; only the one bit the render output actually depends on —
 *    "is a resize in progress" — is mirrored into React state.
 *
 * 2. Whether *this* widget is being dragged, for rendering purposes, still
 *    comes from the workspace store, not from here. The store is the authority
 *    on drag state and the wrapper's classes/cursor read it directly. This
 *    machine is a local view of the same gesture, fed by react-rnd's callbacks;
 *    the two can legitimately disagree for an instant (the global mouseup
 *    safety net clears one before the other), and the render path must keep
 *    using the store's answer.
 */

export type WidgetInteractionState =
  /** No gesture in progress. */
  | { status: 'idle' }
  /**
   * A react-rnd drag is in progress. `moved` records whether the pointer
   * actually travelled: a press with a few pixels of jitter is a click, and
   * must not be treated as a drag when it ends.
   */
  | { status: 'dragging'; moved: boolean }
  /** A react-rnd resize is in progress. This is the only render-visible status. */
  | { status: 'resizing' }
  /**
   * A drag that moved has just ended. The browser fires `click` after the
   * `mouseup` that ended the drag, and that click must not be taken as a click
   * on the widget. The window is closed by `clickSuppressionElapsed`, which the
   * hook schedules on a zero-delay timeout — long enough to outlive the click,
   * short enough that a real click a moment later still lands.
   */
  | { status: 'postDrag' };

export type WidgetInteractionEvent =
  /** react-rnd onDragStart. */
  | { type: 'dragStart' }
  /** react-rnd onDrag; fires once per pointer move. */
  | { type: 'dragMove' }
  /** react-rnd onDragStop. */
  | { type: 'dragStop' }
  /** react-rnd onResizeStart. */
  | { type: 'resizeStart' }
  /** react-rnd onResizeStop. */
  | { type: 'resizeStop' }
  /**
   * The window-level mouseup safety net, which exists to unstick a gesture
   * whose end react-rnd never saw (pointer released outside the component).
   * It also fires on every ordinary mouseup, *after* react-rnd's own document
   * handler, so in any state other than an in-progress gesture it must do
   * nothing — in particular it must not cancel `postDrag`.
   */
  | { type: 'globalMouseUp' }
  /** The zero-delay timeout that closes the post-drag click-suppression window. */
  | { type: 'clickSuppressionElapsed' };

export const initialWidgetInteractionState: WidgetInteractionState = { status: 'idle' };

/**
 * Pure transition function. Returns the *same object* when an event does not
 * apply, so callers can skip work with a reference check — this is what keeps
 * a stream of `dragMove` events after the first one free.
 */
export function widgetInteractionReducer(
  state: WidgetInteractionState,
  event: WidgetInteractionEvent
): WidgetInteractionState {
  switch (event.type) {
    case 'dragStart':
      // Ignored mid-resize: react-rnd's `disableDragging` makes that
      // unreachable, and dropping out of `resizing` would clear the resize
      // cursor and re-enable dragging mid-gesture.
      if (state.status === 'resizing') return state;
      return { status: 'dragging', moved: false };

    case 'dragMove':
      if (state.status !== 'dragging') return state;
      if (state.moved) return state;
      return { status: 'dragging', moved: true };

    case 'dragStop':
      if (state.status !== 'dragging') return state;
      // A drag that never moved is a click; leave the click alone.
      return state.moved ? { status: 'postDrag' } : { status: 'idle' };

    case 'resizeStart':
      if (state.status === 'resizing') return state;
      return { status: 'resizing' };

    case 'resizeStop':
      if (state.status !== 'resizing') return state;
      return { status: 'idle' };

    case 'globalMouseUp':
      // The gesture ended somewhere react-rnd could not see. Note this does
      // *not* open a click-suppression window: react-rnd never reported a drag
      // stop, so there is no synthetic click coming from it either.
      if (state.status === 'dragging' || state.status === 'resizing') {
        return { status: 'idle' };
      }
      return state;

    case 'clickSuppressionElapsed':
      // A stale timeout from an earlier drag must not cancel a newer gesture.
      if (state.status !== 'postDrag') return state;
      return { status: 'idle' };
  }
}

/** The one bit of the machine the wrapper's rendered output depends on. */
export function isResizingState(state: WidgetInteractionState): boolean {
  return state.status === 'resizing';
}

/** True while the click that terminates a drag should be swallowed. */
export function isClickSuppressedState(state: WidgetInteractionState): boolean {
  return state.status === 'postDrag';
}

export interface WidgetInteraction {
  /** Render-visible: true while a resize gesture is in progress. */
  isResizing: boolean;
  /** Reads the current state synchronously, without subscribing to it. */
  getState: () => WidgetInteractionState;
  /** Convenience for `isClickSuppressedState(getState())`. */
  isClickSuppressed: () => boolean;
  /** Applies an event and returns the resulting state. */
  dispatch: (event: WidgetInteractionEvent) => WidgetInteractionState;
}

export function useWidgetInteractionState(): WidgetInteraction {
  const stateRef = useRef<WidgetInteractionState>(initialWidgetInteractionState);
  const [isResizing, setIsResizing] = useState(false);
  const suppressionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSuppressionTimeout = useCallback(() => {
    if (suppressionTimeoutRef.current) {
      clearTimeout(suppressionTimeoutRef.current);
      suppressionTimeoutRef.current = null;
    }
  }, []);

  // Explicitly typed because the body schedules a follow-up `dispatch`, and an
  // inferred return type would be circular.
  const dispatch = useCallback<WidgetInteraction['dispatch']>((event) => {
    const previous = stateRef.current;
    const next = widgetInteractionReducer(previous, event);
    if (next === previous) return previous;

    stateRef.current = next;

    if (next.status === 'postDrag') {
      clearSuppressionTimeout();
      suppressionTimeoutRef.current = setTimeout(() => {
        suppressionTimeoutRef.current = null;
        dispatch({ type: 'clickSuppressionElapsed' });
      }, 0);
    }

    // Only touch React state when the render-visible projection changes, so a
    // drag start/move/stop costs no render at all.
    if (isResizingState(previous) !== isResizingState(next)) {
      setIsResizing(isResizingState(next));
    }

    return next;
  }, [clearSuppressionTimeout]);

  const getState = useCallback(() => stateRef.current, []);
  const isClickSuppressed = useCallback(() => isClickSuppressedState(stateRef.current), []);

  // Drop a pending suppression timeout on unmount so it can't fire against a
  // gone component. The gesture itself is deliberately not unwound here: the
  // store owns drag state and unmounting mid-drag leaves it exactly as before.
  useEffect(() => clearSuppressionTimeout, [clearSuppressionTimeout]);

  return { isResizing, getState, isClickSuppressed, dispatch };
}
