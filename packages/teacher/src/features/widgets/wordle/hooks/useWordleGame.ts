import { useState, useCallback, useEffect } from 'react';
import { VALID_WORDS, TARGET_WORDS } from '../wordList';
import { useTemporaryState } from '@shared/hooks/useTemporaryState';

interface UseWordleGameProps {
  initialState?: {
    targetWord?: string;
    guesses?: string[];
    currentGuess?: string;
    gameStatus?: 'playing' | 'won' | 'lost';
  };
  onStateChange?: (state: WordleState) => void;
}

const WORD_LENGTH = 5;
const MAX_GUESSES = 6;

interface WordleState {
  targetWord: string;
  guesses: string[];
  currentGuess: string;
  gameStatus: 'playing' | 'won' | 'lost';
}

export const useWordleGame = ({
  initialState,
  onStateChange
}: UseWordleGameProps) => {
  // Initialize with saved state or new game
  const [targetWord, setTargetWord] = useState(
    initialState?.targetWord || getRandomWord()
  );
  const [guesses, setGuesses] = useState<string[]>(
    initialState?.guesses || []
  );
  const [currentGuess, setCurrentGuess] = useState(
    initialState?.currentGuess || ''
  );
  const [gameStatus, setGameStatus] = useState<'playing' | 'won' | 'lost'>(
    initialState?.gameStatus || 'playing'
  );
  const {
    value: message,
    setTemporaryValue: showMessage,
    clear: clearMessage
  } = useTemporaryState('', 3000);

  // Calculate letter statuses for keyboard
  const letterStatuses = guesses.reduce((acc, guess) => {
    guess.split('').forEach((letter, index) => {
      if (targetWord[index] === letter) {
        acc[letter] = 'correct';
      } else if (targetWord.includes(letter) && acc[letter] !== 'correct') {
        acc[letter] = 'present';
      } else if (!acc[letter]) {
        acc[letter] = 'absent';
      }
    });
    return acc;
  }, {} as Record<string, 'correct' | 'present' | 'absent'>);

  // Save state when it changes
  useEffect(() => {
    if (onStateChange) {
      onStateChange({
        targetWord,
        guesses,
        currentGuess,
        gameStatus
      });
    }
  }, [targetWord, guesses, currentGuess, gameStatus, onStateChange]);

  const addLetter = useCallback((letter: string) => {
    if (gameStatus !== 'playing') return;
    if (currentGuess.length >= WORD_LENGTH) return;
    
    setCurrentGuess(prev => prev + letter);
  }, [currentGuess, gameStatus]);

  const removeLetter = useCallback(() => {
    if (gameStatus !== 'playing') return;
    
    setCurrentGuess(prev => prev.slice(0, -1));
  }, [gameStatus]);

  const submitGuess = useCallback(() => {
    if (gameStatus !== 'playing') return;
    if (currentGuess.length !== WORD_LENGTH) {
      showMessage('Not enough letters');
      return;
    }

    if (!VALID_WORDS.includes(currentGuess.toLowerCase())) {
      showMessage('Not in word list');
      return;
    }

    const newGuesses = [...guesses, currentGuess];
    setGuesses(newGuesses);
    setCurrentGuess('');

    // Check win condition
    if (currentGuess === targetWord) {
      setGameStatus('won');
      showMessage('Genius!');
    } else if (newGuesses.length >= MAX_GUESSES) {
      setGameStatus('lost');
      showMessage(`The word was ${targetWord}`);
    }
  }, [currentGuess, gameStatus, guesses, targetWord, showMessage]);

  const resetGame = useCallback(() => {
    const newWord = getRandomWord();
    setTargetWord(newWord);
    setGuesses([]);
    setCurrentGuess('');
    setGameStatus('playing');
    clearMessage();
  }, [clearMessage]);

  return {
    targetWord,
    guesses,
    currentGuess,
    gameStatus,
    letterStatuses,
    addLetter,
    removeLetter,
    submitGuess,
    resetGame,
    message
  };
};

function getRandomWord(): string {
  return TARGET_WORDS[Math.floor(Math.random() * TARGET_WORDS.length)].toUpperCase();
}
