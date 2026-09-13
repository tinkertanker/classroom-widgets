import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import { DashboardSettings } from './settings';
import { rendererDir } from './panelWindow';
import { readShortenerSettings } from './shortenerSettings';

let settingsWindow: BrowserWindow | null = null;
let ipcInstalled = false;

function installIpc(settings: DashboardSettings): void {
  if (ipcInstalled) return;
  ipcInstalled = true;
  ipcMain.handle('settings:get', () => ({
    backgroundOpacity: settings.backgroundOpacity,
    alwaysOnTop: settings.alwaysOnTop,
    launchAtLogin: settings.launchAtLoginEnabled,
    linkShortener: settings.linkShortener,
  }));
  ipcMain.on('settings:set', (_event, update: unknown) => {
    if (typeof update !== 'object' || update === null) return;
    const partial = update as Record<string, unknown>;
    if (typeof partial.backgroundOpacity === 'number' && Number.isFinite(partial.backgroundOpacity)) {
      settings.backgroundOpacity = Math.min(1, Math.max(0, Math.round(partial.backgroundOpacity * 100) / 100));
    }
    if (typeof partial.alwaysOnTop === 'boolean') {
      settings.alwaysOnTop = partial.alwaysOnTop;
    }
    if (typeof partial.launchAtLogin === 'boolean') {
      settings.launchAtLoginEnabled = partial.launchAtLogin;
    }
    if (partial.linkShortener && typeof partial.linkShortener === 'object') {
      settings.linkShortener = readShortenerSettings(partial.linkShortener);
    }
    settings.notifyChanged();
  });
  ipcMain.on('settings:reset-positions', () => {
    settings.panelFrames = {};
    settings.notifyChanged();
  });
}

export function openSettingsWindow(settings: DashboardSettings, appVersion: string): void {
  installIpc(settings);
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }
  const win = new BrowserWindow({
    width: 440,
    height: 650,
    resizable: false,
    title: 'Classroom Widgets Settings',
    autoHideMenuBar: true,
    alwaysOnTop: true,
    backgroundColor: '#F5F5F7',
    webPreferences: {
      preload: join(app.getAppPath(), 'out', 'preload', 'settings.js'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
      additionalArguments: [`--classroom-app-version=${appVersion}`],
    },
  });
  settingsWindow = win;
  win.once('closed', () => {
    settingsWindow = null;
  });
  void win.loadFile(join(rendererDir(), 'settings.html'));
}
