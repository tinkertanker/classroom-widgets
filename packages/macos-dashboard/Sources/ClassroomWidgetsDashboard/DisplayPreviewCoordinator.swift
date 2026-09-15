import AppKit
import CoreGraphics

@MainActor
final class DisplayPreviewCoordinator: NSObject {
    private enum Keys {
        static let sourceUUID = "displayPreviewSourceUUIDV1"
        static let frame = "displayPreviewWindowFrameV1"
    }

    private let catalog = DisplayCatalog()
    private let defaultsWriter = DebouncedDefaultsWriter()
    private var intent = DisplayPreviewIntent()
    private var windowController: DisplayPreviewWindowController?
    private var selectedSource: DisplayDescriptor?
    private var session: DisplayCaptureSession?
    private var presentedGeometry: DisplayPreviewFrameGeometry?
    private var stopping = false
    private var stopFailed = false
    private var restartAfterStop = false
    private var resumeAfterVisibilitySuspension = false
    private var restartSourceUUID: String?
    private var terminating = false
    private var backgroundOpacity = 1.0
    private var keepOnAllSpaces = true
    private var observers: [NSObjectProtocol] = []

    override init() {
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
            return
        }
        intent.open()
        let frame = restoredFrame() ?? initialFrame()
        let controller = DisplayPreviewWindowController(
            frame: frame, backgroundOpacity: backgroundOpacity, keepOnAllSpaces: keepOnAllSpaces
        )
        windowController = controller
        wire(controller)
        refreshSources(preselect: true)
        controller.window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func applyPresentationSettings(backgroundOpacity: Double, keepOnAllSpaces: Bool) {
        self.backgroundOpacity = backgroundOpacity
        self.keepOnAllSpaces = keepOnAllSpaces
        windowController?.applyPresentationSettings(backgroundOpacity: backgroundOpacity, keepOnAllSpaces: keepOnAllSpaces)
    }

    func restartIfRunning() {
        guard intent.wantsCapture else { return }
        restartAfterStop = true
        restartSourceUUID = selectedSource?.uuid
        pause(message: "Restarting preview…")
    }

    func flushPersistedState() { defaultsWriter.flush() }

    func prepareForTermination() async -> Bool {
        terminating = true
        cancelDeferredRestarts()
        intent.pause()
        clearFrame(status: "Paused while Classroom Widgets quits.")
        if stopping {
            let deadline = ContinuousClock.now + .seconds(2)
            while stopping, ContinuousClock.now < deadline {
                try? await Task.sleep(nanoseconds: 20_000_000)
            }
            return session == nil
        }
        guard let session else { return true }
        if await stopWithTimeout(session) {
            self.session = nil
            return true
        } else {
            stopFailed = true
            DashboardLog.windowing.error("Display Preview stream did not stop within the cleanup deadline")
            return false
        }
    }

