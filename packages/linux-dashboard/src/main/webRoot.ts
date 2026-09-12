import { app } from 'electron';
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

let resolved: string | null = null;

/**
 * Locates the production teacher build that the web surfaces load.
 * Resolution order mirrors the other shells: explicit override, bundled copy
 * in resources, then a repository checkout above the app.
 */
export function resolveWebRoot(): string {
  if (resolved) return resolved;
  resolved = resolveOnce();
  return resolved;
}

function resolveOnce(): string {
  const overridePath = process.env.CLASSROOM_WIDGETS_WEB_ROOT;
  if (overridePath && overridePath.trim() !== '') {
    return resolve(overridePath);
  }

  const bundled = join(process.resourcesPath, 'Web');
  if (existsSync(join(bundled, 'index.html'))) {
    return bundled;
  }

  let current: string | null = app.getAppPath();
  for (let depth = 0; depth < 10 && current; depth++) {
    const candidate = join(current, 'packages', 'teacher', 'build');
    if (existsSync(join(candidate, 'index.html'))) {
      return candidate;
    }
    const parent = dirname(current);
    current = parent === current ? null : parent;
  }

  const fallback = join(process.cwd(), 'packages', 'teacher', 'build');
  return isAbsolute(fallback) ? fallback : resolve(fallback);
}
