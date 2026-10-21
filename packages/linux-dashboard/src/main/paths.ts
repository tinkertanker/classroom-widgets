import { app } from 'electron';
import { join, resolve } from 'node:path';
import { fileURLToPath, format, pathToFileURL } from 'node:url';

export function preloadPath(name: 'bridge' | 'chrome' | 'settings' | 'displayPreview'): string {
  return join(app.getAppPath(), 'out', 'preload', `${name}.js`);
}

export function rendererPath(file: string): string {
  return join(app.getAppPath(), 'src', 'renderer', file);
}

/** True when a frame URL is the bundled renderer page `file` (query and hash ignored). */
export function isLocalRendererFrame(frameUrl: string, file: string): boolean {
  let url: URL;
  try {
    url = new URL(frameUrl);
  } catch {
    return false;
  }
  if (url.protocol !== 'file:' || url.host !== '') return false;
  url.search = '';
  url.hash = '';
  const path = resolve(rendererPath(file));
  // loadFile may build its URL with the legacy url.format, which leaves a
  // literal % in the path unescaped, so accept that spelling too.
  const expected = [pathToFileURL(path).href, new URL(format({ protocol: 'file', slashes: true, pathname: path })).href];
  if (expected.includes(url.href)) return true;
  try {
    return resolve(fileURLToPath(url)) === path;
  } catch {
    return false;
  }
}
