import { app, Menu, MenuItemConstructorOptions, nativeImage, shell, Tray } from 'electron';
import { join } from 'node:path';
import { log } from './log';
import { WidgetHostController } from './hostController';
import { DashboardSettings } from './settings';
import { openSettingsWindow } from './settingsWindow';
import { WidgetPanelLayout } from './models';
import { ShortcutStatus, WidgetShortcutController } from './widgetShortcuts';
import { widgetMenuItems } from './widgetMenu';

const FULL_WEB_APP_URL = 'https://widgets.tk.sg';
const ABOUT_URL = 'https://github.com/tinkertanker/classroom-widgets';

/**
 * The system tray icon and its context menu: the only always-available UI,
 * mirroring the macOS menu bar item.
 */
export class TrayController {
  private readonly tray: Tray;
  private readonly host: WidgetHostController;
  private readonly settings: DashboardSettings;
  private readonly shortcuts: WidgetShortcutController;
  private readonly appVersion: string;
  private readonly onOpenLauncher: () => void;
  private readonly onCheckForUpdates: () => void;
  private readonly onQuit: () => void;
  private readonly onDisplayPreview: () => void;

  constructor(host: WidgetHostController, settings: DashboardSettings, shortcuts: WidgetShortcutController, appVersion: string, onOpenLauncher: () => void, onCheckForUpdates: () => void, onQuit: () => void, onDisplayPreview: () => void = () => {}) {
    this.host = host;
    this.settings = settings;
    this.shortcuts = shortcuts;
    this.appVersion = appVersion;
    this.onOpenLauncher = onOpenLauncher;
    this.onCheckForUpdates = onCheckForUpdates;
    this.onQuit = onQuit;
    this.onDisplayPreview = onDisplayPreview;

    const iconPath = join(app.getAppPath(), 'assets', 'tray-icon.png');
    this.tray = new Tray(nativeImage.createFromPath(iconPath));
    this.tray.setToolTip('Classroom Widgets');
    this.tray.on('click', () => this.tray.popUpContextMenu());

    this.rebuildMenu();
    this.host.on('widgetOptionsChanged', () => this.rebuildMenu());
    this.host.panelCoordinator.on('changed', () => this.rebuildMenu());
    this.shortcuts.on('changed', () => this.rebuildMenu());
  }

  rebuildMenu(): void {
    const coordinator = this.host.panelCoordinator;
    // Hint each assigned Show chord unless another application holds it.
    const hint = (status: ShortcutStatus | undefined) => (status && status.state !== 'conflict' ? status.accelerator : null);
    const showAccelerators = new Map(this.shortcuts.getStatuses().map((status) => [status.widgetType, hint(status)]));

    const layoutItem = (label: string, layout: WidgetPanelLayout): MenuItemConstructorOptions => ({
      label,
      type: 'radio',
      checked: coordinator.currentLayout === layout,
      click: () => coordinator.arrange(layout),
    });

    const template: MenuItemConstructorOptions[] = [
      ...widgetMenuItems(this.host.widgetOptions, {
        openDisplay: () => this.onDisplayPreview(),
        addWidget: (widgetType) => void this.host.addWidget(widgetType),
        displayAccelerator: hint(this.shortcuts.getDisplayStatus()),
        widgetAccelerator: (widgetType) => showAccelerators.get(widgetType) ?? null,
      }),
      { type: 'separator' },
      {
        label: 'Arrange Widgets',
        enabled: coordinator.hasVisiblePanels,
        submenu: [
          layoutItem('Free Placement', 'freeform'),
          layoutItem('Arrange in a Row', 'row'),
          layoutItem('Arrange in a Column', 'column'),
        ],
      },
      { label: 'Open Widget Launcher', click: () => this.onOpenLauncher() },
      { type: 'separator' },
      { label: 'Settings…', click: () => openSettingsWindow(this.settings, this.shortcuts, this.appVersion) },
      {
        label: 'Launch at Login',
        type: 'checkbox',
        checked: this.settings.launchAtLoginEnabled,
        click: (item) => {
          this.settings.launchAtLoginEnabled = item.checked;
          this.rebuildMenu();
        },
      },
      { type: 'separator' },
      { label: 'Check for Updates…', click: () => this.onCheckForUpdates() },
      { label: 'Reload Widgets', click: () => void this.host.reloadWidgets() },
      { label: `About Classroom Widgets (v${this.appVersion})`, click: () => void openUrl(ABOUT_URL) },
      { label: 'Open Full Web App', click: () => void openUrl(FULL_WEB_APP_URL) },
      { type: 'separator' },
      { label: 'Quit Classroom Widgets', click: () => this.onQuit() },
    ];

    this.tray.setContextMenu(Menu.buildFromTemplate(template));
  }

  destroy(): void {
    this.tray.destroy();
  }
}

async function openUrl(url: string): Promise<void> {
  try {
    await shell.openExternal(url);
  } catch (error) {
    log.warn(`Unable to open ${url}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
