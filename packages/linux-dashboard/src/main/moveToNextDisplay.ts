import { clampRect, intersectionArea, type Rect } from './displayGeometry';

export type MoveDirection = 'previous' | 'next';

/**
 * Target frame for "Move to Previous/Next Display": work areas are ordered
 * by origin (x, then y) and wrap around; the panel keeps its size and its
 * offset from the source work area's origin, clamped into the target work
 * area. Returns null with fewer than two displays or when the panel overlaps
 * no work area.
 */
export function nextDisplayFrame(frame: Rect, workAreas: Rect[], direction: MoveDirection = 'next'): Rect | null {
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
  return clampRect({
    x: target.x + frame.x - source.x,
    y: target.y + frame.y - source.y,
    width: frame.width,
    height: frame.height,
  }, target);
}
