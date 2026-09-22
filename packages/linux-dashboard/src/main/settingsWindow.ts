import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import { DashboardSettings } from './settings';
import { rendererDir } from './panelWindow';
import { readShortenerSettings } from './shortenerSettings';
import { WidgetShortcutController } from './widgetShortcuts';

let settingsWindow: BrowserWindow | null = null;
let ipcInstalled = false;

function installIpc(settings: DashboardSettings, shortcuts: WidgetShortcutController): void {
  if (ipcInstalled) return;
  ipcInstalled = true;
  ipcMain.handle('settings:get', () => ({
    backgroundOpacity: settings.backgroundOpacity,
    alwaysOnTop: settings.alwaysOnTop,
    launchAtLogin: settings.launchAtLoginEnabled,
    linkShortener: settings.linkShortener,
    shortcuts: shortcuts.getStatuses(),
    displayShortcut: shortcuts.getDisplayStatus(),
    moveWidgetShortcut: shortcuts.getMoveWidgetStatus(),
    wayland: process.platform === 'linux' && Boolean(process.env.WAYLAND_DISPLAY),
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
  ipcMain.handle('settings:set-shortcut', (_event, widgetType: unknown, action: unknown, accelerator: unknown) => {
    if (typeof widgetType !== 'number' || (action !== 'show' && action !== 'dismiss') || (typeof accelerator !== 'string' && accelerator !== null)) {
      return { ok: false, error: 'Invalid shortcut.' };
    }
    return shortcuts.setShortcut(widgetType, accelerator, action);
  });
  ipcMain.handle('settings:set-display-shortcut', (_event, action: unknown, accelerator: unknown) => {
    if ((action !== 'show' && action !== 'dismiss') || (typeof accelerator !== 'string' && accelerator !== null)) {
      return { ok: false, error: 'Invalid shortcut.' };
    }
    return shortcuts.setDisplayShortcut(accelerator, action);
  });
  ipcMain.handle('settings:set-move-widget-shortcut', (_event, accelerator: unknown) => {
    if (typeof accelerator !== 'string' && accelerator !== null) {
      return { ok: false, error: 'Invalid shortcut.' };
    }
    return shortcuts.setMoveWidgetShortcut(accelerator);
  });
  ipcMain.on('settings:reset-shortcuts', () => shortcuts.reset());
  ipcMain.on('settings:capturing', (_event, active: unknown) => shortcuts.setCapturing(active === true));
  shortcuts.on('changed', () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send('settings:shortcuts-changed', shortcuts.getStatuses(), shortcuts.getDisplayStatus(), shortcuts.getMoveWidgetStatus());
    }
  });
}

export function openSettingsWindow(settings: DashboardSettings, shortcuts: WidgetShortcutController, appVersion: string): void {
  installIpc(settings, shortcuts);
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }
  const win = new BrowserWindow({
    width: 650,
    height: 700,
    minWidth: 600,
    minHeight: 480,
    resizable: true,
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
    shortcuts.setCapturing(false);
    settingsWindow = null;
  });
  void win.loadFile(join(rendererDir(), 'settings.html'));
}
