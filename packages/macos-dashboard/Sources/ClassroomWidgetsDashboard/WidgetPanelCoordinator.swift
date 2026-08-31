import AppKit
import WebKit

/// A host-provided description of one widget panel. The enclosing inventory
/// revision is monotonic for each host instance so native can reject stale
/// reconciliation results without blocking a reloaded web process.
struct WidgetPanelDescriptor {
    struct Size {
        let width: CGFloat
        let height: CGFloat

        init(width: CGFloat, height: CGFloat) {
            self.width = width
            self.height = height
        }

        var cgSize: NSSize {
            NSSize(width: max(width, 1), height: max(height, 1))
        }
    }

    let id: String
    let title: String
    let preferredContentSize: Size
    let minimumContentSize: Size
    let maximumContentSize: Size?
    let isResizable: Bool
    let aspectRatio: CGFloat?
    let snapshotPayload: [String: Any]

    init(
        id: String,
        title: String,
        preferredContentSize: Size,
        minimumContentSize: Size = Size(width: 240, height: 160),
        maximumContentSize: Size? = nil,
        isResizable: Bool = true,
        aspectRatio: CGFloat? = nil,
        snapshotPayload: [String: Any]
    ) {
        self.id = id
        self.title = title
        self.preferredContentSize = preferredContentSize
        self.minimumContentSize = minimumContentSize
        self.maximumContentSize = maximumContentSize
        self.isResizable = isResizable
        self.aspectRatio = aspectRatio
        self.snapshotPayload = snapshotPayload
    }
}

struct WidgetPanelSnapshot {
    let hostInstanceID: String
    let revision: Int
    let widgets: [WidgetPanelDescriptor]

    init(hostInstanceID: String, revision: Int, widgets: [WidgetPanelDescriptor]) {
        self.hostInstanceID = hostInstanceID
        self.revision = revision
        self.widgets = widgets
    }
}

enum WidgetPanelLayout: String, Codable {
    case freeform
    case row
    case column
}

struct WidgetPanelReady {
    let widgetID: String
    let revision: Int?
}

struct WidgetPanelStateChange {
    let widgetID: String
    let payload: [String: Any]
}

struct WidgetPanelRandomiserListChange {
    let payload: [String: Any]
}

/// Coordinates the bounded, one-widget-per-window compact presentation.
/// It deliberately owns native placement only; widget content and state still
/// arrive through the versioned host snapshot and per-panel web bridge.
@MainActor
final class WidgetPanelCoordinator: NSObject {
    var onPanelReady: (@MainActor (WidgetPanelReady) -> Void)?
    var onPanelStateChange: (@MainActor (WidgetPanelStateChange) -> Void)?
    var onRandomiserListChange: (@MainActor (WidgetPanelRandomiserListChange) -> Void)?
    var onWidgetCreationRequested: (@MainActor (Int) -> Void)?
    var onWidgetRemovalRequested: (@MainActor (String) -> Void)?

    private let webViewFactory = WidgetPanelWebViewFactory()
    private var panelControllers: [String: WidgetPanelController] = [:]
    private var lastSnapshot: WidgetPanelSnapshot?
    private var freeformFrames: [String: NSRect] = [:]
    private var layout: WidgetPanelLayout = .freeform
    private var compactPresentationActive = true
    private var widgetCreationOptions: [CompactWidgetOption] = []
    private var panelBackgroundOpacity = 1.0
    private var panelsJoinAllSpaces = true
    private var lastLayoutSignature: String?
    private let frameDefaultsWriter = DebouncedDefaultsWriter()

    init(compactPresentationActive: Bool = true) {
        self.compactPresentationActive = compactPresentationActive
        super.init()
    }

    func setWidgetCreationOptions(_ options: [CompactWidgetOption]) {
        widgetCreationOptions = options
        panelControllers.values.forEach { $0.setWidgetCreationOptions(options) }
    }

    func applyPresentationSettings(backgroundOpacity: Double, keepOnAllSpaces: Bool) {
        panelBackgroundOpacity = min(max(backgroundOpacity, 0), 1)
        panelsJoinAllSpaces = keepOnAllSpaces
        panelControllers.values.forEach {
            $0.applyPresentationSettings(
                backgroundOpacity: panelBackgroundOpacity,
                keepOnAllSpaces: panelsJoinAllSpaces
            )
        }
    }

