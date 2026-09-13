import { app } from 'electron';
import { EventEmitter } from 'node:events';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { log } from './log';

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
  widgetShortcutsInitialized: boolean;
  widgetShortcuts: Record<string, string | null>;
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
  widgetShortcutsInitialized = false;
  widgetShortcuts: Record<string, string | null> = {};

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
        if (raw.widgetShortcutsInitialized === true) settings.widgetShortcutsInitialized = true;
        if (raw.widgetShortcuts && typeof raw.widgetShortcuts === 'object') {
          for (const [widgetType, shortcut] of Object.entries(raw.widgetShortcuts)) {
            if (/^-?\d+$/.test(widgetType) && (typeof shortcut === 'string' || shortcut === null)) {
              settings.widgetShortcuts[widgetType] = shortcut;
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
      }
    } catch (error) {
      log.warn(`Unable to read settings: ${error instanceof Error ? error.message : String(error)}`);
    }
    return settings;
  }

  save(): void {
    try {
      mkdirSync(dirname(this.settingsPath), { recursive: true });
      const data: DashboardSettingsData = {
        backgroundOpacity: this.backgroundOpacity,
        alwaysOnTop: this.alwaysOnTop,
        panelFrames: this.panelFrames,
        widgetShortcutsInitialized: this.widgetShortcutsInitialized,
        widgetShortcuts: this.widgetShortcuts,
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
      ? `"${executable}"`
      : `"${process.execPath}" "${app.getAppPath()}"`;
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
