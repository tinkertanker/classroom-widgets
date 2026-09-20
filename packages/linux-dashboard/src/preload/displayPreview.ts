import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

contextBridge.exposeInMainWorld('displayPreview', {
  send: (channel: string, payload?: unknown) => ipcRenderer.send(channel, payload),
  on: (channel: string, callback: (payload: unknown) => void) => {
    ipcRenderer.on(channel, (_event: IpcRendererEvent, payload: unknown) => callback(payload));
  },
});