    /// Reconciles the complete host inventory. Snapshots with a lower revision
    /// from the same host instance are ignored to prevent stale bridge retries
    /// from resurrecting or removing panels. A fresh web process has a new
    /// host instance ID, so its revision may safely restart at zero.
    @discardableResult
    func reconcile(snapshot: WidgetPanelSnapshot) -> Bool {
        if let lastSnapshot, snapshot.hostInstanceID != lastSnapshot.hostInstanceID {
            panelControllers.values.forEach { $0.closePermanently() }
            panelControllers.removeAll()
        }
        if let lastSnapshot,
           snapshot.hostInstanceID == lastSnapshot.hostInstanceID,
           snapshot.revision < lastSnapshot.revision {
            return false
        }
        lastSnapshot = snapshot
        guard compactPresentationActive else { return true }

        let descriptorsByID = Dictionary(snapshot.widgets.map { ($0.id, $0) }, uniquingKeysWith: { _, latest in latest })
        let removedIDs = Set(panelControllers.keys).subtracting(descriptorsByID.keys)
        for id in removedIDs {
            panelControllers[id]?.closePermanently()
            panelControllers[id] = nil
            freeformFrames[id] = nil
            UserDefaults.standard.removeObject(forKey: frameDefaultsKey(for: id))
        }

        for descriptor in snapshot.widgets where !descriptor.id.isEmpty {
            let controller: WidgetPanelController
            if let existingController = panelControllers[descriptor.id] {
                controller = existingController
                controller.apply(descriptor: descriptor)
            } else {
                controller = makePanelController(descriptor: descriptor)
                panelControllers[descriptor.id] = controller
            }
            controller.push(snapshot: descriptor.snapshotPayload)
        }

        if layout != .freeform {
            let layoutSignature = snapshot.widgets
                .map { "\($0.id):\($0.preferredContentSize.width)x\($0.preferredContentSize.height)" }
                .joined(separator: "|")
            if layoutSignature != lastLayoutSignature {
                lastLayoutSignature = layoutSignature
                arrange(layout)
            }
        }
        return true
    }

    private func showAll() {
        for controller in orderedControllers {
            controller.show()
        }
    }

    /// Destroys panel web views while their state host reloads or the app exits.
    func deactivate() {
        compactPresentationActive = false
        lastLayoutSignature = nil
        panelControllers.values.forEach { $0.closePermanently() }
        panelControllers.removeAll()
    }

    func flushPersistedFrames() {
        frameDefaultsWriter.flush()
    }

