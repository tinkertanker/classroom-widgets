import { desktopCapturer, MenuItemConstructorOptions, screen } from 'electron';
import { EventEmitter } from 'node:events';
import {
  aspectNormalizedWindowSize,
  clampRect,
  mapPreviewPointToSource,
  Rect,
  rectsIntersect,
} from './displayGeometry';
import { DisplayCatalog, DisplayDescriptor } from './displayCatalog';
import { DashboardSettings, PanelFrame } from './settings';
import {
  DISPLAY_PREVIEW_CHROME_HEIGHT,
  DisplayPreviewState,
  DisplayPreviewWindow,
} from './displayPreviewWindow';
import { movePointer } from './pointer';

interface ScreenLike {
  getDisplayMatching(rect: Rect): Electron.Display;
  getCursorScreenPoint(): { x: number; y: number };
  on(event: string, listener: () => void): void;
  removeListener?(event: string, listener: () => void): void;
  getDisplayNearestPoint?(point: { x: number; y: number }): Electron.Display;
}

interface DesktopCapturerLike {
  getSources(options: { types: Array<'screen'>; thumbnailSize: { width: number; height: number } }): Promise<Array<{ id: string; display_id?: string }>>;
}

export interface DisplayPreviewDeps {
  desktopCapturer: DesktopCapturerLike;
  screen: ScreenLike;
  createWindow?: (bounds: Rect) => DisplayPreviewWindowLike;
}

export interface DisplayPreviewWindowLike extends EventEmitter {
  getBounds(): Rect;
  setBounds(bounds: Rect): void;
  setSize(size: { width: number; height: number }): void;
  getContentSize(): { width: number; height: number };
  show(): void;
  focus(): void;
  close(): void;
  setState(state: DisplayPreviewState): void;
  startStream(sourceId: string, size: { width: number; height: number }): void;
  stopStream(): void;
  popupMenu(template: MenuItemConstructorOptions[]): void;
}

const MINIMUM_PREVIEW_SIZE = { width: 320, height: 180 };
const FRAME_INSET = 12;

export class DisplayPreviewCoordinator extends EventEmitter {
  private window: DisplayPreviewWindowLike | null = null;
  private candidates: DisplayDescriptor[] = [];
  private selectedSource: DisplayDescriptor | null = null;
  private wantsCapture = false;
  private suspendedForOverlap = false;
  private frameTimer: NodeJS.Timeout | null = null;
  private startGeneration = 0;
  private readonly displayChanged = (): void => void this.refreshSources();

  constructor(
    private readonly settings: DashboardSettings,
    private readonly catalog: DisplayCatalog,
    private readonly deps: DisplayPreviewDeps = { desktopCapturer, screen },
  ) {
    super();
  }

  get isOpen(): boolean {
    return this.window !== null;
  }

  open(): void {
    if (this.window) {
      this.window.show();
      this.window.focus();
      return;
    }
    const bounds = this.initialBounds();
    const window = this.deps.createWindow?.(bounds) ?? new DisplayPreviewWindow(bounds);
    this.window = window;
    this.attachWindow(window);
    this.deps.screen.on('display-added', this.displayChanged);
    this.deps.screen.on('display-removed', this.displayChanged);
    this.deps.screen.on('display-metrics-changed', this.displayChanged);
    window.show();
    window.focus();
    this.refreshSources();
  }

  close(): void {
    if (!this.window) return;
    this.stopCapture();
    this.window.close();
  }

  stop(): void {
    this.stopCapture();
    this.publish('Paused.');
  }

  shutdown(): void {
    this.stop();
    this.window?.close();
    this.window = null;
  }

  private attachWindow(window: DisplayPreviewWindowLike): void {
    window.on('powerToggle', () => {
      if (this.wantsCapture) this.stop();
      else void this.start();
    });
    window.on('menuRequested', () => this.showMenu());
    window.on('previewClick', (value: { x: number; y: number; imageRect: Rect }) => {
      if (!this.selectedSource) return;
      if (!this.wantsCapture) {
        void this.start();
        return;
      }
      const point = mapPreviewPointToSource(
        { x: value.x, y: value.y },
        value.imageRect,
        this.selectedSource.bounds,
      );
      if (point) void this.moveTo(point, this.selectedSource);
    });
    window.on('streamLive', () => {
      if (this.wantsCapture && this.selectedSource) this.publish(`Live: ${this.selectedSource.name}`);
    });
    window.on('streamError', (message: string) => {
      if (!this.selectedSource) return;
      this.stopCapture();
      this.publish(`Could not capture ${this.selectedSource.name}: ${message}`);
    });
    window.on('moved', () => this.noteFrameChange());
    window.on('resized', () => this.noteFrameChange());
    window.on('closed', () => {
      this.stopCapture();
      this.window = null;
      this.deps.screen.removeListener?.('display-added', this.displayChanged);
      this.deps.screen.removeListener?.('display-removed', this.displayChanged);
      this.deps.screen.removeListener?.('display-metrics-changed', this.displayChanged);
      this.emit('closed');
    });
  }

