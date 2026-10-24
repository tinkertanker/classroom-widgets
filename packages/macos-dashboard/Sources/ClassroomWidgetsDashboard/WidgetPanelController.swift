import AppKit
import WebKit

@MainActor
final class WidgetPanelController: NSWindowController, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate {
    var onStateChange: (@MainActor (WidgetPanelStateChange) -> Void)?
    var onRandomiserListChange: (@MainActor (WidgetPanelRandomiserListChange) -> Void)?
    var onRemovalRequested: (@MainActor (String) -> Void)?
    var onWidgetCreationRequested: (@MainActor (Int) -> Void)?
    var onDisplayPreviewRequested: (@MainActor () -> Void)?
    var onOutputVolumeChanged: (@MainActor (Double) -> Void)?
    var onLayoutRequested: (@MainActor (WidgetPanelLayout) -> Void)?
    var onSnapRequested: (@MainActor (WindowSnapPreset) -> Void)?
    var onFrameChanged: (@MainActor (String, NSRect) -> Void)?
    var onBecameKey: (@MainActor (String) -> Void)?

    private var descriptor: WidgetPanelDescriptor
    private let webView: WKWebView
    private let messageHandler: WidgetPanelScriptMessageHandler
    // Chrome state is internal so WidgetPanelController+Chrome.swift can reach it.
    let chromeBackground = NonInteractiveVisualEffectView()
    var compactControls: NSView?
    weak var chromeTrackingView: NSView?
    var chromeTrackingArea: NSTrackingArea?
    var chromeHideGeneration = 0
    var chromeVisible = false
    private var isProgrammaticallyChangingFrame = false
    private var isClosingPermanently = false
    var widgetCreationOptions: [CompactWidgetOption] = []
    weak var volumeButton: NSButton?
    private var backgroundOpacity: Double
    private var contentReady = false
    private var pendingShow = false
    private var showFallbackTask: Task<Void, Never>?

    private static let showFallbackDelay: TimeInterval = 5

    var widgetID: String { descriptor.id }
    var isResizable: Bool { descriptor.isResizable }
    var isHidden: Bool { descriptor.hidden }
    /// Frame for a position preset on the panel's screen: resizable widgets fill the
    /// region (keeping their web aspect ratio and size limits); fixed-size ones only move.
    func snapFrame(for preset: WindowSnapPreset) -> NSRect? {
        guard let window,
              let screen = window.screen ?? NSScreen.screens.first(where: { $0.frame.intersects(window.frame) }) ?? NSScreen.main
        else { return nil }
        let content = window.contentRect(forFrameRect: window.frame).size
        // Everything that is not web view: the title bar plus the shared top gap.
        let chrome = NSSize(
            width: max(window.frame.width - content.width, 0),
            height: max(window.frame.height - content.height, 0) + WidgetPanelContentLayout.topGap
        )
        let frameSize = { (webSize: CGSize) in
            window.frameRect(forContentRect: NSRect(origin: .zero, size: WidgetPanelContentLayout.panelSize(for: webSize))).size
        }
        let minimum: NSSize
        let maximum: NSSize?
        let aspect: CGFloat?
        if descriptor.isResizable {
            minimum = frameSize(descriptor.minimumContentSize.cgSize)
            maximum = descriptor.maximumContentSize.map { frameSize($0.cgSize) }
            aspect = descriptor.aspectRatio.flatMap { $0.isFinite && $0 > 0 ? $0 : nil }
        } else {
            minimum = preferredFrameSize
            maximum = preferredFrameSize
            aspect = nil
        }
        return WindowSnapGeometry.frame(
            for: preset,
            visibleFrame: screen.visibleFrame,
            aspect: aspect,
            chrome: chrome,
            minimumFrame: minimum,
            maximumFrame: maximum,
            currentFrame: window.frame,
            margin: 12
        )
    }

    var preferredFrameSize: NSSize {
        let size = WidgetPanelContentLayout.panelSize(for: descriptor.preferredContentSize.cgSize)
        guard let window else { return size }
        return window.frameRect(forContentRect: NSRect(origin: .zero, size: size)).size
    }

