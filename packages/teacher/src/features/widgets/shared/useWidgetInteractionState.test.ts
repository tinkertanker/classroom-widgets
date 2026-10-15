import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  initialWidgetInteractionState,
  useWidgetInteractionState,
  widgetInteractionReducer,
  type WidgetInteractionEvent,
  type WidgetInteractionState
} from './useWidgetInteractionState';

const IDLE: WidgetInteractionState = { status: 'idle' };
const DRAGGING: WidgetInteractionState = { status: 'dragging', moved: false };
const DRAGGING_MOVED: WidgetInteractionState = { status: 'dragging', moved: true };
const RESIZING: WidgetInteractionState = { status: 'resizing' };
const POST_DRAG: WidgetInteractionState = { status: 'postDrag' };

const ALL_STATES: WidgetInteractionState[] = [IDLE, DRAGGING, DRAGGING_MOVED, RESIZING, POST_DRAG];

/** Applies a sequence of events from the initial state. */
function run(...events: WidgetInteractionEvent[]): WidgetInteractionState {
  return events.reduce(widgetInteractionReducer, initialWidgetInteractionState);
}

describe('widgetInteractionReducer', () => {
  describe('idle', () => {
    it.each<WidgetInteractionEvent>([
      { type: 'dragMove' },
      { type: 'dragStop' },
      { type: 'resizeStop' },
      { type: 'globalMouseUp' },
      { type: 'clickSuppressionElapsed' }
    ])('ignores $type', (event) => {
      expect(widgetInteractionReducer(IDLE, event)).toBe(IDLE);
    });
  });

  describe('dragging', () => {
    it('resets movement when a second drag starts', () => {
      expect(run({ type: 'dragStart' }, { type: 'dragMove' }, { type: 'dragStart' }))
        .toEqual(DRAGGING);
    });

    it.each([
      ['before any movement', DRAGGING],
      ['after movement', DRAGGING_MOVED]
    ])('returns to idle on a window mouseup %s', (_label, from) => {
      expect(widgetInteractionReducer(from, { type: 'globalMouseUp' })).toEqual(IDLE);
    });

    it('ignores a resize stop it never started', () => {
      expect(widgetInteractionReducer(DRAGGING_MOVED, { type: 'resizeStop' })).toBe(DRAGGING_MOVED);
    });
  });

  describe('resizing', () => {
    it('stays resizing if a drag start slips through', () => {
      // react-rnd's disableDragging makes this unreachable; dropping the resize
      // here would clear the resize cursor mid-gesture.
      expect(widgetInteractionReducer(RESIZING, { type: 'dragStart' })).toBe(RESIZING);
    });

    it('is idempotent on a repeated resize start', () => {
      expect(widgetInteractionReducer(RESIZING, { type: 'resizeStart' })).toBe(RESIZING);
    });

    it('ignores drag events', () => {
      expect(widgetInteractionReducer(RESIZING, { type: 'dragMove' })).toBe(RESIZING);
      expect(widgetInteractionReducer(RESIZING, { type: 'dragStop' })).toBe(RESIZING);
    });
  });

  describe('postDrag', () => {
    it('is left by a new drag start', () => {
      expect(widgetInteractionReducer(POST_DRAG, { type: 'dragStart' })).toEqual(DRAGGING);
    });
  });

  it('ignores a stale suppression timeout in every state but postDrag', () => {
    for (const state of ALL_STATES.filter((s) => s.status !== 'postDrag')) {
      expect(widgetInteractionReducer(state, { type: 'clickSuppressionElapsed' })).toBe(state);
    }
  });
});

