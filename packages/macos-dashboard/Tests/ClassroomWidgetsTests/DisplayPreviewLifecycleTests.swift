import XCTest
@testable import ClassroomWidgets

final class DisplayPreviewLifecycleTests: XCTestCase {
    func testRevealAfterVisibilityStopResumesSameSource() {
        var state = DisplayPreviewVisibilityResumeState()
        state.hidden(wasRunning: true)

        XCTAssertFalse(state.stopCompleted(currentSourceUUID: "source-a", terminating: false))
        XCTAssertEqual(state.revealed(sessionExists: false), .startNow)
    }

    func testRevealBeforeVisibilityStopRestartsAfterOwnedStopCompletes() {
        var state = DisplayPreviewVisibilityResumeState()
        state.hidden(wasRunning: true)

        XCTAssertEqual(state.revealed(sessionExists: true), .startAfterStop)
        XCTAssertTrue(state.stopCompleted(currentSourceUUID: "source-a", terminating: false))
    }

    func testExplicitCancellationPreventsVisibilityResume() {
        var state = DisplayPreviewVisibilityResumeState()
        state.hidden(wasRunning: true)
        state.cancel()

        XCTAssertEqual(state.revealed(sessionExists: false), .none)
        XCTAssertFalse(state.stopCompleted(currentSourceUUID: "source-a", terminating: false))
    }

    func testSourceChangeOrTerminationPreventsVisibilityResume() {
        var sourceChanged = DisplayPreviewVisibilityResumeState()
        sourceChanged.hidden(wasRunning: true)
        sourceChanged.requestRestart(sourceUUID: "source-a")
        _ = sourceChanged.revealed(sessionExists: true)
        XCTAssertFalse(sourceChanged.stopCompleted(currentSourceUUID: "source-b", terminating: false))

        var terminating = DisplayPreviewVisibilityResumeState()
        terminating.hidden(wasRunning: true)
        terminating.requestRestart(sourceUUID: "source-a")
        _ = terminating.revealed(sessionExists: true)
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
}
