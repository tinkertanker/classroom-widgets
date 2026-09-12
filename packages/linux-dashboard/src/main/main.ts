import { app, session } from 'electron';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { installProtocolHandler, registerPrivilegedScheme } from './appProtocol';
import { WidgetHostController } from './hostController';
import { log } from './log';
import { DashboardSettings } from './settings';
import { TrayController } from './tray';

app.setName('ClassroomWidgets');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  process.stderr.write('Another instance is already running; exiting\n');
  app.quit();
} else {
  bootstrap();
}

function readAppVersion(): string {
  try {
    const raw = JSON.parse(readFileSync(join(app.getAppPath(), 'version.json'), 'utf8')) as { version?: unknown };
    if (typeof raw.version === 'string' && raw.version) return raw.version;
  } catch {
    // Fall through to package metadata.
  }
  return app.getVersion();
}

function bootstrap(): void {
  const version = readAppVersion();

  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
  const debugPort = Number.parseInt(process.env.CLASSROOM_WIDGETS_DEBUG_PORT ?? '', 10);
  if (Number.isInteger(debugPort) && debugPort > 0) {
    app.commandLine.appendSwitch('remote-debugging-port', String(debugPort));
  }
  registerPrivilegedScheme();

  process.on('uncaughtException', (error) => log.error(`Unhandled exception: ${error.stack ?? error.message}`));
  process.on('unhandledRejection', (reason) => log.error(`Unhandled rejection: ${reason instanceof Error ? reason.stack ?? reason.message : String(reason)}`));

  let settings: DashboardSettings | null = null;
  let host: WidgetHostController | null = null;
  let tray: TrayController | null = null;
  let shuttingDown = false;
  let terminationPrepared = false;

  const requestQuit = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
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
    host = new WidgetHostController(settings, version);
    settings.on('changed', () => host?.applySettings());
    host.applySettings();

    tray = new TrayController(host, settings, version, () => void requestQuit());
    void host.start();
  });

  app.on('will-quit', () => {
    tray?.destroy();
    log.info('Classroom Widgets exited');
  });
}