    func prepareForDeactivation(completion: @escaping @MainActor ([WidgetPanelStateChange], Bool) -> Void) {
        compactPresentationActive = false
        let controllers = Array(panelControllers.values)
        guard !controllers.isEmpty else {
            completion([], true)
            return
        }

        var pendingChanges: [WidgetPanelStateChange] = []
        var allPrepared = true
        var remaining = controllers.count
        for controller in controllers {
            controller.hide()
            var completed = false
            let finish: @MainActor (WidgetPanelStateChange?, Bool) -> Void = { change, prepared in
                guard !completed else { return }
                completed = true
                if let change {
                    pendingChanges.append(change)
                }
                allPrepared = allPrepared && prepared
                remaining -= 1
                if remaining == 0 {
                    completion(pendingChanges, allPrepared)
                }
            }
            controller.takePendingState(completion: finish)
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                finish(nil, false)
            }
        }
    }

    @discardableResult
    func activate() -> Bool {
        compactPresentationActive = true
        if panelControllers.isEmpty, let lastSnapshot {
            reconcile(snapshot: lastSnapshot)
        }
        guard !panelControllers.isEmpty else { return false }
        showAll()
        return true
    }

    func arrange(_ layout: WidgetPanelLayout, on screen: NSScreen? = nil) {
        let previousLayout = self.layout
        self.layout = layout
        guard layout != .freeform else {
            restoreFreeformFrames()
            return
        }

        let targetScreen = screen ?? panelControllers.values.compactMap(\.window?.screen).first ?? NSScreen.main
        guard let targetScreen else { return }
        let usableFrame = targetScreen.visibleFrame.insetBy(dx: 12, dy: 12)
        let controllers = orderedControllers

        if previousLayout == .freeform {
            freeformFrames.removeAll()
            for controller in controllers {
                freeformFrames[controller.widgetID] = controller.window?.frame
            }
        }

        let frames = WidgetPanelLayoutEngine.frames(
            for: controllers.map { ($0.widgetID, $0.preferredFrameSize) },
            layout: layout,
            usableFrame: usableFrame
        )
        for controller in controllers {
            guard let frame = frames[controller.widgetID] else { continue }
            controller.setFrame(clampedFrame(frame, on: targetScreen), animate: true)
        }
    }

    func restoreFreeformFrames() {
        layout = .freeform
        for controller in orderedControllers {
            let savedFrame = freeformFrames[controller.widgetID] ?? storedFrame(for: controller.widgetID)
            let frame = savedFrame.map {
                controller.isResizable ? $0 : NSRect(origin: $0.origin, size: controller.preferredFrameSize)
            } ?? controller.defaultFrame()
            let targetScreen = screen(containingMostOf: frame) ?? controller.window?.screen ?? NSScreen.main
            controller.setFrame(clampedFrame(frame, on: targetScreen), animate: true)
        }
    }

    private var orderedControllers: [WidgetPanelController] {
        guard let lastSnapshot else {
            return panelControllers.values.sorted { $0.widgetID < $1.widgetID }
        }
        return lastSnapshot.widgets.compactMap { panelControllers[$0.id] }
    }

    private func makePanelController(descriptor: WidgetPanelDescriptor) -> WidgetPanelController {
        let controller = WidgetPanelController(
            descriptor: descriptor,
            webViewFactory: webViewFactory,
            backgroundOpacity: panelBackgroundOpacity,
            keepOnAllSpaces: panelsJoinAllSpaces
        )
        controller.setWidgetCreationOptions(widgetCreationOptions)
        controller.onReady = { [weak self] ready in
            self?.onPanelReady?(ready)
        }
        controller.onStateChange = { [weak self] stateChange in
            guard let self, self.compactPresentationActive else { return }
            self.onPanelStateChange?(stateChange)
        }
        controller.onRandomiserListChange = { [weak self] change in
            self?.onRandomiserListChange?(change)
        }
        controller.onRemovalRequested = { [weak self] widgetID in
            self?.onWidgetRemovalRequested?(widgetID)
        }
        controller.onWidgetCreationRequested = { [weak self] widgetType in
            self?.onWidgetCreationRequested?(widgetType)
        }
        controller.onLayoutRequested = { [weak self, weak controller] layout in
            self?.arrange(layout, on: controller?.window?.screen)
        }
        controller.onFrameChanged = { [weak self] widgetID, frame in
            self?.persist(frame: frame, for: widgetID)
        }

        if let storedFrame = storedFrame(for: descriptor.id) {
            let targetScreen = screen(containingMostOf: storedFrame) ?? NSScreen.main
            let restoredFrame = descriptor.isResizable
                ? storedFrame
                : NSRect(origin: storedFrame.origin, size: controller.preferredFrameSize)
            controller.setFrame(clampedFrame(restoredFrame, on: targetScreen), animate: false)
        } else {
            controller.setFrame(initialFrame(for: controller), animate: false)
        }
        return controller
    }

    private func initialFrame(for controller: WidgetPanelController) -> NSRect {
        guard let screen = NSScreen.main else { return controller.defaultFrame() }
        let usableFrame = screen.visibleFrame.insetBy(dx: 12, dy: 12)
        let size = controller.preferredFrameSize
        let existingFrames = panelControllers.values.compactMap(\.window?.frame)
        let nextX = (existingFrames.map(\.maxX).max() ?? usableFrame.minX - 12) + 12

        if nextX + size.width <= usableFrame.maxX {
            return NSRect(x: nextX, y: usableFrame.maxY - size.height, width: size.width, height: size.height)
        }

        let nextY = (existingFrames.map(\.minY).min() ?? usableFrame.maxY) - size.height - 12
        return clampedFrame(
            NSRect(x: usableFrame.minX, y: nextY, width: size.width, height: size.height),
            on: screen
        )
    }

    private func persist(frame: NSRect, for widgetID: String) {
        frameDefaultsWriter.set(NSStringFromRect(frame), forKey: frameDefaultsKey(for: widgetID))
    }

    private func storedFrame(for widgetID: String) -> NSRect? {
        guard let encodedFrame = UserDefaults.standard.string(forKey: frameDefaultsKey(for: widgetID)) else {
            return nil
        }
        let frame = NSRectFromString(encodedFrame)
        guard !frame.isNull, !frame.isEmpty, frame.width >= 100, frame.height >= 100 else {
            return nil
        }
        return frame
    }

    private func frameDefaultsKey(for widgetID: String) -> String {
        "widgetPanelFrameV1.\(widgetID)"
    }

    private func intersectionArea(_ first: NSRect, _ second: NSRect) -> CGFloat {
        let intersection = first.intersection(second)
        guard !intersection.isNull else { return 0 }
        return intersection.width * intersection.height
    }

    private func screen(containingMostOf frame: NSRect) -> NSScreen? {
        NSScreen.screens.max {
            intersectionArea($0.frame, frame) < intersectionArea($1.frame, frame)
        }.flatMap { intersectionArea($0.frame, frame) > 0 ? $0 : nil }
    }

    private func clampedFrame(_ frame: NSRect, on screen: NSScreen?) -> NSRect {
        guard let screen else { return frame }
        let visibleFrame = screen.visibleFrame.insetBy(dx: 12, dy: 12)
        let size = NSSize(
            width: min(frame.width, visibleFrame.width),
            height: min(frame.height, visibleFrame.height)
        )
        return NSRect(
            x: min(max(frame.origin.x, visibleFrame.minX), visibleFrame.maxX - size.width),
            y: min(max(frame.origin.y, visibleFrame.minY), visibleFrame.maxY - size.height),
            width: size.width,
            height: size.height
        )
    }
}

