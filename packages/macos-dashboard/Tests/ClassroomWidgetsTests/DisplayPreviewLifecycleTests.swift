import XCTest
@testable import ClassroomWidgets

final class DisplayPreviewLifecycleTests: XCTestCase {
    private final class CaptureOwner {}
    private enum TestError: Error { case stopFailed }

    @MainActor
    private final class StopControl {
        private(set) var callCount = 0
        private var continuation: CheckedContinuation<Void, Error>?

        func run() async throws {
            callCount += 1
            try await withCheckedThrowingContinuation { continuation in
                self.continuation = continuation
            }
        }

        func succeed() {
            continuation?.resume(returning: ())
            continuation = nil
        }
    }

    func testRevealAfterVisibilityStopResumesSameSource() {
        var state = DisplayPreviewAutoResumeState()
        _ = state.hidden(wasRunning: true, sourceUUID: "source-a")

        XCTAssertFalse(state.stopCompleted(currentSourceUUID: "source-a", terminating: false))
        XCTAssertEqual(state.revealed(sessionExists: false, currentSourceUUID: "source-a"), .startNow)
    }

    func testRevealBeforeVisibilityStopRestartsAfterOwnedStopCompletes() {
        var state = DisplayPreviewAutoResumeState()
        _ = state.hidden(wasRunning: true, sourceUUID: "source-a")

        XCTAssertEqual(state.revealed(sessionExists: true, currentSourceUUID: "source-a"), .startAfterStop)
        XCTAssertTrue(state.stopCompleted(currentSourceUUID: "source-a", terminating: false))
    }

    func testExplicitCancellationPreventsVisibilityResume() {
        var state = DisplayPreviewAutoResumeState()
        _ = state.hidden(wasRunning: true, sourceUUID: "source-a")
        state.pauseRequested(preservingDeferredRestart: false)

        XCTAssertEqual(state.revealed(sessionExists: false, currentSourceUUID: "source-a"), .none)
        XCTAssertFalse(state.stopCompleted(currentSourceUUID: "source-a", terminating: false))
    }

    func testSourceChangeOrTerminationPreventsVisibilityResume() {
        var sourceChanged = DisplayPreviewAutoResumeState()
        _ = sourceChanged.hidden(wasRunning: true, sourceUUID: "source-a")
        sourceChanged.requestRestart(sourceUUID: "source-a")
        _ = sourceChanged.revealed(sessionExists: true, currentSourceUUID: "source-a")
        XCTAssertFalse(sourceChanged.stopCompleted(currentSourceUUID: "source-b", terminating: false))

        var terminating = DisplayPreviewAutoResumeState()
        _ = terminating.hidden(wasRunning: true, sourceUUID: "source-a")
        terminating.requestRestart(sourceUUID: "source-a")
        _ = terminating.revealed(sessionExists: true, currentSourceUUID: "source-a")
        XCTAssertFalse(terminating.stopCompleted(currentSourceUUID: "source-a", terminating: true))
    }

    func testVisibilityResumeDoesNotRequestRevokedPermission() {
        XCTAssertFalse(DisplayPreviewPermissionPolicy.shouldRequestPermission(
            for: .visibilityResume,
            preflightGranted: false
        ))
        XCTAssertTrue(DisplayPreviewPermissionPolicy.shouldRequestPermission(
            for: .explicit,
            preflightGranted: false
        ))
        XCTAssertFalse(DisplayPreviewPermissionPolicy.canStart(
            for: .visibilityResume,
            preflightGranted: false
        ))
        XCTAssertTrue(DisplayPreviewPermissionPolicy.canStart(
            for: .explicit,
            preflightGranted: false
        ))
    }

    func testOnlyCurrentAcceptedCaptureCallbacksMayChangeRestartIntent() {
        XCTAssertTrue(DisplayPreviewCaptureCallbackPolicy.mayChangeIntent(
            ownsSession: true,
            acceptsGeneration: true
        ))
        XCTAssertFalse(DisplayPreviewCaptureCallbackPolicy.mayChangeIntent(
            ownsSession: true,
            acceptsGeneration: false
        ), "A callback queued by the intentionally stopped generation must preserve auto-resume")
        XCTAssertFalse(DisplayPreviewCaptureCallbackPolicy.mayChangeIntent(
            ownsSession: false,
            acceptsGeneration: true
        ), "A replacement session must not be affected by its predecessor's callback")
    }