  private initialBounds(): Rect {
    const saved = this.settings.getDisplayPreviewFrame();
    const displays = this.catalog.displays();
    const savedRect = saved && { x: saved.left, y: saved.top, width: saved.width, height: saved.height };
    if (savedRect && savedRect.width >= 320 && savedRect.height >= 240 && displays.some((display) => rectsIntersect(savedRect, display.bounds))) {
      const display = this.deps.screen.getDisplayMatching(savedRect);
      return clampRect(savedRect, inset(display.workArea));
    }
    const point = this.deps.screen.getCursorScreenPoint();
    const nativeDisplay = this.deps.screen.getDisplayNearestPoint?.(point) ?? this.deps.screen.getDisplayMatching({ x: point.x, y: point.y, width: 1, height: 1 });
    const area = nativeDisplay.workArea;
    const width = Math.min(480, area.width);
    const height = Math.min(360, area.height);
    return { x: area.x + (area.width - width) / 2, y: area.y + (area.height - height) / 2, width, height };
  }

  private refreshSources(): void {
    if (!this.window) return;
    const host = this.deps.screen.getDisplayMatching(this.window.getBounds());
    this.candidates = this.catalog.eligibleSources(host.id);
    const previousSource = this.selectedSource;
    const selectedCurrent = this.selectedSource && this.catalog.currentMatching(this.selectedSource);
    if (previousSource && !selectedCurrent) {
      this.stopCapture();
      this.settings.setDisplayPreviewSourceId(null);
      this.selectedSource = this.catalog.resolveSource(null, this.candidates);
      if (!this.selectedSource) {
        this.publish('The selected display is no longer available.');
        return;
      }
    } else if (selectedCurrent && selectedCurrent.id !== host.id) {
      const sourceChanged = this.selectedSource !== null
        && (this.selectedSource.bounds.x !== selectedCurrent.bounds.x
          || this.selectedSource.bounds.y !== selectedCurrent.bounds.y
          || this.selectedSource.bounds.width !== selectedCurrent.bounds.width
          || this.selectedSource.bounds.height !== selectedCurrent.bounds.height
          || this.selectedSource.scaleFactor !== selectedCurrent.scaleFactor);
      this.selectedSource = selectedCurrent;
      if (sourceChanged && this.wantsCapture) {
        this.stopCapture();
        void this.start();
      }
    } else if (!selectedCurrent) {
      this.selectedSource = this.catalog.resolveSource(this.settings.getDisplayPreviewSourceId(), this.candidates);
    }
    if (this.selectedSource && !this.catalog.currentMatching(this.selectedSource)) {
      this.stopCapture();
      this.wantsCapture = false;
      this.selectedSource = null;
      this.settings.setDisplayPreviewSourceId(null);
      this.publish('The selected display is no longer available.');
      return;
    }
    if (this.wantsCapture && this.selectedSource && rectsIntersect(this.window.getBounds(), this.selectedSource.bounds)) {
      if (!this.suspendedForOverlap) {
        this.suspendedForOverlap = true;
        this.window.stopStream();
        this.publish('Preview suspended while it overlaps the source display. Move it fully clear to resume.');
      }
    } else if (this.suspendedForOverlap && this.wantsCapture) {
      this.suspendedForOverlap = false;
      void this.start();
    }
    if (this.selectedSource && !this.candidates.some((candidate) => candidate.id === this.selectedSource?.id)) {
      this.publish('Preview suspended while it overlaps the source display. Move it fully clear to resume.');
    } else if (!this.candidates.length) {
      this.publish('Connect another display or use an extended desktop.');
    } else if (!this.selectedSource) {
      this.publish('Choose a source display, then turn the preview on.');
    } else if (!this.wantsCapture) {
      this.publish('Click to see display');
    }
  }

