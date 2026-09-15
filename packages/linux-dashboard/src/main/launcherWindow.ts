import { BrowserWindow } from 'electron';
import { buildUrl } from './appProtocol';
import { registerNativeMessages } from './nativeMessages';
import { bridgePreloadPath } from './panelWindow';
import { configureWebContents } from './webContentsSetup';

export class LauncherWindow {
  private window: BrowserWindow | null = null;
  private showWhenReady = false;
  private readonly appVersion: string;
  private readonly onAddWidget: (widgetType: number) => void;

  constructor(appVersion: string, onAddWidget: (widgetType: number) => void) {
    this.appVersion = appVersion;
    this.onAddWidget = onAddWidget;
  }

  show(): void {
    if (this.window && !this.window.isDestroyed()) {
      if (this.window.isMinimized()) this.window.restore();
      this.window.show();
      this.window.focus();
      return;
    }

    const win = new BrowserWindow({
      show: false,
      width: 850,
      height: 580,
      minWidth: 700,
      minHeight: 540,
      title: 'Add Widget — Classroom Widgets',
      autoHideMenuBar: true,
      backgroundColor: '#F5F3F1',
      webPreferences: {
        preload: bridgePreloadPath(),
        contextIsolation: true,
        sandbox: false,
        nodeIntegration: false,
        additionalArguments: [`--classroom-app-version=${this.appVersion}`],
      },
    });
    this.window = win;
    this.showWhenReady = true;
    configureWebContents(win.webContents);
    registerNativeMessages(win.webContents, (message) => this.handleMessage(message));
    win.once('ready-to-show', () => {
      if (!this.showWhenReady || win.isDestroyed()) return;
      win.show();
      win.focus();
    });
    win.once('closed', () => {
      this.showWhenReady = false;
      if (this.window === win) this.window = null;
    });
    void win.loadURL(buildUrl({ surface: 'widget-launcher' }));
  }

  close(): void {
    this.showWhenReady = false;
    this.window?.close();
  }

  private handleMessage(message: Record<string, unknown>): void {
    if (message.handler !== 'classroomDashboard' || message.schemaVersion !== 1) return;
    if (message.type === 'desktop-launcher-close') {
      this.close();
      return;
    }
    if (message.type === 'desktop-launcher-add-widget'
      && typeof message.widgetType === 'number' && Number.isInteger(message.widgetType)) {
      this.onAddWidget(message.widgetType);
    }
  }
}
