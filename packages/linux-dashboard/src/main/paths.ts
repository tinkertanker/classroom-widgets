import { app } from 'electron';
import { join } from 'node:path';

export function preloadPath(name: 'bridge' | 'chrome' | 'settings' | 'displayPreview'): string {
  return join(app.getAppPath(), 'out', 'preload', `${name}.js`);
}

export function rendererPath(file: string): string {
  return join(app.getAppPath(), 'src', 'renderer', file);
}