describe('useWidgetInteractionState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exposes state synchronously, before React re-renders', () => {
    const { result } = renderHook(() => useWidgetInteractionState());
    const { dispatch, getState } = result.current;

    // Deliberately outside act(): the wrapper reads this inside a click handler
    // that runs before any render caused by the same event.
    expect(dispatch({ type: 'dragStart' })).toEqual(DRAGGING);
    expect(getState()).toEqual(DRAGGING);
  });

  it('mirrors resizing into React state for the render path', () => {
    const { result } = renderHook(() => useWidgetInteractionState());

    act(() => void result.current.dispatch({ type: 'resizeStart' }));
    expect(result.current.isResizing).toBe(true);

    act(() => void result.current.dispatch({ type: 'resizeStop' }));
    expect(result.current.isResizing).toBe(false);
  });

  it('clears resizing when the pointer is released outside the window', () => {
    const { result } = renderHook(() => useWidgetInteractionState());

    act(() => void result.current.dispatch({ type: 'resizeStart' }));
    act(() => void result.current.dispatch({ type: 'globalMouseUp' }));

    expect(result.current.getState()).toEqual(IDLE);
    expect(result.current.isResizing).toBe(false);
  });

  it('clears a drag when the pointer is released outside the window', () => {
    const { result } = renderHook(() => useWidgetInteractionState());
    const { dispatch } = result.current;

    act(() => {
      dispatch({ type: 'dragStart' });
      dispatch({ type: 'dragMove' });
      dispatch({ type: 'globalMouseUp' });
    });

    expect(result.current.getState()).toEqual(IDLE);
    expect(result.current.isClickSuppressed()).toBe(false);
  });

  it('suppresses the click that ends a drag, then reopens clicks a tick later', () => {
    const { result } = renderHook(() => useWidgetInteractionState());
    const { dispatch, isClickSuppressed } = result.current;

    act(() => {
      dispatch({ type: 'dragStart' });
      dispatch({ type: 'dragMove' });
      dispatch({ type: 'dragStop' });
    });

    expect(isClickSuppressed()).toBe(true);

    act(() => void vi.advanceTimersByTime(0));

    expect(isClickSuppressed()).toBe(false);
    expect(result.current.getState()).toEqual(IDLE);
  });

  it('leaves a click through when the press never moved', () => {
    const { result } = renderHook(() => useWidgetInteractionState());
    const { dispatch, isClickSuppressed } = result.current;

    act(() => {
      dispatch({ type: 'dragStart' });
      dispatch({ type: 'dragStop' });
    });

    expect(isClickSuppressed()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps suppressing through the safety-net mouseup that follows the drag stop', () => {
    const { result } = renderHook(() => useWidgetInteractionState());
    const { dispatch, isClickSuppressed } = result.current;

    act(() => {
      dispatch({ type: 'dragStart' });
      dispatch({ type: 'dragMove' });
      dispatch({ type: 'dragStop' });
      // The window listener is still attached and sees the same mouseup.
      dispatch({ type: 'globalMouseUp' });
    });

    expect(isClickSuppressed()).toBe(true);
  });

  it('does not let an earlier drag\'s timeout reopen clicks during a later one', () => {
    const { result } = renderHook(() => useWidgetInteractionState());
    const { dispatch, isClickSuppressed } = result.current;

    act(() => {
      dispatch({ type: 'dragStart' });
      dispatch({ type: 'dragMove' });
      dispatch({ type: 'dragStop' });
      // Second drag starts and ends before the first timeout gets to run.
      dispatch({ type: 'dragStart' });
      dispatch({ type: 'dragMove' });
      dispatch({ type: 'dragStop' });
    });

    expect(isClickSuppressed()).toBe(true);
    expect(vi.getTimerCount()).toBe(1);

    act(() => void vi.advanceTimersByTime(0));
    expect(isClickSuppressed()).toBe(false);
  });

  it('does not render on drag start, drag move, or drag stop', () => {
    // The wrapper drops its CSS transitions during a drag because the lag is
    // already visible; re-rendering the widget subtree per pointer move would
    // undo that. This is the property most likely to regress unnoticed.
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useWidgetInteractionState();
    });

    const rendersAfterMount = renders;
    const { dispatch } = result.current;

    act(() => {
      dispatch({ type: 'dragStart' });
      for (let i = 0; i < 50; i += 1) dispatch({ type: 'dragMove' });
      dispatch({ type: 'dragStop' });
    });
    act(() => void vi.advanceTimersByTime(0));

    expect(renders).toBe(rendersAfterMount);
  });

  it('renders exactly once at resize start and once at resize stop', () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useWidgetInteractionState();
    });

    const rendersAfterMount = renders;

    act(() => void result.current.dispatch({ type: 'resizeStart' }));
    expect(renders).toBe(rendersAfterMount + 1);

    act(() => void result.current.dispatch({ type: 'resizeStop' }));
    expect(renders).toBe(rendersAfterMount + 2);
  });

  it('keeps a stable dispatch identity across renders', () => {
    // The wrapper lists dispatch in effect and callback dependency arrays; an
    // unstable identity would re-attach the window mouseup listener per render.
    const { result, rerender } = renderHook(() => useWidgetInteractionState());
    const first = result.current;

    act(() => void result.current.dispatch({ type: 'resizeStart' }));
    rerender();

    expect(result.current.dispatch).toBe(first.dispatch);
    expect(result.current.getState).toBe(first.getState);
    expect(result.current.isClickSuppressed).toBe(first.isClickSuppressed);
  });

  it('drops a pending suppression timeout when unmounted mid-post-drag', () => {
    const { result, unmount } = renderHook(() => useWidgetInteractionState());
    const { dispatch } = result.current;

    act(() => {
      dispatch({ type: 'dragStart' });
      dispatch({ type: 'dragMove' });
      dispatch({ type: 'dragStop' });
    });
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
