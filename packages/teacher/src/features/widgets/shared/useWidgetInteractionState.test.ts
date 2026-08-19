import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  classifyDrop,
  initialWidgetInteractionState,
  isClickSuppressedState,
  isResizingState,
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
  it('starts idle', () => {
    expect(initialWidgetInteractionState).toEqual(IDLE);
  });

  describe('idle', () => {
    it('enters dragging, not yet moved, on drag start', () => {
      expect(run({ type: 'dragStart' })).toEqual(DRAGGING);
    });

    it('enters resizing on resize start', () => {
      expect(run({ type: 'resizeStart' })).toEqual(RESIZING);
    });

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
    it('records movement on the first drag move', () => {
      expect(run({ type: 'dragStart' }, { type: 'dragMove' })).toEqual(DRAGGING_MOVED);
    });

    it('returns the identical object for repeat drag moves, so callers can skip work', () => {
      const moved = widgetInteractionReducer(DRAGGING, { type: 'dragMove' });
      expect(widgetInteractionReducer(moved, { type: 'dragMove' })).toBe(moved);
      expect(widgetInteractionReducer(moved, { type: 'dragMove' })).toBe(moved);
    });

    it('resets movement when a second drag starts', () => {
      expect(run({ type: 'dragStart' }, { type: 'dragMove' }, { type: 'dragStart' }))
        .toEqual(DRAGGING);
    });

    it('goes to postDrag when a drag that moved stops', () => {
      expect(run({ type: 'dragStart' }, { type: 'dragMove' }, { type: 'dragStop' }))
        .toEqual(POST_DRAG);
    });

    it('goes straight back to idle when a drag that never moved stops', () => {
      expect(run({ type: 'dragStart' }, { type: 'dragStop' })).toEqual(IDLE);
    });

    it.each([
      ['before any movement', DRAGGING],
      ['after movement', DRAGGING_MOVED]
    ])('returns to idle on a window mouseup %s', (_label, from) => {
      expect(widgetInteractionReducer(from, { type: 'globalMouseUp' })).toEqual(IDLE);
    });

    it('does not open a click-suppression window when the window mouseup ends the drag', () => {
      // react-rnd never reported a drag stop, so no synthetic click follows.
      const after = widgetInteractionReducer(DRAGGING_MOVED, { type: 'globalMouseUp' });
      expect(isClickSuppressedState(after)).toBe(false);
    });

    it('ignores a resize stop it never started', () => {
      expect(widgetInteractionReducer(DRAGGING_MOVED, { type: 'resizeStop' })).toBe(DRAGGING_MOVED);
    });
  });

  describe('resizing', () => {
    it('returns to idle on resize stop', () => {
      expect(run({ type: 'resizeStart' }, { type: 'resizeStop' })).toEqual(IDLE);
    });

    it('returns to idle on a window mouseup', () => {
      expect(run({ type: 'resizeStart' }, { type: 'globalMouseUp' })).toEqual(IDLE);
    });

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
    it('suppresses clicks, and no other state does', () => {
      for (const state of ALL_STATES) {
        expect(isClickSuppressedState(state)).toBe(state.status === 'postDrag');
      }
    });

    it('reopens clicks when the suppression window elapses', () => {
      expect(widgetInteractionReducer(POST_DRAG, { type: 'clickSuppressionElapsed' })).toEqual(IDLE);
    });

    it('survives the window mouseup that follows the same drag', () => {
      // The safety-net listener is still attached and fires on the very mouseup
      // that ended the drag, right after react-rnd's own handler. If that
      // cancelled postDrag, every drag would end by focusing the widget.
      const after = widgetInteractionReducer(POST_DRAG, { type: 'globalMouseUp' });
      expect(after).toBe(POST_DRAG);
      expect(isClickSuppressedState(after)).toBe(true);
    });

    it('is left by a new drag start', () => {
      expect(widgetInteractionReducer(POST_DRAG, { type: 'dragStart' })).toEqual(DRAGGING);
    });
  });

  it('ignores a stale suppression timeout in every state but postDrag', () => {
    for (const state of ALL_STATES.filter((s) => s.status !== 'postDrag')) {
      expect(widgetInteractionReducer(state, { type: 'clickSuppressionElapsed' })).toBe(state);
    }
  });

  it('projects only resizing as render-visible', () => {
    for (const state of ALL_STATES) {
      expect(isResizingState(state)).toBe(state.status === 'resizing');
    }
  });
});

describe('classifyDrop', () => {
  it('treats the trash zone as a delete', () => {
    expect(classifyDrop('trash')).toBe('trash');
  });

  it('treats no drop target as an ordinary reposition', () => {
    expect(classifyDrop(null)).toBe('reposition');
  });

  it('treats any other drop target as an ordinary reposition', () => {
    // Only the trash zone deletes; anything else the board reports must leave
    // the widget alive and simply move it.
    expect(classifyDrop('board')).toBe('reposition');
    expect(classifyDrop('')).toBe('reposition');
  });

  it('carries the whole difference between a trash drop and a reposition', () => {
    // Dragging over the trash is a discriminant on the drag-stop edge, not a
    // state: tracking it live would mean polling the drop target on every
    // pointer move. So the machine's own transition is identical either way,
    // and this classifier is the only thing that tells the two drops apart.
    const afterTrashDrop = run({ type: 'dragStart' }, { type: 'dragMove' }, { type: 'dragStop' });
    const afterOrdinaryDrop = run({ type: 'dragStart' }, { type: 'dragMove' }, { type: 'dragStop' });

    expect(afterTrashDrop).toEqual(POST_DRAG);
    expect(afterOrdinaryDrop).toEqual(POST_DRAG);
    expect(classifyDrop('trash')).not.toBe(classifyDrop(null));
  });
});

describe('useWidgetInteractionState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts idle, not resizing, not suppressing clicks', () => {
    const { result } = renderHook(() => useWidgetInteractionState());

    expect(result.current.getState()).toEqual(IDLE);
    expect(result.current.isResizing).toBe(false);
    expect(result.current.isClickSuppressed()).toBe(false);
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
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
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

    const errorsBefore = consoleError.mock.calls.length;
    act(() => void vi.advanceTimersByTime(0));
    expect(consoleError.mock.calls.length).toBe(errorsBefore);

    consoleError.mockRestore();
  });

  it.each([
    ['drag', [{ type: 'dragStart' }, { type: 'dragMove' }] as WidgetInteractionEvent[]],
    ['resize', [{ type: 'resizeStart' }] as WidgetInteractionEvent[]]
  ])('unmounts cleanly mid-%s without leaving a timer behind', (_label, events) => {
    const { result, unmount } = renderHook(() => useWidgetInteractionState());
    const { dispatch } = result.current;

    act(() => {
      for (const event of events) dispatch(event);
    });

    unmount();

    // The gesture is deliberately not unwound: the workspace store owns drag
    // state, and unmounting mid-drag leaves it untouched, as it always has.
    expect(vi.getTimerCount()).toBe(0);
  });
});