    func testExplicitPausePreventsEarlierStopFromRepublishingAutomaticResumeStatus() {
        XCTAssertTrue(DisplayPreviewStopCompletionPolicy.shouldPublishStatus(
            startGeneration: 8,
            currentGeneration: 8
        ))
        XCTAssertFalse(DisplayPreviewStopCompletionPolicy.shouldPublishStatus(
            startGeneration: 8,
            currentGeneration: 9
        ), "Explicit Pause advances intent and makes the overlap-stop status stale")
    }

    func testSourceChangeDuringStopPublishesOnlyLatestReadyPresentationAfterCleanup() {
        var pending = DisplayPreviewPendingStopPresentation()
        pending.update(
            generation: 4,
            message: "Paused source A.",
            presentation: nil
        )
        let sourceB = DisplayPreviewPresentation.ready(sourceName: "Source B")
        pending.update(
            generation: 5,
            message: sourceB.message,
            presentation: sourceB
        )

        XCTAssertNil(pending.consume(currentGeneration: 4), "Source A completion must not consume source B's state")
        let completed = pending.consume(currentGeneration: 5)
        XCTAssertEqual(completed?.message, "Click to see display")
        XCTAssertEqual(completed?.presentation, sourceB)
        XCTAssertTrue(completed?.presentation?.idleStartEnabled == true)
    }

    func testReadyStatusUsesActionableIdlePrompt() {
        XCTAssertEqual(DisplayPreviewStatus.ready(sourceName: "Creston"), "Click to see display")
    }

    func testOverlapThenClearBeforeStopRestartsOnlyAfterOwnedStopCompletes() {
        var state = DisplayPreviewAutoResumeState()
        XCTAssertEqual(state.placementChanged(
            overlapsSource: true, wasRunning: true, sessionExists: true, sourceUUID: "source-a"
        ), .suspend)
        XCTAssertTrue(state.hasPendingRestart, "Pause must remain an explicit way to cancel overlap auto-resume")
        XCTAssertEqual(state.placementChanged(
            overlapsSource: false, wasRunning: false, sessionExists: true, sourceUUID: "source-a"
        ), .startAfterStop)
        XCTAssertTrue(state.stopCompleted(currentSourceUUID: "source-a", terminating: false))
    }

    func testMovingIdlePreviewNeverCreatesAutomaticStartIntent() {
        var state = DisplayPreviewAutoResumeState()

        XCTAssertEqual(state.placementChanged(
            overlapsSource: true, wasRunning: false, sessionExists: false, sourceUUID: "source-a"
        ), .none)
        XCTAssertEqual(state.placementChanged(
            overlapsSource: false, wasRunning: false, sessionExists: false, sourceUUID: "source-a"
        ), .none)
        XCTAssertFalse(state.hasPendingRestart)
    }

    func testOverlapClearAfterStopStartsImmediately() {
        var state = DisplayPreviewAutoResumeState()
        XCTAssertEqual(state.placementChanged(
            overlapsSource: true, wasRunning: true, sessionExists: true, sourceUUID: "source-a"
        ), .suspend)
        XCTAssertFalse(state.stopCompleted(currentSourceUUID: "source-a", terminating: false))

        XCTAssertEqual(state.placementChanged(
            overlapsSource: false, wasRunning: false, sessionExists: false, sourceUUID: "source-a"
        ), .startNow)
    }

    func testOverlapReentryBeforeStopPreventsPrematureRestart() {
        var state = DisplayPreviewAutoResumeState()
        _ = state.placementChanged(
            overlapsSource: true, wasRunning: true, sessionExists: true, sourceUUID: "source-a"
        )
        XCTAssertEqual(state.placementChanged(
            overlapsSource: false, wasRunning: false, sessionExists: true, sourceUUID: "source-a"
        ), .startAfterStop)
        XCTAssertEqual(state.placementChanged(
            overlapsSource: true, wasRunning: false, sessionExists: true, sourceUUID: "source-a"
        ), .none)

        XCTAssertFalse(state.stopCompleted(currentSourceUUID: "source-a", terminating: false))
        XCTAssertEqual(state.placementChanged(
            overlapsSource: false, wasRunning: false, sessionExists: false, sourceUUID: "source-a"
        ), .startNow)
    }

