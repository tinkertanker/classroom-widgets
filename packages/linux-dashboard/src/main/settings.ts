import { app } from 'electron';
import { EventEmitter } from 'node:events';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { log } from './log';
import { readShortenerSettings, ShortenerSettings } from './shortenerSettings';
import { migrateAutostartDesktopEntry } from './startup';

export interface PanelFrame {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface DashboardSettingsData {
  backgroundOpacity: number;
  alwaysOnTop: boolean;
  panelFrames: Record<string, PanelFrame>;
  linkShortener: ShortenerSettings;
  widgetShortcutsInitialized: boolean;
  widgetShortcutMenuOrderApplied?: boolean;
  widgetShortcuts: Record<string, string | null>;
  widgetDismissShortcuts: Record<string, string | null>;
  displayPreviewFrame?: PanelFrame;
  displayPreviewSourceId?: number;
  displayPreviewShortcut?: string | null;
  displayPreviewDismissShortcut?: string | null;
  moveWidgetPreviousShortcut?: string | null;
  moveWidgetNextShortcut?: string | null;
}

/**
 * User preferences persisted as pretty JSON under the Electron userData
 * directory (~/.config/ClassroomWidgets). Panel frames are keyed by widget ID
 * so widgets reopen where they were left. Mirrors DashboardSettings.cs.
 */
export class DashboardSettings extends EventEmitter {
  readonly backgroundOpacityDefault = 1;
  backgroundOpacity = 1;
  alwaysOnTop = true;
  panelFrames: Record<string, PanelFrame> = {};
  linkShortener = readShortenerSettings();
  widgetShortcutsInitialized = false;
  /** Set on the first inventory once default widget shortcuts follow menu order. */
  widgetShortcutMenuOrderApplied = false;
  widgetShortcuts: Record<string, string | null> = {};
  widgetDismissShortcuts: Record<string, string | null> = {};
  displayPreviewFrame?: PanelFrame;
  displayPreviewSourceId?: number;
  displayPreviewShortcut?: string | null;
  displayPreviewDismissShortcut?: string | null;
  moveWidgetPreviousShortcut?: string | null;
  moveWidgetNextShortcut?: string | null;

  get settingsPath(): string {
    return join(app.getPath('userData'), 'settings.json');
  }

  static load(): DashboardSettings {
    const settings = new DashboardSettings();
    try {
      if (existsSync(settings.settingsPath)) {
        const raw = JSON.parse(readFileSync(settings.settingsPath, 'utf8')) as Partial<DashboardSettingsData>;
        if (typeof raw.backgroundOpacity === 'number' && Number.isFinite(raw.backgroundOpacity)) {
          settings.backgroundOpacity = Math.min(1, Math.max(0, raw.backgroundOpacity));
        }
        if (typeof raw.alwaysOnTop === 'boolean') settings.alwaysOnTop = raw.alwaysOnTop;
        settings.linkShortener = readShortenerSettings(raw.linkShortener);
        if (raw.widgetShortcutsInitialized === true) settings.widgetShortcutsInitialized = true;
        if (raw.widgetShortcutMenuOrderApplied === true) settings.widgetShortcutMenuOrderApplied = true;
        if (raw.widgetShortcuts && typeof raw.widgetShortcuts === 'object') {
          for (const [widgetType, shortcut] of Object.entries(raw.widgetShortcuts)) {
            if (/^-?\d+$/.test(widgetType) && (typeof shortcut === 'string' || shortcut === null)) {
              settings.widgetShortcuts[widgetType] = shortcut;
            }
          }
        }
        if (raw.widgetDismissShortcuts && typeof raw.widgetDismissShortcuts === 'object') {
          for (const [widgetType, shortcut] of Object.entries(raw.widgetDismissShortcuts)) {
            if (/^-?\d+$/.test(widgetType) && (typeof shortcut === 'string' || shortcut === null)) {
              settings.widgetDismissShortcuts[widgetType] = shortcut;
            }
          }
        }
        if (raw.panelFrames && typeof raw.panelFrames === 'object') {
          for (const [id, frame] of Object.entries(raw.panelFrames)) {
            if (
              frame && typeof frame === 'object'
              && typeof frame.left === 'number' && typeof frame.top === 'number'
              && typeof frame.width === 'number' && typeof frame.height === 'number'
            ) {
              settings.panelFrames[id] = { left: frame.left, top: frame.top, width: frame.width, height: frame.height };
            }
          }
        }
        if (raw.displayPreviewFrame && typeof raw.displayPreviewFrame === 'object') {
          const frame = raw.displayPreviewFrame;
          if (
            typeof frame.left === 'number' && typeof frame.top === 'number'
            && typeof frame.width === 'number' && typeof frame.height === 'number'
          ) settings.displayPreviewFrame = { left: frame.left, top: frame.top, width: frame.width, height: frame.height };
        }
        if (typeof raw.displayPreviewSourceId === 'number' && Number.isFinite(raw.displayPreviewSourceId)) {
          settings.displayPreviewSourceId = raw.displayPreviewSourceId;
        }
        if (typeof raw.displayPreviewShortcut === 'string' || raw.displayPreviewShortcut === null) settings.displayPreviewShortcut = raw.displayPreviewShortcut;
        if (typeof raw.displayPreviewDismissShortcut === 'string' || raw.displayPreviewDismissShortcut === null) settings.displayPreviewDismissShortcut = raw.displayPreviewDismissShortcut;
        if (typeof raw.moveWidgetPreviousShortcut === 'string' || raw.moveWidgetPreviousShortcut === null) settings.moveWidgetPreviousShortcut = raw.moveWidgetPreviousShortcut;
        if (typeof raw.moveWidgetNextShortcut === 'string' || raw.moveWidgetNextShortcut === null) settings.moveWidgetNextShortcut = raw.moveWidgetNextShortcut;
      }
    } catch (error) {
      log.warn(`Unable to read settings: ${error instanceof Error ? error.message : String(error)}`);
    }
    settings.migrateLaunchAtLoginEntry();
    return settings;
  }

