import React from 'react';
import { clsx } from 'clsx';

interface WordleGridProps {
  guesses: string[];
  currentGuess: string;
  targetWord: string;
}

const WORD_LENGTH = 5;
const MAX_GUESSES = 6;

export const WordleGrid: React.FC<WordleGridProps> = ({
  guesses,
  currentGuess,
  targetWord
}) => {
  const getLetterStatus = (letter: string, index: number, word: string) => {
    if (!targetWord || !word) return 'empty';
    
    if (targetWord[index] === letter) {
      return 'correct';
    } else if (targetWord.includes(letter)) {
      return 'present';
    } else {
      return 'absent';
    }
  };

  const renderRow = (rowIndex: number) => {
    let letters = '';
    let isCurrentRow = false;

    if (rowIndex < guesses.length) {
      letters = guesses[rowIndex];
    } else if (rowIndex === guesses.length) {
      letters = currentGuess;
      isCurrentRow = true;
    }

    return (
      <div key={rowIndex} className="flex gap-1">
        {Array.from({ length: WORD_LENGTH }).map((_, letterIndex) => {
          const letter = letters[letterIndex] || '';
          const status = !isCurrentRow && letter 
            ? getLetterStatus(letter, letterIndex, letters)
            : 'empty';

          return (
            <div
              key={letterIndex}
              className={clsx(
                'w-12 h-12 border-2 flex items-center justify-center font-bold text-lg rounded',
                'transition-all duration-300',
                {
                  'border-warm-gray-300 dark:border-warm-gray-600': status === 'empty' && !letter,
                  'border-warm-gray-400 dark:border-warm-gray-500': status === 'empty' && letter,
                  'bg-emerald-500 text-white border-emerald-500': status === 'correct',
                  'bg-yellow-500 text-white border-yellow-500': status === 'present',
                  'bg-warm-gray-400 dark:bg-warm-gray-600 text-white border-warm-gray-400 dark:border-warm-gray-600': status === 'absent',
                  'animate-scale-in': isCurrentRow && letter
                }
              )}
            >
              {letter}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-1">
      {Array.from({ length: MAX_GUESSES }).map((_, index) => renderRow(index))}
    </div>
  );
};