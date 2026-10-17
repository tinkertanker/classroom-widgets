import AppKit
import CoreGraphics

/// Pausing and stopping the capture stream, and reconciling stop results.
extension DisplayPreviewCoordinator {
    func pause(message: String, preservingDeferredRestart: Bool = false) {
        autoResume.pauseRequested(preservingDeferredRestart: preservingDeferredRestart)
        intent.pause()
        cancelFrameRecovery()
        clearFrame(status: message)
        stopCurrent(message: message)
    }

    func stopCurrent(
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

    func cancelDeferredRestarts() {
        autoResume.cancel()
    }

    func publishStopStatus(_ message: String) {
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

    var currentPowerState: DisplayPreviewPowerState {
        .current(
            wantsCapture: intent.wantsCapture,
            hasPendingRestart: autoResume.hasPendingRestart
        )
    }

    func publishPendingStopPresentation() {
        guard let pending = pendingStopPresentation.consume(currentGeneration: intent.generation) else { return }
        if let presentation = pending.presentation {
            windowController?.showStatus(presentation)
        } else {
            publishStopStatus(pending.message)
        }
    }

    func stopWithTimeout(
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
    func reconcileConfirmedStop(of capture: DisplayCaptureSession) -> Bool {
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
    func reconcileTerminalStop(of capture: DisplayCaptureSession) -> Bool {
        guard stopLifecycle.terminalStopConfirmed(for: capture) else { return false }
        let operation = stopOperation?.matches(capture) == true ? stopOperation : nil
        session = nil
        stopOperation = nil
        operation?.confirmTerminalStop()
        return true
    }
}