    func testHiddenAndOverlapBlockersComposeInEitherOrder() {
        var overlapThenHidden = DisplayPreviewAutoResumeState()
        _ = overlapThenHidden.placementChanged(
            overlapsSource: true, wasRunning: true, sessionExists: true, sourceUUID: "source-a"
        )
        _ = overlapThenHidden.hidden(wasRunning: false, sourceUUID: "source-a")
        XCTAssertEqual(overlapThenHidden.placementChanged(
            overlapsSource: false, wasRunning: false, sessionExists: true, sourceUUID: "source-a"
        ), .none)
        XCTAssertEqual(
            overlapThenHidden.revealed(sessionExists: true, currentSourceUUID: "source-a"),
            .startAfterStop
        )

        var hiddenThenOverlap = DisplayPreviewAutoResumeState()
        _ = hiddenThenOverlap.hidden(wasRunning: true, sourceUUID: "source-a")
        _ = hiddenThenOverlap.placementChanged(
            overlapsSource: true, wasRunning: false, sessionExists: true, sourceUUID: "source-a"
        )
        XCTAssertEqual(
            hiddenThenOverlap.revealed(sessionExists: true, currentSourceUUID: "source-a"),
            .none
        )
        XCTAssertEqual(hiddenThenOverlap.placementChanged(
            overlapsSource: false, wasRunning: false, sessionExists: true, sourceUUID: "source-a"
        ), .startAfterStop)
    }

    func testExplicitPauseSourceChangeTerminationAndTimeoutCancelOverlapResume() {
        var explicitPause = overlappingState()
        explicitPause.pauseRequested(preservingDeferredRestart: false)
        XCTAssertEqual(explicitPause.placementChanged(
            overlapsSource: false, wasRunning: false, sessionExists: false, sourceUUID: "source-a"
        ), .none)

        var sourceChanged = overlappingState()
        XCTAssertEqual(sourceChanged.placementChanged(
            overlapsSource: false, wasRunning: false, sessionExists: false, sourceUUID: "source-b"
        ), .none)

        var terminating = overlappingState()
        _ = terminating.placementChanged(
            overlapsSource: false, wasRunning: false, sessionExists: true, sourceUUID: "source-a"
        )
        XCTAssertFalse(terminating.stopCompleted(currentSourceUUID: "source-a", terminating: true))

        var timedOut = overlappingState()
        timedOut.cancel()
        XCTAssertEqual(timedOut.placementChanged(
            overlapsSource: false, wasRunning: false, sessionExists: false, sourceUUID: "source-a"
        ), .none)
    }

    @MainActor
    func testConfirmedLateStopSuccessIsNotDiscardedAfterTimeout() async {
        let capture = CaptureOwner()
        let control = StopControl()
        var reconciled = false
        let operation = DisplayPreviewStopOperation(
            owner: capture,
            operation: { try await control.run() },
            onLateSuccess: { reconciled = true }
        )

        let initialResult = await operation.wait(timeoutNanoseconds: 0)
        while control.callCount == 0 { await Task.yield() }
        control.succeed()
        while operation.state == .running { await Task.yield() }

        XCTAssertFalse(initialResult)
        XCTAssertTrue(reconciled)
        XCTAssertEqual(control.callCount, 1)
    }

    @MainActor
    func testOverlappingWaitersShareOneUnderlyingStop() async {
        let capture = CaptureOwner()
        let control = StopControl()
        let operation = DisplayPreviewStopOperation(
            owner: capture,
            operation: { try await control.run() }
        )
        let first = Task { @MainActor in
            await operation.wait(timeoutNanoseconds: 1_000_000_000)
        }
        let second = Task { @MainActor in
            await operation.wait(timeoutNanoseconds: 1_000_000_000)
        }
        while control.callCount == 0 { await Task.yield() }

        control.succeed()
        let firstResult = await first.value
        let secondResult = await second.value

        XCTAssertTrue(firstResult)
        XCTAssertTrue(secondResult)
        XCTAssertEqual(control.callCount, 1)
    }

    @MainActor
    func testLateSuccessBeforeTimedOutCallerResumesCannotRelatchFailure() async {
        let capture = CaptureOwner()
        var lifecycle = DisplayPreviewStopLifecycle()
        lifecycle.adopt(capture)
        XCTAssertTrue(lifecycle.beginStop(of: capture))

        XCTAssertTrue(lifecycle.confirmedStopCompleted(for: capture))
        XCTAssertFalse(lifecycle.stopDidNotComplete(for: capture))
        XCTAssertTrue(lifecycle.canStart)
        XCTAssertFalse(lifecycle.isBlocked)
    }