@MainActor
private final class WidgetPanelController: NSWindowController, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate {
    var onReady: (@MainActor (WidgetPanelReady) -> Void)?
    var onStateChange: (@MainActor (WidgetPanelStateChange) -> Void)?
    var onRandomiserListChange: (@MainActor (WidgetPanelRandomiserListChange) -> Void)?
    var onRemovalRequested: (@MainActor (String) -> Void)?
    var onWidgetCreationRequested: (@MainActor (Int) -> Void)?
    var onLayoutRequested: (@MainActor (WidgetPanelLayout) -> Void)?
    var onFrameChanged: (@MainActor (String, NSRect) -> Void)?

    private var descriptor: WidgetPanelDescriptor
    private let webView: WKWebView
    private let messageHandler: WidgetPanelScriptMessageHandler
    private let chromeBackground = NonInteractiveVisualEffectView()
    private var compactControls: NSView?
    private var compactAccessoryController: NSTitlebarAccessoryViewController?
    private weak var chromeTrackingView: NSView?
    private var chromeTrackingArea: NSTrackingArea?
    private var chromeHideGeneration = 0
    private var chromeVisible = false
    private var isProgrammaticallyChangingFrame = false
    private var isClosingPermanently = false
    private var widgetCreationOptions: [CompactWidgetOption] = []
    private var backgroundOpacity: Double

    var widgetID: String { descriptor.id }
    var isResizable: Bool { descriptor.isResizable }
    var preferredFrameSize: NSSize {
        guard let window else { return descriptor.preferredContentSize.cgSize }
        return window.frameRect(forContentRect: NSRect(origin: .zero, size: descriptor.preferredContentSize.cgSize)).size
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

        let initialContentRect = NSRect(origin: .zero, size: descriptor.preferredContentSize.cgSize)
        let styleMask: NSWindow.StyleMask = descriptor.isResizable
            ? [.titled, .closable, .resizable]
            : [.titled, .closable]
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
        panel.contentMinSize = descriptor.minimumContentSize.cgSize
        if let maximumContentSize = descriptor.maximumContentSize?.cgSize {
            panel.contentMaxSize = maximumContentSize
        }
        panel.contentAspectRatio = Self.contentAspectRatio(for: descriptor)
        panel.contentView = NSView()
        webView.frame = panel.contentView?.bounds ?? .zero
        webView.autoresizingMask = [.width, .height]
        panel.contentView?.addSubview(webView)

        super.init(window: panel)
        panel.delegate = self
        webView.navigationDelegate = self
        webView.uiDelegate = self

        messageHandler.onReady = { [weak self] ready in
            if let snapshot = self?.currentSnapshot {
                self?.push(snapshot: snapshot, force: true)
            }
            self?.onReady?(ready)
        }
        messageHandler.onStateChange = { [weak self] stateChange in
            self?.onStateChange?(stateChange)
        }
        messageHandler.onRandomiserListChange = { [weak self] change in
            self?.onRandomiserListChange?(change)
        }

        addCompactAccessories(to: panel)
        installChromeTracking(on: panel)
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
        if previous.minimumContentSize.width != descriptor.minimumContentSize.width
            || previous.minimumContentSize.height != descriptor.minimumContentSize.height {
            window?.contentMinSize = descriptor.minimumContentSize.cgSize
        }
        let previousMax = previous.maximumContentSize
        let nextMax = descriptor.maximumContentSize
        if previousMax?.width != nextMax?.width || previousMax?.height != nextMax?.height {
            window?.contentMaxSize = nextMax?.cgSize ?? NSSize(
                width: CGFloat.greatestFiniteMagnitude,
                height: CGFloat.greatestFiniteMagnitude
            )
        }
        if previous.aspectRatio != descriptor.aspectRatio {
            window?.contentAspectRatio = Self.contentAspectRatio(for: descriptor)
        }
        if previous.isResizable != descriptor.isResizable, let window {
            if descriptor.isResizable {
                window.styleMask.insert(.resizable)
            } else {
                window.styleMask.remove(.resizable)
            }
        }
    }

