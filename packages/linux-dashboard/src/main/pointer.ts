import { execFile } from 'node:child_process';

export function movePointer(x: number, y: number): Promise<boolean> {
  if (!Number.isFinite(x) || !Number.isFinite(y) || process.platform !== 'linux') return Promise.resolve(false);
  return new Promise((resolve) => {
    execFile('xdotool', ['mousemove', '--sync', String(Math.round(x)), String(Math.round(y))], (error) => resolve(!error));
  });
}
