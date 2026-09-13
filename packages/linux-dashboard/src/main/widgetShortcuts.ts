import { EventEmitter } from 'node:events';
import type { CompactWidgetOption } from './models';
import type { DashboardSettings } from './settings';

export interface ShortcutRegistrar {
  register(accelerator: string, callback: () => void): boolean;
  unregisterAll(): void;
}

export interface WidgetShortcutStatus {
  widgetType: number;
  title: string;
  accelerator: string | null;
  state: 'active' | 'inactive' | 'conflict';
  detail: string;
}

const MODIFIER_ORDER = ['Ctrl', 'Alt', 'Shift', 'Super'] as const;
const MODIFIER_ALIASES: Record<string, typeof MODIFIER_ORDER[number]> = {
  control: 'Ctrl', ctrl: 'Ctrl', alt: 'Alt', option: 'Alt', shift: 'Shift',
  super: 'Super', meta: 'Super', command: 'Super', cmd: 'Super',
};

export function normalizeAccelerator(value: string): string | null {
  const parts = value.split('+').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const modifiers = new Set<typeof MODIFIER_ORDER[number]>();
  let key: string | null = null;
  for (const part of parts) {
    const modifier = MODIFIER_ALIASES[part.toLowerCase()];
    if (modifier) {
      modifiers.add(modifier);
      continue;
    }
    if (key) return null;
    if (/^[a-z0-9]$/i.test(part)) key = part.toUpperCase();
    else if (/^f([1-9]|1[0-9]|2[0-4])$/i.test(part)) key = part.toUpperCase();
    else {
      const namedKey = ['Space', 'Tab', 'Enter', 'Escape', 'Backspace', 'Delete', 'Up', 'Down', 'Left', 'Right', 'Home', 'End', 'PageUp', 'PageDown']
        .find((candidate) => candidate.toLowerCase() === part.toLowerCase());
      if (!namedKey) return null;
      key = namedKey;
    }
  }
  if (!key || modifiers.size === 0) return null;
  return [...MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier)), key].join('+');
}

export class WidgetShortcutController extends EventEmitter {
  private options: CompactWidgetOption[] = [];
  private hostAvailable = false;
  private capturing = false;
  private statuses: WidgetShortcutStatus[] = [];

  constructor(
    private readonly settings: DashboardSettings,
    private readonly registrar: ShortcutRegistrar,
    private readonly launch: (widgetType: number) => void,
  ) {
    super();
  }

  updateOptions(options: CompactWidgetOption[], hostAvailable = true): void {
    this.options = options;
    this.hostAvailable = hostAvailable;
    if (!this.settings.widgetShortcutsInitialized && options.length > 0) {
      options.slice(0, 9).forEach((option, index) => {
        this.settings.widgetShortcuts[String(option.widgetType)] = `Ctrl+Alt+Shift+${index + 1}`;
      });
      this.settings.widgetShortcutsInitialized = true;
      this.settings.notifyChanged();
    }
    this.refresh();
  }

  setCapturing(active: boolean): void {
    if (this.capturing === active) return;
    this.capturing = active;
    this.refresh();
  }

  setHostAvailable(available: boolean): void {
    if (this.hostAvailable === available) return;
    this.hostAvailable = available;
    this.refresh();
  }

  setShortcut(widgetType: number, value: string | null): { ok: boolean; error?: string } {
    if (!this.options.some((option) => option.widgetType === widgetType)) return { ok: false, error: 'Widget is unavailable.' };
    const normalized = value === null ? null : normalizeAccelerator(value);
    if (value !== null && !normalized) return { ok: false, error: 'Use one or more modifiers and a supported key.' };
    if (normalized) {
      const duplicate = Object.entries(this.settings.widgetShortcuts).find(([type, shortcut]) => type !== String(widgetType) && shortcut && normalizeAccelerator(shortcut) === normalized);
      if (duplicate) return { ok: false, error: 'Already assigned to another widget.' };
    }
    this.settings.widgetShortcuts[String(widgetType)] = normalized;
    this.settings.widgetShortcutsInitialized = true;
    this.settings.notifyChanged();
    this.refresh();
    return { ok: true };
  }

  reset(): void {
    if (this.options.length === 0) return;
    this.settings.widgetShortcuts = {};
    this.options.slice(0, 9).forEach((option, index) => {
      this.settings.widgetShortcuts[String(option.widgetType)] = `Ctrl+Alt+Shift+${index + 1}`;
    });
    this.settings.widgetShortcutsInitialized = true;
    this.settings.notifyChanged();
    this.refresh();
  }

  getStatuses(): WidgetShortcutStatus[] {
    return this.statuses;
  }

  unregisterAll(): void {
    this.registrar.unregisterAll();
  }

  private refresh(): void {
    this.registrar.unregisterAll();
    const seen = new Set<string>();
    this.statuses = this.options.map((option) => {
      const stored = this.settings.widgetShortcuts[String(option.widgetType)] ?? null;
      const accelerator = stored && normalizeAccelerator(stored);
      if (!accelerator) return { ...option, accelerator: null, state: 'inactive', detail: 'Not assigned' } as WidgetShortcutStatus;
      if (seen.has(accelerator)) return { ...option, accelerator, state: 'conflict', detail: 'Duplicate assignment' };
      seen.add(accelerator);
      if (!this.hostAvailable || this.capturing) {
        return { ...option, accelerator, state: 'inactive', detail: this.capturing ? 'Paused while recording' : 'Widgets are unavailable' };
      }
      const registered = this.registrar.register(accelerator, () => {
        this.launch(option.widgetType);
      });
      return registered
        ? { ...option, accelerator, state: 'active', detail: 'Active' }
        : { ...option, accelerator, state: 'conflict', detail: 'Unavailable or reserved by another application' };
    });
    this.emit('changed');
  }
}
