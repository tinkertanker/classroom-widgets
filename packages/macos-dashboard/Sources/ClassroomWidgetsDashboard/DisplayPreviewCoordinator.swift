import AppKit
import CoreGraphics

@MainActor
final class DisplayPreviewCoordinator: NSObject {
    // Members without `private` are shared with the DisplayPreviewCoordinator+*.swift extensions.
    enum Keys {
        static let sourceUUID = "displayPreviewSourceUUIDV1"
        static let frame = "displayPreviewWindowFrameV1"
    }

    let catalog: DisplayCatalog
    let defaults: UserDefaults
    let defaultsWriter: DebouncedDefaultsWriter
    let hostDisplayID: @MainActor (NSWindow?) -> CGDirectDisplayID?
    private let overlapsSource: (@MainActor (DisplayDescriptor, NSWindow?) -> Bool)?
    let preflightCaptureAccess: @MainActor () -> Bool
    let requestPermission: (@MainActor () -> Bool)?
    let makeCaptureSession: @MainActor (CGDirectDisplayID) -> DisplayCaptureSession
    var intent = DisplayPreviewIntent()
    private(set) var windowController: DisplayPreviewWindowController?
    var selectedSource: DisplayDescriptor?
    var session: DisplayCaptureSession?
    var presentedGeometry: DisplayPreviewFrameGeometry? {
        get { windowController?.presentedGeometry }
        set { windowController?.presentedGeometry = newValue }
    }
    var stopLifecycle = DisplayPreviewStopLifecycle()
    var stopOperation: DisplayPreviewStopOperation?
    var pendingStopPresentation = DisplayPreviewPendingStopPresentation()
    var autoResume = DisplayPreviewAutoResumeState()
    var frameRecovery = DisplayPreviewFrameRecovery()
    var captureOrder = DisplayPreviewCaptureOrder()
    var recoveryTask: Task<Void, Never>?
    var reconnect: DisplayPreviewReconnectPolicy
    var reconnectTask: Task<Void, Never>?
    let reconnectDebounceNanoseconds: UInt64
    var closeTrigger: String?
    var autoReopenedAt: Date?
    var deliveredFrameGeneration: UInt64?
    var streamActivityGeneration: UInt64?
    private var pendingOpeningAspect = false
    private var backgroundOpacity = 1.0
    private var keepOnAllSpaces = true
    private var observers: [NSObjectProtocol] = []

    init(
        catalog: DisplayCatalog? = nil,
        defaults: UserDefaults = .standard,
        hostDisplayID: @escaping @MainActor (NSWindow?) -> CGDirectDisplayID? = {
            DisplayCatalog.displayID(for: $0?.screen)
        },
        overlapsSource: (@MainActor (DisplayDescriptor, NSWindow?) -> Bool)? = nil,
        preflightCaptureAccess: @escaping @MainActor () -> Bool = { CGPreflightScreenCaptureAccess() },
        requestPermission: (@MainActor () -> Bool)? = nil,
        makeCaptureSession: @escaping @MainActor (CGDirectDisplayID) -> DisplayCaptureSession = {
            DisplayCaptureSession(sourceID: $0)
        },
        reconnectDebounceNanoseconds: UInt64 = DisplayPreviewReconnectPolicy.debounceNanoseconds
    ) {
        let catalog = catalog ?? DisplayCatalog()
        self.catalog = catalog
        reconnect = DisplayPreviewReconnectPolicy(
            externalDisplayAvailable: DisplayPreviewReconnectPolicy.hasExternalDisplay(in: catalog.displays())
        )
        self.defaults = defaults
        defaultsWriter = DebouncedDefaultsWriter(defaults: defaults)
        self.hostDisplayID = hostDisplayID
        self.overlapsSource = overlapsSource
        self.preflightCaptureAccess = preflightCaptureAccess
        self.requestPermission = requestPermission
        self.makeCaptureSession = makeCaptureSession
        self.reconnectDebounceNanoseconds = reconnectDebounceNanoseconds
        super.init()
        observers.append(NotificationCenter.default.addObserver(
            forName: NSApplication.didChangeScreenParametersNotification, object: nil, queue: .main
        ) { [weak self] _ in MainActor.assumeIsolated { self?.screenParametersChanged() } })
        observers.append(NSWorkspace.shared.notificationCenter.addObserver(
            forName: NSWorkspace.willSleepNotification, object: nil, queue: .main
        ) { [weak self] _ in MainActor.assumeIsolated { self?.interrupt(message: "Paused because the Mac is going to sleep.") } })
        observers.append(NSWorkspace.shared.notificationCenter.addObserver(
            forName: NSWorkspace.sessionDidResignActiveNotification, object: nil, queue: .main
        ) { [weak self] _ in MainActor.assumeIsolated { self?.interrupt(message: "Paused because the user session became inactive.") } })
    }

