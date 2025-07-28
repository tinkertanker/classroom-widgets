import React from 'react';
import { clsx } from 'clsx';
import { FaDeleteLeft } from 'react-icons/fa6';

interface WordleKeyboardProps {
  onLetterClick: (letter: string) => void;
  onBackspace: () => void;
  onEnter: () => void;
  letterStatuses: Record<string, 'correct' | 'present' | 'absent'>;
  disabled?: boolean;
}

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACKSPACE']
];

export const WordleKeyboard: React.FC<WordleKeyboardProps> = ({
  onLetterClick,
  onBackspace,
  onEnter,
  letterStatuses,
  disabled
}) => {
  const handleKeyClick = (key: string) => {
    if (disabled) return;
    
    if (key === 'ENTER') {
      onEnter();
    } else if (key === 'BACKSPACE') {
      onBackspace();
    } else {
      onLetterClick(key);
    }
  };

  const getKeyClassName = (key: string) => {
    const status = letterStatuses[key];
    
    return clsx(
      'px-2 py-3 rounded font-semibold text-sm transition-all duration-200',
      'flex items-center justify-center cursor-pointer select-none',
      {
        // Base styles
        'bg-warm-gray-200 dark:bg-warm-gray-700 hover:bg-warm-gray-300 dark:hover:bg-warm-gray-600': !status,
        'text-warm-gray-800 dark:text-warm-gray-200': !status,
        
        // Status styles
        'bg-emerald-500 text-white': status === 'correct',
        'bg-yellow-500 text-white': status === 'present',
        'bg-warm-gray-400 dark:bg-warm-gray-600 text-white': status === 'absent',
        
        // Special keys
        'min-w-[65px]': key === 'ENTER' || key === 'BACKSPACE',
        'min-w-[32px]': key.length === 1,
        
        // Disabled state
        'opacity-50 cursor-not-allowed': disabled
      }
    );
  };

  return (
    <div className="flex flex-col gap-1">
      {KEYBOARD_ROWS.map((row, rowIndex) => (
        <div key={rowIndex} className="flex gap-1 justify-center">
          {row.map((key) => (
            <button
              key={key}
              onClick={() => handleKeyClick(key)}
              className={getKeyClassName(key)}
              disabled={disabled}
            >
              {key === 'BACKSPACE' ? (
                <FaDeleteLeft className="w-4 h-4" />
              ) : (
                key
              )}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
};