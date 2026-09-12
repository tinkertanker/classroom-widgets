import { BrowserWindow } from 'electron';
import { EventEmitter } from 'node:events';
import { buildUrl } from './appProtocol';
import { log } from './log';
import {
  CompactWidgetOption,
  parseInventory,
  WidgetPanelInventory,
  WidgetPanelStateChange,
} from './models';
import { HostWriteTracker } from './hostWriteTracker';
import { registerNativeMessages } from './nativeMessages';
import { bridgePreloadPath } from './panelWindow';
import { WidgetPanelCoordinator } from './panelCoordinator';
import { DashboardSettings } from './settings';
import { configureWebContents, evaluateBool } from './webContentsSetup';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function raceTimeout<T>(promise: Promise<T>, ms: number): Promise<T | 'timeout'> {
  return Promise.race([promise, delay(ms).then(() => 'timeout' as const)]);
}

/**
 * Owns the authoritative React/Zustand widget store inside a hidden
 * BrowserWindow without presenting it. Visible widgets are created only by
 * the WidgetPanelCoordinator in response to host inventories.
 */
export class WidgetHostController extends EventEmitter {
  private readonly settings: DashboardSettings;
  private readonly coordinator: WidgetPanelCoordinator;
  private readonly hostWrites = new HostWriteTracker();
  private readonly window: BrowserWindow;
  private pendingRecoveryChanges: WidgetPanelStateChange[] | null = null;
  private reloadInProgress = false;
  private initialized = false;

  widgetOptions: CompactWidgetOption[] = [];

  constructor(settings: DashboardSettings, appVersion: string) {
    super();
    this.settings = settings;
    this.coordinator = new WidgetPanelCoordinator(settings, appVersion);
    this.coordinator.on('panelStateChanged', (change: WidgetPanelStateChange) => void this.applyPanelStateChange(change));
    this.coordinator.on('randomiserListChanged', (change: unknown) => void this.applyRandomiserListChange(change));
    this.coordinator.on('widgetCreationRequested', (widgetType: number) => void this.addWidget(widgetType));
    this.coordinator.on('widgetRemovalRequested', (widgetId: string) => void this.removeWidget(widgetId));

    this.window = new BrowserWindow({
      show: false,
      width: 1280,
      height: 800,
      skipTaskbar: true,
      webPreferences: {
        preload: bridgePreloadPath(),
        contextIsolation: true,
        sandbox: false,
        nodeIntegration: false,
        additionalArguments: [`--classroom-app-version=${appVersion}`],
      },
    });
    // Tray app: the host window is never shown; only allow real destruction
    // while shutting down.
    this.window.on('close', (event) => {
      if (this.shuttingDown) return;
      event.preventDefault();
    });

    configureWebContents(this.window.webContents);
    registerNativeMessages(this.window.webContents, (message) => this.handleHostMessage(message));
    this.window.webContents.on('render-process-gone', (_event, details) => {
      if (details.reason === 'clean-exit') return;
      log.error(`Widget host process gone (${details.reason}); reloading`);
      void this.recoverFromHostFailure();
    });
  }

  private shuttingDown = false;

  markShuttingDown(): void {
    this.shuttingDown = true;
  }

  get panelCoordinator(): WidgetPanelCoordinator {
    return this.coordinator;
  }

  async start(): Promise<void> {
    this.initialized = true;
    this.loadHost();
  }

  applySettings(): void {
    this.coordinator.applyPresentationSettings(this.settings.backgroundOpacity, this.settings.alwaysOnTop);
    if (this.initialized) {
      void evaluateBool(
        this.window.webContents,
        `window.classroomDashboard?.setBackgroundOpacity?.(${JSON.stringify(this.settings.backgroundOpacity)})`,
      );
    }
  }

  async addWidget(widgetType: number): Promise<void> {
    if (!this.initialized) return;
    const applied = await evaluateBool(
      this.window.webContents,
      `(() => { const host = window.classroomPanelHost; return host?.addWidget ? host.addWidget(${JSON.stringify(widgetType)}) : false; })()`,
    );
    if (!applied) log.warn(`Host refused to add widget type ${widgetType}`);
  }

  async reloadWidgets(): Promise<void> {
    if (this.reloadInProgress || !this.initialized) return;
    this.reloadInProgress = true;
    const { changes, prepared } = await this.coordinator.prepareForDeactivation();
    if (!prepared) {
      this.resumeAfterFailedDeactivation();
      return;
    }
    if (!await this.applyFinalPanelStateChanges(changes)) {
      this.resumeAfterFailedDeactivation();
      return;
    }
    this.coordinator.deactivate();
    this.hostWrites.reset();
    this.loadHost();
  }

