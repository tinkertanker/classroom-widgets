export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  digest: string;
}

export interface UpdateRelease {
  version: string;
  pageUrl: string;
  assets: ReleaseAsset[];
}

export function parseUpdateRelease(value: unknown): UpdateRelease | null {
  if (!value || typeof value !== 'object') return null;
  const release = value as Record<string, unknown>;
  if (typeof release.tag_name !== 'string' || typeof release.html_url !== 'string' || !Array.isArray(release.assets)) return null;
  const version = release.tag_name.replace(/^v/, '');
  if (!parseVersion(version)) return null;
  const assets = release.assets.flatMap((asset): ReleaseAsset[] => {
    if (!asset || typeof asset !== 'object') return [];
    const candidate = asset as Record<string, unknown>;
    return typeof candidate.name === 'string' && typeof candidate.browser_download_url === 'string' && typeof candidate.digest === 'string' && /^sha256:[0-9a-f]{64}$/.test(candidate.digest)
      ? [{ name: candidate.name, browser_download_url: candidate.browser_download_url, digest: candidate.digest }]
      : [];
  });
  return { version, pageUrl: release.html_url, assets };
}

export function isNewerVersion(candidate: string, current: string): boolean {
  const next = parseVersion(candidate);
  const installed = parseVersion(current);
  if (!next || !installed) return false;
  for (let index = 0; index < Math.max(next.length, installed.length); index += 1) {
    const difference = (next[index] ?? 0) - (installed[index] ?? 0);
    if (difference !== 0) return difference > 0;
  }
  return false;
}

function parseVersion(version: string): number[] | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  return match ? match.slice(1).map(Number) : null;
}
