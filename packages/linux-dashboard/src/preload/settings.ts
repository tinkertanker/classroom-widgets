import { contextBridge, ipcRenderer } from 'electron';

const versionArg = process.argv.find((arg) => arg.startsWith('--classroom-app-version='));
const appVersion = versionArg ? versionArg.slice('--classroom-app-version='.length) : '';

contextBridge.exposeInMainWorld('classroomSettings', {
  get: () => ipcRenderer.invoke('settings:get'),
  set: (update: Record<string, unknown>) => ipcRenderer.send('settings:set', update),
  resetPositions: () => ipcRenderer.send('settings:reset-positions'),
  setShortcut: (widgetType: number, accelerator: string | null) => ipcRenderer.invoke('settings:set-shortcut', widgetType, accelerator),
  resetShortcuts: () => ipcRenderer.send('settings:reset-shortcuts'),
  onShortcutsChanged: (callback: (shortcuts: unknown) => void) => ipcRenderer.on('settings:shortcuts-changed', (_event, shortcuts) => callback(shortcuts)),
});
contextBridge.exposeInMainWorld('__CLASSROOM_SETTINGS_VERSION__', appVersion);