  /**
   * Flushes any pending panel writes into the host store so the web app can
   * persist them before the process exits. Returns false when a write could
   * not be confirmed within the time budget.
   */
  async prepareForTermination(): Promise<boolean> {
    this.coordinator.flushPersistedFrames();
    if (!this.initialized || this.reloadInProgress) return !this.initialized;
    this.reloadInProgress = true;

    const preparation = await raceTimeout(this.coordinator.prepareForDeactivation(), 2000);
    if (preparation === 'timeout') {
      this.resumeAfterFailedDeactivation();
      return false;
    }
    if (!preparation.prepared) {
      this.resumeAfterFailedDeactivation();
      return false;
    }

    for (let attempt = 0; attempt <= 20; attempt++) {
      const apply = this.applyFinalPanelStateChanges(preparation.changes);
      const result = await raceTimeout(apply, 1000);
      if (result !== 'timeout' && result === true) {
        this.coordinator.deactivate();
        return true;
      }
      await delay(150);
    }
    this.resumeAfterFailedDeactivation();
    return false;
  }

  private resumeAfterFailedDeactivation(): void {
    this.hostWrites.acknowledgeFailure();
    this.reloadInProgress = false;
    this.coordinator.deactivate();
    this.coordinator.activate();
  }

  private loadHost(): void {
    const url = buildUrl({
      dashboard: '1',
      visible: '0',
      mode: 'compact',
      backgroundOpacity: String(this.settings.backgroundOpacity),
    });
    void this.window.webContents.loadURL(url);
  }

  private handleHostMessage(body: Record<string, unknown>): void {
    if (body.handler !== 'classroomDashboard') return;
    if (body.type !== 'widget-panels-changed') return;

    const inventory = parseInventory(body);
    if (!inventory) {
      log.warn('Ignoring malformed widget inventory');
      return;
    }
    this.reconcileWidgetPanels(inventory);
  }

  /**
   * Panels outlive a crashed host, so their unsent edits are collected first
   * and replayed once the replacement host publishes its inventory.
   */
  private async recoverFromHostFailure(): Promise<void> {
    if (this.reloadInProgress) {
      this.hostWrites.reset();
      this.loadHost();
      return;
    }
    this.reloadInProgress = true;
    const { changes } = await this.coordinator.prepareForDeactivation();
    this.hostWrites.reset();
    this.pendingRecoveryChanges = changes;
    this.coordinator.deactivate();
    this.loadHost();
  }

  private reconcileWidgetPanels(inventory: WidgetPanelInventory): void {
    if (!this.coordinator.reconcile(inventory)) return;
    if (inventory.options && !optionsEqual(inventory.options, this.widgetOptions)) {
      this.widgetOptions = inventory.options;
      this.coordinator.setWidgetCreationOptions(inventory.options);
      this.emit('widgetOptionsChanged');
    }
    if (this.pendingRecoveryChanges) {
      const recovery = this.pendingRecoveryChanges;
      this.pendingRecoveryChanges = null;
      const widgetIds = new Set(inventory.widgets.map((widget) => widget.id));
      void this.finishRecovery(recovery.filter((change) => widgetIds.has(change.widgetId)));
      return;
    }
    this.reloadInProgress = false;
    this.coordinator.activate();
  }

  private async finishRecovery(changes: WidgetPanelStateChange[]): Promise<void> {
    for (let attempt = 0; attempt <= 20; attempt++) {
      if (await this.applyFinalPanelStateChanges(changes)) break;
      await delay(150);
    }
    this.reloadInProgress = false;
    this.coordinator.activate();
  }

  private async applyPanelStateChange(change: WidgetPanelStateChange): Promise<boolean> {
    if (!this.initialized) return false;
    const payload = JSON.stringify(change.payload);
    return evaluateBool(
      this.window.webContents,
      `(() => { const host = window.classroomPanelHost; return host?.applyStateChange ? host.applyStateChange(${payload}) : false; })()`,
    );
  }

  private async applyRandomiserListChange(change: unknown): Promise<void> {
    if (!this.initialized) return;
    const generation = this.hostWrites.begin();
    let applied = false;
    try {
      applied = await evaluateBool(
        this.window.webContents,
        `(() => { const host = window.classroomPanelHost; return host?.applyRandomiserListChange ? host.applyRandomiserListChange(${JSON.stringify(change)}) : false; })()`,
      );
    } finally {
      this.hostWrites.finish(applied, generation);
    }
    if (!applied) log.warn('Host refused Randomiser collection change; the next deactivation attempt will be refused');
  }

  private async removeWidget(widgetId: string): Promise<void> {
    if (!this.initialized) return;
    const idJson = JSON.stringify(widgetId);
    await evaluateBool(
      this.window.webContents,
      `(() => { const host = window.classroomPanelHost; return host?.removeWidget ? host.removeWidget(${idJson}) : false; })()`,
    );
  }

  private async applyFinalPanelStateChanges(changes: WidgetPanelStateChange[]): Promise<boolean> {
    let allApplied = true;
    for (const change of changes) {
      allApplied = (await this.applyPanelStateChange(change)) && allApplied;
    }
    return allApplied && await this.hostWrites.wait();
  }
}

function optionsEqual(a: CompactWidgetOption[], b: CompactWidgetOption[]): boolean {
  return a.length === b.length && a.every((option, i) => option.widgetType === b[i].widgetType && option.title === b[i].title);
}
