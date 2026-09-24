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

    func testNoOpScreenNoticePreservesLiveSourceInsteadOfResetting() {
        func outcome(
            hasWindow: Bool = true,
            selectedSourceID: CGDirectDisplayID? = 2,
            currentMatchID: CGDirectDisplayID? = 2,
            isHostCandidate: Bool = false
        ) -> DisplayPreviewTopologyOutcome {
            DisplayPreviewTopologyPolicy.outcome(
                hasWindow: hasWindow,
                selectedSourceID: selectedSourceID,
                currentMatchID: currentMatchID,
                isHostCandidate: isHostCandidate
            )
        }

        XCTAssertEqual(outcome(), .preserveSource)
        XCTAssertEqual(
            outcome(isHostCandidate: true),
            .preserveSource,
            "Overlapping the source removes it from the host-filtered candidate list but must not reset the preview"
        )
        XCTAssertEqual(outcome(currentMatchID: nil), .reset)
        XCTAssertEqual(outcome(selectedSourceID: nil, currentMatchID: nil), .ignore)
        XCTAssertEqual(outcome(hasWindow: false), .ignore)
        XCTAssertEqual(
            outcome(currentMatchID: 3),
            .reset,
            "A reconnected display with a new CGDirectDisplayID must restart capture"
        )
        XCTAssertEqual(
            outcome(currentMatchID: 3, isHostCandidate: true),
            .reset,
            "Host candidacy must never mask a genuinely changed source"
        )
    }

    func testOverlapSuspensionSurvivesAnUnrelatedNoticeAndStillResumes() {
        var state = DisplayPreviewAutoResumeState()
        XCTAssertEqual(state.placementChanged(
            overlapsSource: true, wasRunning: true, sessionExists: true, sourceUUID: "source-a"
        ), .suspend)
        XCTAssertTrue(state.hasPendingRestart)

        XCTAssertEqual(
            DisplayPreviewTopologyPolicy.outcome(
                hasWindow: true, selectedSourceID: 2, currentMatchID: 2, isHostCandidate: true
            ),
            .preserveSource,
            "The coordinator must not cancel the overlap resume for an unchanged source"
        )
        XCTAssertTrue(state.hasPendingRestart)
        XCTAssertEqual(state.placementChanged(
            overlapsSource: false, wasRunning: false, sessionExists: false, sourceUUID: "source-a"
        ), .startNow, "Moving clear still resumes after the notice")
    }

    func testSourceRemovalOrMirroringStillCancelsOverlapResume() {
        XCTAssertEqual(
            DisplayPreviewTopologyPolicy.outcome(
                hasWindow: true, selectedSourceID: 2, currentMatchID: nil, isHostCandidate: true
            ),
            .reset,
            "A removed or mirrored source is invalid regardless of placement"
        )

        var state = DisplayPreviewAutoResumeState()
        _ = state.placementChanged(
            overlapsSource: true, wasRunning: true, sessionExists: true, sourceUUID: "source-a"
        )
        state.cancel()
        XCTAssertEqual(state.placementChanged(
            overlapsSource: false, wasRunning: false, sessionExists: false, sourceUUID: "source-a"
        ), .none, "A reset cancels the deferred resume")
    }

    func testStaticIdleNeverTriggersFirstFramePause() {
        XCTAssertEqual(
            DisplayPreviewFirstFramePolicy.outcome(deliveredFrame: true, streamActivity: true),
            .wait
        )
        XCTAssertEqual(
            DisplayPreviewFirstFramePolicy.outcome(deliveredFrame: true, streamActivity: false),
            .wait
        )
        XCTAssertEqual(
            DisplayPreviewFirstFramePolicy.outcome(deliveredFrame: false, streamActivity: true),
            .hold,
            "Frame status activity (including static .idle) proves the stream is alive and must not pause"
        )
        XCTAssertEqual(
            DisplayPreviewFirstFramePolicy.outcome(deliveredFrame: false, streamActivity: false),
            .pauseBroken
        )
    }

    func testDeliberateLaunchStartsWhileIncidentalNoticeDoesNot() {
        XCTAssertEqual(
            DisplayPreviewLaunchPolicy.outcome(
                existingWindow: false, wantsCapture: false, hasPendingRestart: false, hasSelectedSource: true
            ),
            .createAndStart
        )
        XCTAssertEqual(
            DisplayPreviewLaunchPolicy.outcome(
                existingWindow: false, wantsCapture: false, hasPendingRestart: false, hasSelectedSource: false
            ),
            .createWithoutStart
        )
        XCTAssertEqual(
            DisplayPreviewLaunchPolicy.outcome(
                existingWindow: true, wantsCapture: true, hasPendingRestart: false, hasSelectedSource: true
            ),
            .raiseOnly,
            "An already-live launch only raises the window"
        )
        XCTAssertEqual(
            DisplayPreviewLaunchPolicy.outcome(
                existingWindow: true, wantsCapture: false, hasPendingRestart: true, hasSelectedSource: true
            ),
            .raiseOnly,
            "A launch during deferred recovery must not start a second stream"
        )
        XCTAssertEqual(
            DisplayPreviewLaunchPolicy.outcome(
                existingWindow: true, wantsCapture: false, hasPendingRestart: false, hasSelectedSource: true
            ),
            .raiseAndStart
        )
        XCTAssertEqual(
            DisplayPreviewLaunchPolicy.outcome(
                existingWindow: true, wantsCapture: false, hasPendingRestart: false, hasSelectedSource: false
            ),
            .raiseOnly
        )
    }

    func testFrameRecoveryHoldsThenRestoresSameSourceWithoutChurn() {
        var recovery = DisplayPreviewFrameRecovery()
        XCTAssertFalse(recovery.isHolding)

        XCTAssertEqual(recovery.gapDetected(generation: 5), .holdBegan)
        XCTAssertTrue(recovery.isHolding)
        guard let episode = recovery.activeEpisode else { return XCTFail("Expected an active hold episode") }
        XCTAssertEqual(
            recovery.gapDetected(generation: 5),
            .holdExtended,
            "Repeated gap frames for the same stream must not restart recovery"
        )
        XCTAssertEqual(recovery.frameRestored(generation: 5), .restored)
        XCTAssertFalse(recovery.isHolding)
        XCTAssertEqual(recovery.frameRestored(generation: 5), .ignored)
        XCTAssertFalse(recovery.isActive(generation: 5, episode: episode))
    }

    func testFrameRecoveryIsBoundedAndCancellable() {
        var recovery = DisplayPreviewFrameRecovery()
        XCTAssertEqual(recovery.gapDetected(generation: 9), .holdBegan)
        guard let episode = recovery.activeEpisode else { return XCTFail("Expected an active hold episode") }
        XCTAssertEqual(
            recovery.windowExpired(generation: 9, episode: episode),
            .holdExtended,
            "The first bounded hold window may be retried once"
        )
        XCTAssertEqual(recovery.windowExpired(generation: 9, episode: episode), .exhausted)
        XCTAssertFalse(recovery.isHolding)

        var cancelled = DisplayPreviewFrameRecovery()
        XCTAssertEqual(cancelled.gapDetected(generation: 4), .holdBegan)
        guard let cancelledEpisode = cancelled.activeEpisode else { return XCTFail("Expected an active hold episode") }
        cancelled.cancel()
        XCTAssertFalse(cancelled.isHolding)
        XCTAssertEqual(cancelled.windowExpired(generation: 4, episode: cancelledEpisode), .ignored)
    }

    func testFrameRecoveryIgnoresStaleGenerations() {
        var recovery = DisplayPreviewFrameRecovery()
        XCTAssertEqual(recovery.gapDetected(generation: 3), .holdBegan)
        XCTAssertEqual(recovery.gapDetected(generation: 4), .ignored)
        XCTAssertEqual(recovery.frameRestored(generation: 3), .restored)
        XCTAssertEqual(recovery.frameRestored(generation: 4), .ignored)
    }

    func testEarlierGapTimerCannotConsumeALaterGapWindow() {
        var recovery = DisplayPreviewFrameRecovery()
        XCTAssertEqual(recovery.gapDetected(generation: 5), .holdBegan)
        guard let firstEpisode = recovery.activeEpisode else { return XCTFail("Expected the first hold episode") }
        XCTAssertEqual(recovery.frameRestored(generation: 5), .restored)
        XCTAssertEqual(recovery.gapDetected(generation: 5), .holdBegan)
        guard let secondEpisode = recovery.activeEpisode else { return XCTFail("Expected the second hold episode") }
        XCTAssertNotEqual(
            firstEpisode,
            secondEpisode,
            "A new gap inside the same stream generation is a new episode"
        )

        XCTAssertEqual(
            recovery.windowExpired(generation: 5, episode: firstEpisode),
            .ignored,
            "Gap A's timer must not consume gap B's window"
        )
        XCTAssertTrue(recovery.isHolding)
        XCTAssertTrue(recovery.isActive(generation: 5, episode: secondEpisode))
        XCTAssertEqual(recovery.windowExpired(generation: 5, episode: secondEpisode), .holdExtended)
        XCTAssertEqual(recovery.windowExpired(generation: 5, episode: secondEpisode), .exhausted)
    }

    func testRepeatedGapBurstsKeepIndependentWindowsAndCancellationWins() {
        var recovery = DisplayPreviewFrameRecovery()
        var episodes: [UInt64] = []
        for generation in UInt64(1)...UInt64(3) {
            XCTAssertEqual(recovery.gapDetected(generation: generation), .holdBegan)
            episodes.append(recovery.activeEpisode ?? 0)
            XCTAssertEqual(recovery.frameRestored(generation: generation), .restored)
        }
        XCTAssertEqual(Set(episodes).count, 3, "Every burst owns a distinct hold episode")
        XCTAssertFalse(recovery.isHolding)

        XCTAssertEqual(recovery.gapDetected(generation: 4), .holdBegan)
        guard let current = recovery.activeEpisode else { return XCTFail("Expected an active hold episode") }
        XCTAssertEqual(recovery.windowExpired(generation: 4, episode: current), .holdExtended)
        recovery.cancel()
        XCTAssertFalse(recovery.isHolding)
        XCTAssertEqual(
            recovery.windowExpired(generation: 4, episode: current),
            .ignored,
            "A cancelled episode can never be exhausted later"
        )
    }

    func testPreGapFrameCannotRestoreALaterGap() {
        var order = DisplayPreviewCaptureOrder()
        XCTAssertTrue(order.acceptsHoldEvent(sequence: 2), "The gap is applied first")
        XCTAssertFalse(
            order.acceptsFrame(sequence: 1),
            "A frame captured before the gap must not restore the held image"
        )
        XCTAssertTrue(order.acceptsFrame(sequence: 3), "A frame captured after the gap restores normally")
        XCTAssertEqual(order.latestFrameSequence, 3)
    }

    func testPostGapFrameDeliveredBeforeTheGapNotificationKeepsTheNewerEvent() {
        var order = DisplayPreviewCaptureOrder()
        XCTAssertTrue(
            order.acceptsFrame(sequence: 3),
            "A coalesced drain can apply a post-gap frame before the gap notification"
        )
        XCTAssertFalse(
            order.acceptsHoldEvent(sequence: 2),
            "A stale gap notification must not undo a newer delivered frame"
        )
        XCTAssertEqual(order.latestHoldSequence, 0)
    }

    func testTerminalDominatesANewerCoalescedFrame() {
        var order = DisplayPreviewCaptureOrder()
        XCTAssertTrue(
            order.acceptsFrame(sequence: 3),
            "A coalesced post-terminal frame can be applied before the terminal notification"
        )
        XCTAssertTrue(
            order.acceptsTerminalEvent(sequence: 2),
            "A terminal status must stop capture even when a newer frame was already applied"
        )
        XCTAssertEqual(order.terminalSequence, 2)
        XCTAssertFalse(order.acceptsFrame(sequence: 4), "No frame may revive a terminal session")
        XCTAssertFalse(order.acceptsHoldEvent(sequence: 5), "No gap may be reported after a terminal")
        XCTAssertFalse(order.acceptsTerminalEvent(sequence: 6), "Duplicate terminals are coalesced")
    }

    func testCaptureOrderResetClearsTerminalDominanceForTheNextStream() {
        var order = DisplayPreviewCaptureOrder()
        XCTAssertTrue(order.acceptsTerminalEvent(sequence: 1))
        order.reset()
        XCTAssertNil(order.terminalSequence)
        XCTAssertTrue(order.acceptsFrame(sequence: 1))
        XCTAssertTrue(order.acceptsHoldEvent(sequence: 2))
    }

    func testDeliberateLaunchDuringAnOwnedStopStartsOnceAfterMatchingCleanup() {
        var state = DisplayPreviewAutoResumeState()
        // close/power-off began the stop; the reopen arrived before it completed.
        state.requestRestart(sourceUUID: "source-a")
        XCTAssertTrue(state.hasPendingRestart)

        XCTAssertTrue(
            state.stopCompleted(currentSourceUUID: "source-a", terminating: false),
            "The matching owned cleanup starts the retained launch"
        )
        XCTAssertFalse(
            state.stopCompleted(currentSourceUUID: "source-a", terminating: false),
            "Cleanup must start the deferred launch exactly once"
        )
    }

    func testExplicitOffBeforeCleanupCancelsADeferredLaunch() {
        var state = DisplayPreviewAutoResumeState()
        state.requestRestart(sourceUUID: "source-a")

        state.pauseRequested(preservingDeferredRestart: false)

        XCTAssertFalse(state.hasPendingRestart, "An explicit off must overwrite the deferred launch")
        XCTAssertFalse(state.stopCompleted(currentSourceUUID: "source-a", terminating: false))
    }

    func testDeferredLaunchIsCancelledBySourceChangeOrTermination() {
        var sourceChanged = DisplayPreviewAutoResumeState()
        sourceChanged.requestRestart(sourceUUID: "source-a")
        XCTAssertFalse(sourceChanged.stopCompleted(currentSourceUUID: "source-b", terminating: false))
        XCTAssertFalse(sourceChanged.hasPendingRestart)

        var terminating = DisplayPreviewAutoResumeState()
        terminating.requestRestart(sourceUUID: "source-a")
        XCTAssertFalse(terminating.stopCompleted(currentSourceUUID: "source-a", terminating: true))
        XCTAssertFalse(terminating.hasPendingRestart)
    }

    func testDeferredLaunchWaitsForOverlapBlockerToClear() {
        var state = DisplayPreviewAutoResumeState()
        state.requestRestart(sourceUUID: "source-a")
        XCTAssertEqual(
            state.placementChanged(
                overlapsSource: true, wasRunning: false, sessionExists: false, sourceUUID: "source-a"
            ),
            .none
        )
        XCTAssertFalse(
            state.stopCompleted(currentSourceUUID: "source-a", terminating: false),
            "A retained launch must not start while the overlap blocker stands"
        )
        XCTAssertTrue(state.hasPendingRestart)
        XCTAssertEqual(
            state.placementChanged(
                overlapsSource: false, wasRunning: false, sessionExists: false, sourceUUID: "source-a"
            ),
            .startNow,
            "Clearing the blocker starts the retained launch"
        )
    }

    func testOnlyADeliberateLaunchDefersDuringAnOwnedStop() {
        XCTAssertTrue(DisplayPreviewDeferredStartPolicy.shouldDefer(
            trigger: .launch, isStopping: true, isTerminating: false
        ))
        XCTAssertFalse(
            DisplayPreviewDeferredStartPolicy.shouldDefer(
                trigger: .explicit, isStopping: true, isTerminating: false
            ),
            "A direct power click keeps its explicit permission flow instead of deferring"
        )
        XCTAssertFalse(DisplayPreviewDeferredStartPolicy.shouldDefer(
            trigger: .visibilityResume, isStopping: true, isTerminating: false
        ))
        XCTAssertFalse(
            DisplayPreviewDeferredStartPolicy.shouldDefer(
                trigger: .launch, isStopping: true, isTerminating: true
            ),
            "Termination cancels deferred starts"
        )
        XCTAssertFalse(DisplayPreviewDeferredStartPolicy.shouldDefer(
            trigger: .launch, isStopping: false, isTerminating: false
        ))
    }

    func testFreshLaunchReResolvesARepluggedSourceByUUID() async {
        await MainActor.run {
            let catalog = DisplayCatalog()
            let replugged = DisplayDescriptor(
                id: 7,
                uuid: "DELL-P2217H",
                name: "DELL P2217H",
                bounds: CGRect(x: -212, y: -1080, width: 1920, height: 1080),
                isActive: true,
                mirrorMasterID: nil
            )
            let builtIn = DisplayDescriptor(
                id: 8,
                uuid: "BUILT-IN",
                name: "Built-in Display",
                bounds: CGRect(x: 0, y: 0, width: 1512, height: 982),
                isActive: true,
                mirrorMasterID: nil
            )

            XCTAssertEqual(
                catalog.resolveSource(rememberedUUIDs: ["DELL-P2217H"], among: [replugged, builtIn])?.id,
                7,
                "A replugged display keeps its UUID but gets a new CGDirectDisplayID"
            )
            XCTAssertEqual(
                catalog.resolveSource(rememberedUUIDs: [], among: [replugged])?.id,
                7,
                "A sole eligible display is auto-selected"
            )
            XCTAssertNil(
                catalog.resolveSource(rememberedUUIDs: [], among: [replugged, builtIn]),
                "Ambiguous candidates keep meaningful selection UI"
            )
            XCTAssertNil(
                catalog.resolveSource(rememberedUUIDs: ["GONE"], among: [replugged, builtIn]),
                "A vanished remembered source is dropped, never captured by a stale identifier"
            )
            XCTAssertEqual(
                catalog.resolveSource(rememberedUUIDs: ["GONE"], among: [replugged])?.id,
                7,
                "With the remembered source gone, the sole remaining display is used"
            )
        }
    }

    func testDeliberateLaunchStartsWithPreflightOnlyPermission() {
        XCTAssertFalse(
            DisplayPreviewPermissionPolicy.shouldRequestPermission(for: .launch, preflightGranted: false),
            "An automatic launch must never present a new Screen Recording dialog"
        )
        XCTAssertFalse(
            DisplayPreviewPermissionPolicy.canStart(for: .launch, preflightGranted: false),
            "Without preflight access a launch leaves an actionable status instead of prompting"
        )
        XCTAssertTrue(DisplayPreviewPermissionPolicy.canStart(for: .launch, preflightGranted: true))
        XCTAssertFalse(DisplayPreviewPermissionPolicy.shouldRequestPermission(for: .launch, preflightGranted: true))
        XCTAssertTrue(
            DisplayPreviewPermissionPolicy.shouldRequestPermission(for: .explicit, preflightGranted: false),
            "A direct power click keeps the existing explicit permission request flow"
        )
        XCTAssertTrue(DisplayPreviewPermissionPolicy.canStart(for: .explicit, preflightGranted: false))
        XCTAssertEqual(DisplayPreviewStartTrigger.launch.logLabel, "launch")
    }

    func testRepeatedTopologyRefreshWithoutChangeDoesNotInvalidateLiveGeometry() async {
        await MainActor.run {
            let catalog = DisplayCatalog()
            XCTAssertTrue(catalog.refreshTopology(), "The first observation establishes the signature")
            let revision = catalog.topologyRevision
            XCTAssertFalse(
                catalog.refreshTopology(),
                "A screen-parameter notice with an unchanged display set must not bump the revision"
            )
            XCTAssertEqual(catalog.topologyRevision, revision)
            XCTAssertFalse(catalog.topologySummary().isEmpty)
        }
    }

    private func overlappingState() -> DisplayPreviewAutoResumeState {
        var state = DisplayPreviewAutoResumeState()
        _ = state.placementChanged(
            overlapsSource: true, wasRunning: true, sessionExists: true, sourceUUID: "source-a"
        )
        return state
    }
}
