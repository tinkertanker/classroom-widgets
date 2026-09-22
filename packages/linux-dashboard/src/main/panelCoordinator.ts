import { screen } from 'electron';
import { EventEmitter } from 'node:events';
import { DashboardSettings } from './settings';
import {
  CompactWidgetOption,
  WidgetPanelDescriptor,
  WidgetPanelInventory,
  WidgetPanelLayout,
  WidgetPanelStateChange,
} from './models';
import { RectFrame, WidgetPanelWindow } from './panelWindow';
import { nextDisplayFrame } from './moveToNextDisplay';

const GAP = 12;
const OVERFLOW_STEP = 28;

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function intersect(a: Rect, b: Rect): Rect {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
}

/** Work area of the monitor holding most of the frame. */
export function workAreaContaining(frame: Rect): Rect {
  try {
    return screen.getDisplayMatching(frame).workArea;
  } catch {
    return primaryWorkArea();
  }
}

export function primaryWorkArea(): Rect {
  return screen.getPrimaryDisplay().workArea;
}

export function clampFrame(frame: Rect, bounds: Rect): Rect {
  const width = Math.min(frame.width, bounds.width);
  const height = Math.min(frame.height, bounds.height);
  const x = Math.min(Math.max(frame.x, bounds.x), bounds.x + bounds.width - width);
  const y = Math.min(Math.max(frame.y, bounds.y), bounds.y + bounds.height - height);
  return { x, y, width, height };
}

/** Lays out panels in a row or column inside the usable area; overflow cascades. */
export function layoutFrames(
  panels: Array<{ id: string; size: { width: number; height: number } }>,
  layout: Exclude<WidgetPanelLayout, 'freeform'>,
  usable: Rect,
): Map<string, Rect> {
  const frames = new Map<string, Rect>();
  if (panels.length === 0) return frames;

  const sizes = panels.map((panel) => ({
    id: panel.id,
    size: {
      width: Math.min(panel.size.width, usable.width),
      height: Math.min(panel.size.height, usable.height),
    },
  }));
  const placed: typeof sizes = [];
  const overflow: typeof sizes = [];
  let used = 0;
  for (const panel of sizes) {
    const extent = layout === 'row' ? panel.size.width : panel.size.height;
    const limit = layout === 'row' ? usable.width : usable.height;
    const next = used + extent + (placed.length > 0 ? GAP : 0);
    if (next <= limit || placed.length === 0) {
      placed.push(panel);
      used = next;
    } else {
      overflow.push(panel);
    }
  }

  if (layout === 'row') {
    let x = usable.x + Math.max(0, (usable.width - used) / 2);
    const rowHeight = Math.max(...placed.map((panel) => panel.size.height));
    const y = usable.y + Math.max(0, (usable.height - rowHeight) / 2);
    for (const panel of placed) {
      frames.set(panel.id, { x, y: y + (rowHeight - panel.size.height) / 2, width: panel.size.width, height: panel.size.height });
      x += panel.size.width + GAP;
    }
  } else {
    const columnWidth = Math.max(...placed.map((panel) => panel.size.width));
    const x = usable.x + usable.width - columnWidth;
    let y = usable.y + Math.max(0, (usable.height - used) / 2);
    for (const panel of placed) {
      frames.set(panel.id, { x: x + (columnWidth - panel.size.width) / 2, y, width: panel.size.width, height: panel.size.height });
      y += panel.size.height + GAP;
    }
  }

  let cascade = 0;
  for (const panel of overflow) {
    const offset = OVERFLOW_STEP * cascade++;
    frames.set(panel.id, {
      x: usable.x + Math.min(offset, Math.max(0, usable.width - panel.size.width)),
      y: usable.y + Math.min(offset, Math.max(0, usable.height - panel.size.height)),
      width: panel.size.width,
      height: panel.size.height,
    });
  }
  return frames;
}

/**
 * Coordinates the one-widget-per-window compact presentation. It owns native
 * placement only; widget content and state arrive through versioned host
 * snapshots and flow back through each panel's web bridge.
 */
export class WidgetPanelCoordinator extends EventEmitter {
  private readonly settings: DashboardSettings;
  private readonly appVersion: string;
  private readonly panels = new Map<string, WidgetPanelWindow>();
  private readonly freeformFrames = new Map<string, Rect>();
  private lastInventory: WidgetPanelInventory | null = null;
  private layout: WidgetPanelLayout = 'freeform';
  private active = true;
  private options: CompactWidgetOption[] = [];
  private backgroundOpacity = 1;
  private alwaysOnTop = true;
  private framesDirty = false;
  private lastFocusedId: string | null = null;

  constructor(settings: DashboardSettings, appVersion: string) {
    super();
    this.settings = settings;
    this.appVersion = appVersion;
  }

  get panelCount(): number {
    return this.panels.size;
  }

  get currentLayout(): WidgetPanelLayout {
    return this.layout;
  }

  setWidgetCreationOptions(options: CompactWidgetOption[]): void {
    this.options = options;
    for (const panel of this.panels.values()) panel.setWidgetCreationOptions(options);
  }

