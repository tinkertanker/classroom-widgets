import { app } from 'electron';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

function logPath(): string {
  return join(app.getPath('userData'), 'classroom-widgets.log');
}

function write(level: string, message: string): void {
  const line = `${new Date().toISOString()} ${level} ${message}`;
  process.stderr.write(line + '\n');
  try {
    mkdirSync(app.getPath('userData'), { recursive: true });
    appendFileSync(logPath(), line + '\n');
  } catch {
    // Logging must never take the app down.
  }
}

export const log = {
  info: (message: string) => write('INFO', message),
  warn: (message: string) => write('WARN', message),
  error: (message: string) => write('ERROR', message),
  path: logPath,
};
