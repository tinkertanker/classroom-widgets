import { BrowserWindow, ipcMain, Menu, MenuItemConstructorOptions, app } from 'electron';
import { EventEmitter } from 'node:events';
import { join } from 'node:path';
import { Rect, Size } from './displayGeometry';
import { log } from './log';

export interface DisplayPreviewState {
  statusMessage: string;
  powerState: 'on' | 'off';
  powerEnabled: boolean;
  idleStartEnabled: boolean;
  sourceId: number | null;
}

const CHROME_HEIGHT = 42;
const windows = new Map<number, DisplayPreviewWindow>();

export class DisplayPreviewWindow extends EventEmitter {
  private readonly win: BrowserWindow;
  private ready = false;
  private pendingState: DisplayPreviewState | null = null;
  private pendingStart: { sourceId: string; width: number; height: number } | null = null;
  private pendingStop = false;

  constructor(bounds: Rect) {
    super();
    this.win = new BrowserWindow({
      ...bounds,
      title: 'Display',
      show: false,
      frame: true,
      resizable: true,
      alwaysOnTop: true,
      minimizable: true,
      minWidth: 320,
      minHeight: 240 + CHROME_HEIGHT,
      webPreferences: {
        preload: join(app.getAppPath(), 'out', 'preload', 'displayPreview.js'),
        contextIsolation: true,
        sandbox: false,
        nodeIntegration: false,
      },
    });
    windows.set(this.win.webContents.id, this);
    this.win.webContents.once('destroyed', () => windows.delete(this.win.webContents.id));
    ipcMain.on('display-preview:action', (event, message: unknown) => {
      if (windows.get(event.sender.id) !== this || !message || typeof message !== 'object') return;
      const action = (message as { action?: unknown }).action;
      if (action === 'toggle-power') this.emit('powerToggle');
      if (action === 'open-menu') this.emit('menuRequested');
    });
    ipcMain.on('display-preview:click', (event, message: unknown) => {
      if (windows.get(event.sender.id) !== this || !message || typeof message !== 'object') return;
      const value = message as { x?: unknown; y?: unknown; imageRect?: unknown };
      if (typeof value.x !== 'number' || typeof value.y !== 'number' || !value.imageRect) return;
      this.emit('previewClick', { x: value.x, y: value.y, imageRect: value.imageRect });
    });
    ipcMain.on('display-preview:stream-live', (event) => {
      if (windows.get(event.sender.id) === this) this.emit('streamLive');
    });
    ipcMain.on('display-preview:stream-error', (event, message: unknown) => {
      if (windows.get(event.sender.id) !== this) return;
      const text = message && typeof message === 'object' && typeof (message as { message?: unknown }).message === 'string'
        ? (message as { message: string }).message
        : String(message ?? 'Unknown error');
      this.emit('streamError', text);
    });
    this.win.on('move', () => this.emit('moved'));
    this.win.on('resize', () => this.emit('resized'));
    this.win.once('closed', () => {
      windows.delete(this.win.webContents.id);
      this.emit('closed');
    });
    this.win.webContents.once('did-finish-load', () => {
      this.ready = true;
      if (this.pendingState) this.win.webContents.send('display-preview:state', this.pendingState);
      if (this.pendingStart) this.win.webContents.send('display-preview:start-stream', this.pendingStart);
      if (this.pendingStop) this.win.webContents.send('display-preview:stop-stream');
      this.pendingState = null;
      this.pendingStart = null;
      this.pendingStop = false;
    });
    void this.win.loadFile(join(app.getAppPath(), 'src', 'renderer', 'display-preview.html'));
  }

  getBounds(): Rect {
    return this.win.getBounds();
  }

  setBounds(bounds: Rect): void {
    if (!this.win.isDestroyed()) this.win.setBounds(bounds);
  }

  setSize(size: Size): void {
    if (!this.win.isDestroyed()) this.win.setSize(Math.round(size.width), Math.round(size.height));
  }

  getContentSize(): Size {
    const [width, height] = this.win.getContentSize();
    return { width, height };
  }

  show(): void {
    if (!this.win.isDestroyed()) this.win.show();
  }

  focus(): void {
    if (!this.win.isDestroyed()) this.win.focus();
  }

  close(): void {
    if (!this.win.isDestroyed()) this.win.close();
  }

  isVisible(): boolean {
    return !this.win.isDestroyed() && this.win.isVisible();
  }

  setState(state: DisplayPreviewState): void {
    if (this.win.isDestroyed() || this.win.webContents.isDestroyed()) return;
    if (!this.ready) {
      this.pendingState = state;
      return;
    }
    this.win.webContents.send('display-preview:state', state);
  }

  startStream(sourceId: string, size: Size): void {
    if (this.win.isDestroyed()) return;
    const start = { sourceId, width: size.width, height: size.height };
    if (!this.ready) {
      this.pendingStart = start;
      this.pendingStop = false;
      return;
    }
    this.win.webContents.send('display-preview:start-stream', start);
  }

  stopStream(): void {
    if (this.win.isDestroyed()) return;
    if (!this.ready) {
      this.pendingStart = null;
      this.pendingStop = true;
      return;
    }
    this.win.webContents.send('display-preview:stop-stream');
  }

  popupMenu(template: MenuItemConstructorOptions[]): void {
    if (this.win.isDestroyed()) return;
    try {
      Menu.buildFromTemplate(template).popup({ window: this.win });
    } catch (error) {
      log.warn(`Unable to open display preview menu: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export { CHROME_HEIGHT as DISPLAY_PREVIEW_CHROME_HEIGHT };
