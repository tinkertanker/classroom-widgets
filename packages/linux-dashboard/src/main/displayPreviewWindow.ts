import { BrowserWindow, ipcMain, IpcMainEvent, Menu, MenuItemConstructorOptions } from 'electron';
import { EventEmitter } from 'node:events';
import { Rect, Size } from './displayGeometry';
import { log } from './log';
import { isLocalRendererFrame, preloadPath, rendererPath } from './paths';
import { allowMediaCapture, configureWebContents } from './webContentsSetup';

export interface DisplayPreviewState {
  statusMessage: string;
  powerState: 'on' | 'off';
  powerEnabled: boolean;
  sourceId: number | null;
}

const CHROME_HEIGHT = 42;
const PAGE = 'display-preview.html';
const windows = new Map<number, DisplayPreviewWindow>();
let ipcRegistered = false;

/** The preview window that sent `event`, if it came from that window's own page. */
function senderWindow(event: IpcMainEvent): DisplayPreviewWindow | undefined {
  const frame = event.senderFrame;
  if (!frame || frame !== event.sender.mainFrame || !isLocalRendererFrame(frame.url, PAGE)) return undefined;
  return windows.get(event.sender.id);
}

function registerIpcHandlers(): void {
  if (ipcRegistered || !ipcMain) return;
  ipcRegistered = true;
  ipcMain.on('display-preview:action', (event, message: unknown) => {
    senderWindow(event)?.handleAction(message);
  });
  ipcMain.on('display-preview:click', (event, message: unknown) => {
    senderWindow(event)?.handleClick(message);
  });
  ipcMain.on('display-preview:stream-live', (event, message: unknown) => {
    senderWindow(event)?.handleStreamLive(message);
  });
  ipcMain.on('display-preview:stream-error', (event, message: unknown) => {
    senderWindow(event)?.handleStreamError(message);
  });
}

registerIpcHandlers();