  private async start(): Promise<void> {
    const generation = ++this.startGeneration;
    if (!this.window || !this.selectedSource) return;
    if (rectsIntersect(this.window.getBounds(), this.selectedSource.bounds)) {
      this.wantsCapture = true;
      this.suspendedForOverlap = true;
      this.publish('Preview suspended while it overlaps the source display. Move it fully clear to resume.');
      return;
    }
    const source = this.selectedSource;
    try {
      const sources = await this.deps.desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 0, height: 0 },
      });
      if (generation !== this.startGeneration || !this.window || this.selectedSource !== source) return;
      const capture = sources.find((candidate) => candidate.display_id === String(source.id))
        ?? (sources.length === 1 && this.candidates.length === 1 ? sources[0] : null);
      if (!capture) {
        this.wantsCapture = false;
        this.publish(`Could not capture ${source.name}: source unavailable.`);
        return;
      }
      this.wantsCapture = true;
      this.window.startStream(capture.id, {
        width: Math.round(source.bounds.width * source.scaleFactor),
        height: Math.round(source.bounds.height * source.scaleFactor),
      });
      this.publish(`Live: ${source.name}`);
    } catch (error) {
      if (generation !== this.startGeneration || !this.window || this.selectedSource !== source) return;
      this.wantsCapture = false;
      this.publish(`Could not capture ${source.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private stopCapture(): void {
    this.startGeneration += 1;
    this.wantsCapture = false;
    this.suspendedForOverlap = false;
    this.window?.stopStream();
  }

  private publish(statusMessage: string): void {
    if (!this.window) return;
    const powerEnabled = this.candidates.length > 0 && this.selectedSource !== null;
    const state: DisplayPreviewState = {
      statusMessage,
      powerState: this.wantsCapture ? 'on' : 'off',
      powerEnabled,
      idleStartEnabled: powerEnabled && !this.wantsCapture,
      sourceId: this.selectedSource?.id ?? null,
    };
    this.window.setState(state);
  }

  private showMenu(): void {
    if (!this.window) return;
    const status = this.selectedSource
      ? (this.wantsCapture ? `Live: ${this.selectedSource.name}` : 'Click to see display')
      : (this.candidates.length ? 'Choose a source display, then turn the preview on.' : 'Connect another display or use an extended desktop.');
    const template: MenuItemConstructorOptions[] = [
      { label: status, enabled: false },
      { type: 'separator' },
      ...this.candidates.map((candidate) => ({
        label: this.catalog.sourceLabel(candidate),
        type: 'radio' as const,
        checked: candidate.id === this.selectedSource?.id,
        click: () => this.selectSource(candidate),
      })),
      { type: 'separator' },
      { label: 'Match Display Aspect Ratio', enabled: this.selectedSource !== null, click: () => this.snapAspect() },
      { label: 'Move Pointer to Source Center', enabled: this.selectedSource !== null, click: () => {
        if (this.selectedSource) void this.moveTo({
          x: this.selectedSource.bounds.x + this.selectedSource.bounds.width / 2,
          y: this.selectedSource.bounds.y + this.selectedSource.bounds.height / 2,
        }, this.selectedSource);
      } },
      { type: 'separator' },
      { label: 'Click the preview to move the pointer there.', enabled: false },
    ];
    this.window.popupMenu(template);
  }

  private selectSource(source: DisplayDescriptor): void {
    const wasCapturing = this.wantsCapture;
    this.stopCapture();
    this.selectedSource = source;
    this.settings.setDisplayPreviewSourceId(source.id);
    this.snapAspect();
    this.publish('Click to see display');
    if (wasCapturing) void this.start();
  }

  private snapAspect(): void {
    if (!this.window || !this.selectedSource) return;
    const host = this.deps.screen.getDisplayMatching(this.window.getBounds());
    const content = this.window.getContentSize();
    const size = aspectNormalizedWindowSize(
      this.selectedSource.bounds.width / this.selectedSource.bounds.height,
      { width: content.width, height: Math.max(content.height - DISPLAY_PREVIEW_CHROME_HEIGHT, 1) },
      DISPLAY_PREVIEW_CHROME_HEIGHT,
      MINIMUM_PREVIEW_SIZE,
      host.workArea,
    );
    this.window.setSize(size);
  }

  private async moveTo(point: { x: number; y: number }, source: DisplayDescriptor): Promise<void> {
    if (!(await movePointer(point.x * source.scaleFactor, point.y * source.scaleFactor))) {
      this.publish('Could not move the pointer. Preview remains live.');
    }
  }

  private noteFrameChange(): void {
    if (!this.window) return;
    if (this.frameTimer) clearTimeout(this.frameTimer);
    this.frameTimer = setTimeout(() => {
      this.frameTimer = null;
      if (!this.window) return;
      const frame = this.window.getBounds();
      const saved: PanelFrame = { left: frame.x, top: frame.y, width: frame.width, height: frame.height };
      this.settings.setDisplayPreviewFrame(saved);
      this.refreshSources();
    }, 150);
  }
}

function inset(rect: Rect): Rect {
  return { x: rect.x + FRAME_INSET, y: rect.y + FRAME_INSET, width: Math.max(rect.width - FRAME_INSET * 2, 1), height: Math.max(rect.height - FRAME_INSET * 2, 1) };
}
