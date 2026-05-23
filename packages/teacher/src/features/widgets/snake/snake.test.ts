import { describe, expect, it } from 'vitest';
import { isSnakeSelfCollision } from './snake';

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