  private migrateLaunchAtLoginEntry(): void {
    if (!existsSync(this.autostartPath)) return;
    try {
      const contents = readFileSync(this.autostartPath, 'utf8');
      const migrated = migrateAutostartDesktopEntry(contents);
      if (migrated !== contents) writeFileSync(this.autostartPath, migrated);
    } catch (error) {
      log.warn(`Unable to update autostart entry: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  save(): void {
    try {
      mkdirSync(dirname(this.settingsPath), { recursive: true });
      const data: DashboardSettingsData = {
        backgroundOpacity: this.backgroundOpacity,
        alwaysOnTop: this.alwaysOnTop,
        panelFrames: this.panelFrames,
        linkShortener: this.linkShortener,
        widgetShortcutsInitialized: this.widgetShortcutsInitialized,
        widgetShortcutMenuOrderApplied: this.widgetShortcutMenuOrderApplied,
        widgetShortcuts: this.widgetShortcuts,
        widgetDismissShortcuts: this.widgetDismissShortcuts,
        displayPreviewFrame: this.displayPreviewFrame,
        displayPreviewSourceId: this.displayPreviewSourceId,
        displayPreviewShortcut: this.displayPreviewShortcut,
        displayPreviewDismissShortcut: this.displayPreviewDismissShortcut,
        moveWidgetPreviousShortcut: this.moveWidgetPreviousShortcut,
        moveWidgetNextShortcut: this.moveWidgetNextShortcut,
      };
      writeFileSync(this.settingsPath, JSON.stringify(data, null, 2));
    } catch (error) {
      log.warn(`Unable to write settings: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  notifyChanged(): void {
    this.save();
    this.emit('changed');
  }

  getDisplayPreviewFrame(): PanelFrame | undefined {
    return this.displayPreviewFrame ? { ...this.displayPreviewFrame } : undefined;
  }

  setDisplayPreviewFrame(frame: PanelFrame): void {
    this.displayPreviewFrame = { ...frame };
    this.save();
  }

  getDisplayPreviewSourceId(): number | null {
    return this.displayPreviewSourceId ?? null;
  }

  setDisplayPreviewSourceId(id: number | null): void {
    this.displayPreviewSourceId = id ?? undefined;
    this.save();
  }

  getDisplayPreviewShortcut(): string | null {
    return this.displayPreviewShortcut ?? null;
  }

  setDisplayPreviewShortcut(shortcut: string | null): void {
    this.displayPreviewShortcut = shortcut;
    this.save();
  }

  setDisplayPreviewDismissShortcut(shortcut: string | null): void {
    this.displayPreviewDismissShortcut = shortcut;
    this.save();
  }

  private get autostartPath(): string {
    const configHome = process.env.XDG_CONFIG_HOME && process.env.XDG_CONFIG_HOME.trim() !== ''
      ? process.env.XDG_CONFIG_HOME
      : join(homedir(), '.config');
    return join(configHome, 'autostart', 'classroom-widgets.desktop');
  }

  get launchAtLoginEnabled(): boolean {
    return existsSync(this.autostartPath);
  }

  set launchAtLoginEnabled(enabled: boolean) {
    if (!enabled) {
      try {
        unlinkSync(this.autostartPath);
      } catch {
        // Already absent.
      }
      return;
    }
    const executable = process.env.APPIMAGE ?? process.execPath;
    const execLine = app.isPackaged
      ? `"${executable}" --background`
      : `"${process.execPath}" "${app.getAppPath()}" --background`;
    const contents = [
      '[Desktop Entry]',
      'Type=Application',
      'Name=Classroom Widgets',
      `Exec=${execLine}`,
      'Icon=classroom-widgets',
      'X-GNOME-Autostart-enabled=true',
      '',
    ].join('\n');
    try {
      mkdirSync(dirname(this.autostartPath), { recursive: true });
      writeFileSync(this.autostartPath, contents);
    } catch (error) {
      log.warn(`Unable to write autostart entry: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
