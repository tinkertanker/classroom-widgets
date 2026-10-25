import AppKit
import CoreGraphics

/// Starting a capture stream: permission, the session's callbacks and the
/// first-frame deadline.
extension DisplayPreviewCoordinator {
    func start(trigger: DisplayPreviewStartTrigger = .explicit) {
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
        let requestedGeneration = intent.generation
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
        // Permission dialogs run a nested event loop. Consent is not authority to
        // revive a request invalidated by topology, close/reopen, or interruption.
        guard intent.generation == requestedGeneration, !intent.isClosed,
              selectedSource == source, windowController === controller, controller.window === window,
              stopLifecycle.canStart, session == nil,
              catalog.currentMatching(source)?.id == source.id, !sourceOverlapsPreview(source)
        else {
            logDisplayTransition(
                .startFailed, trigger: trigger.logLabel, reason: "startRequestInvalidated",
                source: selectedSource, intent: intent.wantsCapture, enabled: selectedSource != nil
            )
            return
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
        window.contentView?.layoutSubtreeIfNeeded()
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
                // A layout or backing change can settle while discovery/start is
                // suspended. Re-read the viewport once the stream is running.
                self.scheduleCaptureResize()
            } catch {
                capture.cancel()
                if self.stopLifecycle.release(capture) {
                    self.cancelCaptureResize()
                    self.session = nil
                }
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

    func cancelCaptureResize() {
        captureResizeTask?.cancel()
        captureResizeTask = nil
    }

    /// Never clear the retained image or reset frame recovery for a resize: a
    /// static source may remain idle after the native configuration completes.
    func scheduleCaptureResize() {
        cancelCaptureResize()
        guard let capture = session, let source = selectedSource,
              let controller = windowController, controller.window?.inLiveResize == false,
              intent.wantsCapture, !stopLifecycle.isStopping, !stopLifecycle.isBlocked
        else { return }
        let generation = intent.generation
        captureResizeTask = Task { @MainActor [weak self, weak capture, weak controller] in
            do {
                try await Task.sleep(nanoseconds: 250_000_000)
                guard let self, let capture, let controller,
                      self.session === capture, self.windowController === controller,
                      self.intent.accepts(generation: generation, sourceID: source.id),
                      self.catalog.currentMatching(source) != nil,
                      controller.window?.inLiveResize == false
                else { return }
                try await capture.updateOutputSize(self.captureOutputSize(for: source, view: controller.previewView))
            } catch is CancellationError {
                // Superseded viewport, source selection, pause, close or teardown.
            } catch {
                guard !Task.isCancelled, let self, let capture, self.session === capture,
                      self.intent.accepts(generation: generation, sourceID: source.id)
                else { return }
                // Keep the working stream/image; a later viewport change can retry.
                let code = (error as NSError).code
                DashboardLog.windowing.error("Display Preview resize configuration failed: code=\(code)")
            }
        }
    }

    private func captureOutputSize(for source: DisplayDescriptor, view: NSView) -> CGSize {
        DisplayPreviewGeometry.captureOutputSize(
            sourceSize: source.bounds.size,
            viewportPixels: view.convertToBacking(view.bounds).size
        )
    }
}
