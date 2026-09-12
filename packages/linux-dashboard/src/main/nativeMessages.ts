import { ipcMain, WebContents } from 'electron';
import { isAllowed } from './appProtocol';
import { log } from './log';

export type NativeMessageHandler = (message: Record<string, unknown>) => void;

const handlers = new Map<number, { contents: WebContents; handler: NativeMessageHandler }>();
let installed = false;

/**
 * Single `native-message` IPC channel shared by the hidden host and every
 * widget panel. `src/preload/bridge.ts` posts `{ handler, ... }` objects here;
 * dispatch is by the sending webContents.
 */
export function registerNativeMessages(contents: WebContents, handler: NativeMessageHandler): void {
  installListener();
  handlers.set(contents.id, { contents, handler });
  contents.once('destroyed', () => handlers.delete(contents.id));
}

export function unregisterNativeMessages(contents: WebContents): void {
  handlers.delete(contents.id);
}

function installListener(): void {
  if (installed) return;
  installed = true;
  ipcMain.on('native-message', (event, message: unknown) => {
    const entry = handlers.get(event.sender.id);
    if (!entry) return;
    const frameUrl = event.senderFrame?.url ?? '';
    if (!isAllowed(frameUrl)) {
      log.warn(`Dropping native message from disallowed origin: ${frameUrl}`);
      return;
    }
    if (typeof message !== 'object' || message === null || Array.isArray(message)) return;
    entry.handler(message as Record<string, unknown>);
  });
}
