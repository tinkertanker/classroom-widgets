import type { Rect, Size } from './displayGeometry';

/** Where the Display window's layout menu can put it on its current screen. */
export const WINDOW_SNAP_PRESETS = [
  'left-half',
  'right-half',
  'top-half',
  'bottom-half',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
  'centre',
  'fill',
] as const;

export type WindowSnapPreset = typeof WINDOW_SNAP_PRESETS[number];

export const WINDOW_SNAP_LABELS: Record<WindowSnapPreset, string> = {
  'left-half': 'Left Half',
  'right-half': 'Right Half',
  'top-half': 'Top Half',
  'bottom-half': 'Bottom Half',
  'top-left': 'Top Left',
  'top-right': 'Top Right',
  'bottom-left': 'Bottom Left',
  'bottom-right': 'Bottom Right',
  centre: 'Centre',
  fill: 'Fill Screen',
};

export interface WindowSnapOptions {
  /** Source display width / height, or null when no source is selected. */
  aspect: number | null;
  /** Window size that is not preview: title bar, control bar and borders. */
  chrome: Size;
  minimumFrame: Size;
  /** Largest window size, or null for no limit. The minimum wins if they conflict. */
  maximumFrame?: Size | null;
  /** Used by `centre`, which keeps the window's size (within the minimum and maximum). */
  currentFrame: Rect;
  /** Gap kept from the work-area edges and between neighbouring halves. */
  margin: number;
}

type Span = 'start' | 'end' | 'full';

// [horizontal span, vertical span]. A full span centres the window on that axis.
const SPANS: Record<WindowSnapPreset, [Span, Span]> = {
  'left-half': ['start', 'full'],
  'right-half': ['end', 'full'],
  'top-half': ['full', 'start'],
  'bottom-half': ['full', 'end'],
  'top-left': ['start', 'start'],
  'top-right': ['end', 'start'],
  'bottom-left': ['start', 'end'],
  'bottom-right': ['end', 'end'],
  centre: ['full', 'full'],
  fill: ['full', 'full'],
};

const finite = (...values: number[]): boolean => values.every(Number.isFinite);

function regionSpan(span: Span, start: number, length: number, gap: number): [number, number] {
  if (span === 'full') return [start, length];
  const half = Math.max((length - gap) / 2, 1);
  return span === 'start' ? [start, half] : [start + length - half, half];
}

function place(span: Span, regionStart: number, regionLength: number, size: number): number {
  if (span === 'start') return regionStart;
  if (span === 'end') return regionStart + regionLength - size;
  return regionStart + (regionLength - size) / 2;
}

/**
 * Frame (window bounds, screen coordinates, y down) for a layout preset on
 * `workArea`. The preview keeps the source aspect when one is given, so a
 * half is the largest preview that fits the half, pushed to its edge. Null
 * when the input cannot produce a usable frame.
 */
export function snapWindowFrame(preset: string, workArea: Rect, options: WindowSnapOptions): Rect | null {
  const spans = (SPANS as Record<string, [Span, Span] | undefined>)[preset];
  if (!spans || !finite(workArea.x, workArea.y, workArea.width, workArea.height)
    || workArea.width <= 0 || workArea.height <= 0) return null;
  const margin = Number.isFinite(options.margin) ? Math.max(options.margin, 0) : 0;
  const area = workArea.width > margin * 2 && workArea.height > margin * 2
    ? { x: workArea.x + margin, y: workArea.y + margin, width: workArea.width - margin * 2, height: workArea.height - margin * 2 }
    : { ...workArea };
  const [hSpan, vSpan] = spans;
  const [rx, rw] = regionSpan(hSpan, area.x, area.width, margin);
  const [ry, rh] = regionSpan(vSpan, area.y, area.height, margin);
  const chromeWidth = Number.isFinite(options.chrome.width) ? Math.max(options.chrome.width, 0) : 0;
  const chromeHeight = Number.isFinite(options.chrome.height) ? Math.max(options.chrome.height, 0) : 0;
  const minWidth = Number.isFinite(options.minimumFrame.width) ? Math.max(options.minimumFrame.width, 1) : 1;
  const minHeight = Number.isFinite(options.minimumFrame.height) ? Math.max(options.minimumFrame.height, 1) : 1;
  const maxWidth = options.maximumFrame && Number.isFinite(options.maximumFrame.width) && options.maximumFrame.width > 0
    ? options.maximumFrame.width : Number.POSITIVE_INFINITY;
  const maxHeight = options.maximumFrame && Number.isFinite(options.maximumFrame.height) && options.maximumFrame.height > 0
    ? options.maximumFrame.height : Number.POSITIVE_INFINITY;
  const aspect = options.aspect !== null && Number.isFinite(options.aspect) && options.aspect > 0 ? options.aspect : null;

  let width: number;
  let height: number;
  if (preset === 'centre') {
    const current = options.currentFrame;
    if (!finite(current.width, current.height) || current.width <= 0 || current.height <= 0) return null;
    width = Math.max(Math.min(current.width, maxWidth), minWidth);
    height = Math.max(Math.min(current.height, maxHeight), minHeight);
  } else if (aspect !== null) {
    const availableWidth = Math.max(rw - chromeWidth, 1);
    const availableHeight = Math.max(rh - chromeHeight, 1);
    let scale = Math.min(availableWidth / aspect, availableHeight);
    scale = Math.min(scale, (maxWidth - chromeWidth) / aspect, maxHeight - chromeHeight);
    // Grow, keeping the aspect, until the window meets its minimum size.
    scale = Math.max(scale, (minWidth - chromeWidth) / aspect, minHeight - chromeHeight);
    width = aspect * scale + chromeWidth;
    height = scale + chromeHeight;
  } else {
    width = Math.max(Math.min(rw, maxWidth), minWidth);
    height = Math.max(Math.min(rh, maxHeight), minHeight);
  }
  // Never larger than the work area, even if that breaks the aspect on a tiny screen.
  width = Math.min(Math.round(width), Math.floor(area.width));
  height = Math.min(Math.round(height), Math.floor(area.height));
  const x = Math.round(place(hSpan, rx, rw, width));
  const y = Math.round(place(vSpan, ry, rh, height));
  const areaRight = Math.floor(area.x + area.width);
  const areaBottom = Math.floor(area.y + area.height);
  const left = Math.ceil(area.x);
  const top = Math.ceil(area.y);
  return {
    x: Math.max(Math.min(x, areaRight - width), left),
    y: Math.max(Math.min(y, areaBottom - height), top),
    width,
    height,
  };
}
