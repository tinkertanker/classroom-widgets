// Sandboxed preload: only `electron` renderer modules are available here.
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// The only channels display-preview.js uses. Anything else is dropped, so a
// page in this window cannot reach Settings or other main-process IPC.
const SEND_CHANNELS = new Set(['display-preview:action', 'display-preview:click', 'display-preview:stream-live', 'display-preview:stream-error']);
const RECEIVE_CHANNELS = new Set(['display-preview:state', 'display-preview:start-stream', 'display-preview:stop-stream']);

contextBridge.exposeInMainWorld('displayPreview', {
  send: (channel: string, payload?: unknown) => {
    if (SEND_CHANNELS.has(channel)) ipcRenderer.send(channel, payload);
  },
  on: (channel: string, callback: (payload: unknown) => void) => {
    if (!RECEIVE_CHANNELS.has(channel)) return;
    ipcRenderer.on(channel, (_event: IpcRendererEvent, payload: unknown) => callback(payload));
  },
});