    deinit {
        for observer in observers { NotificationCenter.default.removeObserver(observer) }
    }

    /// `activatingApp: false` is for automatic reopening, which must not steal focus.
    func open(activatingApp: Bool = true) {
        reconnect.windowOpened()
        autoReopenedAt = activatingApp ? nil : Date()
        if let window = windowController?.window {
            window.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
            switch DisplayPreviewLaunchPolicy.outcome(
                existingWindow: true,
                wantsCapture: intent.wantsCapture,
                hasPendingRestart: autoResume.hasPendingRestart,
                hasSelectedSource: selectedSource != nil
            ) {
            case .raiseAndStart:
                logDisplayTransition(.raise, trigger: "deliberateLaunch", intent: intent.wantsCapture, enabled: true)
                start(trigger: .launch)
            case .raiseOnly:
                logDisplayTransition(.raise, trigger: "deliberateLaunch", intent: intent.wantsCapture, enabled: selectedSource != nil)
            case .createWithoutStart, .createAndStart:
                break
            }
            return
        }
        intent.open()
        pendingOpeningAspect = true
        let frame = restoredFrame() ?? initialFrame()
        let controller = DisplayPreviewWindowController(
            frame: frame, backgroundOpacity: backgroundOpacity, keepOnAllSpaces: keepOnAllSpaces
        )
        windowController = controller
        wire(controller)
        refreshSources(preselect: true)
        logDisplayTransition(
            .open,
            trigger: "deliberateLaunch",
            source: selectedSource,
            intent: intent.wantsCapture,
            enabled: selectedSource != nil
        )
        if activatingApp {
            controller.window?.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
        } else {
            controller.window?.orderFrontRegardless()
        }
        if DisplayPreviewLaunchPolicy.outcome(
            existingWindow: false,
            wantsCapture: intent.wantsCapture,
            hasPendingRestart: autoResume.hasPendingRestart,
            hasSelectedSource: selectedSource != nil
        ) == .createAndStart {
            start(trigger: .launch)
        }
    }

    func dismiss() {
        // Closing the native window invokes its delegate and the shared cleanup
        // path, which revokes capture intent before asynchronous stops finish.
        windowController?.close()
    }

    func toggle() {
        if windowController == nil { open() }
        else { dismiss() }
    }

    func applyPresentationSettings(backgroundOpacity: Double, keepOnAllSpaces: Bool) {
        self.backgroundOpacity = backgroundOpacity
        self.keepOnAllSpaces = keepOnAllSpaces
        windowController?.applyPresentationSettings(backgroundOpacity: backgroundOpacity, keepOnAllSpaces: keepOnAllSpaces)
    }

    func restartIfRunning() {
        guard intent.wantsCapture else { return }
        logDisplayTransition(
            .deferredRestart,
            trigger: "reloadWidgets",
            source: selectedSource,
            intent: true,
            enabled: true
        )
        autoResume.requestRestart(sourceUUID: selectedSource?.uuid)
        pause(message: "Restarting preview…", preservingDeferredRestart: true)
    }

    func flushPersistedState() { defaultsWriter.flush() }

