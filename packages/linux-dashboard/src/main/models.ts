/**
 * TypeScript port of WidgetPanelModels.cs. Payloads arrive as plain JSON
 * values from the web views; every field is validated before use.
 */

export interface PanelSize {
  width: number;
  height: number;
}

export function clampSize(size: PanelSize): PanelSize {
  return { width: Math.max(size.width, 1), height: Math.max(size.height, 1) };
}

/**
 * A compact widget the teacher app offers, in native menu order. Menus draw a
 * separator wherever `menuGroup` changes and put Display first.
 */
export interface CompactWidgetOption {
  widgetType: number;
  title: string;
  menuGroup: number;
  emoji?: string;
}

export interface WidgetPanelDescriptor {
  id: string;
  title: string;
  preferredContentSize: PanelSize;
  minimumContentSize: PanelSize;
  maximumContentSize: PanelSize | null;
  isResizable: boolean;
  aspectRatio: number | null;
  hidden: boolean;
  revision: number;
  stateRevision: number;
  /** The full inventory payload, retained verbatim for the panel web view. */
  snapshotPayload: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringProp(payload: Record<string, unknown>, name: string): string | null {
  const value = payload[name];
  return typeof value === 'string' ? value : null;
}

function sizeProp(payload: Record<string, unknown>, name: string): PanelSize | null {
  const value = payload[name];
  if (!isRecord(value)) return null;
  const { width, height } = value;
  if (typeof width !== 'number' || !Number.isFinite(width)) return null;
  if (typeof height !== 'number' || !Number.isFinite(height)) return null;
  return { width, height };
}

function intProp(payload: Record<string, unknown>, name: string): number | null {
  const value = payload[name];
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

export function parseDescriptor(payload: unknown): WidgetPanelDescriptor | null {
  if (!isRecord(payload)) return null;
  if (intProp(payload, 'schemaVersion') !== 1) return null;
  const id = stringProp(payload, 'widgetId');
  if (!id) return null;
  const title = stringProp(payload, 'title');
  if (title === null) return null;
  const preferred = sizeProp(payload, 'preferredSize');
  if (!preferred) return null;
  const minimum = sizeProp(payload, 'minimumSize');
  if (!minimum) return null;
  const resizable = payload.isResizable;
  if (typeof resizable !== 'boolean') return null;
  const maintainsAspectRatio = payload.maintainsAspectRatio;
  if (typeof maintainsAspectRatio !== 'boolean') return null;
  if (!('maximumSize' in payload)) return null;

  let maximum: PanelSize | null = null;
  if (isRecord(payload.maximumSize)) {
    maximum = sizeProp(payload, 'maximumSize');
    if (!maximum) return null;
  } else if (payload.maximumSize !== null) {
    return null;
  }

  const revision = intProp(payload, 'revision') ?? 0;
  const stateRevision = intProp(payload, 'stateRevision') ?? 0;

  return {
    id,
    title,
    preferredContentSize: preferred,
    minimumContentSize: minimum,
    maximumContentSize: maximum,
    isResizable: resizable,
    aspectRatio: maintainsAspectRatio && preferred.height > 0 ? preferred.width / preferred.height : null,
    hidden: payload.hidden === true,
    revision,
    stateRevision,
    snapshotPayload: payload,
  };
}

export interface WidgetPanelInventory {
  hostInstanceId: string;
  revision: number;
  widgets: WidgetPanelDescriptor[];
  options: CompactWidgetOption[] | null;
}

export function parseInventory(body: unknown): WidgetPanelInventory | null {
  if (!isRecord(body)) return null;
  if (intProp(body, 'schemaVersion') !== 1) return null;
  const hostValue = body.hostInstanceId;
  if (typeof hostValue !== 'string') return null;
  const hostInstanceId = hostValue.trim();
  if (!hostInstanceId) return null;
  const revision = intProp(body, 'inventoryRevision');
  if (revision === null || revision < 0) return null;
  if (!Array.isArray(body.widgets)) return null;

  const widgets = body.widgets
    .map(parseDescriptor)
    .filter((descriptor): descriptor is WidgetPanelDescriptor => descriptor !== null);

  let options: CompactWidgetOption[] | null = null;
  if (Array.isArray(body.compactWidgetOptions)) {
    const seen = new Set<number>();
    const parsed: CompactWidgetOption[] = [];
    for (const option of body.compactWidgetOptions) {
      if (!isRecord(option)) continue;
      const widgetType = intProp(option, 'widgetType');
      if (widgetType === null) continue;
      const rawTitle = option.title;
      if (typeof rawTitle !== 'string') continue;
      const title = rawTitle.trim();
      if (!title || seen.has(widgetType)) continue;
      seen.add(widgetType);
      const rawGroup = intProp(option, 'menuGroup');
      const menuGroup = rawGroup !== null && rawGroup >= 0 ? rawGroup : 0;
      const emoji = typeof option.emoji === 'string' ? option.emoji.trim() : '';
      parsed.push({ widgetType, title, menuGroup, ...(emoji ? { emoji } : {}) });
    }
    options = parsed;
  }

  return { hostInstanceId, revision, widgets, options };
}

export type WidgetPanelLayout = 'freeform' | 'row' | 'column';

export interface WidgetPanelStateChange {
  widgetId: string;
  payload: Record<string, unknown>;
}