    func applyPresentationSettings(backgroundOpacity: Double, keepOnAllSpaces: Bool) {
        let nextOpacity = min(max(backgroundOpacity, 0), 1)
        let opacityChanged = self.backgroundOpacity != nextOpacity
        self.backgroundOpacity = nextOpacity
        window?.backgroundColor = .clear
        window?.collectionBehavior = Self.collectionBehavior(joinsAllSpaces: keepOnAllSpaces)
        if opacityChanged {
            setWebBackgroundOpacity()
        }
    }

    func setWidgetCreationOptions(_ options: [CompactWidgetOption]) {
        widgetCreationOptions = options
    }

    func show() {
        let wasVisible = window?.isVisible == true
        window?.orderFront(nil)
        if !wasVisible {
            revealChrome()
            scheduleChromeHide()
        }
    }

    func hide() {
        window?.orderOut(nil)
    }

    func closePermanently() {
        guard !isClosingPermanently else { return }
        isClosingPermanently = true
        webView.stopLoading()
        window?.close()
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
            "return window.classroomWidgetPanel?.takePendingState?.() ?? null",
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
            """
            (() => {
              const panel = window.classroomWidgetPanel;
              if (!panel?.receiveSnapshot) return false;
              panel.receiveSnapshot(snapshot);
              return true;
            })()
            """,
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
        updateChromeTrackingArea()
        guard !isProgrammaticallyChangingFrame, let frame = window?.frame else { return }
        onFrameChanged?(widgetID, frame)
    }

    func windowDidBecomeKey(_ notification: Notification) {
        revealChrome()
        scheduleChromeHide()
    }

    override func mouseEntered(with event: NSEvent) {
        revealChrome()
    }

