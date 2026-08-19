import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWidgetState } from '@shared/hooks/useWidgetState';

// Mirrors TicTacToe's GameState: a nested array and a nested object, both of
// which the widget rebuilds as new references on every local update. A parent
// that persists and replays this shape (the desktop compact panel deserialises
// its snapshot, so every render hands the widget freshly built objects) is the
// case a one-level comparison cannot see through.
interface GameState {
  board: (string | null)[];
  currentPlayer: 'X' | 'O';
  score: { X: number; O: number };
}

// Every call returns brand new `board` / `score` references, so two states that
// are value-equal are never reference-equal.
const makeState = (overrides: Partial<GameState> = {}): GameState => ({
  board: Array(9).fill(null),
  currentPlayer: 'X',
  score: { X: 0, O: 0 },
  ...overrides
});

const withMove = (index: number, player: 'X' | 'O'): GameState => {
  const board = Array(9).fill(null);
  board[index] = player;
  return makeState({ board, currentPlayer: player === 'X' ? 'O' : 'X' });
};

/**
 * Renders the hook the way a widget host does: `savedState` arrives as a prop,
 * `onStateChange` is the persistence callback. `renders` counts every render of
 * the hook's component, so an unnecessary resync shows up as an extra render on
 * top of the one the rerender itself causes.
 */
function renderWidget(initialSavedState: GameState | undefined) {
  const onStateChange = vi.fn<(state: GameState) => void>();
  const counter = { renders: 0 };

  const view = renderHook(
    ({ savedState }: { savedState: GameState | undefined }) => {
      counter.renders++;
      return useWidgetState<GameState>({
        initialState: makeState(),
        savedState,
        onStateChange
      });
    },
    { initialProps: { savedState: initialSavedState } }
  );

  return { ...view, onStateChange, counter };
}

describe('useWidgetState savedState resync', () => {
  it('ignores a parent that rebuilds savedState with the same contents every render', () => {
    const { result, rerender, counter, onStateChange } = renderWidget(makeState());

    const stateAfterMount = result.current.state;
    const rendersAfterMount = counter.renders;

    // Three rerenders, each with a structurally identical but freshly built value.
    rerender({ savedState: makeState() });
    rerender({ savedState: makeState() });
    rerender({ savedState: makeState() });

    // One render per rerender and no more: a resync would call setState with a
    // different reference and force a second render each time.
    expect(counter.renders).toBe(rendersAfterMount + 3);
    expect(result.current.state).toBe(stateAfterMount);
    expect(onStateChange).not.toHaveBeenCalled();
  });

  it('does not revert a local update when the parent echoes it back rebuilt', () => {
    const { result, rerender, counter, onStateChange } = renderWidget(makeState());

    act(() => {
      result.current.setState(withMove(0, 'X'));
    });

    const localState = result.current.state;
    expect(localState.board[0]).toBe('X');
    expect(onStateChange).toHaveBeenCalledTimes(1);

    const rendersAfterUpdate = counter.renders;

    // The parent persisted the update and now replays it as a fresh object with
    // fresh nested members - value-equal to what the hook emitted, never
    // reference-equal to it.
    rerender({ savedState: withMove(0, 'X') });
    rerender({ savedState: withMove(0, 'X') });

    expect(counter.renders).toBe(rendersAfterUpdate + 2);
    expect(result.current.state).toBe(localState);
    expect(onStateChange).toHaveBeenCalledTimes(1);
  });

  it('adopts a genuine external nested change the hook did not emit', () => {
    const { result, rerender } = renderWidget(makeState());

    act(() => {
      result.current.setState(withMove(0, 'X'));
    });
    expect(result.current.state.board[0]).toBe('X');

    // Somebody else moved: a nested change the hook never pushed out.
    const external = makeState({
      board: ['X', 'O', null, null, null, null, null, null, null],
      currentPlayer: 'X',
      score: { X: 1, O: 2 }
    });
    rerender({ savedState: external });

    expect(result.current.state).toEqual(external);
    expect(result.current.state.board[1]).toBe('O');
    expect(result.current.state.score).toEqual({ X: 1, O: 2 });
  });

  it('adopts an external change that only differs in a nested field', () => {
    const { result, rerender } = renderWidget(makeState());

    // Identical except for one nested counter - invisible to a one-level compare.
    const external = makeState({ score: { X: 3, O: 0 } });
    rerender({ savedState: external });

    expect(result.current.state.score).toEqual({ X: 3, O: 0 });
  });

  it('keeps an in-flight local update when savedState still holds the previous value', () => {
    const stale = makeState();
    const { result, rerender } = renderWidget(stale);

    act(() => {
      result.current.setState(withMove(4, 'X'));
    });
    const localState = result.current.state;

    // The parent re-renders for its own reasons before it has persisted the
    // update, so the widget is handed the pre-update value one render late.
    rerender({ savedState: stale });

    expect(result.current.state).toBe(localState);
    expect(result.current.state.board[4]).toBe('X');
  });

  it('keeps an in-flight local update when the lagging savedState is also rebuilt', () => {
    const { result, rerender } = renderWidget(makeState());

    act(() => {
      result.current.setState(withMove(4, 'X'));
    });
    const localState = result.current.state;

    // Same lag, but the parent rebuilds the prop, so the stale value is not even
    // reference-equal to the one the hook already reconciled at mount.
    rerender({ savedState: makeState() });

    expect(result.current.state).toBe(localState);
    expect(result.current.state.board[4]).toBe('X');
  });

  it('starts from savedState when one is supplied and from initialState otherwise', () => {
    const saved = withMove(2, 'X');
    const { result: withSaved, counter: savedCounter } = renderWidget(saved);
    expect(withSaved.current.state).toBe(saved);
    // Mount must not trigger a resync render on top of the initial one.
    expect(savedCounter.renders).toBe(1);

    const { result: withoutSaved } = renderWidget(undefined);
    expect(withoutSaved.current.state).toEqual(makeState());
  });

  it('adopts savedState that arrives after mounting without one', () => {
    const { result, rerender } = renderWidget(undefined);

    const arriving = withMove(8, 'O');
    rerender({ savedState: arriving });

    expect(result.current.state).toEqual(arriving);
  });

  it('still notifies the parent through updateState and resetState', () => {
    const { result, onStateChange } = renderWidget(makeState());

    act(() => {
      result.current.updateState({ currentPlayer: 'O' });
    });
    expect(onStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ currentPlayer: 'O' })
    );

    act(() => {
      result.current.resetState();
    });
    expect(onStateChange).toHaveBeenLastCalledWith(makeState());
    expect(result.current.state).toEqual(makeState());
  });
});
