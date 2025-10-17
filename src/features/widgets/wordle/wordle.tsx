import React, { useState, useEffect, useCallback } from 'react';
import { WordleGrid } from './components/WordleGrid';
import { WordleKeyboard } from './components/WordleKeyboard';
import { useWordleGame } from './hooks/useWordleGame';
import { FaRotate, FaLightbulb } from 'react-icons/fa6';

interface WordleProps {
  savedState?: {
    targetWord?: string;
    guesses?: string[];
    currentGuess?: string;
    gameStatus?: 'playing' | 'won' | 'lost';
  };
  onStateChange?: (state: any) => void;
}

const Wordle: React.FC<WordleProps> = ({ savedState, onStateChange }) => {
  const {
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
  } = useWordleGame({
    initialState: savedState,
    onStateChange
  });

  // Handle keyboard input
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (gameStatus !== 'playing') return;
      
      if (e.key === 'Enter') {
        submitGuess();
      } else if (e.key === 'Backspace') {
        removeLetter();
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        addLetter(e.key.toUpperCase());
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameStatus, addLetter, removeLetter, submitGuess]);

  return (
    <div className="w-full h-full flex flex-col bg-soft-white/90 dark:bg-warm-gray-800/90 rounded-lg border border-warm-gray-200 dark:border-warm-gray-700">
      {/* Header */}
      <div className="p-3 border-b border-warm-gray-200 dark:border-warm-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-warm-gray-800 dark:text-warm-gray-200">
            Wordle
          </h3>
          <div className="flex items-center gap-2">
            {gameStatus !== 'playing' && (
              <div className="text-sm font-medium">
                {gameStatus === 'won' ? (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    You won!
                  </span>
                ) : (
                  <span className="text-warm-gray-600 dark:text-warm-gray-400">
                    The word was: {targetWord}
                  </span>
                )}
              </div>
            )}
            <button
              onClick={resetGame}
              className="p-1.5 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 rounded transition-colors"
              title="New game"
            >
              <FaRotate className="w-4 h-4 text-warm-gray-600 dark:text-warm-gray-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Game content */}
      <div className="flex-1 flex flex-col p-3 gap-3 overflow-hidden">
        {/* Message */}
        {message && (
          <div className="text-center">
            <span className="text-sm font-medium text-warm-gray-600 dark:text-warm-gray-400">
              {message}
            </span>
          </div>
        )}

        {/* Grid */}
        <div className="flex-1 flex items-center justify-center">
          <WordleGrid
            guesses={guesses}
            currentGuess={currentGuess}
            targetWord={targetWord}
          />
        </div>

        {/* Keyboard */}
        <div className="mt-auto">
          <WordleKeyboard
            onLetterClick={addLetter}
            onBackspace={removeLetter}
            onEnter={submitGuess}
            letterStatuses={letterStatuses}
            disabled={gameStatus !== 'playing'}
          />
        </div>
      </div>
    </div>
  );
};

export default Wordle;