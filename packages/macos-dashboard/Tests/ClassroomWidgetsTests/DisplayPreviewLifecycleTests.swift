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
}