    func prepareForTermination() async -> Bool {
        stopLifecycle.beginTermination()
        reconnectTask?.cancel()
        cancelDeferredRestarts()
        cancelFrameRecovery()
        intent.pause()
        clearFrame(status: "Paused while Classroom Widgets quits.")
        logDisplayTransition(
            .termination,
            trigger: "prepareForTermination",
            source: selectedSource,
            intent: false,
            enabled: session != nil
        )
        guard let session else { return true }
        if stopLifecycle.isBlocked {
            if stopOperation?.matches(session) == true, stopOperation?.state == .running {
                // Join the still-running cleanup below without issuing another stop.
            } else {
                guard stopLifecycle.retryBlockedStop(of: session) else { return false }
            }
        } else if !stopLifecycle.isStopping {
            guard stopLifecycle.beginStop(of: session) else { return false }
        }
        logDisplayTransition(
            .stop,
            trigger: "termination",
            reason: "prepareForTermination",
            source: selectedSource,
            intent: false,
            enabled: true
        )
        let stopped = await stopWithTimeout(session, retryFailed: true)
        if stopped {
            let reconciled = reconcileConfirmedStop(of: session)
            return reconciled || self.session == nil
        }
        if stopLifecycle.stopDidNotComplete(for: session) {
            DashboardLog.windowing.error("Display Preview stream did not stop within the cleanup deadline")
        }
        return false
    }

    func terminationCancelled() {
        stopLifecycle.cancelTermination()
        cancelDeferredRestarts()
        windowController?.showStatus(
            "Quit was cancelled. Preview remains paused; turn the preview on when ready.",
            powerState: .off, powerEnabled: session == nil, centerEnabled: false
        )
    }

    private func wire(_ controller: DisplayPreviewWindowController) {
        controller.onSourceSelected = { [weak self] id in self?.selectSource(id) }
        controller.onPrepareSourceMenu = { [weak self] in self?.refreshSourceMenu() }
        controller.onToggleCapture = { [weak self] in self?.toggleCapture() }
        controller.onMoveToCenter = { [weak self] in self?.movePointerToCenter() }
        controller.onClose = { [weak self] in self?.close() }
        controller.onFrameChanged = { [weak self] frame in
            self?.persist(frame: frame)
            self?.validateWindowPlacement()
        }
        controller.onVisibilityChanged = { [weak self] visible in self?.visibilityChanged(visible) }
        controller.previewView.onCompletedPrimaryClick = { [weak self] point, _ in self?.warp(from: point) }
    }

    func refreshSources(preselect: Bool) {
        let hostID = hostDisplayID(windowController?.window)
        let candidates = catalog.eligibleSources(hostDisplayID: hostID)
        if preselect {
            selectPreselectedSource(from: candidates)
        }
        windowController?.setSources(candidates, selectedID: selectedSource?.id)
        if candidates.isEmpty {
            windowController?.showStatus(
                "Connect another display or use an extended desktop.",
                powerState: .off, powerEnabled: false, centerEnabled: false
            )
        } else if let selectedSource {
            windowController?.showStatus(DisplayPreviewPresentation.ready(sourceName: selectedSource.name))
        } else {
            windowController?.showStatus(
                "Choose a source display, then turn the preview on.",
                powerState: .off, powerEnabled: false, centerEnabled: false
            )
        }
        normalizeOpeningAspectIfNeeded()
    }

    /// Host eligibility changes when the window moves, not just when displays
    /// reconnect. Refresh at menu opening without resetting capture or status.
    private func refreshSourceMenu() {
        let candidates = catalog.eligibleSources(hostDisplayID: hostDisplayID(windowController?.window))
        let current = selectedSource.flatMap { source -> DisplayDescriptor? in
            guard let match = catalog.currentMatching(source), match.id == source.id else { return nil }
            return match
        }
        windowController?.setSources(
            candidates, selectedID: current?.id, retainingSelectedSource: current
        )
    }

    /// Re-resolves the source on a fresh launch. The in-memory descriptor and the
    /// saved UUID are both validated against the fresh candidate list, so a source
    /// that was unplugged and replugged with a new `CGDirectDisplayID` is matched by
    /// UUID instead of being captured by a stale identifier.
    private func selectPreselectedSource(from candidates: [DisplayDescriptor]) {
        let savedUUID = defaults.string(forKey: Keys.sourceUUID)
        let remembered = [selectedSource?.uuid, savedUUID].compactMap { $0 }
        selectedSource = catalog.resolveSource(rememberedUUIDs: remembered, among: candidates)
        intent.select(sourceID: selectedSource?.id)
    }