    func terminationCancelled() {
        terminating = false
        cancelDeferredRestarts()
        windowController?.showStatus(
            "Quit was cancelled. Preview remains paused; press Resume when ready.",
            buttonTitle: "Resume", buttonEnabled: session == nil, centerEnabled: false
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
        controller.previewView.onGeometryInvalidated = { [weak self] in self?.presentedGeometry = nil }
        controller.previewView.onCompletedPrimaryClick = { [weak self] point, _ in self?.warp(from: point) }
    }

    private func refreshSources(preselect: Bool) {
        let hostID = DisplayCatalog.displayID(for: windowController?.window?.screen)
        let candidates = catalog.eligibleSources(hostDisplayID: hostID)
        if preselect, selectedSource == nil {
            let saved = UserDefaults.standard.string(forKey: Keys.sourceUUID)
            selectedSource = saved.flatMap { catalog.matchSavedUUID($0, among: candidates) }
                ?? (candidates.count == 1 ? candidates[0] : nil)
            intent.select(sourceID: selectedSource?.id)
        }
        windowController?.setSources(candidates, selectedID: selectedSource?.id)
        let message = candidates.isEmpty
            ? "Connect another display or use an extended desktop."
            : selectedSource == nil ? "Choose a source display, then press Start." : "Ready to preview \(selectedSource!.name)."
        windowController?.showStatus(message, buttonTitle: "Start", buttonEnabled: selectedSource != nil, centerEnabled: false)
    }

    private func selectSource(_ id: CGDirectDisplayID?) {
        let hostID = DisplayCatalog.displayID(for: windowController?.window?.screen)
        let source = catalog.eligibleSources(hostDisplayID: hostID).first { $0.id == id }
        guard source != selectedSource else { return }
        cancelDeferredRestarts()
        intent.select(sourceID: source?.id)
        selectedSource = source
        presentedGeometry = nil
        windowController?.clearFrame()
        if let source { defaultsWriter.set(source.uuid, forKey: Keys.sourceUUID) }
        stopCurrent(message: source.map { "Ready to preview \($0.name)." } ?? "Choose a source display.")
    }

    private func toggleCapture() {
        if intent.wantsCapture { pause(message: "Paused.") } else { start() }
    }

    private func start() {
        guard !terminating, !stopping, !stopFailed, session == nil, let source = selectedSource,
              let controller = windowController, let window = controller.window,
              !sourceOverlapsPreview(source)
        else {
            if stopFailed { controllerStatus("The previous stream could not stop. Quit Classroom Widgets to recover.", enabled: false) }
            else if selectedSource != nil { controllerStatus("Move the preview to a different display before starting.", enabled: true) }
            return
        }
        guard CGPreflightScreenCaptureAccess() || requestCapturePermission() else { return }
        guard let generation = intent.start() else { return }
        controller.showStatus("Starting…", buttonTitle: "Pause", buttonEnabled: true, centerEnabled: false)
        let capture = DisplayCaptureSession(sourceID: source.id)
        session = capture
        capture.onFrame = { [weak self, weak capture] buffer, size in
            guard let self, let capture, self.session === capture,
                  self.intent.accepts(generation: generation, sourceID: source.id),
                  self.catalog.currentMatching(source) != nil
            else { return }
            guard self.windowController?.showFrame(buffer, size: size) == true else {
                self.clearFrame(status: "The preview renderer stopped. Press Retry.")
                return
            }
            guard let publishedRect = self.windowController?.previewView.fittedImageRectTopLeft() else { return }
            self.presentedGeometry = DisplayPreviewFrameGeometry(
                imageRect: publishedRect, sourceBounds: source.bounds,
                sourceID: source.id, topologyRevision: self.catalog.topologyRevision
            )
            self.windowController?.showStatus(
                "Live: \(source.name)", buttonTitle: "Pause", buttonEnabled: true, centerEnabled: true
            )
        }
        capture.onStop = { [weak self, weak capture] error in
            guard let self, let capture, self.session === capture else { return }
            self.intent.pause()
            self.clearFrame(status: "Capture stopped: \(error.localizedDescription)")
            self.session = nil
        }
        capture.onUnavailable = { [weak self, weak capture] in
            guard let self, let capture, self.session === capture else { return }
            self.clearFrame(status: "The selected display is temporarily unavailable. Press Resume when it returns.")
            self.intent.pause()
            self.stopCurrent(message: "The selected display is temporarily unavailable.")
        }
        let outputSize = captureOutputSize(for: source, view: controller.previewView)
        Task { @MainActor [weak self, weak capture] in
            guard let self, let capture else { return }
            do {
                try await capture.start(excludingWindowID: CGWindowID(window.windowNumber), outputSize: outputSize)
                guard self.session === capture, self.intent.accepts(generation: generation, sourceID: source.id) else {
                    if await self.stopWithTimeout(capture) {
                        if self.session === capture { self.session = nil }
                    } else {
                        self.stopFailed = true
                    }
                    return
                }
                self.beginFirstFrameTimeout(generation: generation, sourceID: source.id, capture: capture)
            } catch {
                if self.session === capture { self.session = nil }
                guard self.intent.accepts(generation: generation, sourceID: source.id) else { return }
                self.intent.pause()
                self.clearFrame(status: "Unable to start: \(error.localizedDescription)")
            }
        }
    }

    private func requestCapturePermission() -> Bool {
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
            controllerStatus("Allow Classroom Widgets in System Settings > Privacy & Security > Screen Recording, then press Retry.", button: "Retry", enabled: true)
            return false
        }
        return true
    }

    private func pause(message: String) {
        intent.pause()
        clearFrame(status: message)
        stopCurrent(message: message)
    }

    private func stopCurrent(message: String) {
        guard let capture = session, !stopping else {
            controllerStatus(message, button: "Start", enabled: selectedSource != nil && !stopFailed)
            return
        }
        stopping = true
        Task { @MainActor [weak self, weak capture] in
            guard let self, let capture else { return }
            if await self.stopWithTimeout(capture) {
                if self.session === capture { self.session = nil }
                self.stopping = false
                self.controllerStatus(message, button: "Resume", enabled: self.selectedSource != nil)
                if self.restartAfterStop,
                   self.restartSourceUUID == self.selectedSource?.uuid,
                   !self.terminating {
                    self.restartAfterStop = false
                    self.restartSourceUUID = nil
                    self.start()
                } else {
                    self.cancelDeferredRestarts()
                }
            } else {
                self.stopping = false
                self.restartAfterStop = false
                self.stopFailed = true
                self.controllerStatus("Capture could not stop. Quit Classroom Widgets to recover safely.", enabled: false)
            }
        }
    }