    override func mouseExited(with event: NSEvent) {
        scheduleChromeHide()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        setWebBackgroundOpacity()
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
                NSWorkspace.shared.open(url)
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
            NSWorkspace.shared.open(url)
        }
        return nil
    }

    private var currentSnapshot: [String: Any]?
    private var lastPushedRevision: Int?
    private var lastPushedStateRevision: Int?
    private var lastTrackingRevealHeight: CGFloat = -1

    private func setWebBackgroundOpacity() {
        webView.evaluateJavaScript(
            "document.documentElement.style.setProperty('--compact-widget-background-opacity', '\(backgroundOpacity)')"
        )
    }

    private func loadWidget() {
        lastPushedRevision = nil
        lastPushedStateRevision = nil
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

    private func addCompactAccessories(to panel: NSPanel) {
        let addButton = NSButton(
            image: NSImage(systemSymbolName: "plus", accessibilityDescription: "Add widget") ?? NSImage(),
            target: self,
            action: #selector(showAddWidgetMenu(_:))
        )
        addButton.bezelStyle = .texturedRounded
        addButton.controlSize = .small
        addButton.imagePosition = .imageOnly
        addButton.toolTip = "Add widget"

        let arrangeButton = NSButton(
            image: NSImage(systemSymbolName: "square.grid.2x2", accessibilityDescription: "Arrange widgets") ?? NSImage(),
            target: self,
            action: #selector(showArrangeWidgetsMenu(_:))
        )
        arrangeButton.bezelStyle = .texturedRounded
        arrangeButton.controlSize = .small
        arrangeButton.imagePosition = .imageOnly
        arrangeButton.toolTip = "Arrange widgets"

        let controls = NSStackView(views: [addButton, arrangeButton])
        controls.orientation = .horizontal
        controls.alignment = .centerY
        controls.spacing = 6
        controls.frame.size = controls.fittingSize
        let accessory = NSTitlebarAccessoryViewController()
        accessory.view = controls
        accessory.layoutAttribute = .right
        panel.addTitlebarAccessoryViewController(accessory)
        compactControls = controls
        compactAccessoryController = accessory
    }

    private func installChromeTracking(on panel: NSPanel) {
        guard let frameView = panel.contentView?.superview else { return }
        if let titlebarView = panel.standardWindowButton(.closeButton)?.superview {
            chromeBackground.material = .headerView
            chromeBackground.blendingMode = .withinWindow
            chromeBackground.state = .active
            chromeBackground.wantsLayer = true
            chromeBackground.layer?.cornerRadius = 10
            chromeBackground.layer?.cornerCurve = .continuous
            chromeBackground.layer?.masksToBounds = true
            chromeBackground.setAccessibilityElement(false)
            chromeBackground.frame = titlebarView.bounds
            chromeBackground.autoresizingMask = [.width, .height]
            titlebarView.addSubview(chromeBackground, positioned: .below, relativeTo: nil)
        }
        chromeTrackingView = frameView
        updateChromeTrackingArea()
    }

    private func updateChromeTrackingArea() {
        guard let frameView = chromeTrackingView else { return }
        let revealHeight = min(frameView.bounds.height, max(44, frameView.bounds.height - (window?.contentLayoutRect.maxY ?? 0) + 12))
        if chromeTrackingArea != nil, abs(revealHeight - lastTrackingRevealHeight) < 0.5 {
            return
        }
        lastTrackingRevealHeight = revealHeight
        if let chromeTrackingArea {
            frameView.removeTrackingArea(chromeTrackingArea)
        }
        let area = NSTrackingArea(
            rect: NSRect(x: 0, y: frameView.bounds.maxY - revealHeight, width: frameView.bounds.width, height: revealHeight),
            options: [.mouseEnteredAndExited, .activeAlways],
            owner: self,
            userInfo: nil
        )
        frameView.addTrackingArea(area)
        chromeTrackingArea = area
    }

    private func revealChrome() {
        chromeHideGeneration += 1
        setChromeVisible(true)
    }

    private func scheduleChromeHide() {
        chromeHideGeneration += 1
        let generation = chromeHideGeneration
        Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 1_800_000_000)
            guard let self,
                  self.chromeHideGeneration == generation,
                  !self.pointerIsInChromeRevealArea
            else { return }
            self.setChromeVisible(false)
        }
    }

    private var pointerIsInChromeRevealArea: Bool {
        guard let panel = window, panel.isVisible else { return false }
        let revealRect = NSRect(x: panel.frame.minX, y: panel.frame.maxY - 48, width: panel.frame.width, height: 48)
        return revealRect.contains(NSEvent.mouseLocation)
    }

    private func setChromeVisible(_ visible: Bool) {
        guard let panel = window else { return }
        let effectiveVisibility = visible || NSWorkspace.shared.isVoiceOverEnabled
        guard chromeVisible != effectiveVisibility else { return }
        chromeVisible = effectiveVisibility
        panel.titleVisibility = .hidden
        panel.titlebarAppearsTransparent = true

        let views: [NSView] = standardWindowButtons(in: panel).map { $0 as NSView }
            + [compactControls].compactMap { $0 }
            + [chromeBackground]
        views.forEach { $0.isHidden = false }
        let targetAlpha: CGFloat = effectiveVisibility ? 1 : 0
        if NSWorkspace.shared.accessibilityDisplayShouldReduceMotion {
            views.forEach { $0.alphaValue = targetAlpha }
        } else {
            NSAnimationContext.runAnimationGroup { context in
                context.duration = 0.16
                views.forEach { $0.animator().alphaValue = targetAlpha }
            }
        }

        guard !effectiveVisibility else { return }
        let generation = chromeHideGeneration
        Task { @MainActor [weak self] in
            if !NSWorkspace.shared.accessibilityDisplayShouldReduceMotion {
                try? await Task.sleep(nanoseconds: 170_000_000)
            }
            guard let self,
                  self.chromeHideGeneration == generation,
                  !self.chromeVisible
            else { return }
            views.forEach { $0.isHidden = true }
        }
    }

    private func standardWindowButtons(in panel: NSWindow) -> [NSButton] {
        [NSWindow.ButtonType.closeButton, .miniaturizeButton, .zoomButton]
            .compactMap { panel.standardWindowButton($0) }
    }

    @objc private func showAddWidgetMenu(_ sender: NSButton) {
        let menu = NSMenu(title: "Add Widget")
        for option in widgetCreationOptions {
            let item = NSMenuItem(title: option.title, action: #selector(requestWidgetCreation(_:)), keyEquivalent: "")
            item.target = self
            item.tag = option.widgetType
            menu.addItem(item)
        }
        if menu.items.isEmpty {
            let item = NSMenuItem(title: "No compact widgets available", action: nil, keyEquivalent: "")
            item.isEnabled = false
            menu.addItem(item)
        }
        menu.popUp(positioning: nil, at: NSPoint(x: 0, y: sender.bounds.maxY + 4), in: sender)
    }

    @objc private func requestWidgetCreation(_ sender: NSMenuItem) {
        onWidgetCreationRequested?(sender.tag)
    }

    @objc private func showArrangeWidgetsMenu(_ sender: NSButton) {
        let menu = NSMenu(title: "Arrange Widgets")
        let layouts: [(title: String, layout: WidgetPanelLayout)] = [
            ("Freeform", .freeform),
            ("Arrange in Row", .row),
            ("Arrange in Column", .column)
        ]
        for itemLayout in layouts {
            let item = NSMenuItem(title: itemLayout.title, action: #selector(requestLayout(_:)), keyEquivalent: "")
            item.target = self
            item.representedObject = itemLayout.layout.rawValue
            menu.addItem(item)
        }
        menu.popUp(positioning: nil, at: NSPoint(x: 0, y: sender.bounds.maxY + 4), in: sender)
    }

    @objc private func requestLayout(_ sender: NSMenuItem) {
        guard let rawLayout = sender.representedObject as? String,
              let layout = WidgetPanelLayout(rawValue: rawLayout)
        else { return }
        onLayoutRequested?(layout)
    }

    private static func collectionBehavior(joinsAllSpaces: Bool) -> NSWindow.CollectionBehavior {
        var behavior: NSWindow.CollectionBehavior = [.fullScreenAuxiliary]
        if joinsAllSpaces {
            behavior.insert(.canJoinAllSpaces)
        }
        return behavior
    }

    private static func contentAspectRatio(for descriptor: WidgetPanelDescriptor) -> NSSize {
        guard let aspectRatio = descriptor.aspectRatio, aspectRatio > 0 else { return .zero }
        return NSSize(width: aspectRatio, height: 1)
    }

}

private final class WidgetPanel: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}