  applyPresentationSettings(backgroundOpacity: number, alwaysOnTop: boolean): void {
    this.backgroundOpacity = Math.min(1, Math.max(0, backgroundOpacity));
    this.alwaysOnTop = alwaysOnTop;
    for (const panel of this.panels.values()) panel.applyPresentationSettings(this.backgroundOpacity, this.alwaysOnTop);
  }

  /**
   * Reconciles the complete host inventory. Lower revisions from the same
   * host instance are ignored so stale deliveries cannot resurrect or remove
   * panels; a fresh web process has a new instance ID and restarts at zero.
   */
  reconcile(inventory: WidgetPanelInventory): boolean {
    if (this.lastInventory && inventory.hostInstanceId !== this.lastInventory.hostInstanceId) {
      for (const panel of this.panels.values()) panel.closePermanently();
      this.panels.clear();
      this.lastFocusedId = null;
    } else if (this.lastInventory && inventory.revision < this.lastInventory.revision) {
      return false;
    }
    this.lastInventory = inventory;

    const incomingIds = new Set(inventory.widgets.map((widget) => widget.id));
    for (const [id, panel] of [...this.panels]) {
      if (incomingIds.has(id)) continue;
      panel.closePermanently();
      this.panels.delete(id);
      this.freeformFrames.delete(id);
      if (this.lastFocusedId === id) this.lastFocusedId = null;
    }

    let created = false;
    let visibilityChanged = false;
    for (const descriptor of inventory.widgets) {
      const existing = this.panels.get(descriptor.id);
      if (existing) {
        const wasHidden = existing.isHidden;
        existing.apply(descriptor);
        if (descriptor.hidden) {
          existing.hidePanel();
          if (this.lastFocusedId === descriptor.id) this.lastFocusedId = null;
        }
        else if (this.active && wasHidden) existing.showPanel();
        visibilityChanged ||= wasHidden !== descriptor.hidden;
        continue;
      }
      const panel = this.makePanel(descriptor);
      this.panels.set(descriptor.id, panel);
      created = true;
      if (this.active) panel.showPanel();
    }

    if ((created || visibilityChanged) && this.layout !== 'freeform') this.arrange(this.layout);
    this.emit('changed');
    return true;
  }

  activate(): boolean {
    this.active = true;
    if (this.panels.size === 0 && this.lastInventory) this.reconcile(this.lastInventory);
    if (this.panels.size === 0) return false;
    for (const panel of this.panels.values()) panel.showPanel();
    return true;
  }

  deactivate(): void {
    this.active = false;
    this.lastFocusedId = null;
    for (const panel of this.panels.values()) panel.closePermanently();
    this.panels.clear();
    this.emit('changed');
  }

  /**
   * Moves the selected panel (focused, else most recently focused, else the
   * only visible one) to the next display in screen order, keeping its size
   * and work-area offset. Treated like a manual drag: layout becomes
   * freeform and the new frame is persisted.
   */
  moveSelectedPanelToNextDisplay(): void {
    const panel = this.selectedPanel();
    if (!panel) return;
    const frame = nextDisplayFrame(
      panel.currentFrame,
      screen.getAllDisplays().map((display) => display.workArea),
    );
    if (!frame) return;
    if (this.layout !== 'freeform') {
      this.layout = 'freeform';
      this.freeformFrames.clear();
    }
    panel.setFrame(frame);
    this.persist(panel.currentFrame, panel.widgetId);
  }

  private selectedPanel(): WidgetPanelWindow | null {
    for (const panel of this.panels.values()) {
      if (!panel.isHidden && panel.isFocused()) return panel;
    }
    if (this.lastFocusedId) {
      const remembered = this.panels.get(this.lastFocusedId);
      return remembered && !remembered.isHidden && remembered.isVisible() ? remembered : null;
    }
    const visible = [...this.panels.values()].filter((panel) => !panel.isHidden && panel.isVisible());
    return visible.length === 1 ? visible[0] : null;
  }

  flushPersistedFrames(): void {
    if (!this.framesDirty) return;
    this.framesDirty = false;
    this.settings.save();
  }

  /**
   * Collects unsent state from every panel before the host reloads. Panels
   * that fail to answer make the whole preparation fail so no writes are lost.
   */
  async prepareForDeactivation(): Promise<{ changes: WidgetPanelStateChange[]; prepared: boolean }> {
    this.active = false;
    const results = await Promise.all([...this.panels.values()].map((panel) => panel.takePendingState()));
    const changes = results.map((r) => r.change).filter((c): c is WidgetPanelStateChange => c !== null);
    const prepared = results.every((r) => r.prepared);
    return { changes, prepared };
  }

