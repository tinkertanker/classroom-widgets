import XCTest
@testable import ClassroomWidgets

final class DisplayPreviewLifecycleTests: XCTestCase {
    private final class CaptureOwner {}

    func testRevealAfterVisibilityStopResumesSameSource() {
        var state = DisplayPreviewVisibilityResumeState()
        state.hidden(wasRunning: true, sourceUUID: "source-a")

        XCTAssertFalse(state.stopCompleted(currentSourceUUID: "source-a", terminating: false))
        XCTAssertEqual(state.revealed(sessionExists: false, currentSourceUUID: "source-a"), .startNow)
    }

    func testRevealBeforeVisibilityStopRestartsAfterOwnedStopCompletes() {
        var state = DisplayPreviewVisibilityResumeState()
        state.hidden(wasRunning: true, sourceUUID: "source-a")

        XCTAssertEqual(state.revealed(sessionExists: true, currentSourceUUID: "source-a"), .startAfterStop)
        XCTAssertTrue(state.stopCompleted(currentSourceUUID: "source-a", terminating: false))
    }

    func testExplicitCancellationPreventsVisibilityResume() {
        var state = DisplayPreviewVisibilityResumeState()
        state.hidden(wasRunning: true, sourceUUID: "source-a")
        state.pauseRequested(preservingDeferredRestart: false)

        XCTAssertEqual(state.revealed(sessionExists: false, currentSourceUUID: "source-a"), .none)
        XCTAssertFalse(state.stopCompleted(currentSourceUUID: "source-a", terminating: false))
    }

    func testSourceChangeOrTerminationPreventsVisibilityResume() {
        var sourceChanged = DisplayPreviewVisibilityResumeState()
        sourceChanged.hidden(wasRunning: true, sourceUUID: "source-a")
        sourceChanged.requestRestart(sourceUUID: "source-a")
        _ = sourceChanged.revealed(sessionExists: true, currentSourceUUID: "source-a")
        XCTAssertFalse(sourceChanged.stopCompleted(currentSourceUUID: "source-b", terminating: false))

        var terminating = DisplayPreviewVisibilityResumeState()
        terminating.hidden(wasRunning: true, sourceUUID: "source-a")
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

    @MainActor
    func testConfirmedLateStopSuccessIsNotDiscardedAfterTimeout() async {
        var reconciled = false
        let initialResult: Bool = await withCheckedContinuation { continuation in
            let gate = DisplayPreviewStopGate(continuation) { reconciled = true }
            gate.finish(false)
            gate.finish(true)
        }

        XCTAssertFalse(initialResult)
        XCTAssertTrue(reconciled)
    }

    @MainActor
    func testLateSuccessBeforeTimedOutCallerResumesCannotRelatchFailure() async {
        let capture = CaptureOwner()
        var lifecycle = DisplayPreviewStopLifecycle()
        lifecycle.adopt(capture)
        XCTAssertTrue(lifecycle.beginStop(of: capture))

        let timedOut: Bool = await withCheckedContinuation { continuation in
            let gate = DisplayPreviewStopGate(continuation) {
                XCTAssertTrue(lifecycle.confirmedStopCompleted(for: capture))
            }
            gate.finish(false)
            gate.finish(true)
        }

        XCTAssertFalse(timedOut)
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
}
