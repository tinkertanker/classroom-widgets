import AppKit
import WebKit

@MainActor
final class LauncherWindowCoordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
    private let scriptMessageHandler = DashboardScriptMessageHandler()
    private let onAddWidget: (Int) -> Void
    private var window: NSWindow?

    init(onAddWidget: @escaping (Int) -> Void) {
        self.onAddWidget = onAddWidget
        super.init()
        scriptMessageHandler.onDesktopLauncherAddWidget = { [weak self] widgetType in
            self?.onAddWidget(widgetType)
        }
        scriptMessageHandler.onDesktopLauncherClose = { [weak self] in
            self?.window?.performClose(nil)
        }
    }

    func show() {
        if let window {
            window.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
            return
        }

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

        let webView = WKWebView(frame: .zero, configuration: configuration)
        ClassroomWebViewTuning.apply(to: webView)
        webView.navigationDelegate = self
        webView.uiDelegate = self

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 850, height: 580),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Add Widget — Classroom Widgets"
        window.minSize = NSSize(width: 700, height: 540)
        window.contentView = webView
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

        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
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
            NSWorkspace.shared.open(url)
        }
    }

    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if let url = navigationAction.request.url, url.scheme != dashboardURLScheme {
            NSWorkspace.shared.open(url)
        }
        return nil
    }
}
