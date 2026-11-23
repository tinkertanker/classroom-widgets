import XCTest
@testable import ClassroomTimerCore

final class CountdownTimerTests: XCTestCase {
    func testPauseAndResumePreserveRemainingTime() {
        let clock = ManualClock()
        let timer = CountdownTimer(duration: 90, now: { clock.now })

        timer.start()
        clock.advance(by: 30)
        timer.update()
        XCTAssertEqual(timer.remaining, 60, accuracy: 0.001)

        timer.pause()
        clock.advance(by: 50)
        timer.update()
        XCTAssertEqual(timer.remaining, 60, accuracy: 0.001)
        XCTAssertFalse(timer.isRunning)

        timer.resume()
        clock.advance(by: 10)
        timer.update()
        XCTAssertEqual(timer.remaining, 50, accuracy: 0.001)
    }

    func testCompletionStopsAtZeroAndDoesNotGoNegative() {
        let clock = ManualClock()
        let timer = CountdownTimer(duration: 5, now: { clock.now })

        timer.start()
        clock.advance(by: 8)
        timer.update()

        XCTAssertEqual(timer.remaining, 0)
        XCTAssertFalse(timer.isRunning)

        clock.advance(by: 10)
        timer.update()
        XCTAssertEqual(timer.remaining, 0)
    }

    func testResetRestoresSelectedDurationAndStopsCountdown() {
        let clock = ManualClock()
        let timer = CountdownTimer(duration: 45, now: { clock.now })

        timer.start()
        clock.advance(by: 12)
        timer.reset()

        XCTAssertEqual(timer.remaining, 45)
        XCTAssertFalse(timer.isRunning)
    }

    func testChangingDurationReplacesRunningCountdown() {
        let clock = ManualClock()
        let timer = CountdownTimer(duration: 60, now: { clock.now })

        timer.start()
        clock.advance(by: 20)
        timer.setDuration(150)
        clock.advance(by: 10)
        timer.update()

        XCTAssertEqual(timer.duration, 150)
        XCTAssertEqual(timer.remaining, 150)
        XCTAssertFalse(timer.isRunning)
    }

    func testInvalidDurationDoesNotReplaceCurrentSelection() {
        let timer = CountdownTimer(duration: 120, now: { 0 })

        timer.setDuration(.nan)
        XCTAssertEqual(timer.duration, 120)
        XCTAssertEqual(timer.remaining, 120)

        timer.setDuration(.infinity)
        XCTAssertEqual(timer.duration, 120)
    }

    func testFirstLaunchStartsWithOneMinuteReady() {
        let timer = CountdownTimer(now: { 0 })

        XCTAssertEqual(timer.duration, 60)
        XCTAssertEqual(timer.remaining, 60)
        XCTAssertEqual(timer.state, .ready)
    }

    func testQuickAddsExtendBothCurrentTimeAndRestartDuration() {
        let clock = ManualClock()
        let timer = CountdownTimer(duration: 60, now: { clock.now })

        timer.addTime(60)
        XCTAssertEqual(timer.duration, 120)
        XCTAssertEqual(timer.remaining, 120)
        XCTAssertEqual(timer.state, .ready)

        timer.start()
        clock.advance(by: 20)
        timer.addTime(120)
        timer.update()

        XCTAssertEqual(timer.duration, 240)
        XCTAssertEqual(timer.remaining, 220, accuracy: 0.001)
        XCTAssertEqual(timer.state, .running)

        timer.pause()
        timer.addTime(60)
        XCTAssertEqual(timer.duration, 300)
        XCTAssertEqual(timer.remaining, 280, accuracy: 0.001)
        XCTAssertEqual(timer.state, .paused)
    }

    func testEditingPausedRemainingDoesNotChangeRestartDuration() {
        let clock = ManualClock()
        let timer = CountdownTimer(duration: 120, now: { clock.now })

        timer.start()
        clock.advance(by: 30)
        timer.pause()
        timer.editRemaining(45)

        XCTAssertEqual(timer.duration, 120)
        XCTAssertEqual(timer.remaining, 45)
        XCTAssertEqual(timer.state, .paused)

        timer.restart()
        XCTAssertEqual(timer.remaining, 120)
        XCTAssertEqual(timer.state, .ready)
    }

    func testRestartReturnsToReadyWithoutStarting() {
        let clock = ManualClock()
        let timer = CountdownTimer(duration: 30, now: { clock.now })

        timer.start()
        clock.advance(by: 10)
        timer.restart()

        XCTAssertEqual(timer.remaining, 30)
        XCTAssertEqual(timer.state, .ready)
    }

    func testRestoreUsesStoredDeadlineInsteadOfTickCount() {
        let snapshot = CountdownSnapshot(
            duration: 90,
            remaining: 40,
            state: .running,
            deadline: 150,
            runDuration: 90
        )
        let restored = CountdownTimer(snapshot: snapshot, now: { 125 })

        XCTAssertEqual(restored.remaining, 25, accuracy: 0.001)
        XCTAssertEqual(restored.state, .running)
        XCTAssertEqual(restored.duration, 90)
    }

    func testRestoreMarksExpiredDeadlineFinishedWithoutNegativeTime() {
        let snapshot = CountdownSnapshot(
            duration: 90,
            remaining: 12,
            state: .running,
            deadline: 100,
            runDuration: 90
        )
        let restored = CountdownTimer(snapshot: snapshot, now: { 101 })

        XCTAssertEqual(restored.remaining, 0)
        XCTAssertEqual(restored.state, .finished)
    }

    func testZeroDurationCannotStart() {
        let timer = CountdownTimer(duration: 0, now: { 0 })

        timer.start()

        XCTAssertEqual(timer.state, .ready)
        XCTAssertFalse(timer.isRunning)
    }

    func testQuickAddsCannotExceedTheDurationPickerMaximum() {
        let maximum = 99 * 60 * 60 + 59 * 60 + 59
        let timer = CountdownTimer(duration: TimeInterval(maximum - 30), now: { 0 })

        XCTAssertTrue(timer.canAddTime(30))
        timer.addTime(30)
        XCTAssertEqual(timer.duration, TimeInterval(maximum))
        XCTAssertFalse(timer.canAddTime(1))
        timer.addTime(1)

        XCTAssertEqual(timer.duration, TimeInterval(maximum))
        XCTAssertEqual(timer.remaining, TimeInterval(maximum))
    }

    func testManualPausedEditCannotExceedThePickerMaximum() {
        let maximum = TimeInterval(99 * 60 * 60 + 59 * 60 + 59)
        let clock = ManualClock()
        let timer = CountdownTimer(duration: 60, now: { clock.now })

        timer.start()
        timer.pause()
        timer.editRemaining(maximum)
        XCTAssertFalse(timer.canAddTime(1))
        timer.editRemaining(maximum + 1)

        XCTAssertEqual(timer.remaining, maximum)
    }
}

private final class ManualClock {
    var now: TimeInterval = 0

    func advance(by seconds: TimeInterval) {
        now += seconds
    }
}
