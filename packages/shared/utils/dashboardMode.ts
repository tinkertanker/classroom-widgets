const DASHBOARD_QUERY_KEYS = ['dashboard', 'desktop'];

export function isDesktopDashboardMode(search?: string) {
  const query = search ?? (typeof window === 'undefined' ? '' : window.location.search);
  const params = new URLSearchParams(query);
  return DASHBOARD_QUERY_KEYS.some((key) => {
    const value = params.get(key);
    return value === '1' || value === 'true';
  });
}