export class DisplayPreviewWindow extends EventEmitter {
  private readonly win: BrowserWindow;
  private ready = false;
  private pendingState: DisplayPreviewState | null = null;
  private pendingStart: { streamId: number; sourceId: string; width: number; height: number } | null = null;
  private pendingStop = false;
  private restoring = false;
  /** Bumped by a restore() that starts a restore and by cancelRestore(), so a stale settle never reports. */
  private restoreToken = 0;
  private unmaximiseQueued = false;
  private maximisedUnderFullScreen = false;
  private awaitingMaximise = false;
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
      autoHideMenuBar: true,
      minimizable: true,
      minWidth: 320,
      minHeight: 240 + CHROME_HEIGHT,
      webPreferences: {
        preload: preloadPath('displayPreview'),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });
    const contentsId = this.win.webContents.id;
    windows.set(contentsId, this);
    configureWebContents(this.win.webContents);
    allowMediaCapture(this.win.webContents, (url) => isLocalRendererFrame(url, PAGE));
    this.win.webContents.once('destroyed', () => windows.delete(contentsId));
    this.win.on('move', () => this.emit('moved'));
    this.win.on('resize', () => this.emit('resized'));
    // Report 'restored' once a restore() has left the window neither full screen nor
    // maximised. Only a restore() asked for here reacts, so F11 still returns a
    // window to maximised. X11 reports leaving full screen synchronously, as a plain
    // window, and only then does the window manager re-maximise a window that went
    // full screen from maximised, so remember that case and wait for it.
    const restored = (settle = false): void => {
      if (!this.restoring || this.win.isDestroyed()) return;
      if (this.win.isFullScreen()) return;
      if (this.win.isMaximized()) {
        this.requestUnmaximise();
        return;
      }
      if (this.awaitingMaximise) return;
      this.restoring = false;
      if (!settle) {
        // Later tick: the caller subscribes after restore() returns.
        setImmediate(() => this.emit('restored'));
        return;
      }
      // The window manager reports leaving maximised before it sends the restored
      // frame; let that frame arrive first, so Centre keeps the restored size.
      const token = this.restoreToken;
      const done = (): void => {
        clearTimeout(timer);
        if (this.win.isDestroyed()) return;
        this.win.removeListener('resize', done);
        if (token !== this.restoreToken || this.win.isMaximized() || this.win.isFullScreen()) return;
        this.emit('restored');
      };
      const timer = setTimeout(done, 200);
      this.win.once('resize', done);
    };
    this.win.on('maximize', () => {
      this.awaitingMaximise = false;
      restored();
    });
    this.win.on('unmaximize', () => {
      // Entering full screen from maximised reports unmaximize while already full screen.
      if (this.win.isFullScreen()) this.maximisedUnderFullScreen = true;
      restored(true);
    });
    this.win.on('leave-full-screen', () => {
      if (this.restoring && this.maximisedUnderFullScreen) this.awaitingMaximise = true;
      this.maximisedUnderFullScreen = false;
      restored();
    });
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
    void this.win.loadFile(rendererPath(PAGE));
  }

  handleAction(message: unknown): void {
    if (!message || typeof message !== 'object') return;
    const action = (message as { action?: unknown }).action;
    if (action === 'toggle-power') this.emit('powerToggle');
    if (action === 'open-menu') this.emit('menuRequested');
    if (action === 'open-layout-menu') this.emit('layoutMenuRequested');
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

  restore(): boolean {
    if (this.win.isDestroyed()) return false;
    const restoring = this.win.isFullScreen() || this.win.isMaximized();
    // Set first: on X11, Chromium reports leaving full screen synchronously.
    if (restoring) {
      this.restoring = true;
      this.restoreToken += 1;
    }
    if (this.win.isFullScreen()) this.win.setFullScreen(false);
    if (this.win.isMaximized()) this.win.unmaximize();
    return restoring;
  }

  /**
   * Unmaximises a little later rather than from inside a window-state handler:
   * changing window state there makes Electron re-dispatch state events
   * synchronously (hundreds deep under xfwm4), and the request is lost. Re-sends
   * about every 130 ms while a restore is still waiting on a maximised window.
   * Callers of restore() must end the wait with cancelRestore(), as the
   * coordinator's fallback does, or this keeps re-sending.
   */
  private requestUnmaximise(): void {
    if (this.unmaximiseQueued) return;
    this.unmaximiseQueued = true;
    setTimeout(() => {
      this.unmaximiseQueued = false;
      if (!this.restoring || this.win.isDestroyed() || this.win.isFullScreen() || !this.win.isMaximized()) return;
      this.win.unmaximize();
      setTimeout(() => {
        if (this.restoring && !this.win.isDestroyed() && !this.win.isFullScreen() && this.win.isMaximized()) this.requestUnmaximise();
      }, 100);
    }, 30);
  }

  /** Whether the window is still full screen or maximised. */
  needsRestore(): boolean {
    return !this.win.isDestroyed() && (this.win.isFullScreen() || this.win.isMaximized());
  }

  /** Stops waiting for a restore(), so later user state changes are left alone. */
  cancelRestore(): void {
    this.restoreToken += 1;
    this.restoring = false;
    this.awaitingMaximise = false;
  }

  setContentSize(size: Size): void {
    if (!this.win.isDestroyed()) this.win.setContentSize(Math.round(size.width), Math.round(size.height));
  }

  getContentSize(): Size {
    const [width, height] = this.win.getContentSize();
    return { width, height };
  }

  show(): void {
    if (!this.win.isDestroyed()) this.win.show();
  }

  showInactive(): void {
    if (!this.win.isDestroyed()) this.win.showInactive();
  }

  focus(): void {
    if (!this.win.isDestroyed()) this.win.focus();
  }

  isFocused(): boolean {
    return !this.win.isDestroyed() && this.win.isFocused();
  }

  setAlwaysOnTop(alwaysOnTop: boolean): void {
    if (!this.win.isDestroyed()) this.win.setAlwaysOnTop(alwaysOnTop);
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
