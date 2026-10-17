import AppKit

/// Coordinates the bounded, one-widget-per-window compact presentation.
/// It deliberately owns native placement only; widget content and state still
/// arrive through the versioned host snapshot and per-panel web bridge.
@MainActor
final class WidgetPanelCoordinator: NSObject {
    var onPanelStateChange: (@MainActor (WidgetPanelStateChange) -> Void)?
    var onRandomiserListChange: (@MainActor (WidgetPanelRandomiserListChange) -> Void)?
    var onWidgetCreationRequested: (@MainActor (Int) -> Void)?
    var onDisplayPreviewRequested: (@MainActor () -> Void)?
    var onOutputVolumeChanged: (@MainActor (Double) -> Void)?
    var onWidgetRemovalRequested: (@MainActor (String) -> Void)?

    private let webViewFactory = WidgetPanelWebViewFactory()
    private var panelControllers: [String: WidgetPanelController] = [:]
    private var lastSnapshot: WidgetPanelSnapshot?
    private var freeformFrames: [String: NSRect] = [:]
    private(set) var layout: WidgetPanelLayout = .freeform
    private var compactPresentationActive = true
    private var lastFocusedWidgetID: String?
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
            lastFocusedWidgetID = nil
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
            if lastFocusedWidgetID == id { lastFocusedWidgetID = nil }
        }

        for descriptor in snapshot.widgets where !descriptor.id.isEmpty {
            let controller: WidgetPanelController
            if let existingController = panelControllers[descriptor.id] {
                controller = existingController
                let wasHidden = controller.isHidden
                controller.apply(descriptor: descriptor)
                if descriptor.hidden {
                    controller.hide()
                    if lastFocusedWidgetID == descriptor.id { lastFocusedWidgetID = nil }
                } else if wasHidden {
                    controller.show()
                }
            } else {
                controller = makePanelController(descriptor: descriptor)
                panelControllers[descriptor.id] = controller
                if descriptor.hidden {
                    controller.hide()
                }
            }
            controller.push(snapshot: descriptor.snapshotPayload)
        }

        if layout != .freeform {
            let layoutSignature = snapshot.widgets
                .filter { !$0.hidden }
                .map { "\($0.id):\($0.preferredContentSize.width)x\($0.preferredContentSize.height)" }
                .joined(separator: "|")
            if layoutSignature != lastLayoutSignature {
                lastLayoutSignature = layoutSignature
                arrange(layout)
            }
        }
        return true
    }

    /// Called only after checkpoint applications succeed. Revisions restart with
    /// the host, so compare state rather than revision numbers across instances.
    /// A no-op can use cached matching state; changed state needs fresh inventory.
    func hasAcknowledged(_ changes: [WidgetPanelStateChange]) -> Bool {
        guard let lastSnapshot else { return changes.isEmpty }
        return changes.allSatisfy { change in
            // A removed widget's flush is a successful no-op in the host.
            guard let widget = lastSnapshot.widgets.first(where: { $0.id == change.widgetID }) else { return true }
            guard let state = widget.snapshotPayload["state"],
                  let expected = change.payload["state"],
                  let stateData = try? JSONSerialization.data(withJSONObject: state, options: [.sortedKeys, .fragmentsAllowed]),
                  let expectedData = try? JSONSerialization.data(withJSONObject: expected, options: [.sortedKeys, .fragmentsAllowed])
            else { return false }
            return stateData == expectedData
        }
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
        lastFocusedWidgetID = nil
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

    var hasVisiblePanels: Bool { panelControllers.values.contains(where: isPresented) }

    func arrange(_ layout: WidgetPanelLayout, on screen: NSScreen? = nil) {
        let previousLayout = self.layout
        self.layout = layout
        guard layout != .freeform else {
            restoreFreeformFrames()
            return
        }

        let targetScreen = screen
            ?? selectedPanelController()?.window?.screen
            ?? orderedControllers.first(where: isPresented)?.window?.screen
            ?? NSScreen.main
        guard let targetScreen else { return }
        let usableFrame = targetScreen.visibleFrame.insetBy(dx: 12, dy: 12)
        // Reserve positions for loading panels before content readiness reveals them.
        let controllers = orderedControllers.filter { !$0.isHidden }

        if previousLayout == .freeform {
            freeformFrames.removeAll()
            for controller in orderedControllers where !controller.isHidden {
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

    /// Moves the selected panel (key, else most recently focused, else the
    /// only visible one) to the previous/next display in NSScreen order,
    /// keeping its size and work-area offset. Mirrors a manual drag: the new
    /// frame is persisted and arrange bookkeeping stays untouched.
    func moveSelectedPanel(_ direction: MoveDirection, workAreas: [CGRect]) {
        guard let controller = selectedPanelController(), let frame = controller.window?.frame else { return }
        guard let moved = WidgetPanelMoveGeometry.nextDisplayFrame(frame: frame, workAreas: workAreas, direction: direction) else { return }
        controller.setFrame(moved, animate: true)
        persist(frame: moved, for: controller.widgetID)
    }

    private func isPresented(_ controller: WidgetPanelController) -> Bool {
        controller.window?.isVisible == true && !controller.isHidden
    }

    private func selectedPanelController() -> WidgetPanelController? {
        if let key = panelControllers.values.first(where: {
            $0.window?.isKeyWindow == true && $0.window?.isVisible == true && !$0.isHidden
        }) {
            return key
        }
        if let lastFocusedWidgetID {
            guard let remembered = panelControllers[lastFocusedWidgetID],
                  remembered.window?.isVisible == true, !remembered.isHidden
            else { return nil }
            return remembered
        }
        let visible = panelControllers.values.filter { $0.window?.isVisible == true && !$0.isHidden }
        return visible.count == 1 ? visible.first : nil
    }

    func restoreFreeformFrames() {
        layout = .freeform
        for controller in orderedControllers where !controller.isHidden {
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
        let perfFields: [String: Any] = PerfProbe.isEnabled
            ? ["widgetId": descriptor.id, "widgetType": descriptor.snapshotPayload["widgetType"] ?? NSNull()]
            : [:]
        PerfProbe.mark("panel.create.begin", perfFields)
        defer { PerfProbe.mark("panel.create.end", perfFields) }
        let controller = WidgetPanelController(
            descriptor: descriptor,
            webViewFactory: webViewFactory,
            backgroundOpacity: panelBackgroundOpacity,
            keepOnAllSpaces: panelsJoinAllSpaces
        )
        controller.setWidgetCreationOptions(widgetCreationOptions)
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
        controller.onDisplayPreviewRequested = { [weak self] in
            self?.onDisplayPreviewRequested?()
        }
        controller.onOutputVolumeChanged = { [weak self] volume in
            self?.onOutputVolumeChanged?(volume)
        }
        controller.onLayoutRequested = { [weak self, weak controller] layout in
            self?.arrange(layout, on: controller?.window?.screen)
        }
        controller.onFrameChanged = { [weak self] widgetID, frame in
            self?.persist(frame: frame, for: widgetID)
        }
        controller.onBecameKey = { [weak self] widgetID in
            self?.lastFocusedWidgetID = widgetID
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
        let existingFrames = panelControllers.values.filter { !$0.isHidden }.compactMap(\.window?.frame)
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

    // MARK: Benchmark hooks for PerfScenario

    /// Closes a panel the way its close button does.
    func perfClose(widgetID: String) {
        guard let controller = panelControllers[widgetID], let window = controller.window else { return }
        _ = controller.windowShouldClose(window)
    }

    func perfReload(widgetID: String) {
        panelControllers[widgetID]?.perfReload()
    }

    func perfEvaluate(widgetID: String, script: String, arguments: [String: Any] = [:]) async -> Any? {
        await panelControllers[widgetID]?.perfEvaluate(script, arguments: arguments)
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
