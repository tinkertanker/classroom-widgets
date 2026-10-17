import AppKit
import CoreGraphics

/// Holding the last frame across a temporary gap in the stream.
extension DisplayPreviewCoordinator {
    /// Retains the last good image and enabled intent across a temporary frame gap
    /// on the same authorized source. Bounded and cancellable; it never starts a
    /// replacement stream and never requests permission.
    func holdForFrameGap(
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

    func cancelRecoveryTask() {
        recoveryTask?.cancel()
        recoveryTask = nil
    }

    /// Cancels both the hold state and the timer that owns it. Every explicit
    /// off/close/source/termination/sleep/lock path uses this so no recovery work
    /// can outlive the intent that authorized it.
    func cancelFrameRecovery() {
        cancelRecoveryTask()
        frameRecovery.cancel()
    }
}
