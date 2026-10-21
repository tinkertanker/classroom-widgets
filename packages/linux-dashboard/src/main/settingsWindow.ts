import { BrowserWindow, ipcMain, IpcMainEvent, IpcMainInvokeEvent } from 'electron';
import { log } from './log';
import { DashboardSettings, outputVolumePresets } from './settings';
import { isLocalRendererFrame, preloadPath, rendererPath } from './paths';
import { readShortenerSettings } from './shortenerSettings';
import { configureWebContents } from './webContentsSetup';
import { WidgetShortcutController } from './widgetShortcuts';

let settingsWindow: BrowserWindow | null = null;
let ipcInstalled = false;

/** Typing in the Short.io fields is saved and broadcast once it pauses this long. */
export const SHORTENER_SAVE_DELAY_MS = 300;

/**
 * Settings IPC is accepted only from the main frame of the current Settings
 * window while it shows the bundled settings.html: not from Display Preview or
 * another window, a child frame, or a page Settings was navigated to.
 */
function fromSettingsDocument(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
  const contents = settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow.webContents : null;
  const frame = event.senderFrame;
  const trusted = !!contents && event.sender === contents && !!frame && frame === contents.mainFrame
    && isLocalRendererFrame(frame.url, 'settings.html');
  if (!trusted) log.warn(`Ignoring settings IPC from an untrusted sender: ${frame?.url ?? 'unknown frame'}`);
  return trusted;
}

function trustedOn(channel: string, listener: (event: IpcMainEvent, ...args: unknown[]) => void): void {
  ipcMain.on(channel, (event, ...args: unknown[]) => {
    if (fromSettingsDocument(event)) listener(event, ...args);
  });
}

function trustedHandle(channel: string, handler: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown): void {
  ipcMain.handle(channel, (event, ...args: unknown[]) => {
    if (!fromSettingsDocument(event)) throw new Error('Untrusted settings sender.');
    return handler(event, ...args);
  });
}

function installIpc(settings: DashboardSettings, shortcuts: WidgetShortcutController): void {
  if (ipcInstalled) return;
  ipcInstalled = true;
  trustedHandle('settings:get', () => ({
    backgroundOpacity: settings.backgroundOpacity,
    outputVolume: settings.outputVolume,
    outputVolumePresets,
    alwaysOnTop: settings.alwaysOnTop,
    displayPreviewShowOnReconnect: settings.displayPreviewShowOnReconnect,
    launchAtLogin: settings.launchAtLoginEnabled,
    linkShortener: settings.linkShortener,
    shortcuts: shortcuts.getStatuses(),
    displayShortcut: shortcuts.getDisplayStatus(),
    moveWidgetShortcuts: moveWidgetStatuses(shortcuts),
    wayland: process.platform === 'linux' && Boolean(process.env.WAYLAND_DISPLAY),
  }));
  trustedOn('settings:set', (_event, update: unknown) => {
    if (typeof update !== 'object' || update === null) return;
    const partial = update as Record<string, unknown>;
    let changedSetting: 'outputVolume' | 'launchAtLogin' | undefined;
    let immediate = false;
    if (typeof partial.backgroundOpacity === 'number' && Number.isFinite(partial.backgroundOpacity)) {
      settings.backgroundOpacity = Math.min(1, Math.max(0, Math.round(partial.backgroundOpacity * 100) / 100));
      immediate = true;
    }
    if (typeof partial.outputVolume === 'number' && Number.isFinite(partial.outputVolume)) {
      settings.outputVolume = Math.min(1, Math.max(0, Math.round(partial.outputVolume * 100) / 100));
      immediate = true;
      changedSetting = 'outputVolume';
    }
    if (typeof partial.alwaysOnTop === 'boolean') {
      settings.alwaysOnTop = partial.alwaysOnTop;
      immediate = true;
    }
    if (typeof partial.displayPreviewShowOnReconnect === 'boolean') {
      settings.displayPreviewShowOnReconnect = partial.displayPreviewShowOnReconnect;
      immediate = true;
    }
    if (typeof partial.launchAtLogin === 'boolean') {
      settings.launchAtLoginEnabled = partial.launchAtLogin;
      immediate = true;
      changedSetting = 'launchAtLogin';
    }
    if (partial.linkShortener && typeof partial.linkShortener === 'object') {
      settings.linkShortener = readShortenerSettings(partial.linkShortener);
    }
    // Short.io fields send every keystroke: keep the value in memory now, but
    // write settings.json and update every panel once typing pauses.
    if (immediate) settings.notifyChanged(changedSetting);
    else settings.notifyChangedSoon(SHORTENER_SAVE_DELAY_MS);
  });
  trustedOn('settings:reset-positions', () => {
    settings.panelFrames = {};
    settings.notifyChanged();
  });
  trustedHandle('settings:set-shortcut', (_event, widgetType: unknown, action: unknown, accelerator: unknown) => {
    if (typeof widgetType !== 'number' || (action !== 'show' && action !== 'dismiss') || (typeof accelerator !== 'string' && accelerator !== null)) {
      return { ok: false, error: 'Invalid shortcut.' };
    }
    return shortcuts.setShortcut(widgetType, accelerator, action);
  });
  trustedHandle('settings:set-display-shortcut', (_event, action: unknown, accelerator: unknown) => {
    if ((action !== 'show' && action !== 'dismiss') || (typeof accelerator !== 'string' && accelerator !== null)) {
      return { ok: false, error: 'Invalid shortcut.' };
    }
    return shortcuts.setDisplayShortcut(accelerator, action);
  });
  trustedHandle('settings:set-move-widget-shortcut', (_event, payload: unknown) => {
    const update = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
    const direction = update.direction;
    const accelerator = update.shortcut;
    if ((direction !== 'previous' && direction !== 'next') || (typeof accelerator !== 'string' && accelerator !== null)) {
      return { ok: false, error: 'Invalid shortcut.' };
    }
    return shortcuts.setMoveWidgetShortcut(direction, accelerator);
  });
  trustedOn('settings:reset-shortcuts', () => shortcuts.reset());
  trustedOn('settings:capturing', (_event, active: unknown) => shortcuts.setCapturing(active === true));
  shortcuts.on('changed', () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send('settings:shortcuts-changed', shortcuts.getStatuses(), shortcuts.getDisplayStatus(), moveWidgetStatuses(shortcuts));
    }
  });
  settings.on('changed', (changedSetting) => {
    if ((changedSetting === 'outputVolume' || changedSetting === 'launchAtLogin') && settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send('settings:changed', {
        outputVolume: settings.outputVolume,
        launchAtLogin: settings.launchAtLoginEnabled,
      });
    }
  });
}

function moveWidgetStatuses(shortcuts: WidgetShortcutController) {
  return {
    previous: shortcuts.getMoveWidgetStatus('previous'),
    next: shortcuts.getMoveWidgetStatus('next'),
  };
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
      preload: preloadPath('settings'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      additionalArguments: [`--classroom-app-version=${appVersion}`],
    },
  });
  settingsWindow = win;
  configureWebContents(win.webContents);
  win.once('closed', () => {
    if (settingsWindow === win) settingsWindow = null;
    shortcuts.setCapturing(false);
    settings.flushPendingChange();
  });
  void win.loadFile(rendererPath('settings.html'));
}
