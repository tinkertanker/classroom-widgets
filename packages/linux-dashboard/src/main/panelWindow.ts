import { BrowserWindow, ipcMain, Menu, screen, WebContentsView } from 'electron';
import { EventEmitter } from 'node:events';
import type { Rect } from './displayGeometry';
import { buildUrl } from './appProtocol';
import { log } from './log';
import {
  clampSize,
  CompactWidgetOption,
  isRecord,
  WidgetPanelDescriptor,
  WidgetPanelLayout,
  WidgetPanelStateChange,
} from './models';
import { registerNativeMessages, unregisterNativeMessages } from './nativeMessages';
import { configureWebContents, evaluate, evaluateBool } from './webContentsSetup';
import { audioSettingsScript, outputVolumeLabel, outputVolumePresets, type DashboardSettings } from './settings';
import { shortenerSettingsScript } from './shortenerSettings';
import { desktopHostScripts } from './generated/desktopHostScripts';
import { widgetMenuItems } from './widgetMenu';
import { preloadPath, rendererPath } from './paths';
import { WINDOW_SNAP_LABELS, WindowSnapPreset } from './windowSnap';

interface ChromeUpdate {
  title: string;
  theme: 'light' | 'dark';
  opacity: number;
  outputVolume: number;
  outputVolumeLabel: string;
  chromeVisible: boolean;
  addEnabled: boolean;
}

const CHROME_HEIGHT = 30;

const panelsByChromeContents = new Map<number, WidgetPanelWindow>();
let chromeListenerInstalled = false;

function installChromeListener(): void {
  if (chromeListenerInstalled) return;
  chromeListenerInstalled = true;
  ipcMain.on('panel-chrome-action', (event, message: unknown) => {
    const panel = panelsByChromeContents.get(event.sender.id);
    if (panel) panel.handleChromeAction(message);
  });
}

function sizeLimits(descriptor: WidgetPanelDescriptor) {
  const minimum = clampSize(descriptor.minimumContentSize);
  const maximum = descriptor.maximumContentSize ? clampSize(descriptor.maximumContentSize) : null;
  return {
    minWidth: Math.round(minimum.width),
    minHeight: Math.round(minimum.height + CHROME_HEIGHT),
    maxWidth: maximum ? Math.round(Math.max(maximum.width, minimum.width)) : undefined,
    maxHeight: maximum ? Math.round(Math.max(maximum.height, minimum.height) + CHROME_HEIGHT) : undefined,
  };
}

function chromeTheme(descriptor: WidgetPanelDescriptor): 'light' | 'dark' {
  return descriptor.snapshotPayload.theme === 'dark' ? 'dark' : 'light';
}

function presentationOf(descriptor: WidgetPanelDescriptor) {
  return {
    title: descriptor.title,
    ...sizeLimits(descriptor),
    isResizable: descriptor.isResizable,
    aspectRatio: descriptor.aspectRatio && descriptor.aspectRatio > 0 ? descriptor.aspectRatio : 0,
    theme: chromeTheme(descriptor),
  };
}

/**
 * A borderless always-on-top window presenting exactly one compact widget.
 * The chrome strip (title, add, arrange, close) is revealed while the pointer
 * is over the window and fades out shortly after it leaves.
 */
export class WidgetPanelWindow extends EventEmitter {
  // One timer checks the pointer for every shown panel: a timer per panel
  // woke the main process about eight times a second for each panel.
  private static readonly hoverPanels = new Set<WidgetPanelWindow>();
  private static hoverTimer: NodeJS.Timeout | null = null;

  private descriptor: WidgetPanelDescriptor;
  private backgroundOpacity: number;
  private options: CompactWidgetOption[] = [];
  private readonly win: BrowserWindow;
  private readonly view: WebContentsView;
  private chromeVisible = false;
  private panelReady = false;
  private closingPermanently = false;
  private lastProgrammaticBounds: Rect | null = null;
  private lastPushedRevision: number | null = null;
  private lastPushedStateRevision: number | null = null;
  private appliedPresentation: ReturnType<typeof presentationOf> | null = null;
  private writesCheckpoint: { resolve: () => void } | null = null;
  private frameTimer: NodeJS.Timeout | null = null;
  private pointerLeftAt: number | null = null;
  private menuOpen = false;

