import XCTest
@testable import ClassroomWidgets

final class HostWriteTrackerTests: XCTestCase {
    func testFailedAttemptDoesNotPoisonNextAttempt() async {
        await MainActor.run {
            let tracker = HostWriteTracker()
            let generation = tracker.begin()
            tracker.finish(succeeded: false, generation: generation)

            var results: [Bool] = []
            tracker.wait { results.append($0) }
            tracker.wait { results.append($0) }
            XCTAssertEqual(results, [false, false], "Retries within the failed attempt must not hide failure")

            tracker.acknowledgeFailure()
            tracker.wait { results.append($0) }
            XCTAssertEqual(results, [false, false, true])
        }
    }

    func testAcknowledgingFailurePreservesPendingWritesAndWaiters() async {
        await MainActor.run {
            let tracker = HostWriteTracker()
            let failedWrite = tracker.begin()
            let pendingWrite = tracker.begin()
            tracker.finish(succeeded: false, generation: failedWrite)

            var results: [Bool] = []
            tracker.wait { results.append($0) }
            tracker.acknowledgeFailure()
            tracker.wait { results.append($0) }
            XCTAssertTrue(results.isEmpty, "Acknowledgement must not release pending writes")

            tracker.finish(succeeded: true, generation: pendingWrite)
            XCTAssertEqual(results, [true, true], "The live host's callback must still drain both waiters")
        }
    }

    func testLateFailureStillFailsNextAttempt() async {
        await MainActor.run {
            let tracker = HostWriteTracker()
            let pendingWrite = tracker.begin()
            tracker.acknowledgeFailure()

            var result: Bool?
            tracker.wait { result = $0 }
            XCTAssertNil(result)
            tracker.finish(succeeded: false, generation: pendingWrite)
            XCTAssertEqual(result, false)
        }
    }

    func testHostResetInvalidatesOldCallbacks() async {
        await MainActor.run {
            let tracker = HostWriteTracker()
            let oldWrite = tracker.begin()
            var oldResult: Bool?
            tracker.wait { oldResult = $0 }
            tracker.reset()
            XCTAssertEqual(oldResult, false)

            let newWrite = tracker.begin()
            var newResult: Bool?
            tracker.wait { newResult = $0 }
            tracker.finish(succeeded: false, generation: oldWrite)
            XCTAssertNil(newResult)
            tracker.finish(succeeded: true, generation: newWrite)
            XCTAssertEqual(newResult, true)
        }
    }
}
