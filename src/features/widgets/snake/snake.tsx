import React, { useState, useEffect, useCallback, useRef } from 'react';
import { cn, widgetContainer, buttons, text, transitions } from '../../../shared/utils/styles';

interface Position {
  x: number;
  y: number;
}

enum Direction {
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT'
}

const GRID_SIZE = 20;
const CELL_SIZE = 15;
const INITIAL_SPEED = 150;

const Snake: React.FC = () => {
  const [snake, setSnake] = useState<Position[]>([{ x: 10, y: 10 }]);
  const [food, setFood] = useState<Position>({ x: 15, y: 15 });
  const [direction, setDirection] = useState<Direction>(Direction.RIGHT);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [score, setScore] = useState(0);
  const [speed, setSpeed] = useState(INITIAL_SPEED);
  const directionRef = useRef(direction);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);

  const generateRandomFood = useCallback((): Position => {
    let newFood: Position;
    do {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE)
      };
    } while (snake.some(segment => segment.x === newFood.x && segment.y === newFood.y));
    return newFood;
  }, [snake]);

  const resetGame = useCallback(() => {
    setSnake([{ x: 10, y: 10 }]);
    setFood({ x: 15, y: 15 });
    setDirection(Direction.RIGHT);
    directionRef.current = Direction.RIGHT;
    setGameOver(false);
    setScore(0);
    setSpeed(INITIAL_SPEED);
    setIsPaused(true);
  }, []);

  const moveSnake = useCallback(() => {
    if (gameOver || isPaused) return;

    setSnake(currentSnake => {
      const newSnake = [...currentSnake];
      const head = { ...newSnake[0] };

      switch (directionRef.current) {
        case Direction.UP:
          head.y -= 1;
          break;
        case Direction.DOWN:
          head.y += 1;
          break;
        case Direction.LEFT:
          head.x -= 1;
          break;
        case Direction.RIGHT:
          head.x += 1;
          break;
      }

      // Check wall collision
      if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
        setGameOver(true);
        setIsPaused(true);
        return currentSnake;
      }

      // Check self collision
      if (newSnake.some(segment => segment.x === head.x && segment.y === head.y)) {
        setGameOver(true);
        setIsPaused(true);
        return currentSnake;
      }

      newSnake.unshift(head);

      // Check if food eaten
      if (head.x === food.x && head.y === food.y) {
        setScore(prev => prev + 10);
        setFood(generateRandomFood());
        // Increase speed every 50 points
        if ((score + 10) % 50 === 0) {
          setSpeed(prev => Math.max(50, prev - 20));
        }
      } else {
        newSnake.pop();
      }

      return newSnake;
    });
  }, [gameOver, isPaused, food, score, generateRandomFood]);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (gameOver) return;

      const keyDirectionMap: Record<string, Direction> = {
        ArrowUp: Direction.UP,
        ArrowDown: Direction.DOWN,
        ArrowLeft: Direction.LEFT,
        ArrowRight: Direction.RIGHT
      };

      const newDirection = keyDirectionMap[e.key];
      if (!newDirection) return;

      // Prevent opposite direction
      const opposites: Record<Direction, Direction> = {
        [Direction.UP]: Direction.DOWN,
        [Direction.DOWN]: Direction.UP,
        [Direction.LEFT]: Direction.RIGHT,
        [Direction.RIGHT]: Direction.LEFT
      };

      if (opposites[directionRef.current] !== newDirection) {
        setDirection(newDirection);
        directionRef.current = newDirection;
      }

      // Auto-start game on first key press
      if (isPaused && !gameOver) {
        setIsPaused(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameOver, isPaused]);

  // Game loop
  useEffect(() => {
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current);
    }

    if (!isPaused && !gameOver) {
      gameLoopRef.current = setInterval(moveSnake, speed);
    }

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
    };
  }, [moveSnake, isPaused, gameOver, speed]);

  const togglePause = () => {
    if (!gameOver) {
      setIsPaused(prev => !prev);
    }
  };

  return (
    <div className={`${widgetContainer} items-center justify-center p-4 gap-4`}>
      {/* Header */}
      <div className="w-full flex justify-between items-center">
        <div className={`${text.primary} text-lg font-bold`}>
          Score: {score}
        </div>
        <div className="flex gap-2">
          {!gameOver && (
            <button
              onClick={togglePause}
              className={`${buttons.primary} ${transitions.all} px-3 py-1`}
            >
              {isPaused ? 'Start' : 'Pause'}
            </button>
          )}
          <button
            onClick={resetGame}
            className={`${buttons.secondary} ${transitions.all} px-3 py-1`}
          >
            New Game
          </button>
        </div>
      </div>

      {/* Game Board */}
      <div className="relative bg-gray-900 dark:bg-gray-950 rounded-lg p-2">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${GRID_SIZE}, ${CELL_SIZE}px)`,
            gridTemplateRows: `repeat(${GRID_SIZE}, ${CELL_SIZE}px)`,
            gap: '1px',
            backgroundColor: '#1f2937'
          }}
        >
          {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, index) => {
            const x = index % GRID_SIZE;
            const y = Math.floor(index / GRID_SIZE);
            const isSnake = snake.some(segment => segment.x === x && segment.y === y);
            const isHead = snake[0]?.x === x && snake[0]?.y === y;
            const isFood = food.x === x && food.y === y;

            return (
              <div
                key={index}
                className={`${transitions.all}`}
                style={{
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                  backgroundColor: isHead
                    ? '#10b981'
                    : isSnake
                    ? '#34d399'
                    : isFood
                    ? '#ef4444'
                    : '#374151',
                  borderRadius: isFood ? '50%' : '2px'
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Game Status */}
      {gameOver && (
        <div className="text-xl font-bold text-red-500">
          Game Over!
        </div>
      )}

      {/* Instructions */}
      {isPaused && !gameOver && (
        <div className={`${text.secondary} text-sm text-center`}>
          Use arrow keys to control the snake
        </div>
      )}
    </div>
  );
};

export default Snake;