  /** Set by the coordinator so the arrange menu can check the active layout. */
  getCurrentLayout: () => WidgetPanelLayout = () => 'freeform';
  hasMultipleVisiblePanels: () => boolean = () => false;

  constructor(descriptor: WidgetPanelDescriptor, backgroundOpacity: number, alwaysOnTop: boolean, appVersion: string, private readonly settings: DashboardSettings) {
    super();
    installChromeListener();
    this.descriptor = descriptor;
    this.backgroundOpacity = Math.min(1, Math.max(0, backgroundOpacity));

    const preferred = this.preferredFrameSize();

    this.win = new BrowserWindow({
      frame: false,
      transparent: true,
      alwaysOnTop,
      skipTaskbar: true,
      show: false,
      resizable: descriptor.isResizable,
      width: Math.round(preferred.width),
      height: Math.round(preferred.height),
      ...sizeLimits(descriptor),
      backgroundColor: '#00000000',
      title: descriptor.title,
      webPreferences: {
        preload: preloadPath('chrome'),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });

    const chromeContentsId = this.win.webContents.id;
    panelsByChromeContents.set(chromeContentsId, this);
    this.win.webContents.once('destroyed', () => panelsByChromeContents.delete(chromeContentsId));

    this.view = new WebContentsView({
      webPreferences: {
        preload: preloadPath('bridge'),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        additionalArguments: [`--classroom-app-version=${appVersion}`],
      },
    });
    this.view.setBackgroundColor('#00000000');
    this.win.contentView.addChildView(this.view);
    this.layoutView();

    configureWebContents(this.win.webContents);
    configureWebContents(this.view.webContents);
    registerNativeMessages(this.view.webContents, (message) => this.handlePanelMessage(message));

    void this.win.loadFile(rendererPath('panel-chrome.html'));
    // Also after a reload (View > Reload): inventories no longer resend the chrome.
    this.win.webContents.on('did-finish-load', () => this.pushChromeUpdate());
    this.view.webContents.on('did-finish-load', () => this.applyWebPresentation());
    this.view.webContents.on('render-process-gone', (_event, details) => {
      if (details.reason !== 'clean-exit') {
        log.error(`Widget panel ${this.widgetId} render process gone (${details.reason}); reloading`);
        this.loadWidget();
      }
    });

    this.win.on('focus', () => this.emit('focused', this.widgetId));
    this.win.on('move', () => this.noteFrameChange());
    this.win.on('resize', () => {
      this.layoutView();
      this.noteFrameChange();
    });
    this.win.on('will-resize', () => this.layoutView());
    this.win.on('resized', () => this.layoutView());

    this.win.on('close', (event) => {
      if (this.closingPermanently) return;
      event.preventDefault();
      this.hidePanel();
      this.emit('removalRequested', this.widgetId);
    });

    this.win.once('closed', () => {
      this.stopTimers();
      unregisterNativeMessages(this.view.webContents);
      if (!this.view.webContents.isDestroyed()) this.view.webContents.close();
    });

    this.applyDescriptorPresentation();
    this.loadWidget();
  }

  get widgetId(): string {
    return this.descriptor.id;
  }

  get isResizable(): boolean {
    return this.descriptor.isResizable;
  }

  get isHidden(): boolean {
    return this.descriptor.hidden;
  }

  isVisible(): boolean {
    return !this.win.isDestroyed() && this.win.isVisible();
  }

  isFocused(): boolean {
    return !this.win.isDestroyed() && this.win.isFocused();
  }

  get currentFrame(): Rect {
    return this.win.getBounds();
  }

  /** Size rules for the position presets, in window (frame) sizes. */
  snapConstraints(): { aspect: number | null; chrome: { width: number; height: number }; minimumFrame: { width: number; height: number }; maximumFrame: { width: number; height: number } | null } {
    const chrome = { width: 0, height: CHROME_HEIGHT };
    if (!this.descriptor.isResizable) {
      // Fixed-size widgets are only moved.
      const size = this.preferredFrameSize();
      return { aspect: null, chrome, minimumFrame: size, maximumFrame: size };
    }
    const limits = sizeLimits(this.descriptor);
    const aspect = this.descriptor.aspectRatio && this.descriptor.aspectRatio > 0 ? this.descriptor.aspectRatio : null;
    return {
      aspect,
      chrome,
      minimumFrame: { width: limits.minWidth, height: limits.minHeight },
      maximumFrame: limits.maxWidth !== undefined && limits.maxHeight !== undefined
        ? { width: limits.maxWidth, height: limits.maxHeight }
        : null,
    };
  }

  preferredFrameSize(): { width: number; height: number } {
    const content = clampSize(this.descriptor.preferredContentSize);
    return { width: content.width, height: content.height + CHROME_HEIGHT };
  }

  showPanel(): void {
    if (this.closingPermanently || this.descriptor.hidden || this.win.isDestroyed()) return;
    if (!this.win.isVisible()) this.win.showInactive();
    this.startHoverTimer();
  }

  hidePanel(): void {
    this.stopHoverTimer();
    if (!this.win.isDestroyed() && this.win.isVisible()) this.win.hide();
  }

  closePermanently(): void {
    this.flushPendingFrame();
    this.closingPermanently = true;
    this.stopTimers();
    if (!this.win.isDestroyed()) this.win.destroy();
  }

  apply(descriptor: WidgetPanelDescriptor): void {
    this.descriptor = descriptor;
    this.applyDescriptorPresentation();
    this.pushSnapshot();
  }

  applyPresentationSettings(backgroundOpacity: number, alwaysOnTop: boolean): void {
    const next = Math.min(1, Math.max(0, backgroundOpacity));
    this.backgroundOpacity = next;
    if (!this.win.isDestroyed()) this.win.setAlwaysOnTop(alwaysOnTop);
    this.applyWebPresentation();
    this.pushChromeUpdate();
  }

  setWidgetCreationOptions(options: CompactWidgetOption[]): void {
    this.options = options;
    this.pushChromeUpdate();
  }

  setFrame(frame: Rect, initializing = false): void {
    if (this.win.isDestroyed()) return;
    const bounds: Rect = {
      x: Math.round(frame.x),
      y: Math.round(frame.y),
      width: Math.max(Math.round(frame.width), this.win.getMinimumSize()[0]),
      height: Math.max(Math.round(frame.height), this.win.getMinimumSize()[1]),
    };
    this.lastProgrammaticBounds = bounds;
    this.win.setBounds(bounds);
    const appliedBounds = this.win.getBounds();
    if (!boundsMatch(appliedBounds, bounds)) this.lastProgrammaticBounds = appliedBounds;
    this.layoutView();
    if (initializing && this.frameTimer) {
      clearTimeout(this.frameTimer);
      this.frameTimer = null;
    }
  }

  defaultFrame(): Rect {
    const workArea = screen.getPrimaryDisplay().workArea;
    const size = this.preferredFrameSize();
    const width = Math.min(size.width, workArea.width);
    const height = Math.min(size.height, workArea.height);
    return {
      x: workArea.x + (workArea.width - width) / 2,
      y: workArea.y + (workArea.height - height) / 2,
      width,
      height,
    };
  }

  /**
   * Asks the panel for any unsent state and waits for its writes checkpoint
   * so nothing typed moments before a reload is lost.
   */
  async takePendingState(): Promise<{ change: WidgetPanelStateChange | null; prepared: boolean }> {
    if (this.view.webContents.isDestroyed()) return { change: null, prepared: true };

    const checkpoint = new Promise<void>((resolve) => {
      this.writesCheckpoint = { resolve };
    });
    const scriptPromise = evaluate(
      this.view.webContents,
      desktopHostScripts.widgetPanelTakePendingStateResult,
    );
    const delay = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 900));
    const completed = await Promise.race([Promise.all([scriptPromise, checkpoint]).then(() => 'done' as const), delay]);
    this.writesCheckpoint = null;
    if (completed === 'timeout') return { change: null, prepared: false };

