import { EventEmitter } from 'node:events';
import type { DisplayPreviewCoordinator } from './displayPreview';
import type { CompactWidgetOption } from './models';
import type { DashboardSettings } from './settings';

export interface ShortcutRegistrar {
  register(accelerator: string, callback: () => void): boolean;
  unregisterAll(): void;
}

export interface ShortcutStatus {
  title: string;
  accelerator: string | null;
  dismissAccelerator: string | null;
  state: 'active' | 'inactive' | 'conflict';
  detail: string;
  dismissState: 'active' | 'inactive' | 'conflict';
  dismissDetail: string;
}

export interface WidgetShortcutStatus extends ShortcutStatus {
  widgetType: number;
}

export type WidgetShortcutAction = 'show' | 'dismiss';
type ShortcutRegistrationState = Pick<WidgetShortcutStatus, 'state' | 'detail'>;

const DISPLAY_DEFAULT = 'Ctrl+Alt+Shift+0';
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
  private displayStatus?: ShortcutStatus;

  constructor(
    private readonly settings: DashboardSettings,
    private readonly registrar: ShortcutRegistrar,
    private readonly launch: (widgetType: number) => void,
    private readonly dismiss: (widgetType: number) => void,
    private readonly toggle: (widgetType: number) => void,
    private readonly displayPreview: Pick<DisplayPreviewCoordinator, 'open' | 'close' | 'isOpen'>,
  ) {
    super();
  }

  updateOptions(options: CompactWidgetOption[], hostAvailable = true): void {
    this.options = options;
    this.hostAvailable = hostAvailable;
    let changed = false;
    const reserved = this.widgetReservations();
    if (this.settings.displayPreviewShortcut === undefined) {
      this.settings.displayPreviewShortcut = reserved.has(DISPLAY_DEFAULT) ? null : DISPLAY_DEFAULT;
      changed = true;
    }
    if (this.settings.displayPreviewDismissShortcut === undefined) {
      this.settings.displayPreviewDismissShortcut = this.settings.displayPreviewShortcut;
      changed = true;
    }
    for (const shortcut of [this.settings.displayPreviewShortcut, this.settings.displayPreviewDismissShortcut]) {
      const normalized = normalizeAccelerator(shortcut ?? '');
      if (normalized) reserved.add(normalized);
    }
    const defaults = Array.from({ length: 9 }, (_, index) => `Ctrl+Alt+Shift+${index + 1}`);
    options.slice(0, 9).forEach((option) => {
      const type = String(option.widgetType);
      if (!Object.hasOwn(this.settings.widgetShortcuts, type)) {
        const shortcut = defaults.find((candidate) => !reserved.has(candidate)) ?? null;
        this.settings.widgetShortcuts[type] = shortcut;
        if (shortcut) reserved.add(shortcut);
        changed = true;
      }
    });
    options.forEach((option) => {
      const type = String(option.widgetType);
      if (!Object.hasOwn(this.settings.widgetDismissShortcuts, type) && Object.hasOwn(this.settings.widgetShortcuts, type)) {
        this.settings.widgetDismissShortcuts[type] = this.settings.widgetShortcuts[type];
        changed = true;
      }
    });
    if (options.length > 0 && !this.settings.widgetShortcutsInitialized) {
      this.settings.widgetShortcutsInitialized = true;
      changed = true;
    }
    if (changed) this.settings.notifyChanged();
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

  setShortcut(widgetType: number, value: string | null, action: WidgetShortcutAction = 'show'): { ok: boolean; error?: string } {
    if (!this.options.some((option) => option.widgetType === widgetType)) return { ok: false, error: 'Widget is unavailable.' };
    const normalized = value === null ? null : normalizeAccelerator(value);
    if (value !== null && !normalized) return { ok: false, error: 'Use one or more modifiers and a supported key.' };
    if (normalized) {
      const duplicate = [this.settings.widgetShortcuts, this.settings.widgetDismissShortcuts].some((bindings) =>
        Object.entries(bindings).some(([type, shortcut]) => {
          if (!shortcut || normalizeAccelerator(shortcut) !== normalized) return false;
          return type !== String(widgetType);
        }))
        || [this.settings.displayPreviewShortcut, this.settings.displayPreviewDismissShortcut]
          .some((shortcut) => normalizeAccelerator(shortcut ?? '') === normalized);
      if (duplicate) return { ok: false, error: 'Already assigned to another widget.' };
    }
    const bindings = action === 'show' ? this.settings.widgetShortcuts : this.settings.widgetDismissShortcuts;
    bindings[String(widgetType)] = normalized;
    this.settings.widgetShortcutsInitialized = true;
    this.settings.notifyChanged();
    this.refresh();
    return { ok: true };
  }

  setDisplayShortcut(value: string | null, action: WidgetShortcutAction = 'show'): { ok: boolean; error?: string } {
    const normalized = value === null ? null : normalizeAccelerator(value);
    if (value !== null && !normalized) return { ok: false, error: 'Use one or more modifiers and a supported key.' };
    if (normalized && this.widgetReservations().has(normalized)) return { ok: false, error: 'Already assigned to another widget.' };
    if (action === 'show') this.settings.displayPreviewShortcut = normalized;
    else this.settings.displayPreviewDismissShortcut = normalized;
    this.settings.notifyChanged();
    this.refresh();
    return { ok: true };
  }

  reset(): void {
    this.settings.displayPreviewShortcut = DISPLAY_DEFAULT;
    this.settings.displayPreviewDismissShortcut = DISPLAY_DEFAULT;
    if (this.options.length === 0) {
      this.settings.notifyChanged();
      this.refresh();
      return;
    }
    this.settings.widgetShortcuts = Object.fromEntries(this.options.map((option) => [String(option.widgetType), null]));
    this.settings.widgetDismissShortcuts = Object.fromEntries(this.options.map((option) => [String(option.widgetType), null]));
    this.options.slice(0, 9).forEach((option, index) => {
      const type = String(option.widgetType);
      const shortcut = `Ctrl+Alt+Shift+${index + 1}`;
      this.settings.widgetShortcuts[type] = shortcut;
      this.settings.widgetDismissShortcuts[type] = shortcut;
    });
    this.settings.widgetShortcutsInitialized = true;
    this.settings.notifyChanged();
    this.refresh();
  }

  getStatuses(): WidgetShortcutStatus[] {
    return this.statuses;
  }

  getDisplayStatus(): ShortcutStatus | undefined {
    return this.displayStatus;
  }

  unregisterAll(): void {
    this.registrar.unregisterAll();
  }

  private widgetReservations(): Set<string> {
    return new Set([this.settings.widgetShortcuts, this.settings.widgetDismissShortcuts]
      .flatMap((bindings) => Object.values(bindings))
      .flatMap((shortcut) => {
        const normalized = normalizeAccelerator(shortcut ?? '');
        return normalized ? [normalized] : [];
      }));
  }

  private refresh(): void {
    this.registrar.unregisterAll();
    const seen = new Set<string>();
    const registerPair = (
      accelerator: string | null,
      dismissAccelerator: string | null,
      actions: Record<WidgetShortcutAction | 'toggle', () => void>,
      unavailableDetail: string | null,
      reserved = new Set<string>(),
    ) => {
      const register = (assigned: string | null, callback: () => void, toggles = false): ShortcutRegistrationState => {
        if (!assigned) return { state: 'inactive', detail: 'Not assigned' };
        if (unavailableDetail) return { state: 'inactive', detail: unavailableDetail };
        const registered = !seen.has(assigned) && !reserved.has(assigned) && this.registrar.register(assigned, callback);
        seen.add(assigned);
        return registered
          ? { state: 'active', detail: toggles ? 'Active — toggles this widget' : 'Active' }
          : { state: 'conflict', detail: 'Unavailable or reserved by another application' };
      };
      const same = accelerator !== null && accelerator === dismissAccelerator;
      const showStatus = register(accelerator, same ? actions.toggle : actions.show, same);
      const dismissStatus = same ? showStatus : register(dismissAccelerator, actions.dismiss);
      return {
        accelerator,
        dismissAccelerator,
        state: showStatus.state,
        detail: showStatus.detail,
        dismissState: dismissStatus.state,
        dismissDetail: dismissStatus.detail,
      };
    };
    this.statuses = this.options.map((option) => {
      const type = String(option.widgetType);
      return {
        ...option,
        ...registerPair(
          normalizeAccelerator(this.settings.widgetShortcuts[type] ?? ''),
          normalizeAccelerator(this.settings.widgetDismissShortcuts[type] ?? ''),
          { show: () => this.launch(option.widgetType), dismiss: () => this.dismiss(option.widgetType), toggle: () => this.toggle(option.widgetType) },
          this.capturing ? 'Paused while recording' : this.hostAvailable ? null : 'Widgets are unavailable',
        ),
      };
    });
    this.displayStatus = {
      title: 'Display',
      ...registerPair(
        normalizeAccelerator(this.settings.displayPreviewShortcut ?? ''),
        normalizeAccelerator(this.settings.displayPreviewDismissShortcut ?? ''),
        {
          show: () => this.displayPreview.open(),
          dismiss: () => this.displayPreview.close(),
          toggle: () => this.displayPreview.isOpen ? this.displayPreview.close() : this.displayPreview.open(),
        },
        this.capturing ? 'Paused while recording' : null,
        this.widgetReservations(),
      ),
    };
    this.emit('changed');
  }
}