private final class NonInteractiveVisualEffectView: NSVisualEffectView {
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
}

@MainActor
private final class WidgetPanelWebViewFactory {
    func makeWebView(widgetID: String) -> (webView: WKWebView, messageHandler: WidgetPanelScriptMessageHandler) {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.processPool = DashboardWebKitShared.panelProcessPool
        configuration.allowsAirPlayForMediaPlayback = false
        configuration.setURLSchemeHandler(DashboardWebKitShared.schemeHandler, forURLScheme: dashboardURLScheme)

        let userContentController = WKUserContentController()
        userContentController.addUserScript(WKUserScript(
            source: "window.__CLASSROOM_WIDGETS_MACOS__ = true; window.__CLASSROOM_WIDGET_PANEL__ = true;",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        ))
        let messageHandler = WidgetPanelScriptMessageHandler(widgetID: widgetID)
        userContentController.add(messageHandler, name: "classroomWidgetPanel")
        configuration.userContentController = userContentController

        let webView = WKWebView(frame: .zero, configuration: configuration)
        ClassroomWebViewTuning.apply(to: webView)
        webView.setValue(false, forKey: "drawsBackground")
        return (webView, messageHandler)
    }
}

@MainActor
private final class WidgetPanelScriptMessageHandler: NSObject, WKScriptMessageHandler {
    var onReady: (@MainActor (WidgetPanelReady) -> Void)?
    var onStateChange: (@MainActor (WidgetPanelStateChange) -> Void)?
    var onRandomiserListChange: (@MainActor (WidgetPanelRandomiserListChange) -> Void)?
    var onWritesCheckpoint: (@MainActor () -> Void)?

    private let widgetID: String

