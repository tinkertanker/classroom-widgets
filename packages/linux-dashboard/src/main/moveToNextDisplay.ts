export interface MoveRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function intersectionArea(a: MoveRect, b: MoveRect): number {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return width > 0 && height > 0 ? width * height : 0;
}

function clampInto(frame: MoveRect, bounds: MoveRect): MoveRect {
  const width = Math.min(frame.width, bounds.width);
  const height = Math.min(frame.height, bounds.height);
  return {
    x: Math.min(Math.max(frame.x, bounds.x), bounds.x + bounds.width - width),
    y: Math.min(Math.max(frame.y, bounds.y), bounds.y + bounds.height - height),
    width,
    height,
  };
}

export type MoveDirection = 'previous' | 'next';

/**
 * Target frame for "Move to Previous/Next Display": work areas are ordered
 * by origin (x, then y) and wrap around; the panel keeps its size and its
 * offset from the source work area's origin, clamped into the target work
 * area. Returns null with fewer than two displays or when the panel overlaps
 * no work area.
 */
export function nextDisplayFrame(frame: MoveRect, workAreas: MoveRect[], direction: MoveDirection = 'next'): MoveRect | null {
  if (workAreas.length < 2) return null;
  const sorted = [...workAreas].sort((a, b) => a.x - b.x || a.y - b.y);
  let sourceIndex = -1;
  let best = 0;
  sorted.forEach((area, index) => {
    const overlap = intersectionArea(area, frame);
    if (overlap > best) {
      best = overlap;
      sourceIndex = index;
    }
  });
  if (sourceIndex < 0) return null;
  const step = direction === 'next' ? 1 : -1;
  const source = sorted[sourceIndex];
  const target = sorted[(sourceIndex + step + sorted.length) % sorted.length];
  return clampInto({
    x: target.x + frame.x - source.x,
    y: target.y + frame.y - source.y,
    width: frame.width,
    height: frame.height,
  }, target);
}