    private func close() {
        cancelDeferredRestarts()
        intent.close()
        clearFrame(status: "Closed.")
        persist(frame: windowController?.window?.frame ?? .zero)
        windowController = nil
        stopCurrent(message: "Closed.")
    }

    private func interrupt(message: String) {
        guard windowController != nil else { return }
        cancelDeferredRestarts()
        pause(message: message)
    }

    private func screenParametersChanged() {
        catalog.topologyChanged()
        cancelDeferredRestarts()
        windowController?.previewView.discardPendingClick()
        presentedGeometry = nil
        guard windowController != nil else { return }
        pause(message: "Display arrangement changed. Check the source and press Resume.")
        selectedSource = nil
        intent.select(sourceID: nil)
        refreshSources(preselect: true)
    }

    private func visibilityChanged(_ visible: Bool) {
        if !visible, intent.wantsCapture {
            resumeAfterVisibilitySuspension = true
            pause(message: "Preview suspended while its window is hidden.")
        } else if visible, resumeAfterVisibilitySuspension {
            resumeAfterVisibilitySuspension = false
            if session == nil { start() } else { restartAfterStop = true }
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
            controllerStatus("Could not move the pointer (error \(result.rawValue)). Preview remains live.", button: "Pause", enabled: true)
        }
    }

    private func movePointerToCenter() {
        guard presentedGeometry != nil, let source = selectedSource, intent.wantsCapture,
              catalog.currentMatching(source) != nil, !sourceOverlapsPreview(source)
        else { return }
        let target = CGPoint(x: source.bounds.midX, y: source.bounds.midY)
        if CGWarpMouseCursorPosition(target) != .success {
            controllerStatus("Could not move the pointer. Preview remains live.", button: "Pause", enabled: true)
        }
    }

    private func beginFirstFrameTimeout(generation: UInt64, sourceID: CGDirectDisplayID, capture: DisplayCaptureSession) {
        Task { @MainActor [weak self, weak capture] in
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            guard let self, let capture, self.session === capture,
                  self.intent.accepts(generation: generation, sourceID: sourceID), self.presentedGeometry == nil
            else { return }
            self.pause(message: "No usable frame arrived. Press Retry.")
        }
    }

    private func clearFrame(status: String) {
        presentedGeometry = nil
        windowController?.clearFrame()
        controllerStatus(status, button: "Resume", enabled: selectedSource != nil && !stopFailed)
    }

    private func controllerStatus(_ message: String, button: String = "Resume", enabled: Bool) {
        windowController?.showStatus(message, buttonTitle: button, buttonEnabled: enabled, centerEnabled: false)
    }

    private func validateWindowPlacement() {
        guard let source = selectedSource, intent.wantsCapture, sourceOverlapsPreview(source) else { return }
        cancelDeferredRestarts()
        pause(message: "Move the preview completely off the source display, then press Resume.")
    }

    private func sourceOverlapsPreview(_ source: DisplayDescriptor) -> Bool {
        guard let windowFrame = windowController?.window?.frame,
              let sourceScreen = NSScreen.screens.first(where: { DisplayCatalog.displayID(for: $0) == source.id })
        else { return true }
        return windowFrame.intersection(sourceScreen.frame).area > 0
    }

    private func cancelDeferredRestarts() {
        restartAfterStop = false
        restartSourceUUID = nil
        resumeAfterVisibilitySuspension = false
    }

    private func stopWithTimeout(_ capture: DisplayCaptureSession) async -> Bool {
        await withCheckedContinuation { continuation in
            let gate = DisplayPreviewStopGate(continuation)
            Task { @MainActor in
                do {
                    try await capture.stop()
                    gate.finish(true)
                } catch {
                    DashboardLog.windowing.error("Display Preview stream stop failed: \(error.localizedDescription, privacy: .public)")
                    gate.finish(false)
                }
            }
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 2_000_000_000)
                gate.finish(false)
            }
        }
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
        guard let value = UserDefaults.standard.string(forKey: Keys.frame) else { return nil }
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
private final class DisplayPreviewStopGate {
    private var continuation: CheckedContinuation<Bool, Never>?

    init(_ continuation: CheckedContinuation<Bool, Never>) { self.continuation = continuation }

    func finish(_ result: Bool) {
        guard let continuation else { return }
        self.continuation = nil
        continuation.resume(returning: result)
    }
}

private extension CGRect {
    var area: CGFloat { isNull ? 0 : width * height }
    func clamped(to bounds: CGRect) -> CGRect {
        guard !bounds.isEmpty else { return self }
        let size = CGSize(width: min(width, bounds.width), height: min(height, bounds.height))
        return CGRect(
            x: min(max(minX, bounds.minX), bounds.maxX - size.width),
            y: min(max(minY, bounds.minY), bounds.maxY - size.height),
            width: size.width, height: size.height
        )
    }
}
