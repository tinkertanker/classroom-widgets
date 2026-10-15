import AppKit
import WebKit

@MainActor
final class LauncherWindowCoordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
    private let scriptMessageHandler = DashboardScriptMessageHandler()
    private let onAddWidget: (Int) -> Void
    private let onOpenDisplayPreview: () -> Void
    private var window: NSWindow?
    private var webView: WKWebView?

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
            source: "window.__CLASSROOM_WIDGETS_MACOS__ = true; window.__CLASSROOM_WIDGETS_MACOS_VERSION__ = \(appVersionJSON);",
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
        self.window = window

        var components = URLComponents()
        components.scheme = dashboardURLScheme
        components.host = "app"
        components.path = "/"
        components.queryItems = [URLQueryItem(name: "surface", value: "widget-launcher")]
        if let url = components.url {
            webView.load(URLRequest(url: url))
        }
    }

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
