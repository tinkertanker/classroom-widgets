// AUTO-GENERATED FILE - DO NOT EDIT
// Generated from packages/shared/desktopHostScripts.json by scripts/generateDesktopHostScripts.cjs.
// Run 'pnpm generate:desktop-scripts' to regenerate.

/// The JavaScript injected into widget web views, shared with the Windows and
/// Linux apps. A JSON parameter must already be JSON-encoded, or name an
/// argument bound by callAsyncJavaScript.
enum DesktopHostScripts {
    /// Window globals the teacher app reads.
    enum Global {
        static let macosFlag = "__CLASSROOM_WIDGETS_MACOS__"
        static let macosVersion = "__CLASSROOM_WIDGETS_MACOS_VERSION__"
        static let windowsFlag = "__CLASSROOM_WIDGETS_WINDOWS__"
        static let windowsVersion = "__CLASSROOM_WIDGETS_WINDOWS_VERSION__"
        static let linuxFlag = "__CLASSROOM_WIDGETS_LINUX__"
        static let linuxVersion = "__CLASSROOM_WIDGETS_LINUX_VERSION__"
        static let audioVolume = "__CLASSROOM_WIDGETS_AUDIO_VOLUME__"
        static let audio = "classroomAudio"
        static let shortenerSettings = "classroomShortenerSettings"
        static let dashboard = "classroomDashboard"
        static let panelHost = "classroomPanelHost"
        static let widgetPanel = "classroomWidgetPanel"
    }

    static let shortenerSettingsChangedEvent = "classroom-shortener-settings-changed"
    static let shortenerProviders = ["tinyurl", "spoo", "shortio"]
    static let defaultShortenerProvider = "tinyurl"
    static let outputVolumePresets: [(label: String, volume: Double)] = [
        (label: "Mute", volume: 0),
        (label: "1 ■□□□", volume: 0.1),
        (label: "2 ■■□□", volume: 0.25),
        (label: "3 ■■■□", volume: 0.5),
        (label: "4 ■■■■", volume: 1)
    ]

    /// Keeps a provider within the supported set.
    static func normalizeShortenerProvider(_ provider: String?) -> String {
        guard let provider, shortenerProviders.contains(provider) else { return defaultShortenerProvider }
        return provider
    }

    enum PanelHostMethod: String {
        case addWidget
        case showWidget
        case dismissWidget
        case toggleWidget
        case removeWidget
        case applyStateChange
        case applyRandomiserListChange
    }

    /// Marks the page as running inside the macOS app.
    static let macosFlag = "window.__CLASSROOM_WIDGETS_MACOS__ = true; "

    /// Publishes the macOS app version.
    static func macosVersion(version: String) -> String {
        "window.__CLASSROOM_WIDGETS_MACOS_VERSION__ = \(version); "
    }

    /// Marks the page as running inside the Windows app and publishes its version.
    static func windowsFlags(version: String) -> String {
        "window.__CLASSROOM_WIDGETS_WINDOWS__ = true; window.__CLASSROOM_WIDGETS_WINDOWS_VERSION__ = \(version); "
    }

    /// Publishes the native link-shortener settings and tells the web app they changed.
    static func shortenerSettings(settings: String) -> String {
        "window.classroomShortenerSettings = \(settings); window.dispatchEvent(new Event('classroom-shortener-settings-changed'));"
    }

    /// Publishes the native output volume for start-up and applies it to a running page.
    static func audioVolume(volume: String) -> String {
        "window.__CLASSROOM_WIDGETS_AUDIO_VOLUME__ = \(volume); window.classroomAudio?.setVolume(\(volume));"
    }

    /// Sets the hidden widget host's background opacity.
    static func dashboardBackgroundOpacity(opacity: String) -> String {
        "window.classroomDashboard?.setBackgroundOpacity?.(\(opacity))"
    }

    /// Calls a widget host method; evaluates to its result, or false when the host is not ready.
    static func panelHostCall(_ method: PanelHostMethod, argument: String) -> String {
        "(() => { const host = window.classroomPanelHost; return host?.\(method.rawValue) ? host.\(method.rawValue)(\(argument)) : false; })()"
    }

    /// Hands a widget panel its snapshot; evaluates to false when the panel is not ready.
    static func widgetPanelReceiveSnapshot(snapshot: String) -> String {
        "(() => { const panel = window.classroomWidgetPanel; if (!panel?.receiveSnapshot) return false; panel.receiveSnapshot(\(snapshot)); return true; })()"
    }

    /// Takes a widget panel's unsent state, or null.
    static let widgetPanelTakePendingState = "window.classroomWidgetPanel?.takePendingState?.() ?? null"

    /// Takes a widget panel's unsent state as { ok, value }, telling a missing panel apart from no pending state.
    static let widgetPanelTakePendingStateResult = "(() => { const p = window.classroomWidgetPanel; if (!p?.takePendingState) return { ok: false }; return { ok: true, value: p.takePendingState() ?? null }; })()"

    /// Tells a widget panel page whether the native chrome strip is showing.
    static func widgetPanelChromeVisible(visible: String) -> String {
        "document.documentElement.dataset.widgetChromeVisible = \(visible);"
    }

    /// Sets a widget panel page's background opacity CSS variable.
    static func widgetPanelBackgroundOpacity(opacity: String) -> String {
        "document.documentElement.style.setProperty('--compact-widget-background-opacity', \(opacity));"
    }
}
