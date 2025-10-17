import React, { useState, useEffect } from 'react';
import { cn, buttons, widgetControls, widgetWrapper } from '../../../shared/utils/styles';

interface TicTacToeProps {
  savedState?: GameState;
  onStateChange?: (state: GameState) => void;
}

interface GameState {
  board: (string | null)[];
  currentPlayer: 'X' | 'O';
  winner: string | null;
  isDraw: boolean;
  score: {
    X: number;
    O: number;
  };
}

const initialState: GameState = {
  board: Array(9).fill(null),
  currentPlayer: 'X',
  winner: null,
  isDraw: false,
  score: { X: 0, O: 0 }
};

const winningCombinations = [
  [0, 1, 2], // Top row
  [3, 4, 5], // Middle row
  [6, 7, 8], // Bottom row
  [0, 3, 6], // Left column
  [1, 4, 7], // Middle column
  [2, 5, 8], // Right column
  [0, 4, 8], // Diagonal top-left to bottom-right
  [2, 4, 6]  // Diagonal top-right to bottom-left
];

const TicTacToe: React.FC<TicTacToeProps> = ({ savedState, onStateChange }) => {
  const [gameState, setGameState] = useState<GameState>(savedState || initialState);

  useEffect(() => {
    if (savedState) {
      setGameState(savedState);
    }
  }, [savedState]);

  useEffect(() => {
    onStateChange?.(gameState);
  }, [gameState, onStateChange]);

  const checkWinner = (board: (string | null)[]): string | null => {
    for (const combination of winningCombinations) {
      const [a, b, c] = combination;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a];
      }
    }
    return null;
  };

  const checkDraw = (board: (string | null)[]): boolean => {
    return board.every(cell => cell !== null);
  };

  const handleCellClick = (index: number) => {
    if (gameState.board[index] || gameState.winner || gameState.isDraw) {
      return;
    }

    const newBoard = [...gameState.board];
    newBoard[index] = gameState.currentPlayer;

    const winner = checkWinner(newBoard);
    const isDraw = !winner && checkDraw(newBoard);

    setGameState(prev => ({
      board: newBoard,
      currentPlayer: prev.currentPlayer === 'X' ? 'O' : 'X',
      winner,
      isDraw,
      score: winner ? {
        ...prev.score,
        [winner]: prev.score[winner as 'X' | 'O'] + 1
      } : prev.score
    }));
  };

  const resetGame = () => {
    setGameState(prev => ({
      ...initialState,
      score: prev.score
    }));
  };

  const resetScore = () => {
    setGameState(initialState);
  };

  const getCellStyle = (value: string | null) => {
    if (!value) return '';
    return value === 'X' 
      ? 'text-sage-600 dark:text-sage-400' 
      : 'text-terracotta-600 dark:text-terracotta-400';
  };

  return (
    <div className={widgetWrapper}>
      <div className="bg-soft-white dark:bg-warm-gray-800 rounded-t-lg border border-warm-gray-200 dark:border-warm-gray-700 w-full h-full flex flex-col p-2">
        {/* Score Display */}
        <div className="flex justify-center mb-2">
          <div className="flex items-center gap-4 text-sm font-medium">
            <div className="flex items-center gap-1">
              <span className="text-sage-600 dark:text-sage-400 text-lg">X</span>
              <span className="text-warm-gray-600 dark:text-warm-gray-400">{gameState.score.X}</span>
            </div>
            <span className="text-warm-gray-400 dark:text-warm-gray-600 text-xs">vs</span>
            <div className="flex items-center gap-1">
              <span className="text-warm-gray-600 dark:text-warm-gray-400">{gameState.score.O}</span>
              <span className="text-terracotta-600 dark:text-terracotta-400 text-lg">O</span>
            </div>
          </div>
        </div>

        {/* Game Status */}
        <div className="text-center mb-2 h-6">
          {gameState.winner && (
            <div className="text-base font-medium">
              <span className={getCellStyle(gameState.winner)}>{gameState.winner}</span>
              <span className="text-warm-gray-600 dark:text-warm-gray-400"> wins!</span>
            </div>
          )}
          {gameState.isDraw && !gameState.winner && (
            <div className="text-base font-medium text-warm-gray-600 dark:text-warm-gray-400">
              It's a draw!
            </div>
          )}
          {!gameState.winner && !gameState.isDraw && (
            <div className="text-xs text-warm-gray-600 dark:text-warm-gray-400">
              Current player: <span className={getCellStyle(gameState.currentPlayer)}>{gameState.currentPlayer}</span>
            </div>
          )}
        </div>

        {/* Game Board */}
        <div className="flex-1 flex items-center justify-center">
          <div className="grid grid-cols-3 gap-1 w-full max-w-[200px] aspect-square">
            {gameState.board.map((value, index) => (
              <button
                key={index}
                onClick={() => handleCellClick(index)}
                className={`
                  aspect-square rounded font-bold text-2xl
                  transition-all duration-200
                  ${value 
                    ? 'bg-warm-gray-100 dark:bg-warm-gray-700 cursor-default' 
                    : 'bg-warm-gray-50 dark:bg-warm-gray-750 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 cursor-pointer'
                  }
                  ${getCellStyle(value)}
                  border border-warm-gray-300 dark:border-warm-gray-600
                `}
                disabled={!!value || !!gameState.winner || gameState.isDraw}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Control Buttons */}
      <div className={cn(widgetControls, "gap-2", "justify-between")}>
        <button
          onClick={resetGame}
          className={cn(buttons.primary, "px-3 py-1.5 text-sm")}
        >
          New Game
        </button>
        <button
          onClick={resetScore}
          className={cn(buttons.primary, "px-3 py-1.5 text-sm")}
        >
          Reset Score
        </button>
      </div>
    </div>
  );
};

export default TicTacToe;