export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

function positiveFiniteSize(size: Size): boolean {
  return Number.isFinite(size.width) && Number.isFinite(size.height) && size.width > 0 && size.height > 0;
}

function finiteRect(rect: Rect): boolean {
  return [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite);
}

export function aspectFit(contentSize: Size, bounds: Rect): Rect | null {
  if (!positiveFiniteSize(contentSize) || !finiteRect(bounds) || bounds.width <= 0 || bounds.height <= 0) return null;
  const scale = Math.min(bounds.width / contentSize.width, bounds.height / contentSize.height);
  const width = contentSize.width * scale;
  const height = contentSize.height * scale;
  return {
    x: bounds.x + (bounds.width - width) / 2,
    y: bounds.y + (bounds.height - height) / 2,
    width,
    height,
  };
}

export function mapPreviewPointToSource(point: Point, imageRect: Rect, sourceBounds: Rect): Point | null {
  if (![point.x, point.y].every(Number.isFinite)
    || !finiteRect(imageRect) || imageRect.width <= 0 || imageRect.height <= 0
    || !finiteRect(sourceBounds) || sourceBounds.width <= 0 || sourceBounds.height <= 0) return null;
  const u = (point.x - imageRect.x) / imageRect.width;
  const v = (point.y - imageRect.y) / imageRect.height;
  if (!(u >= 0 && u < 1 && v >= 0 && v < 1)) return null;
  const x = Math.min(sourceBounds.x + u * sourceBounds.width, sourceBounds.x + sourceBounds.width - 1);
  const y = Math.min(sourceBounds.y + v * sourceBounds.height, sourceBounds.y + sourceBounds.height - 1);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

export function aspectNormalizedWindowSize(
  aspect: number,
  proposedPreviewSize: Size,
  chromeHeight: number,
  minimumPreviewSize: Size,
  maximumSize: Size,
): Size {
  const chrome = Number.isFinite(chromeHeight) ? Math.max(chromeHeight, 0) : 0;
  const fallback = { width: proposedPreviewSize.width, height: proposedPreviewSize.height + chrome };
  if (!Number.isFinite(aspect) || aspect <= 0 || !positiveFiniteSize(proposedPreviewSize)) return fallback;

  const minimum = {
    width: Math.max(Number.isFinite(minimumPreviewSize.width) ? minimumPreviewSize.width : 1, 1),
    height: Math.max(Number.isFinite(minimumPreviewSize.height) ? minimumPreviewSize.height : 1, 1),
  };
  const scale = Math.min(proposedPreviewSize.width / aspect, proposedPreviewSize.height);
  let width = aspect * scale;
  let height = scale;
  if (width < minimum.width || height < minimum.height) {
    const minimumScale = Math.max(minimum.width / aspect, minimum.height);
    width = aspect * minimumScale;
    height = minimumScale;
  }
  if (positiveFiniteSize(maximumSize)) {
    const maximumPreviewHeight = Math.max(maximumSize.height - chrome, 1);
    const screenScale = Math.min(1, maximumSize.width / width, maximumPreviewHeight / height);
    if (screenScale < 1) {
      const scaledWidth = width * screenScale;
      const scaledHeight = height * screenScale;
      if (scaledWidth >= minimum.width && scaledHeight >= minimum.height) {
        width = scaledWidth;
        height = scaledHeight;
      } else {
        width = Math.max(minimum.width, Math.min(width, maximumSize.width));
        height = Math.max(minimum.height, Math.min(height, maximumPreviewHeight));
      }
    }
  }
  return { width, height: height + chrome };
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return finiteRect(a) && finiteRect(b)
    && Math.min(a.x + a.width, b.x + b.width) > Math.max(a.x, b.x)
    && Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y);
}

export function clampRect(rect: Rect, bounds: Rect): Rect {
  if (!finiteRect(rect) || !finiteRect(bounds)) return rect;
  const width = Math.min(Math.max(rect.width, 0), Math.max(bounds.width, 0));
  const height = Math.min(Math.max(rect.height, 0), Math.max(bounds.height, 0));
  return {
    x: Math.min(Math.max(rect.x, bounds.x), bounds.x + bounds.width - width),
    y: Math.min(Math.max(rect.y, bounds.y), bounds.y + bounds.height - height),
    width,
    height,
  };
}

export function intersectionArea(a: Rect, b: Rect): number {
  if (!rectsIntersect(a, b)) return 0;
  return (Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
    * (Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
}

export function describePosition(bounds: Rect): string {
  if (bounds.x < 0) return 'left';
  if (bounds.y < 0) return 'above';
  if (bounds.x > 0) return 'right';
  if (bounds.y > 0) return 'below';
  return 'main';
}
