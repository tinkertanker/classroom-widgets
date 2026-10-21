import AppKit
import WebKit

@MainActor
final class LauncherWindowCoordinator: NSObject, WKNavigationDelegate, WKUIDelegate, NSWindowDelegate {
    private let scriptMessageHandler = DashboardScriptMessageHandler()
    private let onAddWidget: (Int) -> Void
    private let onOpenDisplayPreview: () -> Void
    private var window: NSWindow?
    private var webView: WKWebView?
    /// Set when the web content process ended while the launcher was not on
    /// screen; the page is reloaded when the window next becomes visible.
    private var reloadWhenVisible = false
    private var recentTerminations: [TimeInterval] = []

    init(onAddWidget: @escaping (Int) -> Void, onOpenDisplayPreview: @escaping () -> Void) {
        self.onAddWidget = onAddWidget
        self.onOpenDisplayPreview = onOpenDisplayPreview
        super.init()
        scriptMessageHandler.onDesktopLauncherAddWidget = { [weak self] widgetType in
            self?.onAddWidget(widgetType)
        }
        scriptMessageHandler.onDesktopLauncherClose = { [weak self] in
            self?.window?.performClose(nil)
        }
        scriptMessageHandler.onDesktopLauncherOpenDisplayPreview = { [weak self] in
            self?.onOpenDisplayPreview()
        }
    }

    func show() {
        PerfProbe.mark("launcher.show", ["existing": window != nil])
        prepare()
        if let webView, window?.contentView !== webView {
            window?.contentView = webView
        }
        reloadIfPending()
        window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        PerfProbe.mark("launcher.visible")
    }

    /// Starts loading the launcher page while the widget host is still
    /// starting. The web view joins the window only in `show()`, so nothing
    /// is drawn for a window that is not on screen yet.
    func prepare() {
        guard window == nil else { return }
        PerfProbe.mark("launcher.prepare")
        let appVersion = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "unknown"
        let appVersionJSON = (try? JSONEncoder().encode(appVersion))
            .flatMap { String(data: $0, encoding: .utf8) } ?? "\"unknown\""
        let configuration = WKWebViewConfiguration()
        configuration.setURLSchemeHandler(DashboardWebKitShared.schemeHandler, forURLScheme: dashboardURLScheme)
        configuration.userContentController.addUserScript(WKUserScript(
            source: DesktopHostScripts.macosFlag + DesktopHostScripts.macosVersion(version: appVersionJSON),
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        ))
        configuration.userContentController.add(scriptMessageHandler, name: "classroomDashboard")
        PerfProbe.install(in: configuration.userContentController, surface: "widget-launcher")

        let contentRect = NSRect(x: 0, y: 0, width: 850, height: 580)
        let webView = WKWebView(frame: contentRect, configuration: configuration)
        ClassroomWebViewTuning.apply(to: webView)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        self.webView = webView

        let window = NSWindow(
            contentRect: contentRect,
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Add Widget — Classroom Widgets"
        window.minSize = NSSize(width: 700, height: 540)
        window.center()
        window.isReleasedWhenClosed = false
        window.setFrameAutosaveName("WidgetLauncherWindow")
        window.delegate = self
        self.window = window
        load(webView)
    }

    private func load(_ webView: WKWebView) {
        var components = URLComponents()
        components.scheme = dashboardURLScheme
        components.host = "app"
        components.path = "/"
        components.queryItems = [URLQueryItem(name: "surface", value: "widget-launcher")]
        if let url = components.url {
            webView.load(URLRequest(url: url))
        }
    }

    private func reloadIfPending() {
        guard reloadWhenVisible, let webView else { return }
        reloadWhenVisible = false
        load(webView)
    }

    /// Implementing this turns off WebKit's own reload, which makes only one
    /// attempt per 30 seconds and otherwise leaves the launcher blank until
    /// the app restarts. Reload now when the launcher is on screen, or the
    /// next time it is shown. A page that keeps crashing while open waits
    /// for the next show instead of reloading in a loop.
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        let now = ProcessInfo.processInfo.systemUptime
        recentTerminations = recentTerminations.filter { now - $0 < Self.crashLoopWindow } + [now]
        let visible = window?.isVisible == true && window?.isMiniaturized == false
        let crashLoop = inCrashLoop
        DashboardLog.web.error(
            "Launcher web content process terminated (visible: \(visible, privacy: .public), crash loop: \(crashLoop, privacy: .public))"
        )
        PerfProbe.mark("launcher.terminated", ["visible": visible, "crashLoop": crashLoop])
        guard visible, !crashLoop else {
            reloadWhenVisible = true
            return
        }
        load(webView)
    }

    /// More than `crashLoopLimit` terminations in the last 30 seconds.
    private var inCrashLoop: Bool {
        let now = ProcessInfo.processInfo.systemUptime
        return recentTerminations.filter { now - $0 < Self.crashLoopWindow }.count > Self.crashLoopLimit
    }

    // Un-minimising or unhiding brings the window back without `show()`.
    // These automatic reloads respect the crash-loop guard; `show()` is a
    // deliberate user action and always reloads.
    func windowDidChangeOcclusionState(_ notification: Notification) {
        guard window?.occlusionState.contains(.visible) == true, !inCrashLoop else { return }
        reloadIfPending()
    }

    func windowDidDeminiaturize(_ notification: Notification) {
        guard !inCrashLoop else { return }
        reloadIfPending()
    }

    private static let crashLoopWindow: TimeInterval = 30
    private static let crashLoopLimit = 3

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        PerfProbe.mark("launcher.nav.start")
    }

    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        PerfProbe.mark("launcher.nav.commit")
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        PerfProbe.mark("launcher.nav.finish")
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }
        if url.scheme == dashboardURLScheme || url.scheme == "about" {
            decisionHandler(.allow)
            return
        }
        decisionHandler(.cancel)
        if navigationAction.navigationType == .linkActivated {
            ExternalLinkOpener.open(url)
        }
    }

    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if let url = navigationAction.request.url, url.scheme != dashboardURLScheme {
            ExternalLinkOpener.open(url)
        }
        return nil
    }
}
