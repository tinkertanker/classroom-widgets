import { app, globalShortcut, screen, session, desktopCapturer } from 'electron';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { installProtocolHandler, registerPrivilegedScheme } from './appProtocol';
import { WidgetHostController } from './hostController';
import { LauncherWindow } from './launcherWindow';
import { log } from './log';
import { DashboardSettings } from './settings';
import { DisplayCatalog } from './displayCatalog';
import { DisplayPreviewCoordinator } from './displayPreview';
import { appImageUpdateRelaunchDelay, isBackgroundLaunch, relaunchExecutable, x11RelaunchArguments } from './startup';
import { TrayController } from './tray';
import { openSettingsWindow } from './settingsWindow';
import { UpdateController } from './updateController';
import { WidgetShortcutController } from './widgetShortcuts';

const relaunchArguments = x11RelaunchArguments(process.platform, process.env, process.argv);
if (relaunchArguments) {
  app.relaunch({ args: relaunchArguments, execPath: relaunchExecutable(process.env, process.execPath) });
  const appImage = process.env.APPIMAGE?.trim();
  let delay = 0;
  if (appImage) {
    try {
      delay = appImageUpdateRelaunchDelay(process.env, readdirSync(dirname(appImage)));
    } catch {
      // The update backup is only a compatibility signal; relaunch normally if its directory is unavailable.
    }
  }
  if (delay > 0) setTimeout(() => app.exit(0), delay);
  else app.exit(0);
} else {
  launch();
}

function launch(): void {
  app.setName('ClassroomWidgets');

  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    process.stderr.write('Another instance is already running; exiting\n');
    app.quit();
  } else {
    bootstrap();
  }
}

// Packaged builds get the version via electron-builder extraMetadata; dev runs read the repo-root version.json.
function readAppVersion(): string {
  if (app.isPackaged) return app.getVersion();
  try {
    const raw = JSON.parse(readFileSync(join(app.getAppPath(), '..', '..', 'version.json'), 'utf8')) as { version?: unknown };
    if (typeof raw.version === 'string' && raw.version) return raw.version;
  } catch {
    // Fall through to package metadata.
  }
  return app.getVersion();
}

function bootstrap(): void {
  const version = readAppVersion();

  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
  if (process.platform === 'linux') app.commandLine.appendSwitch('enable-features', 'GlobalShortcutsPortal');
  const debugPort = Number.parseInt(process.env.CLASSROOM_WIDGETS_DEBUG_PORT ?? '', 10);
  if (Number.isInteger(debugPort) && debugPort > 0) {
    app.commandLine.appendSwitch('remote-debugging-port', String(debugPort));
  }
  registerPrivilegedScheme();

  process.on('uncaughtException', (error) => log.error(`Unhandled exception: ${error.stack ?? error.message}`));
  process.on('unhandledRejection', (reason) => log.error(`Unhandled rejection: ${reason instanceof Error ? reason.stack ?? reason.message : String(reason)}`));

  let settings: DashboardSettings | null = null;
  let host: WidgetHostController | null = null;
  let launcher: LauncherWindow | null = null;
  let tray: TrayController | null = null;
  let updates: UpdateController | null = null;
  let shortcuts: WidgetShortcutController | null = null;
  let displayPreview: DisplayPreviewCoordinator | null = null;
  let shuttingDown = false;
  let terminationPrepared = false;
  let launcherRequested = !isBackgroundLaunch(process.argv);

  const openLauncher = (): void => {
    if (!host || host.widgetOptions.length === 0) {
      launcherRequested = true;
      return;
    }
    launcherRequested = false;
    launcher?.show();
  };

  app.on('second-instance', (_event, commandLine) => {
    if (!isBackgroundLaunch(commandLine)) openLauncher();
  });
  app.on('activate', () => openLauncher());

  const requestQuit = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    displayPreview?.shutdown();
    host?.markShuttingDown();
    if (host && !terminationPrepared) {
      terminationPrepared = await host.prepareForTermination();
      if (!terminationPrepared) log.warn('Some widget state could not be flushed before quitting');
    }
    host?.panelCoordinator.deactivate();
    settings?.save();
    // Chromium commits localStorage lazily; force the host store to disk.
    try {
      await Promise.race([
        session.defaultSession.flushStorageData(),
        new Promise<void>((resolve) => setTimeout(resolve, 1000)),
      ]);
    } catch (error) {
      log.warn(`Storage flush before quit failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    app.quit();
  };

  process.on('SIGTERM', () => void requestQuit());
  process.on('SIGINT', () => void requestQuit());

  app.on('window-all-closed', () => {
    // Tray app: panels may all be closed; keep running.
  });

  app.on('before-quit', () => {
    shuttingDown = true;
    displayPreview?.shutdown();
    host?.markShuttingDown();
    host?.panelCoordinator.flushPersistedFrames();
    // Panels must not preventDefault the close events that quit triggers.
    host?.panelCoordinator.deactivate();
    settings?.save();
  });

  void app.whenReady().then(() => {
    installProtocolHandler();
    log.info(`Classroom Widgets ${version} starting`);

    settings = DashboardSettings.load();
    const displayCatalog = new DisplayCatalog(screen);
    displayPreview = new DisplayPreviewCoordinator(settings, displayCatalog, { desktopCapturer, screen });
    host = new WidgetHostController(settings, version);
    launcher = new LauncherWindow(version, (widgetType) => {
      if (host?.widgetOptions.some((option) => option.widgetType === widgetType)) {
        void host.addWidget(widgetType);
      }
    });
    shortcuts = new WidgetShortcutController(
      settings,
      globalShortcut,
      (widgetType) => void host?.addWidget(widgetType),
      (widgetType) => void host?.dismissWidget(widgetType),
      (widgetType) => void host?.toggleWidget(widgetType),
      displayPreview,
    );
    shortcuts.updateOptions([], false);
    host.panelCoordinator.on('displayPreviewRequested', () => displayPreview?.open());
    host.on('openSettingsRequested', () => openSettingsWindow(settings!, shortcuts!, version));
    host.on('widgetOptionsChanged', () => {
      shortcuts?.updateOptions(host?.widgetOptions ?? []);
      if (launcherRequested) openLauncher();
    });
    host.on('hostAvailabilityChanged', (available: boolean) => shortcuts?.setHostAvailable(available));
    settings.on('changed', () => host?.applySettings());
    host.applySettings();

    updates = new UpdateController(version, () => void requestQuit());
    tray = new TrayController(host, settings, shortcuts, version, openLauncher, () => void updates?.check(true), () => void requestQuit(), () => displayPreview?.open());
    void host.start();
    setTimeout(() => void updates?.check(), 10_000);
  });

  app.on('will-quit', () => {
    shortcuts?.unregisterAll();
    tray?.destroy();
    log.info('Classroom Widgets exited');
  });
}
