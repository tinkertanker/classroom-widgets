const DASHBOARD_QUERY_KEYS = ['dashboard', 'desktop'];

export function isDesktopDashboardMode(search?: string) {
  const query = search ?? (typeof window === 'undefined' ? '' : window.location.search);
  const params = new URLSearchParams(query);
  return DASHBOARD_QUERY_KEYS.some((key) => {
    const value = params.get(key);
    return value === '1' || value === 'true';
  });
}

const clampOpacity = (opacity: number): number => Math.min(1, Math.max(0, opacity));

export function parseBackgroundOpacityFromSearch(search: string): number {
  const params = new URLSearchParams(search);
  const rawOpacity = params.get('backgroundOpacity');
  if (rawOpacity !== null) {
    const opacity = Number(rawOpacity);
    if (Number.isFinite(opacity)) return clampOpacity(opacity);
  }

  // Compatibility with prototypes installed before the continuous slider.
  const appearance = params.get('appearance');
  if (appearance === 'translucent') return 0.58;
  if (appearance === 'transparent') return 0;
  return 1;
}
