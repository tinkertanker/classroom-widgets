import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWordleGame } from './useWordleGame';

// 'APPLE' and 'ABOUT' are both TARGET_WORDS, so they are guessable too.
const TARGET = 'APPLE';
const WRONG_VALID = 'ABOUT';

function typeWord(result: { current: ReturnType<typeof useWordleGame> }, word: string) {
  for (const letter of word) {
    act(() => result.current.addLetter(letter));
  }
}

describe('useWordleGame', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setup(initialState: Parameters<typeof useWordleGame>[0]['initialState'] = { targetWord: TARGET }) {
    return renderHook(() => useWordleGame({ initialState }));
  }

  it('restores a saved game exactly', () => {
    const { result } = setup({
      targetWord: TARGET,
      guesses: [WRONG_VALID],
      currentGuess: 'AP',
      gameStatus: 'playing'
    });

    expect(result.current.targetWord).toBe(TARGET);
    expect(result.current.guesses).toEqual([WRONG_VALID]);
    expect(result.current.currentGuess).toBe('AP');
    expect(result.current.gameStatus).toBe('playing');
  });

  it('caps the current guess at five letters', () => {
    const { result } = setup();

    typeWord(result, 'ABCDEFGH');

    expect(result.current.currentGuess).toBe('ABCDE');
  });

  it('removes letters and tolerates backspace on an empty guess', () => {
    const { result } = setup();

    act(() => result.current.removeLetter());
    expect(result.current.currentGuess).toBe('');

    typeWord(result, 'AB');
    act(() => result.current.removeLetter());
    expect(result.current.currentGuess).toBe('A');
  });

  it('rejects a submit with fewer than five letters', () => {
    const { result } = setup();

    typeWord(result, 'APP');
    act(() => result.current.submitGuess());

    expect(result.current.guesses).toEqual([]);
    expect(result.current.message).toBe('Not enough letters');
  });

  it('rejects gibberish not in the word list without consuming a guess', () => {
    const { result } = setup();

    typeWord(result, 'ZZZZZ');
    act(() => result.current.submitGuess());

    expect(result.current.guesses).toEqual([]);
    expect(result.current.currentGuess).toBe('ZZZZZ'); // still editable
    expect(result.current.message).toBe('Not in word list');
  });

  it('wins when the target word is guessed', () => {
    const { result } = setup();

    typeWord(result, TARGET);
    act(() => result.current.submitGuess());

    expect(result.current.gameStatus).toBe('won');
    expect(result.current.guesses).toEqual([TARGET]);
    expect(result.current.message).toBe('Genius!');
  });

  it('loses after six wrong guesses and reveals the word', () => {
    const { result } = setup();

    for (let i = 0; i < 6; i++) {
      typeWord(result, WRONG_VALID);
      act(() => result.current.submitGuess());
    }

    expect(result.current.gameStatus).toBe('lost');
    expect(result.current.guesses).toHaveLength(6);
    expect(result.current.message).toBe(`The word was ${TARGET}`);
  });

  it('ignores all input once the game is over', () => {
    const { result } = setup();

    typeWord(result, TARGET);
    act(() => result.current.submitGuess());
    expect(result.current.gameStatus).toBe('won');

    typeWord(result, 'ABOUT');
    expect(result.current.currentGuess).toBe('');

    act(() => result.current.submitGuess());
    expect(result.current.guesses).toHaveLength(1);
  });

  it('computes keyboard letter statuses with correct precedence', () => {
    const { result } = setup();

    // Target APPLE vs guess ABOUT: A correct, B/O/U/T absent
    typeWord(result, WRONG_VALID);
    act(() => result.current.submitGuess());

    expect(result.current.letterStatuses['A']).toBe('correct');
    expect(result.current.letterStatuses['B']).toBe('absent');
    expect(result.current.letterStatuses['T']).toBe('absent');
  });

  it('upgrades a letter from present to correct across guesses but never downgrades', () => {
    const { result } = setup({ targetWord: 'ANGEL' });

    // 'ALONE': A correct (index 0); L present; E present
    typeWord(result, 'ALONE');
    act(() => result.current.submitGuess());
    expect(result.current.letterStatuses['L']).toBe('present');

    // 'ANGLE': L still present (index 3 vs target index 4), E present
    typeWord(result, 'ANGLE');
    act(() => result.current.submitGuess());
    expect(result.current.letterStatuses['A']).toBe('correct');
    expect(result.current.letterStatuses['N']).toBe('correct');
    expect(result.current.letterStatuses['G']).toBe('correct');

    // 'ANGEL' exact: L and E become correct, nothing downgrades
    typeWord(result, 'ANGEL');
    act(() => result.current.submitGuess());
    expect(result.current.letterStatuses['L']).toBe('correct');
    expect(result.current.letterStatuses['E']).toBe('correct');
    expect(result.current.gameStatus).toBe('won');
  });

  it('clears transient messages after their timeout', () => {
    const { result } = setup();

    typeWord(result, 'APP');
    act(() => result.current.submitGuess());
    expect(result.current.message).toBe('Not enough letters');

    act(() => {
      vi.advanceTimersByTime(3001);
    });

    expect(result.current.message).toBe('');
  });

  it('resets to a fresh game', () => {
    const { result } = setup();

    typeWord(result, TARGET);
    act(() => result.current.submitGuess());
    expect(result.current.gameStatus).toBe('won');

    act(() => result.current.resetGame());

    expect(result.current.gameStatus).toBe('playing');
    expect(result.current.guesses).toEqual([]);
    expect(result.current.currentGuess).toBe('');
    expect(result.current.message).toBe('');
    expect(result.current.targetWord).toMatch(/^[A-Z]{5}$/);
  });

  it('notifies onStateChange with the full serializable state', () => {
    const onStateChange = vi.fn();
    const { result } = renderHook(() => useWordleGame({
      initialState: { targetWord: TARGET },
      onStateChange
    }));

    typeWord(result, 'A');

    const lastCall = onStateChange.mock.calls.at(-1)?.[0];
    expect(lastCall).toEqual({
      targetWord: TARGET,
      guesses: [],
      currentGuess: 'A',
      gameStatus: 'playing'
    });
  });
});