    init(
        descriptor: WidgetPanelDescriptor,
        webViewFactory: WidgetPanelWebViewFactory,
        backgroundOpacity: Double,
        keepOnAllSpaces: Bool
    ) {
        self.descriptor = descriptor
        self.backgroundOpacity = min(max(backgroundOpacity, 0), 1)
        let webContext = webViewFactory.makeWebView(widgetID: descriptor.id)
        webView = webContext.webView
        messageHandler = webContext.messageHandler
        PerfProbe.mark("panel.webview.created", ["widgetId": descriptor.id])

        let initialContentRect = NSRect(
            origin: .zero,
            size: WidgetPanelContentLayout.panelSize(for: descriptor.preferredContentSize.cgSize)
        )
        let styleMask: NSWindow.StyleMask = [.titled, .closable, .resizable, .nonactivatingPanel]
        let panel = WidgetPanel(
            contentRect: initialContentRect,
            styleMask: styleMask,
            backing: .buffered,
            defer: false
        )
        panel.title = descriptor.title
        panel.isFloatingPanel = true
        panel.level = .floating
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.titlebarAppearsTransparent = true
        panel.hidesOnDeactivate = false
        panel.acceptsMouseMovedEvents = true
        panel.isReleasedWhenClosed = false
        panel.collectionBehavior = Self.collectionBehavior(joinsAllSpaces: keepOnAllSpaces)
        Self.applySizeConstraints(for: descriptor, to: panel)
        let contentView = NSView(frame: initialContentRect)
        panel.contentView = contentView
        // NSView is unflipped: keep the web view bottom-aligned with a fixed transparent top margin.
        webView.frame = NSRect(
            origin: .zero,
            size: NSSize(width: contentView.bounds.width, height: contentView.bounds.height - WidgetPanelContentLayout.topGap)
        )
        webView.autoresizingMask = [.width, .height]
        contentView.addSubview(webView)

        super.init(window: panel)
        panel.delegate = self
        webView.navigationDelegate = self
        webView.uiDelegate = self

        messageHandler.onReady = { [weak self] in
            PerfProbe.mark("panel.ready", ["widgetId": descriptor.id])
            if let snapshot = self?.currentSnapshot {
                self?.push(snapshot: snapshot, force: true)
            }
        }
        messageHandler.onContentReady = { [weak self] in
            PerfProbe.mark("panel.contentReady", ["widgetId": descriptor.id])
            self?.contentReady = true
            self?.presentPendingShow()
        }
        messageHandler.onStateChange = { [weak self] stateChange in
            self?.onStateChange?(stateChange)
        }
        messageHandler.onRandomiserListChange = { [weak self] change in
            self?.onRandomiserListChange?(change)
        }

        addCompactAccessories(to: panel)
        installChromeTracking(on: panel)
        revealChrome()
        scheduleChromeHide()
        loadWidget()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    deinit {
        MainActor.assumeIsolated {
            webView.configuration.userContentController.removeScriptMessageHandler(forName: "classroomWidgetPanel")
        }
    }

    func apply(descriptor: WidgetPanelDescriptor) {
        guard descriptor.id == widgetID else { return }
        let previous = self.descriptor
        self.descriptor = descriptor
        if previous.title != descriptor.title {
            window?.title = descriptor.title
        }
        Self.applySizeConstraints(for: descriptor, to: window)
    }

    func applyPresentationSettings(backgroundOpacity: Double, keepOnAllSpaces: Bool) {
        let nextOpacity = min(max(backgroundOpacity, 0), 1)
        let opacityChanged = self.backgroundOpacity != nextOpacity
        self.backgroundOpacity = nextOpacity
        window?.backgroundColor = .clear
        window?.collectionBehavior = Self.collectionBehavior(joinsAllSpaces: keepOnAllSpaces)
        webView.evaluateJavaScript(DashboardShortenerSettings.script(), completionHandler: nil)
        webView.evaluateJavaScript(DashboardAudioSettings.script(), completionHandler: nil)
        updateVolumeButton()
        if opacityChanged {
            setWebBackgroundOpacity()
        }
    }

    func setWidgetCreationOptions(_ options: [CompactWidgetOption]) {
        widgetCreationOptions = options
    }

    func show() {
        guard !descriptor.hidden else { return }
        if contentReady || window?.isVisible == true {
            presentNow()
            return
        }
        pendingShow = true
        guard showFallbackTask == nil else { return }
        showFallbackTask = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(Self.showFallbackDelay * 1_000_000_000))
            guard !Task.isCancelled else { return }
            self?.presentPendingShow()
        }
    }

    private func presentNow() {
        let wasVisible = window?.isVisible == true
        window?.orderFront(nil)
        if !wasVisible {
            PerfProbe.mark("panel.shown", ["widgetId": widgetID])
            revealChrome()
            scheduleChromeHide()
        }
    }

    private func presentPendingShow() {
        showFallbackTask?.cancel()
        showFallbackTask = nil
        guard pendingShow, !descriptor.hidden else { return }
        pendingShow = false
        presentNow()
    }

    func hide() {
        pendingShow = false
        showFallbackTask?.cancel()
        showFallbackTask = nil
        window?.orderOut(nil)
    }

    func closePermanently() {
        guard !isClosingPermanently else { return }
        isClosingPermanently = true
        webView.stopLoading()
        window?.close()
        PerfProbe.mark("panel.closed", ["widgetId": widgetID])
    }

    func takePendingState(completion: @escaping @MainActor (WidgetPanelStateChange?, Bool) -> Void) {
        var receivedCheckpoint = false
        var receivedResult = false
        var resultPrepared = true
        var pendingChange: WidgetPanelStateChange?
        var completed = false
        let finishIfReady: @MainActor () -> Void = { [weak self] in
            guard !completed, receivedCheckpoint, receivedResult else { return }
            completed = true
            self?.messageHandler.onWritesCheckpoint = nil
            completion(pendingChange, resultPrepared)
        }
        messageHandler.onWritesCheckpoint = {
            receivedCheckpoint = true
            finishIfReady()
        }
        webView.callAsyncJavaScript(
            "return " + DesktopHostScripts.widgetPanelTakePendingState,
            arguments: [:],
            in: nil,
            in: .page
        ) { result in
            receivedResult = true
            guard case let .success(value) = result else {
                resultPrepared = false
                finishIfReady()
                return
            }
            if value is NSNull {
                finishIfReady()
                return
            }
            guard
                  let payload = value as? [String: Any],
                  (payload["schemaVersion"] as? NSNumber)?.intValue == 1,
                  let widgetID = payload["widgetId"] as? String,
                  widgetID == self.widgetID,
                  payload["baseRevision"] is NSNumber,
                  payload["state"] != nil
            else {
                resultPrepared = false
                finishIfReady()
                return
            }
            var finalPayload = payload
            finalPayload["flush"] = true
            pendingChange = WidgetPanelStateChange(widgetID: widgetID, payload: finalPayload)
            finishIfReady()
        }
        Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 900_000_000)
            guard !completed else { return }
            completed = true
            self?.messageHandler.onWritesCheckpoint = nil
            completion(nil, false)
        }
    }

    func setFrame(_ frame: NSRect, animate: Bool) {
        guard let window else { return }
        isProgrammaticallyChangingFrame = true
        if animate, !NSWorkspace.shared.accessibilityDisplayShouldReduceMotion {
            NSAnimationContext.runAnimationGroup { context in
                context.duration = 0.18
                window.animator().setFrame(frame, display: true)
            } completionHandler: { [weak self] in
                Task { @MainActor [weak self] in
                    self?.isProgrammaticallyChangingFrame = false
                }
            }
        } else {
            window.setFrame(frame, display: true)
            isProgrammaticallyChangingFrame = false
        }
    }

    func defaultFrame() -> NSRect {
        guard let window else { return .zero }
        let visibleFrame = window.screen?.visibleFrame ?? NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        let size = preferredFrameSize
        return NSRect(
            x: visibleFrame.midX - size.width / 2,
            y: visibleFrame.midY - size.height / 2,
            width: min(size.width, visibleFrame.width),
            height: min(size.height, visibleFrame.height)
        )
    }

    func push(snapshot: [String: Any], force: Bool = false) {
        let revision = (snapshot["revision"] as? NSNumber)?.intValue
        let stateRevision = (snapshot["stateRevision"] as? NSNumber)?.intValue
        if !force,
           revision != nil,
           revision == lastPushedRevision,
           stateRevision == lastPushedStateRevision {
            currentSnapshot = snapshot
            return
        }
        lastPushedRevision = revision
        lastPushedStateRevision = stateRevision
        currentSnapshot = snapshot
        webView.callAsyncJavaScript(
            [
                DashboardShortenerSettings.script(),
                DashboardAudioSettings.script(),
                DesktopHostScripts.widgetPanelReceiveSnapshot(snapshot: "snapshot")
            ].joined(separator: "\n"),
            arguments: ["snapshot": snapshot],
            in: nil,
            in: .page
        ) { result in
            if case let .failure(error) = result {
                DashboardLog.web.error("Unable to push widget panel snapshot: \(error.localizedDescription, privacy: .public)")
            }
        }
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        if isClosingPermanently {
            return true
        }
        hide()
        onRemovalRequested?(widgetID)
        return false
    }

    func windowDidMove(_ notification: Notification) {
        guard !isProgrammaticallyChangingFrame, let frame = window?.frame else { return }
        onFrameChanged?(widgetID, frame)
    }

    func windowDidResize(_ notification: Notification) {
        guard !isProgrammaticallyChangingFrame, let frame = window?.frame else { return }
        onFrameChanged?(widgetID, frame)
    }

    func windowWillResize(_ sender: NSWindow, to frameSize: NSSize) -> NSSize {
        // NSWindow.contentAspectRatio would include the gap and distort the web viewport.
        let proposed = sender.contentRect(forFrameRect: NSRect(origin: .zero, size: frameSize)).size
        let current = sender.contentRect(forFrameRect: sender.frame).size
        let size = WidgetPanelContentLayout.constrainedSize(proposed, current: current, descriptor: descriptor)
        return sender.frameRect(forContentRect: NSRect(origin: .zero, size: size)).size
    }

    func windowDidBecomeKey(_ notification: Notification) {
        onBecameKey?(widgetID)
        revealChrome()
        scheduleChromeHide()
    }

    override func mouseEntered(with event: NSEvent) {
        revealChrome()
    }

    override func mouseExited(with event: NSEvent) {
        scheduleChromeHide()
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        PerfProbe.mark("panel.nav.start", ["widgetId": widgetID])
    }

    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        PerfProbe.mark("panel.nav.commit", ["widgetId": widgetID])
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        PerfProbe.mark("panel.nav.finish", ["widgetId": widgetID])
        webView.evaluateJavaScript(DashboardShortenerSettings.script(), completionHandler: nil)
        webView.evaluateJavaScript(DashboardAudioSettings.script(), completionHandler: nil)
        setWebBackgroundOpacity()
        setWebChromeVisibility()
        guard let snapshot = currentSnapshot else { return }
        push(snapshot: snapshot, force: true)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        guard !isClosingPermanently else { return }
        DashboardLog.web.error(
            "Widget panel web content process terminated for \(self.widgetID, privacy: .public); reloading"
        )
        loadWidget()
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
        guard url.scheme == dashboardURLScheme || url.scheme == "about" else {
            decisionHandler(.cancel)
            if navigationAction.navigationType == .linkActivated {
                ExternalLinkOpener.open(url)
            }
            return
        }
        decisionHandler(.allow)
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

    func perfReload() {
        loadWidget()
    }

    func perfEvaluate(_ body: String, arguments: [String: Any]) async -> Any? {
        await withCheckedContinuation { continuation in
            webView.callAsyncJavaScript(body, arguments: arguments, in: nil, in: .page) { result in
                switch result {
                case let .success(value): continuation.resume(returning: value)
                case let .failure(error): continuation.resume(returning: ["error": error.localizedDescription])
                }
            }
        }
    }

    private var currentSnapshot: [String: Any]?
    private var lastPushedRevision: Int?
    private var lastPushedStateRevision: Int?

    func setWebChromeVisibility() {
        webView.evaluateJavaScript(
            DesktopHostScripts.widgetPanelChromeVisible(visible: chromeVisible ? "\"true\"" : "\"false\"")
        )
    }

    private func setWebBackgroundOpacity() {
        webView.evaluateJavaScript(
            DesktopHostScripts.widgetPanelBackgroundOpacity(opacity: "\"\(backgroundOpacity)\"")
        )
    }

    private func loadWidget() {
        lastPushedRevision = nil
        lastPushedStateRevision = nil
        contentReady = false
        var components = URLComponents()
        components.scheme = dashboardURLScheme
        components.host = "app"
        components.path = "/"
        components.queryItems = [
            URLQueryItem(name: "surface", value: "widget-panel"),
            URLQueryItem(name: "widgetId", value: widgetID),
            URLQueryItem(name: "backgroundOpacity", value: String(backgroundOpacity))
        ]
        guard let url = components.url else { return }
        webView.load(URLRequest(url: url))
    }

    private static func applySizeConstraints(for descriptor: WidgetPanelDescriptor, to window: NSWindow?) {
        guard let window else { return }
        window.contentMinSize = descriptor.isResizable
            ? WidgetPanelContentLayout.panelSize(for: descriptor.minimumContentSize.cgSize)
            : WidgetPanelContentLayout.panelSize(for: descriptor.preferredContentSize.cgSize)
        window.contentMaxSize = descriptor.isResizable
            ? descriptor.maximumContentSize.map { WidgetPanelContentLayout.panelSize(for: $0.cgSize) } ?? NSSize(
                width: CGFloat.greatestFiniteMagnitude,
                height: CGFloat.greatestFiniteMagnitude
            )
            : WidgetPanelContentLayout.panelSize(for: descriptor.preferredContentSize.cgSize)
        window.standardWindowButton(.zoomButton)?.isEnabled = descriptor.isResizable
    }

    private static func collectionBehavior(joinsAllSpaces: Bool) -> NSWindow.CollectionBehavior {
        var behavior: NSWindow.CollectionBehavior = [.fullScreenAuxiliary]
        if joinsAllSpaces {
            behavior.insert(.canJoinAllSpaces)
        }
        return behavior
    }

}

private final class WidgetPanel: FloatingPanel {}

final class NonInteractiveVisualEffectView: NSVisualEffectView {
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
}
