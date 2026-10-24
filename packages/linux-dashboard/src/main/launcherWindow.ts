import { BrowserWindow, nativeTheme } from 'electron';
import { buildUrl } from './appProtocol';
import { registerNativeMessages } from './nativeMessages';
import { preloadPath } from './paths';
import { configureWebContents } from './webContentsSetup';

export class LauncherWindow {
  private window: BrowserWindow | null = null;
  private showWhenReady = false;
  /** The current window has been asked to show at least once. */
  private presented = false;
  /** The current window has painted its first frame ('ready-to-show'). */
  private painted = false;
  private readonly appVersion: string;
  private readonly onAddWidget: (widgetType: number) => void;
  private readonly onOpenDisplayPreview: () => void;

  constructor(appVersion: string, onAddWidget: (widgetType: number) => void, onOpenDisplayPreview: () => void) {
    this.appVersion = appVersion;
    this.onAddWidget = onAddWidget;
    this.onOpenDisplayPreview = onOpenDisplayPreview;
  }

  /**
   * Starts loading the launcher hidden, so the first show() can present an
   * already painted page instead of waiting for a cold load.
   */
  prepare(): void {
    if (this.window && !this.window.isDestroyed()) return;
    this.create();
  }

  show(): void {
    const existing = this.window && !this.window.isDestroyed() ? this.window : null;
    if (existing && (this.presented || this.painted)) {
      this.presented = true;
      if (existing.isMinimized()) existing.restore();
      existing.show();
      existing.focus();
      return;
    }
    if (!existing) this.create();
    this.presented = true;
    this.showWhenReady = true;
  }

  private create(): void {
    const win = new BrowserWindow({
      show: false,
      width: 850,
      height: 580,
      minWidth: 700,
      minHeight: 540,
      title: 'Add Widget — Classroom Widgets',
      autoHideMenuBar: true,
      backgroundColor: nativeTheme.shouldUseDarkColors ? '#2D2926' : '#F5F3F1',
      webPreferences: {
        preload: preloadPath('bridge'),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        additionalArguments: [`--classroom-app-version=${this.appVersion}`],
      },
    });
    this.window = win;
    this.presented = false;
    this.painted = false;
    configureWebContents(win.webContents);
    registerNativeMessages(win.webContents, (message) => this.handleMessage(message));
    win.once('ready-to-show', () => {
      if (this.window === win) this.painted = true;
      if (!this.showWhenReady || win.isDestroyed()) return;
      win.show();
      win.focus();
    });
    win.once('closed', () => {
      if (this.window !== win) return;
      this.showWhenReady = false;
      this.window = null;
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
      return;
    }
    if (message.type === 'desktop-launcher-open-display-preview') {
      this.onOpenDisplayPreview();
    }
  }
}