    /// A fresh deliberate launch sizes the preview viewport to the source display
    /// aspect once. The same smaller-side fit keeps later resizes and source changes
    /// aspect-matched; the menu item re-snaps on demand.
    private func normalizeOpeningAspectIfNeeded() {
        guard pendingOpeningAspect, let source = selectedSource, let controller = windowController else { return }
        pendingOpeningAspect = false
        let aspect = source.bounds.width / source.bounds.height
        guard controller.matchSourceAspect(aspect, animated: false) else { return }
        logDisplayTransition(
            .open,
            trigger: "openingAspect",
            source: source,
            intent: intent.wantsCapture,
            enabled: true,
            extra: "aspect=\(String(format: "%.3f", aspect))"
        )
    }

    func selectSource(_ id: CGDirectDisplayID?) {
        let hostID = hostDisplayID(windowController?.window)
        let candidates = catalog.eligibleSources(hostDisplayID: hostID)
        guard let source = candidates.first(where: { $0.id == id }), source != selectedSource else {
            // Re-picking the current source still makes it the saved choice.
            if let current = selectedSource, current.id == id { defaultsWriter.set(current.uuid, forKey: Keys.sourceUUID) }
            // A menu action can outlive its host/topology snapshot. Restore the
            // accepted selection rather than cancelling its overlap-resume intent.
            refreshSourceMenu()
            return
        }
        cancelDeferredRestarts()
        cancelFrameRecovery()
        intent.select(sourceID: source.id)
        selectedSource = source
        presentedGeometry = nil
        windowController?.clearFrame()
        windowController?.setSources(candidates, selectedID: source.id)
        defaultsWriter.set(source.uuid, forKey: Keys.sourceUUID)
        logDisplayTransition(
            .sourceSelected,
            trigger: "sourceMenu",
            source: source,
            intent: intent.wantsCapture,
            enabled: true
        )
        let readyPresentation = DisplayPreviewPresentation.ready(sourceName: source.name)
        stopCurrent(
            message: readyPresentation.message,
            completionPresentation: readyPresentation
        )
        normalizeOpeningAspectIfNeeded()
    }

    private func toggleCapture() {
        if autoResume.hasPendingRestart {
            logDisplayTransition(
                .pause, trigger: "powerToggle", source: selectedSource, intent: false, enabled: true
            )
            autoResume.cancel()
            pause(message: "Paused.")
        } else if intent.wantsCapture {
            logDisplayTransition(
                .pause, trigger: "powerToggle", source: selectedSource, intent: false, enabled: true
            )
            pause(message: "Paused.")
        } else {
            start()
        }
    }

    private func close() {
        cancelDeferredRestarts()
        cancelFrameRecovery()
        session?.cancel()
        intent.close()
        clearFrame(status: "Closed.")
        logDisplayTransition(
            .close, trigger: closeTrigger ?? "closeButton", source: selectedSource, intent: false, enabled: false
        )
        persist(frame: windowController?.window?.frame ?? .zero)
        defaultsWriter.flush()
        windowController = nil
        reconnect.windowClosed()
        stopCurrent(message: "Closed.")
    }

    private func interrupt(message: String) {
        guard windowController != nil else { return }
        cancelDeferredRestarts()
        logDisplayTransition(
            .pause, trigger: "systemInterrupt", source: selectedSource, intent: false, enabled: true
        )
        pause(message: message)
    }

    private func visibilityChanged(_ visible: Bool) {
        if !visible {
            if autoResume.hidden(wasRunning: intent.wantsCapture, sourceUUID: selectedSource?.uuid) == .suspend {
                logDisplayTransition(
                    .hidden, trigger: "miniaturize", source: selectedSource, intent: false, enabled: true
                )
                pause(message: "Preview suspended while its window is hidden.", preservingDeferredRestart: true)
                publishStopStatus("Preview suspended while its window is hidden.")
            }
        } else {
            switch autoResume.revealed(
                sessionExists: session != nil,
                currentSourceUUID: selectedSource?.uuid
            ) {
            case .startNow:
                logDisplayTransition(
                    .revealed, trigger: "deminiaturize", source: selectedSource, intent: true, enabled: true
                )
                start(trigger: .visibilityResume)
            case .startAfterStop, .suspend, .none: break
            }
        }
    }

