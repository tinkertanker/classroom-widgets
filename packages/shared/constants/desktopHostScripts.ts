// AUTO-GENERATED FILE - DO NOT EDIT
// Generated from packages/shared/desktopHostScripts.json by scripts/generateDesktopHostScripts.cjs.
// Run 'pnpm generate:desktop-scripts' to regenerate.

/**
 * The JavaScript the desktop apps inject into widget web views, and the window
 * globals the teacher app reads. A JSON parameter must already be JSON-encoded.
 */

export const DESKTOP_GLOBALS = {
  macosFlag: '__CLASSROOM_WIDGETS_MACOS__',
  macosVersion: '__CLASSROOM_WIDGETS_MACOS_VERSION__',
  windowsFlag: '__CLASSROOM_WIDGETS_WINDOWS__',
  windowsVersion: '__CLASSROOM_WIDGETS_WINDOWS_VERSION__',
  linuxFlag: '__CLASSROOM_WIDGETS_LINUX__',
  linuxVersion: '__CLASSROOM_WIDGETS_LINUX_VERSION__',
  audioVolume: '__CLASSROOM_WIDGETS_AUDIO_VOLUME__',
  audio: 'classroomAudio',
  shortenerSettings: 'classroomShortenerSettings',
  dashboard: 'classroomDashboard',
  panelHost: 'classroomPanelHost',
  widgetPanel: 'classroomWidgetPanel',
} as const;

export const SHORTENER_SETTINGS_CHANGED_EVENT = 'classroom-shortener-settings-changed';

export const SHORTENER_PROVIDER_IDS = ['tinyurl', 'spoo', 'shortio'] as const;
export type ShortenerProviderId = typeof SHORTENER_PROVIDER_IDS[number];
export const DEFAULT_SHORTENER_PROVIDER_ID: ShortenerProviderId = 'tinyurl';

export const OUTPUT_VOLUME_PRESETS: readonly { label: string; volume: number }[] = [
  { label: 'Mute', volume: 0 },
  { label: '1 ■□□□', volume: 0.1 },
  { label: '2 ■■□□', volume: 0.25 },
  { label: '3 ■■■□', volume: 0.5 },
  { label: '4 ■■■■', volume: 1 },
];

/** Keeps a provider within the supported set. */
export function normalizeShortenerProvider(provider: unknown): ShortenerProviderId {
  return (SHORTENER_PROVIDER_IDS as readonly unknown[]).includes(provider)
    ? provider as ShortenerProviderId
    : DEFAULT_SHORTENER_PROVIDER_ID;
}

export const PANEL_HOST_METHODS = ['addWidget', 'showWidget', 'dismissWidget', 'toggleWidget', 'removeWidget', 'applyStateChange', 'applyRandomiserListChange'] as const;
export type PanelHostMethod = typeof PANEL_HOST_METHODS[number];

export const desktopHostScripts = {
  /** Marks the page as running inside the macOS app. */
  macosFlag: `window.__CLASSROOM_WIDGETS_MACOS__ = true; `,
  /** Publishes the macOS app version. */
  macosVersion: (version: string): string => `window.__CLASSROOM_WIDGETS_MACOS_VERSION__ = ${version}; `,
  /** Marks the page as running inside the Windows app and publishes its version. */
  windowsFlags: (version: string): string => `window.__CLASSROOM_WIDGETS_WINDOWS__ = true; window.__CLASSROOM_WIDGETS_WINDOWS_VERSION__ = ${version}; `,
  /** Publishes the native link-shortener settings and tells the web app they changed. */
  shortenerSettings: (settings: string): string => `window.classroomShortenerSettings = ${settings}; window.dispatchEvent(new Event('classroom-shortener-settings-changed'));`,
  /** Publishes the native output volume for start-up and applies it to a running page. */
  audioVolume: (volume: string): string => `window.__CLASSROOM_WIDGETS_AUDIO_VOLUME__ = ${volume}; window.classroomAudio?.setVolume(${volume});`,
  /** Sets the hidden widget host's background opacity. */
  dashboardBackgroundOpacity: (opacity: string): string => `window.classroomDashboard?.setBackgroundOpacity?.(${opacity})`,
  /** Calls a widget host method; evaluates to its result, or false when the host is not ready. */
  panelHostCall: (method: PanelHostMethod, argument: string): string => `(() => { const host = window.classroomPanelHost; return host?.${method} ? host.${method}(${argument}) : false; })()`,
  /** Hands a widget panel its snapshot; evaluates to false when the panel is not ready. */
  widgetPanelReceiveSnapshot: (snapshot: string): string => `(() => { const panel = window.classroomWidgetPanel; if (!panel?.receiveSnapshot) return false; panel.receiveSnapshot(${snapshot}); return true; })()`,
  /** Takes a widget panel's unsent state, or null. */
  widgetPanelTakePendingState: `window.classroomWidgetPanel?.takePendingState?.() ?? null`,
  /** Takes a widget panel's unsent state as { ok, value }, telling a missing panel apart from no pending state. */
  widgetPanelTakePendingStateResult: `(() => { const p = window.classroomWidgetPanel; if (!p?.takePendingState) return { ok: false }; return { ok: true, value: p.takePendingState() ?? null }; })()`,
  /** Tells a widget panel page whether the native chrome strip is showing. */
  widgetPanelChromeVisible: (visible: string): string => `document.documentElement.dataset.widgetChromeVisible = ${visible};`,
  /** Sets a widget panel page's background opacity CSS variable. */
  widgetPanelBackgroundOpacity: (opacity: string): string => `document.documentElement.style.setProperty('--compact-widget-background-opacity', ${opacity});`,
} as const;