    init(widgetID: String) {
        self.widgetID = widgetID
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.request.url?.scheme == dashboardURLScheme,
              let body = message.body as? [String: Any],
              let type = body["type"] as? String
        else { return }

        let requestedWidgetID = body["widgetId"] as? String
        guard requestedWidgetID == nil || requestedWidgetID == widgetID else { return }
        let revision = (body["baseRevision"] as? NSNumber)?.intValue

        switch type {
        case "panel-ready":
            onReady?(WidgetPanelReady(widgetID: widgetID, revision: revision))
        case "panel-state-change":
            guard revision != nil, body["state"] != nil else { return }
            var payload = body
            payload.removeValue(forKey: "flush")
            onStateChange?(WidgetPanelStateChange(widgetID: widgetID, payload: payload))
        case "randomiser-list-save":
            guard (body["schemaVersion"] as? NSNumber)?.intValue == 1,
                  let name = body["name"] as? String,
                  !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                  let choices = body["choices"] as? [String],
                  choices.count <= 10_000
            else { return }
            onRandomiserListChange?(WidgetPanelRandomiserListChange(payload: body))
        case "randomiser-list-delete":
            guard (body["schemaVersion"] as? NSNumber)?.intValue == 1,
                  let id = body["id"] as? String,
                  !id.isEmpty
            else { return }
            onRandomiserListChange?(WidgetPanelRandomiserListChange(payload: body))
        case "panel-writes-checkpoint":
            onWritesCheckpoint?()
        default:
            return
        }
    }
}

private enum WidgetPanelLayoutEngine {
    static func frames(
        for panels: [(id: String, size: NSSize)],
        layout: WidgetPanelLayout,
        usableFrame: NSRect,
        gap: CGFloat = 12
    ) -> [String: NSRect] {
        var frames: [String: NSRect] = [:]
        switch layout {
        case .freeform:
            return frames
        case .row:
            var x = usableFrame.minX
            var y = usableFrame.maxY
            var rowHeight: CGFloat = 0
            for (index, panel) in panels.enumerated() {
                let size = constrained(panel.size, to: usableFrame.size)
                if x + size.width > usableFrame.maxX, x > usableFrame.minX {
                    x = usableFrame.minX
                    y -= rowHeight + gap
                    rowHeight = 0
                }
                if y - size.height < usableFrame.minY {
                    addCascadedFrames(for: panels[index...], to: &frames, usableFrame: usableFrame, gap: gap)
                    return frames
                }
                frames[panel.id] = NSRect(x: x, y: y - size.height, width: size.width, height: size.height)
                x += size.width + gap
                rowHeight = max(rowHeight, size.height)
            }
        case .column:
            var y = usableFrame.maxY
            var x = usableFrame.minX
            var columnWidth: CGFloat = 0
            for (index, panel) in panels.enumerated() {
                let size = constrained(panel.size, to: usableFrame.size)
                if y - size.height < usableFrame.minY, y < usableFrame.maxY {
                    x += columnWidth + gap
                    y = usableFrame.maxY
                    columnWidth = 0
                }
                if x + size.width > usableFrame.maxX {
                    addCascadedFrames(for: panels[index...], to: &frames, usableFrame: usableFrame, gap: gap)
                    return frames
                }
                y -= size.height
                frames[panel.id] = NSRect(x: x, y: y, width: size.width, height: size.height)
                y -= gap
                columnWidth = max(columnWidth, size.width)
            }
        }
        return frames
    }

    private static func addCascadedFrames(
        for panels: ArraySlice<(id: String, size: NSSize)>,
        to frames: inout [String: NSRect],
        usableFrame: NSRect,
        gap: CGFloat
    ) {
        let panelCount = CGFloat(panels.count)
        for (index, panel) in panels.enumerated() {
            let size = constrained(panel.size, to: usableFrame.size)
            let availableOffset = min(usableFrame.width - size.width, usableFrame.height - size.height)
            let step = min(gap, max(0, availableOffset) / panelCount)
            let offset = CGFloat(index + 1) * step
            frames[panel.id] = NSRect(
                x: usableFrame.minX + offset,
                y: usableFrame.maxY - size.height - offset,
                width: size.width,
                height: size.height
            )
        }
    }

    private static func constrained(_ size: NSSize, to maximumSize: NSSize) -> NSSize {
        NSSize(width: min(size.width, maximumSize.width), height: min(size.height, maximumSize.height))
    }
}
