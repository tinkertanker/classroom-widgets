import { contextBridge, ipcRenderer } from 'electron';

const versionArg = process.argv.find((arg) => arg.startsWith('--classroom-app-version='));
const appVersion = versionArg ? versionArg.slice('--classroom-app-version='.length) : '';

contextBridge.exposeInMainWorld('classroomSettings', {
  get: () => ipcRenderer.invoke('settings:get'),
  set: (update: Record<string, unknown>) => ipcRenderer.send('settings:set', update),
  resetPositions: () => ipcRenderer.send('settings:reset-positions'),
  setShortcut: (widgetType: number, action: 'show' | 'dismiss', accelerator: string | null) => ipcRenderer.invoke('settings:set-shortcut', widgetType, action, accelerator),
  setDisplayShortcut: (action: 'show' | 'dismiss', accelerator: string | null) => ipcRenderer.invoke('settings:set-display-shortcut', action, accelerator),
  setMoveWidgetShortcut: (accelerator: string | null) => ipcRenderer.invoke('settings:set-move-widget-shortcut', accelerator),
  resetShortcuts: () => ipcRenderer.send('settings:reset-shortcuts'),
  setCapturing: (active: boolean) => ipcRenderer.send('settings:capturing', active),
  onShortcutsChanged: (callback: (shortcuts: unknown, displayShortcut: unknown, moveWidgetShortcut: unknown) => void) => ipcRenderer.on('settings:shortcuts-changed', (_event, shortcuts, displayShortcut, moveWidgetShortcut) => callback(shortcuts, displayShortcut, moveWidgetShortcut)),
});
contextBridge.exposeInMainWorld('__CLASSROOM_SETTINGS_VERSION__', appVersion);
