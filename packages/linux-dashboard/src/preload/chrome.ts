import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

contextBridge.exposeInMainWorld('classroomPanelChrome', {
  send: (action: string, payload?: unknown) => ipcRenderer.send('panel-chrome-action', { action, payload }),
  onUpdate: (callback: (update: unknown) => void) => {
    ipcRenderer.on('panel-chrome-update', (_event: IpcRendererEvent, update: unknown) => callback(update));
  },
});