    private func warp(from point: CGPoint) {
        guard let geometry = presentedGeometry, let expected = selectedSource,
              intent.wantsCapture, catalog.currentMatching(expected) != nil,
              !sourceOverlapsPreview(expected),
              geometry.sourceID == expected.id,
              let target = DisplayPreviewGeometry.target(
                topLeftPoint: point, geometry: geometry, currentTopologyRevision: catalog.topologyRevision
              )
        else { return }
        let result = CGWarpMouseCursorPosition(target)
        if result != .success {
            controllerStatus("Could not move the pointer (error \(result.rawValue)). Preview remains live.", powerState: .on, enabled: true)
        }
    }

    private func movePointerToCenter() {
        guard presentedGeometry != nil, let source = selectedSource, intent.wantsCapture,
              catalog.currentMatching(source) != nil, !sourceOverlapsPreview(source)
        else { return }
        let target = CGPoint(x: source.bounds.midX, y: source.bounds.midY)
        if CGWarpMouseCursorPosition(target) != .success {
            controllerStatus("Could not move the pointer. Preview remains live.", powerState: .on, enabled: true)
        }
    }

    func clearFrame(status: String) {
        presentedGeometry = nil
        windowController?.clearFrame()
        controllerStatus(status, enabled: selectedSource != nil && !stopLifecycle.isBlocked)
    }

    func controllerStatus(
        _ message: String,
        powerState: DisplayPreviewPowerState? = nil,
        enabled: Bool
    ) {
        windowController?.showStatus(
            message,
            powerState: powerState ?? currentPowerState,
            powerEnabled: enabled,
            centerEnabled: false
        )
    }

    func validateWindowPlacement() {
        guard let source = selectedSource else { return }
        switch autoResume.placementChanged(
            overlapsSource: sourceOverlapsPreview(source),
            wasRunning: intent.wantsCapture,
            sessionExists: session != nil,
            sourceUUID: source.uuid
        ) {
        case .suspend:
            let message = "Preview suspended while it overlaps the source display. Move it fully clear to resume."
            logDisplayTransition(
                .overlapSuspend, trigger: "windowPlacement", source: source, intent: false, enabled: true
            )
            pause(message: message, preservingDeferredRestart: true)
            publishStopStatus(message)
        case .startNow:
            logDisplayTransition(
                .overlapResume, trigger: "windowPlacement", source: source, intent: true, enabled: true
            )
            start(trigger: .visibilityResume)
        case .none, .startAfterStop: break
        }
    }

    func sourceOverlapsPreview(_ source: DisplayDescriptor) -> Bool {
        if let overlapsSource { return overlapsSource(source, windowController?.window) }
        guard let windowFrame = windowController?.window?.frame,
              let sourceScreen = NSScreen.screens.first(where: { DisplayCatalog.displayID(for: $0) == source.id })
        else { return true }
        return windowFrame.intersection(sourceScreen.frame).area > 0
    }

    private func persist(frame: NSRect) {
        guard frame.width >= 320, frame.height >= 240 else { return }
        defaultsWriter.set(NSStringFromRect(frame), forKey: Keys.frame)
    }

    private func restoredFrame() -> NSRect? {
        guard let value = defaults.string(forKey: Keys.frame) else { return nil }
        let frame = NSRectFromString(value)
        guard frame.width >= 320, frame.height >= 240,
              let screen = NSScreen.screens.max(by: { $0.frame.intersection(frame).area < $1.frame.intersection(frame).area }),
              screen.frame.intersection(frame).area > 0
        else { return nil }
        return frame.clamped(to: screen.visibleFrame.insetBy(dx: 12, dy: 12))
    }

    private func initialFrame() -> NSRect {
        let point = NSEvent.mouseLocation
        let screen = NSScreen.screens.first { $0.frame.contains(point) } ?? NSScreen.screens.first
        let size = NSSize(width: 480, height: 360)
        let origin = CGPoint(x: (screen?.visibleFrame.midX ?? 0) - size.width / 2, y: (screen?.visibleFrame.midY ?? 0) - size.height / 2)
        return NSRect(origin: origin, size: size).clamped(to: screen?.visibleFrame.insetBy(dx: 12, dy: 12) ?? .zero)
    }
}
