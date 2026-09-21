import { BrowserWindow, ipcMain, Menu, MenuItemConstructorOptions, app } from 'electron';
import { EventEmitter } from 'node:events';
import { join } from 'node:path';
import { Rect, Size } from './displayGeometry';
import { log } from './log';
import { allowMediaCapture } from './webContentsSetup';

export interface DisplayPreviewState {
  statusMessage: string;
  powerState: 'on' | 'off';
  powerEnabled: boolean;
  idleStartEnabled: boolean;
  sourceId: number | null;
}

const CHROME_HEIGHT = 42;
const windows = new Map<number, DisplayPreviewWindow>();
let ipcRegistered = false;

function registerIpcHandlers(): void {
  if (ipcRegistered || !ipcMain) return;
  ipcRegistered = true;
  ipcMain.on('display-preview:action', (event, message: unknown) => {
    windows.get(event.sender.id)?.handleAction(message);
  });
  ipcMain.on('display-preview:click', (event, message: unknown) => {
    windows.get(event.sender.id)?.handleClick(message);
  });
  ipcMain.on('display-preview:stream-live', (event, message: unknown) => {
    windows.get(event.sender.id)?.handleStreamLive(message);
  });
  ipcMain.on('display-preview:stream-error', (event, message: unknown) => {
    windows.get(event.sender.id)?.handleStreamError(message);
  });
}

registerIpcHandlers();

export class DisplayPreviewWindow extends EventEmitter {
  private readonly win: BrowserWindow;
  private ready = false;
  private pendingState: DisplayPreviewState | null = null;
  private pendingStart: { streamId: number; sourceId: string; width: number; height: number } | null = null;
  private pendingStop = false;
  private nextStreamId = 0;
  private streamId: number | null = null;

  constructor(bounds: Rect) {
    super();
    this.win = new BrowserWindow({
      ...bounds,
      title: 'Display',
      show: false,
      frame: true,
      resizable: true,
      alwaysOnTop: true,
      autoHideMenuBar: true,
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
    const contentsId = this.win.webContents.id;
    windows.set(contentsId, this);
    allowMediaCapture(this.win.webContents);
    this.win.webContents.once('destroyed', () => windows.delete(contentsId));
    this.win.on('move', () => this.emit('moved'));
    this.win.on('resize', () => this.emit('resized'));
    this.win.once('closed', () => {
      windows.delete(contentsId);
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

  handleAction(message: unknown): void {
    if (!message || typeof message !== 'object') return;
    const action = (message as { action?: unknown }).action;
    if (action === 'toggle-power') this.emit('powerToggle');
    if (action === 'open-menu') this.emit('menuRequested');
  }

  handleClick(message: unknown): void {
    if (!message || typeof message !== 'object') return;
    const value = message as { x?: unknown; y?: unknown; imageRect?: unknown; streamId?: unknown };
    if (value.streamId !== this.streamId) return;
    if (typeof value.x !== 'number' || typeof value.y !== 'number' || !value.imageRect) return;
    this.emit('previewClick', { x: value.x, y: value.y, imageRect: value.imageRect });
  }

  private matchesStream(message: unknown): boolean {
    return this.streamId !== null && !!message && typeof message === 'object'
      && (message as { streamId?: unknown }).streamId === this.streamId;
  }

  handleStreamLive(message: unknown): void {
    if (!this.matchesStream(message)) return;
    this.emit('streamLive');
  }

  handleStreamError(message: unknown): void {
    if (!this.matchesStream(message)) return;
    const text = message && typeof message === 'object' && typeof (message as { message?: unknown }).message === 'string'
      ? (message as { message: string }).message
      : String(message ?? 'Unknown error');
    this.emit('streamError', text);
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
    this.streamId = ++this.nextStreamId;
    const start = { streamId: this.streamId, sourceId, width: size.width, height: size.height };
    if (!this.ready) {
      this.pendingStart = start;
      this.pendingStop = false;
      return;
    }
    this.win.webContents.send('display-preview:start-stream', start);
  }

  stopStream(): void {
    this.streamId = null;
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
