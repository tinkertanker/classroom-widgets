import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateRandomFood, isSnakeSelfCollision } from './snake';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('isSnakeSelfCollision', () => {
  it('allows moving into the current tail when the tail will be vacated', () => {
    const snake = [
      { x: 2, y: 2 },
      { x: 2, y: 3 },
      { x: 1, y: 3 },
      { x: 1, y: 2 }
    ];

    expect(isSnakeSelfCollision(snake, { x: 1, y: 2 }, false)).toBe(false);
  });

  it('treats moving into the current tail as a collision when food is eaten', () => {
    const snake = [
      { x: 2, y: 2 },
      { x: 2, y: 3 },
      { x: 1, y: 3 },
      { x: 1, y: 2 }
    ];

    expect(isSnakeSelfCollision(snake, { x: 1, y: 2 }, true)).toBe(true);
  });
});

describe('generateRandomFood', () => {
  it('does not place food on occupied cells', () => {
    vi.spyOn(Math, 'random').mockReturnValue(315 / 400);

    expect(generateRandomFood([{ x: 15, y: 15 }])).toEqual({ x: 16, y: 15 });
  });

  it('returns null when the snake occupies the full grid', () => {
    const occupiedSegments = Array.from({ length: 20 * 20 }, (_, index) => ({
      x: index % 20,
      y: Math.floor(index / 20)
    }));

    expect(generateRandomFood(occupiedSegments)).toBeNull();
  });
});