  arrange(layout: WidgetPanelLayout): void {
    const previous = this.layout;
    this.layout = layout;
    if (layout === 'freeform') {
      this.restoreFreeformFrames();
      this.emit('changed');
      return;
    }

    const panels = this.orderedPanels();
    if (panels.length === 0) return;
    if (previous === 'freeform') {
      this.freeformFrames.clear();
      for (const panel of panels) this.freeformFrames.set(panel.widgetId, panel.currentFrame);
    }

    const workArea = workAreaContaining(panels[0].currentFrame);
    const usable: Rect = {
      x: workArea.x + GAP,
      y: workArea.y + GAP,
      width: Math.max(workArea.width - 24, 1),
      height: Math.max(workArea.height - 24, 1),
    };
    const frames = layoutFrames(
      panels.map((panel) => ({ id: panel.widgetId, size: panel.preferredFrameSize() })),
      layout,
      usable,
    );
    for (const panel of panels) {
      const frame = frames.get(panel.widgetId);
      if (frame) panel.setFrame(clampFrame(frame, workArea));
    }
    this.emit('changed');
  }

  private restoreFreeformFrames(): void {
    for (const panel of this.orderedPanels()) {
      const saved = this.freeformFrames.get(panel.widgetId) ?? this.storedFrame(panel.widgetId);
      const frame = saved
        ? (panel.isResizable ? saved : { x: saved.x, y: saved.y, ...panel.preferredFrameSize() })
        : panel.defaultFrame();
      panel.setFrame(clampFrame(frame, workAreaContaining(frame)));
    }
  }

  private orderedPanels(): WidgetPanelWindow[] {
    if (!this.lastInventory) {
      return [...this.panels.values()].filter((panel) => !panel.isHidden)
        .sort((a, b) => a.widgetId.localeCompare(b.widgetId));
    }
    return this.lastInventory.widgets
      .map((widget) => this.panels.get(widget.id))
      .filter((panel): panel is WidgetPanelWindow => panel !== undefined && !panel.isHidden);
  }

  private makePanel(descriptor: WidgetPanelDescriptor): WidgetPanelWindow {
    const panel = new WidgetPanelWindow(descriptor, this.backgroundOpacity, this.alwaysOnTop, this.appVersion, this.settings);
    panel.setWidgetCreationOptions(this.options);
    panel.getCurrentLayout = () => this.layout;
    panel.on('panelStateChanged', (change: WidgetPanelStateChange) => this.emit('panelStateChanged', change));
    panel.on('randomiserListChanged', (change: unknown) => this.emit('randomiserListChanged', change));
    panel.on('removalRequested', (widgetId: string) => this.emit('widgetRemovalRequested', widgetId));
    panel.on('widgetCreationRequested', (widgetType: number) => this.emit('widgetCreationRequested', widgetType));
    panel.on('displayPreviewRequested', () => this.emit('displayPreviewRequested'));
    panel.on('openSettingsRequested', () => this.emit('openSettingsRequested'));
    panel.on('layoutRequested', (layout: WidgetPanelLayout) => this.arrange(layout));
    panel.on('focused', (widgetId: string) => { this.lastFocusedId = widgetId; });
    panel.on('frameChanged', (widgetId: string, frame: RectFrame) => {
      if (this.layout !== 'freeform') {
        this.layout = 'freeform';
        this.freeformFrames.clear();
      }
      this.persist(frame, widgetId);
    });

    const stored = this.layout === 'freeform' ? this.storedFrame(descriptor.id) : null;
    const initial = stored
      ? (descriptor.isResizable ? stored : { x: stored.x, y: stored.y, ...panel.preferredFrameSize() })
      : this.initialFrame(panel);
    panel.setFrame(clampFrame(initial, workAreaContaining(initial)), true);
    return panel;
  }

  // Places a brand-new panel to the right of the existing ones along the top
  // of the primary work area, wrapping below them when the row is full.
  private initialFrame(panel: WidgetPanelWindow): Rect {
    const usable = { ...primaryWorkArea() };
    usable.x += GAP;
    usable.y += GAP;
    usable.width -= GAP * 2;
    usable.height -= GAP * 2;
    const size = panel.preferredFrameSize();
    const existing = [...this.panels.values()].filter((p) => !p.isHidden).map((p) => p.currentFrame);
    const nextX = (existing.length > 0 ? Math.max(...existing.map((f) => f.x + f.width)) : usable.x - GAP) + GAP;
    if (nextX + size.width <= usable.x + usable.width) {
      return { x: nextX, y: usable.y, width: size.width, height: size.height };
    }
    const nextY = (existing.length > 0 ? Math.max(...existing.map((f) => f.y + f.height)) : usable.y - GAP) + GAP;
    return { x: usable.x, y: nextY, width: size.width, height: size.height };
  }

  private persist(frame: RectFrame, widgetId: string): void {
    this.settings.panelFrames[widgetId] = { left: frame.x, top: frame.y, width: frame.width, height: frame.height };
    this.framesDirty = true;
  }

  private storedFrame(widgetId: string): Rect | null {
    const stored = this.settings.panelFrames[widgetId];
    if (!stored || stored.width <= 0 || stored.height <= 0) return null;
    return { x: stored.left, y: stored.top, width: stored.width, height: stored.height };
  }
}
