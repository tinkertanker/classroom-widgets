import { app } from 'electron';
import { EventEmitter } from 'node:events';
import { closeSync, existsSync, fchmodSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { log } from './log';
import { readShortenerSettings, ShortenerSettings } from './shortenerSettings';
import { migrateAutostartDesktopEntry } from './startup';
import { desktopHostScripts, OUTPUT_VOLUME_PRESETS } from './generated/desktopHostScripts';

export const outputVolumePresets = OUTPUT_VOLUME_PRESETS;

export function outputVolumeLabel(volume: number): string {
  return outputVolumePresets.find(preset => preset.volume === volume)?.label ?? 'Custom';
}

export interface PanelFrame {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface DashboardSettingsData {
  backgroundOpacity: number;
  outputVolume: number;
  alwaysOnTop: boolean;
  displayPreviewShowOnReconnect?: boolean;
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

function readShortcutMap(raw: unknown, target: Record<string, string | null>): void {
  if (!raw || typeof raw !== 'object') return;
  for (const [widgetType, shortcut] of Object.entries(raw)) {
    if (/^-?\d+$/.test(widgetType) && (typeof shortcut === 'string' || shortcut === null)) {
      target[widgetType] = shortcut;
    }
  }
}

function readFrame(frame: unknown): PanelFrame | null {
  if (!frame || typeof frame !== 'object') return null;
  const { left, top, width, height } = frame as Record<string, unknown>;
  if (typeof left !== 'number' || typeof top !== 'number' || typeof width !== 'number' || typeof height !== 'number') return null;
  return { left, top, width, height };
}

/**
 * User preferences persisted as pretty JSON under the Electron userData
 * directory (~/.config/ClassroomWidgets). Panel frames are keyed by widget ID
 * so widgets reopen where they were left. Mirrors DashboardSettings.cs.
 */
export class DashboardSettings extends EventEmitter {
  backgroundOpacity = 1;
  outputVolume = 1;
  alwaysOnTop = true;
  /** Reopen Display when a monitor returns after a disconnect hid it. */
  displayPreviewShowOnReconnect = true;
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
  private pendingChange: ReturnType<typeof setTimeout> | null = null;
  /** Set when settings.json exists but could not be read and is still in place: saving would destroy it. */
  private keepUnreadableFile = false;

  get settingsPath(): string {
    return join(app.getPath('userData'), 'settings.json');
  }

  static load(): DashboardSettings {
    const settings = new DashboardSettings();
    try {
      const raw = settings.readDocument();
      if (raw) {
        if (typeof raw.backgroundOpacity === 'number' && Number.isFinite(raw.backgroundOpacity)) {
          settings.backgroundOpacity = Math.min(1, Math.max(0, raw.backgroundOpacity));
        }
        if (typeof raw.outputVolume === 'number' && Number.isFinite(raw.outputVolume)) {
          settings.outputVolume = Math.min(1, Math.max(0, raw.outputVolume));
        }
        if (typeof raw.alwaysOnTop === 'boolean') settings.alwaysOnTop = raw.alwaysOnTop;
        if (typeof raw.displayPreviewShowOnReconnect === 'boolean') settings.displayPreviewShowOnReconnect = raw.displayPreviewShowOnReconnect;
        settings.linkShortener = readShortenerSettings(raw.linkShortener);
        if (raw.widgetShortcutsInitialized === true) settings.widgetShortcutsInitialized = true;
        if (raw.widgetShortcutMenuOrderApplied === true) settings.widgetShortcutMenuOrderApplied = true;
        readShortcutMap(raw.widgetShortcuts, settings.widgetShortcuts);
        readShortcutMap(raw.widgetDismissShortcuts, settings.widgetDismissShortcuts);
        if (raw.panelFrames && typeof raw.panelFrames === 'object') {
          for (const [id, frame] of Object.entries(raw.panelFrames)) {
            const parsed = readFrame(frame);
            if (parsed) settings.panelFrames[id] = parsed;
          }
        }
        const displayPreviewFrame = readFrame(raw.displayPreviewFrame);
        if (displayPreviewFrame) settings.displayPreviewFrame = displayPreviewFrame;
        if (typeof raw.displayPreviewSourceId === 'number' && Number.isFinite(raw.displayPreviewSourceId)) {
          settings.displayPreviewSourceId = raw.displayPreviewSourceId;
        }
        for (const key of ['displayPreviewShortcut', 'displayPreviewDismissShortcut', 'moveWidgetPreviousShortcut', 'moveWidgetNextShortcut'] as const) {
          const value = raw[key];
          if (typeof value === 'string' || value === null) settings[key] = value;
        }
      }
    } catch (error) {
      log.warn(`Unable to read settings: ${error instanceof Error ? error.message : String(error)}`);
    }
    settings.migrateLaunchAtLoginEntry();
    return settings;
  }

  /**
   * Reads settings.json. A file that cannot be parsed is moved aside, so the
   * next save cannot overwrite what the teacher may still want to recover.
   */
  private readDocument(): Partial<DashboardSettingsData> | null {
    let text: string;
    try {
      text = readFileSync(this.settingsPath, 'utf8');
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') return null;
      if (code === 'EACCES' || code === 'EPERM' || code === 'EISDIR') {
        // Never readable by us (for example owned by root): keep a copy
        // rather than letting the first save replace it.
        this.moveAside(error);
      } else {
        // Possibly temporary (a network home still mounting): leave it where
        // it is and do not save over it, so the next launch can read it.
        this.keepUnreadableFile = true;
        log.warn(`Unable to read settings, so changes will not be saved this session: ${error instanceof Error ? error.message : String(error)}`);
      }
      return null;
    }
    try {
      const raw: unknown = JSON.parse(text);
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Partial<DashboardSettingsData>;
      throw new Error('settings.json is not a JSON object');
    } catch (error) {
      this.moveAside(error);
      return null;
    }
  }

  private moveAside(reason: unknown): void {
    const aside = `${this.settingsPath}.corrupt-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const detail = reason instanceof Error ? reason.message : String(reason);
    try {
      renameSync(this.settingsPath, aside);
      log.warn(`Unreadable settings moved to ${aside}; using defaults: ${detail}`);
    } catch (renameError) {
      // It could not be kept elsewhere, so never write over it this session.
      this.keepUnreadableFile = true;
      log.warn(`Unreadable settings could not be moved aside, so changes will not be saved this session (${detail}): ${renameError instanceof Error ? renameError.message : String(renameError)}`);
    }
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
    if (this.keepUnreadableFile) return;
    try {
      mkdirSync(dirname(this.settingsPath), { recursive: true });
      const data: DashboardSettingsData = {
        backgroundOpacity: this.backgroundOpacity,
        outputVolume: this.outputVolume,
        alwaysOnTop: this.alwaysOnTop,
        displayPreviewShowOnReconnect: this.displayPreviewShowOnReconnect,
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
      writeFileAtomically(this.settingsPath, JSON.stringify(data, null, 2));
    } catch (error) {
      log.warn(`Unable to write settings: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  notifyChanged(changedSetting?: 'outputVolume' | 'launchAtLogin'): void {
    this.cancelPendingChange();
    this.save();
    this.emit('changed', changedSetting);
  }

  /** Saves and emits `changed` once no further call arrives for `delayMs`. */
  notifyChangedSoon(delayMs: number): void {
    this.cancelPendingChange();
    this.pendingChange = setTimeout(() => {
      this.pendingChange = null;
      this.notifyChanged();
    }, delayMs);
  }

  /** Runs a change scheduled by notifyChangedSoon now, if there is one. */
  flushPendingChange(): void {
    if (this.pendingChange) this.notifyChanged();
  }

  /** Drops a change scheduled by notifyChangedSoon; its values stay in memory for the next save. */
  cancelPendingChange(): void {
    if (!this.pendingChange) return;
    clearTimeout(this.pendingChange);
    this.pendingChange = null;
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

/**
 * Writes a sibling temporary file and renames it over `path`, so a crash or
 * kill mid-write leaves either the old or the new document, never a partial
 * one, which is what a killed or crashed app needs. There is no fsync, because
 * saves run on the main thread and Display drags save often; ext4 flushes a
 * file replaced by rename, but on other filesystems a power cut just after a
 * save can still leave an empty file, which the next launch moves aside. The file is private to the user: it can hold a Short.io API key.
 */
function writeFileAtomically(path: string, contents: string): void {
  const temporary = `${path}.tmp`;
  try {
    const fd = openSync(temporary, 'w', 0o600);
    try {
      try {
        // The mode above only applies when the file is created.
        fchmodSync(fd, 0o600);
      } catch {
        // Some filesystems (vfat, some network homes) refuse chmod; still save.
      }
      writeFileSync(fd, contents);
    } finally {
      closeSync(fd);
    }
    renameSync(temporary, path);
  } catch (error) {
    try {
      rmSync(temporary, { force: true });
    } catch {
      // Report the write failure, not the cleanup.
    }
    throw error;
  }
}

export function audioSettingsScript(outputVolume: number): string {
  const volume = Math.min(1, Math.max(0, outputVolume));
  return desktopHostScripts.audioVolume(JSON.stringify(volume));
}
