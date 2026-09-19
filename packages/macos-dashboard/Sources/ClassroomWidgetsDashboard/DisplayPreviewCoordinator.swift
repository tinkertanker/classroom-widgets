import AppKit
import CoreGraphics

@MainActor
final class DisplayPreviewCoordinator: NSObject {
    private enum Keys {
        static let sourceUUID = "displayPreviewSourceUUIDV1"
        static let frame = "displayPreviewWindowFrameV1"
    }

    private let catalog: DisplayCatalog
    private let defaults: UserDefaults
    private let defaultsWriter: DebouncedDefaultsWriter
    private let hostDisplayID: @MainActor (NSWindow?) -> CGDirectDisplayID?
    private let overlapsSource: (@MainActor (DisplayDescriptor, NSWindow?) -> Bool)?
    private let preflightCaptureAccess: @MainActor () -> Bool
    private let requestPermission: (@MainActor () -> Bool)?
    private let makeCaptureSession: @MainActor (CGDirectDisplayID) -> DisplayCaptureSession
    private var intent = DisplayPreviewIntent()
    private(set) var windowController: DisplayPreviewWindowController?
    private var selectedSource: DisplayDescriptor?
    private(set) var session: DisplayCaptureSession?
    private var presentedGeometry: DisplayPreviewFrameGeometry? {
        get { windowController?.presentedGeometry }
        set { windowController?.presentedGeometry = newValue }
    }
    private var stopLifecycle = DisplayPreviewStopLifecycle()
    private var stopOperation: DisplayPreviewStopOperation?
    private var pendingStopPresentation = DisplayPreviewPendingStopPresentation()
    private var autoResume = DisplayPreviewAutoResumeState()
    private var frameRecovery = DisplayPreviewFrameRecovery()
    private var captureOrder = DisplayPreviewCaptureOrder()
    private var recoveryTask: Task<Void, Never>?
    private var deliveredFrameGeneration: UInt64?
    private var streamActivityGeneration: UInt64?
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
        }
    ) {
        self.catalog = catalog ?? DisplayCatalog()
        self.defaults = defaults
        defaultsWriter = DebouncedDefaultsWriter(defaults: defaults)
        self.hostDisplayID = hostDisplayID
        self.overlapsSource = overlapsSource
        self.preflightCaptureAccess = preflightCaptureAccess
        self.requestPermission = requestPermission
        self.makeCaptureSession = makeCaptureSession
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

    func open() {
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
        controller.window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        if DisplayPreviewLaunchPolicy.outcome(
            existingWindow: false,
            wantsCapture: intent.wantsCapture,
            hasPendingRestart: autoResume.hasPendingRestart,
            hasSelectedSource: selectedSource != nil
        ) == .createAndStart {
            start(trigger: .launch)
        }
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

    private func refreshSources(preselect: Bool) {
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

    private func selectSource(_ id: CGDirectDisplayID?) {
        let hostID = hostDisplayID(windowController?.window)
        let source = catalog.eligibleSources(hostDisplayID: hostID).first { $0.id == id }
        guard source != selectedSource else { return }
        cancelDeferredRestarts()
        cancelFrameRecovery()
        intent.select(sourceID: source?.id)
        selectedSource = source
        presentedGeometry = nil
        windowController?.clearFrame()
        if let source { defaultsWriter.set(source.uuid, forKey: Keys.sourceUUID) }
        logDisplayTransition(
            .sourceSelected,
            trigger: "sourceMenu",
            source: source,
            intent: intent.wantsCapture,
            enabled: source != nil
        )
        let readyPresentation = source.map { DisplayPreviewPresentation.ready(sourceName: $0.name) }
        stopCurrent(
            message: readyPresentation?.message ?? "Choose a source display.",
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

    private func start(trigger: DisplayPreviewStartTrigger = .explicit) {
        guard stopLifecycle.canStart, session == nil, let source = selectedSource,
              let controller = windowController, let window = controller.window,
              !sourceOverlapsPreview(source)
        else {
            if stopLifecycle.isBlocked {
                controllerStatus("The previous stream could not stop. Quit Classroom Widgets to recover.", enabled: false)
            } else if let source = selectedSource,
                      DisplayPreviewDeferredStartPolicy.shouldDefer(
                        trigger: trigger,
                        isStopping: stopLifecycle.isStopping,
                        isTerminating: stopLifecycle.terminating
                      ),
                      !sourceOverlapsPreview(source) {
                // A deliberate launch arrived while the owned stop is still in
                // flight, and nothing else blocks it. Retain it for this source;
                // the matching cleanup consumes it and starts preflight-only, so
                // no permission dialog appears.
                autoResume.requestRestart(sourceUUID: source.uuid)
                logDisplayTransition(
                    .deferredRestart,
                    trigger: "launchDuringOwnedStop",
                    source: source,
                    intent: false,
                    enabled: true
                )
                controllerStatus("Starting when the previous preview finishes stopping…", enabled: true)
            } else if selectedSource != nil {
                controllerStatus("Move the preview to a different display before starting.", enabled: true)
            }
            return
        }
        let preflightGranted = preflightCaptureAccess()
        guard DisplayPreviewPermissionPolicy.canStart(
            for: trigger,
            preflightGranted: preflightGranted
        ) else {
            intent.pause()
            autoResume.cancel()
            logDisplayTransition(
                .startFailed,
                trigger: trigger.logLabel,
                reason: "permissionPreflightDenied",
                source: source,
                intent: false,
                enabled: true
            )
            controllerStatus(
                "Screen Recording access is off. Turn the preview on to request access again.",
                enabled: true
            )
            return
        }
        if DisplayPreviewPermissionPolicy.shouldRequestPermission(
            for: trigger,
            preflightGranted: preflightGranted
        ) {
            guard requestCapturePermission() else { return }
        }
        guard let generation = intent.start() else { return }
        deliveredFrameGeneration = nil
        streamActivityGeneration = nil
        captureOrder.reset()
        cancelFrameRecovery()
        logDisplayTransition(
            .start,
            trigger: trigger.logLabel,
            source: source,
            intent: true,
            enabled: true,
            generation: generation
        )
        controller.showStatus("Starting…", powerState: .on, powerEnabled: true, centerEnabled: false)
        let capture = makeCaptureSession(source.id)
        session = capture
        stopLifecycle.adopt(capture)
        capture.onFrameActivity = { [weak self, weak capture] in
            guard let self, let capture, self.session === capture,
                  self.intent.accepts(generation: generation, sourceID: source.id)
            else { return }
            // Static `.idle`/`.started` statuses prove the stream is alive even
            // though they never deliver an image.
            self.streamActivityGeneration = generation
        }
        capture.onFrame = { [weak self, weak capture] buffer, size, sequence in
            guard let self, let capture, self.session === capture,
                  self.intent.accepts(generation: generation, sourceID: source.id),
                  self.catalog.currentMatching(source) != nil,
                  self.captureOrder.acceptsFrame(sequence: sequence)
            else { return }
            let isFirstDeliveredFrame = self.deliveredFrameGeneration != generation
            self.deliveredFrameGeneration = generation
            self.streamActivityGeneration = generation
            if self.frameRecovery.frameRestored(generation: generation) == .restored {
                self.cancelRecoveryTask()
                self.logDisplayTransition(
                    .recovered,
                    trigger: "frame",
                    source: source,
                    intent: true,
                    enabled: true,
                    generation: generation
                )
            }
            guard self.windowController?.showFrame(buffer, size: size) == true else {
                self.clearFrame(status: "The preview renderer stopped. Turn the preview off, then on to retry.")
                return
            }
            guard let publishedRect = self.windowController?.previewView.fittedImageRectTopLeft() else { return }
            self.presentedGeometry = DisplayPreviewFrameGeometry(
                imageRect: publishedRect, sourceBounds: source.bounds,
                sourceID: source.id, topologyRevision: self.catalog.topologyRevision
            )
            self.windowController?.showStatus(
                DisplayPreviewStatus.live(sourceName: source.name),
                powerState: .on, powerEnabled: true, centerEnabled: true
            )
            if isFirstDeliveredFrame {
                self.logDisplayTransition(
                    .firstFrame,
                    trigger: "frame",
                    source: source,
                    intent: true,
                    enabled: true,
                    generation: generation
                )
            }
        }
        capture.onTransientGap = { [weak self, weak capture] reason, sequence in
            guard let self, let capture,
                  DisplayPreviewCaptureCallbackPolicy.mayChangeIntent(
                    ownsSession: self.session === capture,
                    acceptsGeneration: self.intent.accepts(generation: generation, sourceID: source.id)
                  ),
                  self.captureOrder.acceptsHoldEvent(sequence: sequence)
            else { return }
            self.holdForFrameGap(
                generation: generation,
                source: source,
                capture: capture,
                reason: reason,
                message: DisplayPreviewStatus.reconnecting(sourceName: source.name)
            )
        }
        capture.onStop = { [weak self, weak capture] error in
            guard let self, let capture, self.session === capture else { return }
            let mayChangeIntent = DisplayPreviewCaptureCallbackPolicy.mayChangeIntent(
                ownsSession: true,
                acceptsGeneration: self.intent.accepts(generation: generation, sourceID: source.id)
            )
            guard self.reconcileTerminalStop(of: capture) else { return }
            // Domain and code only: a localized description can carry window titles.
            let stopReason = "delegateTerminal:\((error as NSError).domain)/\((error as NSError).code)"
            if mayChangeIntent {
                self.logDisplayTransition(
                    .stop,
                    trigger: "delegateTerminal",
                    reason: stopReason,
                    source: source,
                    intent: false,
                    enabled: true,
                    generation: generation
                )
                self.pendingStopPresentation.clear()
                self.cancelDeferredRestarts()
                self.intent.pause()
                self.clearFrame(status: "Capture stopped: \(error.localizedDescription)")
            } else if self.autoResume.stopCompleted(
                currentSourceUUID: self.selectedSource?.uuid,
                terminating: self.stopLifecycle.terminating
            ) {
                self.logDisplayTransition(
                    .stop,
                    trigger: "deferredRestartStopCompleted",
                    reason: stopReason,
                    source: source,
                    intent: false,
                    enabled: true,
                    generation: generation
                )
                self.pendingStopPresentation.clear()
                self.start(trigger: .visibilityResume)
            } else {
                self.logDisplayTransition(
                    .stop,
                    trigger: "ownedStopCompleted",
                    reason: stopReason,
                    source: source,
                    intent: self.intent.wantsCapture,
                    enabled: true,
                    generation: generation
                )
                self.publishPendingStopPresentation()
            }
        }
        capture.onUnavailable = { [weak self, weak capture] reason, sequence in
            guard let self, let capture,
                  DisplayPreviewCaptureCallbackPolicy.mayChangeIntent(
                    ownsSession: self.session === capture,
                    acceptsGeneration: self.intent.accepts(generation: generation, sourceID: source.id)
                  ),
                  self.captureOrder.acceptsTerminalEvent(sequence: sequence)
            else { return }
            self.cancelFrameRecovery()
            self.cancelDeferredRestarts()
            let message = DisplayPreviewStatus.unavailable(sourceName: source.name)
            self.logDisplayTransition(
                .streamStopped,
                trigger: "frameStatus",
                reason: reason.rawValue,
                source: source,
                intent: false,
                enabled: true,
                generation: generation
            )
            self.clearFrame(status: message)
            self.intent.pause()
            self.stopCurrent(message: message)
        }
        let outputSize = captureOutputSize(for: source, view: controller.previewView)
        Task { @MainActor [weak self, weak capture] in
            guard let self, let capture else { return }
            guard self.session === capture,
                  self.intent.accepts(generation: generation, sourceID: source.id)
            else { return }
            do {
                try await capture.start(excludingWindowID: CGWindowID(window.windowNumber), outputSize: outputSize)
                guard self.session === capture, self.intent.accepts(generation: generation, sourceID: source.id) else {
                    guard self.stopLifecycle.beginStop(of: capture) else { return }
                    if await self.stopWithTimeout(capture) {
                        _ = self.reconcileConfirmedStop(of: capture)
                    } else {
                        _ = self.stopLifecycle.stopDidNotComplete(for: capture)
                    }
                    return
                }
                self.beginFirstFrameTimeout(generation: generation, sourceID: source.id, capture: capture)
            } catch {
                if self.stopLifecycle.release(capture) { self.session = nil }
                guard self.intent.accepts(generation: generation, sourceID: source.id) else { return }
                self.logDisplayTransition(
                    .startFailed,
                    trigger: "start",
                    reason: "startThrew",
                    source: source,
                    intent: false,
                    enabled: true,
                    generation: generation
                )
                self.intent.pause()
                self.clearFrame(status: "Unable to start: \(error.localizedDescription)")
            }
        }
    }

    private func requestCapturePermission() -> Bool {
        if let requestPermission { return requestPermission() }
        let alert = NSAlert()
        alert.messageText = "Allow Screen Recording"
        alert.informativeText = "Display Preview needs Screen Recording access to show the selected display. Capture stays on this Mac and stops when you pause or close the preview."
        alert.addButton(withTitle: "Continue")
        alert.addButton(withTitle: "Cancel")
        guard alert.runModal() == .alertFirstButtonReturn else {
            controllerStatus("Screen Recording access was not requested.", enabled: true)
            return false
        }
        guard CGRequestScreenCaptureAccess() else {
            let settingsAlert = NSAlert()
            settingsAlert.messageText = "Screen Recording Is Off"
            settingsAlert.informativeText = "Allow Classroom Widgets in System Settings > Privacy & Security > Screen Recording. macOS may require you to relaunch the app."
            settingsAlert.addButton(withTitle: "Open System Settings")
            settingsAlert.addButton(withTitle: "Not Now")
            if settingsAlert.runModal() == .alertFirstButtonReturn,
               let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture") {
                NSWorkspace.shared.open(url)
            }
            controllerStatus("Allow Classroom Widgets in System Settings > Privacy & Security > Screen Recording, then turn the preview on.", enabled: true)
            return false
        }
        return true
    }

    private func pause(message: String, preservingDeferredRestart: Bool = false) {
        autoResume.pauseRequested(preservingDeferredRestart: preservingDeferredRestart)
        intent.pause()
        cancelFrameRecovery()
        clearFrame(status: message)
        stopCurrent(message: message)
    }

    private func stopCurrent(
        message: String,
        completionPresentation: DisplayPreviewPresentation? = nil
    ) {
        pendingStopPresentation.update(
            generation: intent.generation,
            message: message,
            presentation: completionPresentation
        )
        guard let capture = session else {
            publishPendingStopPresentation()
            return
        }
        publishInFlightStopStatus(message, completionPresentation: completionPresentation)
        guard stopLifecycle.beginStop(of: capture) else {
            return
        }
        logDisplayTransition(
            .stop,
            trigger: "appRequested",
            reason: completionPresentation == nil ? "pause" : "sourceChange",
            source: selectedSource,
            intent: intent.wantsCapture,
            enabled: true
        )
        Task { @MainActor [weak self, weak capture] in
            guard let self, let capture else { return }
            if await self.stopWithTimeout(capture) {
                guard self.reconcileConfirmedStop(of: capture) else { return }
                if self.autoResume.stopCompleted(
                    currentSourceUUID: self.selectedSource?.uuid,
                    terminating: self.stopLifecycle.terminating
                ) {
                    self.pendingStopPresentation.clear()
                    self.start(trigger: .visibilityResume)
                } else {
                    self.publishPendingStopPresentation()
                }
            } else {
                if self.stopLifecycle.stopDidNotComplete(for: capture) {
                    self.logDisplayTransition(
                        .stop,
                        trigger: "stopTimeout",
                        reason: "stopDidNotComplete",
                        source: self.selectedSource,
                        intent: false,
                        enabled: false
                    )
                    self.autoResume.cancel()
                    self.pendingStopPresentation.clear()
                    self.controllerStatus("Capture could not stop. Quit Classroom Widgets to recover safely.", enabled: false)
                }
            }
        }
    }

    private func close() {
        cancelDeferredRestarts()
        cancelFrameRecovery()
        intent.close()
        clearFrame(status: "Closed.")
        logDisplayTransition(
            .close, trigger: "closeButton", source: selectedSource, intent: false, enabled: false
        )
        persist(frame: windowController?.window?.frame ?? .zero)
        windowController = nil
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

    private func screenParametersChanged() {
        let topologyChanged = catalog.refreshTopology()
        logDisplayTransition(
            .topologyNotice,
            trigger: "didChangeScreenParameters",
            reason: topologyChanged ? "topologyChanged" : "noTopologyChange",
            source: selectedSource,
            intent: intent.wantsCapture,
            enabled: selectedSource != nil,
            extra: "displays=\(catalog.topologySummary())"
        )
        guard let controller = windowController else { return }
        controller.previewView.discardPendingClick()
        let hostID = hostDisplayID(controller.window)
        let candidates = catalog.eligibleSources(hostDisplayID: hostID)
        let match = selectedSource.flatMap { catalog.currentMatching($0) }
        let isHostCandidate = match.map { current in
            candidates.contains { $0.uuid == current.uuid }
        } ?? false

        switch DisplayPreviewTopologyPolicy.outcome(
            hasWindow: true,
            selectedSourceID: selectedSource?.id,
            currentMatchID: match?.id,
            isHostCandidate: isHostCandidate
        ) {
        case .ignore:
            controller.setSources(candidates, selectedID: selectedSource?.id)
            return
        case .preserveSource:
            guard let current = match else { return }
            selectedSource = current
            if isHostCandidate {
                controller.setSources(candidates, selectedID: current.id)
            }
            // Host-filtered candidacy is a placement fact: while the preview
            // overlaps its own source the menu keeps its selection and the
            // existing overlap/hidden auto-resume intent stays intact.
            if topologyChanged, let geometry = presentedGeometry {
                // Same source and bounds: keep pointer mapping usable by adopting
                // the new revision instead of discarding it.
                presentedGeometry = DisplayPreviewFrameGeometry(
                    imageRect: geometry.imageRect,
                    sourceBounds: current.bounds,
                    sourceID: current.id,
                    topologyRevision: catalog.topologyRevision
                )
            }
            logDisplayTransition(
                .topologyPreserved,
                trigger: "didChangeScreenParameters",
                reason: isHostCandidate ? "sourceStillValid" : "sourceStillValidHostOverlap",
                source: current,
                intent: intent.wantsCapture,
                enabled: true
            )
            if topologyChanged {
                validateWindowPlacement()
            }
            return
        case .reset:
            break
        }

        cancelDeferredRestarts()
        cancelFrameRecovery()
        presentedGeometry = nil
        logDisplayTransition(
            .topologyReset,
            trigger: "didChangeScreenParameters",
            reason: selectedSource == nil ? "noSelectedSource" : "sourceChanged",
            source: selectedSource,
            intent: false,
            enabled: false
        )
        pause(message: "Display arrangement changed. Check the source, then turn the preview on.")
        selectedSource = nil
        intent.select(sourceID: nil)
        refreshSources(preselect: true)
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
        } else if visible {
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

    /// Retains the last good image and enabled intent across a temporary frame gap
    /// on the same authorized source. Bounded and cancellable; it never starts a
    /// replacement stream and never requests permission.
    private func holdForFrameGap(
        generation: UInt64,
        source: DisplayDescriptor,
        capture: DisplayCaptureSession,
        reason: DisplayCaptureGapReason,
        message: String
    ) {
        switch frameRecovery.gapDetected(generation: generation) {
        case .holdBegan:
            guard let episode = frameRecovery.activeEpisode else { return }
            presentedGeometry = nil
            windowController?.previewView.discardPendingClick()
            windowController?.previewView.setImageStale(true)
            windowController?.showStatus(
                message,
                powerState: .on,
                powerEnabled: true,
                centerEnabled: false
            )
            logDisplayTransition(
                .hold,
                trigger: "frameStatus",
                reason: reason.rawValue,
                source: source,
                intent: true,
                enabled: true,
                generation: generation
            )
            startRecoveryWindow(
                generation: generation,
                episode: episode,
                source: source,
                capture: capture
            )
        case .holdExtended, .ignored, .restored, .exhausted:
            break
        }
    }

    /// Owns exactly one recovery timer for the current hold episode. The episode
    /// check makes a timer from an earlier gap a no-op instead of consuming a later
    /// gap's window, and cancelling the owned task stops it from doing any work.
    private func startRecoveryWindow(
        generation: UInt64,
        episode: UInt64,
        source: DisplayDescriptor,
        capture: DisplayCaptureSession
    ) {
        cancelRecoveryTask()
        recoveryTask = makeRecoveryTask(
            generation: generation,
            episode: episode,
            source: source,
            capture: capture
        )
    }

    private func makeRecoveryTask(
        generation: UInt64,
        episode: UInt64,
        source: DisplayDescriptor,
        capture: DisplayCaptureSession
    ) -> Task<Void, Never> {
        Task { @MainActor [weak self, weak capture] in
            try? await Task.sleep(nanoseconds: DisplayPreviewFrameRecovery.holdWindowNanoseconds)
            guard !Task.isCancelled, let self, let capture else { return }
            self.recoveryWindowElapsed(
                generation: generation,
                episode: episode,
                source: source,
                capture: capture
            )
        }
    }

    private func recoveryWindowElapsed(
        generation: UInt64,
        episode: UInt64,
        source: DisplayDescriptor,
        capture: DisplayCaptureSession
    ) {
        guard session === capture, intent.accepts(generation: generation, sourceID: source.id) else { return }
        guard frameRecovery.isActive(generation: generation, episode: episode) else { return }
        guard preflightCaptureAccess() else {
            // Permission was revoked while holding: stop recovery immediately
            // rather than waiting out the remaining hold window.
            cancelFrameRecovery()
            logDisplayTransition(
                .recoveryExhausted,
                trigger: "permissionRevoked",
                source: source,
                intent: false,
                enabled: true,
                generation: generation
            )
            pause(message: DisplayPreviewStatus.unavailable(sourceName: source.name))
            return
        }
        switch frameRecovery.windowExpired(generation: generation, episode: episode) {
        case .holdExtended:
            recoveryTask = makeRecoveryTask(
                generation: generation,
                episode: episode,
                source: source,
                capture: capture
            )
        case .exhausted:
            cancelFrameRecovery()
            logDisplayTransition(
                .recoveryExhausted,
                trigger: "holdWindowExpired",
                source: source,
                intent: false,
                enabled: true,
                generation: generation
            )
            pause(message: DisplayPreviewStatus.unavailable(sourceName: source.name))
        case .holdBegan, .restored, .ignored:
            break
        }
    }

    private func cancelRecoveryTask() {
        recoveryTask?.cancel()
        recoveryTask = nil
    }

    /// Cancels both the hold state and the timer that owns it. Every explicit
    /// off/close/source/termination/sleep/lock path uses this so no recovery work
    /// can outlive the intent that authorized it.
    private func cancelFrameRecovery() {
        cancelRecoveryTask()
        frameRecovery.cancel()
    }

    private func beginFirstFrameTimeout(generation: UInt64, sourceID: CGDirectDisplayID, capture: DisplayCaptureSession) {
        Task { @MainActor [weak self, weak capture] in
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            guard let self, let capture, self.session === capture,
                  self.intent.accepts(generation: generation, sourceID: sourceID),
                  let source = self.selectedSource
            else { return }
            switch DisplayPreviewFirstFramePolicy.outcome(
                deliveredFrame: self.deliveredFrameGeneration == generation,
                streamActivity: self.streamActivityGeneration == generation
            ) {
            case .wait:
                return
            case .hold:
                self.holdForFrameGap(
                    generation: generation,
                    source: source,
                    capture: capture,
                    reason: .missingImageBuffer,
                    message: DisplayPreviewStatus.waitingForFirstFrame(sourceName: source.name)
                )
            case .pauseBroken:
                self.logDisplayTransition(
                    .firstFrameTimeout,
                    trigger: "firstFrameDeadline",
                    source: source,
                    intent: false,
                    enabled: true,
                    generation: generation
                )
                self.pause(message: "No usable frame arrived. Turn the preview on to retry.")
            }
        }
    }

    private func logDisplayTransition(
        _ transition: DisplayPreviewTransition,
        trigger: String,
        reason: String? = nil,
        source: DisplayDescriptor? = nil,
        intent: Bool? = nil,
        enabled: Bool? = nil,
        generation: UInt64? = nil,
        extra: String? = nil
    ) {
        var fields = "event=\(transition.rawValue) trigger=\(trigger)"
        if let reason { fields += " reason=\(reason)" }
        if let intent { fields += " intent=\(intent ? "capture" : "paused")" }
        if let enabled { fields += " enabled=\(enabled)" }
        if let source {
            fields += " sourceID=\(source.id) sourceHash=\(Self.displayIdentifierHash(source.uuid))"
        }
        fields += " topology=\(catalog.topologyRevision)"
        if let generation { fields += " generation=\(generation)" }
        if let extra { fields += " \(extra)" }
        // `notice` maps to OS_LOG_TYPE_DEFAULT, which is persisted for later
        // inspection; these transitions are deduplicated and low frequency, and
        // per-frame statuses never reach this funnel.
        DashboardLog.windowing.notice("Display Preview \(fields, privacy: .public)")
    }

    /// Non-reversible identifier so logs never carry a raw display UUID.
    private static func displayIdentifierHash(_ uuid: String) -> String {
        var hash: UInt64 = 0xcbf2_9ce4_8422_2325
        for byte in uuid.utf8 {
            hash = (hash ^ UInt64(byte)) &* 0x0000_0100_0000_01b3
        }
        return String(hash, radix: 16)
    }

    private func clearFrame(status: String) {
        presentedGeometry = nil
        windowController?.clearFrame()
        controllerStatus(status, enabled: selectedSource != nil && !stopLifecycle.isBlocked)
    }

    private func controllerStatus(
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

    private func validateWindowPlacement() {
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

    private func sourceOverlapsPreview(_ source: DisplayDescriptor) -> Bool {
        if let overlapsSource { return overlapsSource(source, windowController?.window) }
        guard let windowFrame = windowController?.window?.frame,
              let sourceScreen = NSScreen.screens.first(where: { DisplayCatalog.displayID(for: $0) == source.id })
        else { return true }
        return windowFrame.intersection(sourceScreen.frame).area > 0
    }

    private func cancelDeferredRestarts() {
        autoResume.cancel()
    }

    private func publishStopStatus(_ message: String) {
        controllerStatus(
            message,
            enabled: selectedSource != nil && !stopLifecycle.isBlocked
        )
    }

    private func publishInFlightStopStatus(
        _ message: String,
        completionPresentation: DisplayPreviewPresentation?
    ) {
        if let completionPresentation {
            windowController?.showStatus(
                message,
                powerState: completionPresentation.powerState,
                powerEnabled: false,
                centerEnabled: false
            )
            return
        }
        controllerStatus(
            message,
            enabled: autoResume.hasPendingRestart
        )
    }

    private var currentPowerState: DisplayPreviewPowerState {
        .current(
            wantsCapture: intent.wantsCapture,
            hasPendingRestart: autoResume.hasPendingRestart
        )
    }

    private func publishPendingStopPresentation() {
        guard let pending = pendingStopPresentation.consume(currentGeneration: intent.generation) else { return }
        if let presentation = pending.presentation {
            windowController?.showStatus(presentation)
        } else {
            publishStopStatus(pending.message)
        }
    }

    private func stopWithTimeout(
        _ capture: DisplayCaptureSession,
        retryFailed: Bool = false
    ) async -> Bool {
        let operation: DisplayPreviewStopOperation
        if let current = stopOperation, current.matches(capture),
           current.state != .failed || !retryFailed {
            operation = current
        } else {
            operation = DisplayPreviewStopOperation(
                owner: capture,
                operation: { try await capture.stop() },
                onFailure: { error in
                    DashboardLog.windowing.error("Display Preview stream stop failed: \(error.localizedDescription, privacy: .public)")
                },
                onLateSuccess: { [weak self, weak capture] in
                    guard let self, let capture else { return }
                    self.reconcileConfirmedLateStop(of: capture)
                }
            )
            stopOperation = operation
        }
        return await operation.wait(timeoutNanoseconds: 2_000_000_000)
    }

    @discardableResult
    private func reconcileConfirmedStop(of capture: DisplayCaptureSession) -> Bool {
        guard stopLifecycle.confirmedStopCompleted(for: capture) else { return false }
        if session === capture { session = nil }
        if stopOperation?.matches(capture) == true { stopOperation = nil }
        return true
    }

    private func reconcileConfirmedLateStop(of capture: DisplayCaptureSession) {
        guard reconcileConfirmedStop(of: capture) else { return }
        autoResume.cancel()
        intent.pause()
        controllerStatus(
            "Capture stopped. Turn the preview on when ready.",
            enabled: selectedSource != nil
        )
    }

    @discardableResult
    private func reconcileTerminalStop(of capture: DisplayCaptureSession) -> Bool {
        guard stopLifecycle.terminalStopConfirmed(for: capture) else { return false }
        let operation = stopOperation?.matches(capture) == true ? stopOperation : nil
        session = nil
        stopOperation = nil
        operation?.confirmTerminalStop()
        return true
    }

    private func captureOutputSize(for source: DisplayDescriptor, view: NSView) -> CGSize {
        let backing = view.convertToBacking(view.bounds).size
        let desiredLongEdge = min(max(backing.width, backing.height), 1920)
        let aspect = source.bounds.width / source.bounds.height
        return aspect >= 1
            ? CGSize(width: desiredLongEdge, height: desiredLongEdge / aspect)
            : CGSize(width: desiredLongEdge * aspect, height: desiredLongEdge)
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

@MainActor
final class DisplayPreviewStopOperation {
    enum State: Equatable {
        case running
        case succeeded
        case failed
    }

    private let ownerID: ObjectIdentifier
    private var waiters: [UUID: CheckedContinuation<Bool, Never>] = [:]
    private(set) var state: State = .running
    private let onFailure: (Error) -> Void
    private let onLateSuccess: () -> Void

    init(
        owner: AnyObject,
        operation: @escaping () async throws -> Void,
        onFailure: @escaping (Error) -> Void = { _ in },
        onLateSuccess: @escaping () -> Void = {}
    ) {
        ownerID = ObjectIdentifier(owner)
        self.onFailure = onFailure
        self.onLateSuccess = onLateSuccess
        Task { @MainActor [weak self] in
            do {
                try await operation()
                _ = self?.finish(succeeded: true)
            } catch {
                if self?.finish(succeeded: false) == true {
                    self?.onFailure(error)
                }
            }
        }
    }

    func matches(_ owner: AnyObject) -> Bool {
        ownerID == ObjectIdentifier(owner)
    }

    func wait(timeoutNanoseconds: UInt64) async -> Bool {
        switch state {
        case .succeeded: return true
        case .failed: return false
        case .running: break
        }
        let waiterID = UUID()
        return await withCheckedContinuation { continuation in
            waiters[waiterID] = continuation
            Task { @MainActor [weak self] in
                try? await Task.sleep(nanoseconds: timeoutNanoseconds)
                self?.timeout(waiterID)
            }
        }
    }

    func confirmTerminalStop() {
        _ = finish(succeeded: true)
    }

    @discardableResult
    private func finish(succeeded: Bool) -> Bool {
        guard state == .running else { return false }
        state = succeeded ? .succeeded : .failed
        let pending = Array(waiters.values)
        waiters.removeAll()
        if pending.isEmpty, succeeded { onLateSuccess() }
        for continuation in pending {
            continuation.resume(returning: succeeded)
        }
        return true
    }

    private func timeout(_ waiterID: UUID) {
        guard let continuation = waiters.removeValue(forKey: waiterID) else { return }
        continuation.resume(returning: false)
    }
}