    func testConfirmedLateOwnedStopReleasesBlockedCaptureAfterCancelledTermination() {
        let capture = CaptureOwner()
        var lifecycle = DisplayPreviewStopLifecycle()
        lifecycle.adopt(capture)
        lifecycle.beginTermination()
        XCTAssertTrue(lifecycle.beginStop(of: capture))
        XCTAssertTrue(lifecycle.stopDidNotComplete(for: capture))
        lifecycle.cancelTermination()

        XCTAssertTrue(lifecycle.confirmedStopCompleted(for: capture))
        XCTAssertTrue(lifecycle.canStart)
    }

    func testFailedOwnedStopRemainsBlocked() {
        let capture = CaptureOwner()
        var lifecycle = DisplayPreviewStopLifecycle()
        lifecycle.adopt(capture)
        lifecycle.beginTermination()
        XCTAssertTrue(lifecycle.beginStop(of: capture))

        XCTAssertTrue(lifecycle.stopDidNotComplete(for: capture))
        lifecycle.cancelTermination()
        XCTAssertFalse(lifecycle.terminating)
        XCTAssertTrue(lifecycle.isBlocked)
        XCTAssertFalse(lifecycle.canStart)
    }

    @MainActor
    func testSettledStopFailureCanBeRetriedForTermination() async {
        let capture = CaptureOwner()
        var callCount = 0
        var lifecycle = DisplayPreviewStopLifecycle()
        lifecycle.adopt(capture)
        lifecycle.beginTermination()
        XCTAssertTrue(lifecycle.beginStop(of: capture))
        let failed = DisplayPreviewStopOperation(owner: capture) {
            callCount += 1
            throw TestError.stopFailed
        }

        let failedResult = await failed.wait(timeoutNanoseconds: 1_000_000_000)
        XCTAssertFalse(failedResult)
        XCTAssertTrue(lifecycle.stopDidNotComplete(for: capture))
        XCTAssertTrue(lifecycle.retryBlockedStop(of: capture))
        let retry = DisplayPreviewStopOperation(owner: capture) { callCount += 1 }

        let retryResult = await retry.wait(timeoutNanoseconds: 1_000_000_000)
        XCTAssertTrue(retryResult)
        XCTAssertTrue(lifecycle.confirmedStopCompleted(for: capture))
        XCTAssertEqual(callCount, 2)
    }

    func testLateCompletionCannotReleaseReplacementCapture() {
        let first = CaptureOwner()
        let replacement = CaptureOwner()
        var lifecycle = DisplayPreviewStopLifecycle()
        lifecycle.adopt(first)
        XCTAssertTrue(lifecycle.beginStop(of: first))
        lifecycle.adopt(replacement)

        XCTAssertFalse(lifecycle.confirmedStopCompleted(for: first))
        XCTAssertTrue(lifecycle.owns(replacement))
        XCTAssertFalse(lifecycle.canStart)
    }

    func testTerminalDelegateStopReleasesMatchingBlockedOwnerButNotReplacement() {
        let first = CaptureOwner()
        let replacement = CaptureOwner()
        var active = DisplayPreviewStopLifecycle()
        active.adopt(first)
        XCTAssertTrue(active.terminalStopConfirmed(for: first))

        var stopping = DisplayPreviewStopLifecycle()
        stopping.adopt(first)
        XCTAssertTrue(stopping.beginStop(of: first))
        XCTAssertTrue(stopping.terminalStopConfirmed(for: first))

        var blocked = DisplayPreviewStopLifecycle()
        blocked.adopt(first)
        XCTAssertTrue(blocked.beginStop(of: first))
        XCTAssertTrue(blocked.stopDidNotComplete(for: first))

        XCTAssertTrue(blocked.terminalStopConfirmed(for: first))
        XCTAssertTrue(blocked.canStart)

        var replaced = DisplayPreviewStopLifecycle()
        replaced.adopt(first)
        XCTAssertTrue(replaced.beginStop(of: first))
        replaced.adopt(replacement)

        XCTAssertFalse(replaced.terminalStopConfirmed(for: first))
        XCTAssertTrue(replaced.owns(replacement))
    }

    private func overlappingState() -> DisplayPreviewAutoResumeState {
        var state = DisplayPreviewAutoResumeState()
        _ = state.placementChanged(
            overlapsSource: true, wasRunning: true, sessionExists: true, sourceUUID: "source-a"
        )
        return state
    }
}