    const result = await scriptPromise;
    if (!isRecord(result) || result.ok !== true) return { change: null, prepared: false };
    const value = result.value;
    // null means nothing pending; the panel is still prepared.
    if (value === null || value === undefined) return { change: null, prepared: true };
    if (!isRecord(value)) return { change: null, prepared: true };
    const payload = value;
    if (
      payload.schemaVersion !== 1
      || payload.widgetId !== this.widgetId
      || typeof payload.baseRevision !== 'number'
      || !('state' in payload)
    ) {
      return { change: null, prepared: false };
    }

    return { change: { widgetId: this.widgetId, payload: { ...payload, flush: true } }, prepared: true };
  }

  private loadWidget(): void {
    this.panelReady = false;
    this.lastPushedRevision = null;
    this.lastPushedStateRevision = null;
    void this.view.webContents.loadURL(buildUrl({
      surface: 'widget-panel',
      widgetId: this.widgetId,
      backgroundOpacity: this.opacityText(),
    }));
  }

  private handlePanelMessage(body: Record<string, unknown>): void {
    if (body.handler !== 'classroomWidgetPanel') return;
    if (typeof body.type !== 'string') return;
    if (typeof body.widgetId === 'string' && body.widgetId !== this.widgetId) return;

    switch (body.type) {
      case 'open-settings':
        this.emit('openSettingsRequested');
        break;
      case 'panel-ready':
        this.panelReady = true;
        this.pushSnapshot(true);
        break;
      case 'panel-state-change': {
        if (typeof body.baseRevision !== 'number') return;
        if (!('state' in body)) return;
        const payload: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(body)) {
          if (key === 'flush' || key === 'handler') continue;
          payload[key] = value;
        }
        this.emit('panelStateChanged', { widgetId: this.widgetId, payload } satisfies WidgetPanelStateChange);
        break;
      }
      case 'randomiser-list-save': {
        if (typeof body.name !== 'string' || body.name.trim() === '') return;
        if (!Array.isArray(body.choices) || body.choices.length > 10_000) return;
        this.emit('randomiserListChanged', body);
        break;
      }
      case 'randomiser-list-delete': {
        if (typeof body.id !== 'string' || body.id === '') return;
        this.emit('randomiserListChanged', body);
        break;
      }
      case 'panel-writes-checkpoint':
        this.writesCheckpoint?.resolve();
        break;
    }
  }

  private pushSnapshot(force = false): void {
    if (this.view.webContents.isDestroyed() || !this.panelReady) return;
    if (!force
      && this.descriptor.revision === this.lastPushedRevision
      && this.descriptor.stateRevision === this.lastPushedStateRevision) return;
    this.lastPushedRevision = this.descriptor.revision;
    this.lastPushedStateRevision = this.descriptor.stateRevision;
    const snapshot = JSON.stringify(this.descriptor.snapshotPayload);
    void evaluateBool(
      this.view.webContents,
      shortenerSettingsScript(this.settings.linkShortener)
        + audioSettingsScript(this.settings.outputVolume)
        + desktopHostScripts.widgetPanelReceiveSnapshot(snapshot),
    );
  }

  /**
   * Every inventory re-applies each panel's descriptor, and a List sends one
   * inventory per keystroke. Only touch the native window and the chrome
   * when a presented field changed (#213).
   */
  private applyDescriptorPresentation(): void {
    if (this.win.isDestroyed()) return;
    const next = presentationOf(this.descriptor);
    const previous = this.appliedPresentation;
    this.appliedPresentation = next;

    if (previous?.title !== next.title) this.win.setTitle(next.title);
    const resizeChanged = previous?.isResizable !== next.isResizable;
    // Electron restores saved limits when resizing is re-enabled, so reapply
    // both limits after a resize-mode change even when their values match.
    if (resizeChanged) this.win.setResizable(next.isResizable);
    if (resizeChanged || previous?.minWidth !== next.minWidth || previous?.minHeight !== next.minHeight) {
      this.win.setMinimumSize(next.minWidth, next.minHeight);
    }
    if (resizeChanged || previous?.maxWidth !== next.maxWidth || previous?.maxHeight !== next.maxHeight) {
      this.win.setMaximumSize(next.maxWidth ?? 100_000, next.maxHeight ?? 100_000);
    }
    if (previous?.aspectRatio !== next.aspectRatio) {
      if (next.aspectRatio > 0) {
        this.win.setAspectRatio(next.aspectRatio, { width: 0, height: CHROME_HEIGHT });
      } else {
        this.win.setAspectRatio(0);
      }
    }
    if (previous?.title !== next.title || previous?.theme !== next.theme) this.pushChromeUpdate();
  }

  private pushChromeUpdate(): void {
    if (this.win.isDestroyed() || this.win.webContents.isDestroyed()) return;
    const update: ChromeUpdate = {
      title: this.descriptor.title,
      theme: chromeTheme(this.descriptor),
      opacity: this.backgroundOpacity,
      outputVolume: this.settings.outputVolume,
      outputVolumeLabel: outputVolumeLabel(this.settings.outputVolume),
      chromeVisible: this.chromeVisible,
      addEnabled: this.options.length > 0,
    };
    this.win.webContents.send('panel-chrome-update', update);
  }

  private applyWebPresentation(): void {
    if (this.view.webContents.isDestroyed()) return;
    void evaluate(
      this.view.webContents,
      shortenerSettingsScript(this.settings.linkShortener)
        + audioSettingsScript(this.settings.outputVolume)
        + desktopHostScripts.widgetPanelChromeVisible(JSON.stringify(this.chromeVisible ? 'true' : 'false'))
        + desktopHostScripts.widgetPanelBackgroundOpacity(JSON.stringify(this.opacityText())),
    );
  }

  private opacityText(): string {
    return String(Math.round(this.backgroundOpacity * 100) / 100);
  }

  private layoutView(): void {
    if (this.win.isDestroyed() || this.view.webContents.isDestroyed()) return;
    const [width, height] = this.win.getContentSize();
    this.view.setBounds({ x: 0, y: CHROME_HEIGHT, width, height: Math.max(0, height - CHROME_HEIGHT) });
  }

  private noteFrameChange(): void {
    if (this.closingPermanently || this.win.isDestroyed()) return;
    if (this.frameTimer) clearTimeout(this.frameTimer);
    this.frameTimer = setTimeout(() => this.flushPendingFrame(), 400);
  }

  flushPendingFrame(): void {
    if (!this.frameTimer) return;
    clearTimeout(this.frameTimer);
    this.frameTimer = null;
    if (this.win.isDestroyed()) return;
    const bounds = this.win.getBounds();
    if (this.lastProgrammaticBounds && boundsMatch(bounds, this.lastProgrammaticBounds)) return;
    if (this.lastProgrammaticBounds && this.isAspectRatioSettled(bounds, this.lastProgrammaticBounds)) {
      this.lastProgrammaticBounds = bounds;
      return;
    }
    this.lastProgrammaticBounds = null;
    this.emit('frameChanged', this.widgetId, bounds);
  }

  private isAspectRatioSettled(bounds: Rect, target: Rect): boolean {
    return this.descriptor.aspectRatio !== null
      && Math.abs(bounds.x - target.x) <= 2
      && Math.abs(bounds.y - target.y) <= 2
      && Math.abs(bounds.width - target.width) <= 2;
  }

  private startHoverTimer(): void {
    WidgetPanelWindow.hoverPanels.add(this);
    if (!WidgetPanelWindow.hoverTimer) WidgetPanelWindow.hoverTimer = setInterval(WidgetPanelWindow.pollPointer, 120);
  }

  private stopHoverTimer(): void {
    WidgetPanelWindow.hoverPanels.delete(this);
    if (WidgetPanelWindow.hoverPanels.size === 0 && WidgetPanelWindow.hoverTimer) {
      clearInterval(WidgetPanelWindow.hoverTimer);
      WidgetPanelWindow.hoverTimer = null;
    }
  }

  private static pollPointer(): void {
    const point = screen.getCursorScreenPoint();
    for (const panel of WidgetPanelWindow.hoverPanels) panel.updateChromeForPointer(point);
  }

  private stopTimers(): void {
    this.stopHoverTimer();
    if (this.frameTimer) {
      clearTimeout(this.frameTimer);
      this.frameTimer = null;
    }
  }

  private updateChromeForPointer(point: { x: number; y: number }): void {
    if (this.win.isDestroyed() || !this.win.isVisible()) return;
    const bounds = this.win.getBounds();
    const inside = point.x >= bounds.x && point.x < bounds.x + bounds.width
      && point.y >= bounds.y && point.y < bounds.y + bounds.height;

    if (inside || this.menuOpen) {
      this.pointerLeftAt = null;
      this.setChromeVisible(true);
      return;
    }
    if (this.pointerLeftAt === null) this.pointerLeftAt = Date.now();
    if (this.chromeVisible && Date.now() - this.pointerLeftAt > 1200) this.setChromeVisible(false);
  }

  private setChromeVisible(visible: boolean): void {
    if (this.chromeVisible === visible) return;
    this.chromeVisible = visible;
    this.pushChromeUpdate();
    this.applyWebPresentation();
  }

  private trackMenu(menu: Menu): void {
    this.menuOpen = true;
    menu.once('menu-will-close', () => {
      this.menuOpen = false;
    });
  }

  handleChromeAction(message: unknown): void {
    if (!isRecord(message) || typeof message.action !== 'string') return;
    switch (message.action) {
      case 'close':
        this.hidePanel();
        this.emit('removalRequested', this.widgetId);
        break;
      case 'add': {
        const menu = Menu.buildFromTemplate(widgetMenuItems(this.options, {
          openDisplay: () => this.emit('displayPreviewRequested'),
          addWidget: (widgetType) => this.emit('widgetCreationRequested', widgetType),
        }));
        this.trackMenu(menu);
        const bounds = this.win.getBounds();
        menu.popup({ window: this.win, x: Math.max(0, bounds.width - 48), y: CHROME_HEIGHT });
        break;
      }
      case 'arrange': {
        const current = this.getCurrentLayout();
        const entry = (label: string, layout: WidgetPanelLayout) => ({
          label,
          type: 'radio' as const,
          visible: this.hasMultipleVisiblePanels(),
          checked: current === layout,
          click: () => this.emit('layoutRequested', layout),
        });
        const snap = (preset: WindowSnapPreset) => ({
          label: WINDOW_SNAP_LABELS[preset],
          click: () => this.emit('snapRequested', preset),
        });
        const menu = Menu.buildFromTemplate([
          entry('Free placement', 'freeform'),
          entry('Arrange in a row', 'row'),
          entry('Arrange in a column', 'column'),
          { type: 'separator', visible: this.hasMultipleVisiblePanels() },
          { label: 'Move this widget', enabled: false },
          snap('left-half'), snap('right-half'), snap('top-half'), snap('bottom-half'),
          { type: 'separator' },
          snap('top-left'), snap('top-right'), snap('bottom-left'), snap('bottom-right'),
          { type: 'separator' },
          snap('centre'), snap('fill'),
        ]);
        this.trackMenu(menu);
        menu.popup({ window: this.win, y: CHROME_HEIGHT });
        break;
      }
      case 'volume': {
        const preset = (label: string, volume: number) => ({
          label,
          type: 'checkbox' as const,
          checked: this.settings.outputVolume === volume,
          click: () => {
            this.settings.outputVolume = volume;
            this.settings.notifyChanged('outputVolume');
          },
        });
        const menu = Menu.buildFromTemplate(outputVolumePresets.map(({ label, volume }) => preset(label, volume)));
        this.trackMenu(menu);
        const bounds = this.win.getBounds();
        menu.popup({ window: this.win, x: Math.max(0, bounds.width - 100), y: CHROME_HEIGHT });
        break;
      }
    }
  }
}

function boundsMatch(a: Rect, b: Rect): boolean {
  return Math.abs(a.x - b.x) <= 2
    && Math.abs(a.y - b.y) <= 2
    && Math.abs(a.width - b.width) <= 2
    && Math.abs(a.height - b.height) <= 2;
}
