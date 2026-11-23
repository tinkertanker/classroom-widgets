import XCTest
@testable import ClassroomTimerCore

final class ClockTimeTests: XCTestCase {
    func testDefaultEndTimeRoundsUpToTheNextHalfHour() throws {
        let calendar = testCalendar()
        let now = try date(2026, 11, 23, 9, 12, calendar: calendar)

        let selection = defaultEndTimeSelection(now: now, calendar: calendar)

        XCTAssertEqual(selection, ClockTimeSelection(hour: 9, minute: 30, period: .am))
    }

    func testDefaultEndTimeAtHalfHourSelectsTheFollowingHour() throws {
        let calendar = testCalendar()
        let now = try date(2026, 11, 23, 9, 30, calendar: calendar)

        let selection = defaultEndTimeSelection(now: now, calendar: calendar)

        XCTAssertEqual(selection, ClockTimeSelection(hour: 10, minute: 0, period: .am))
    }

    func testDefaultEndTimeWrapsFromLateNightToMidnight() throws {
        let calendar = testCalendar()
        let now = try date(2026, 11, 23, 23, 45, calendar: calendar)

        let selection = defaultEndTimeSelection(now: now, calendar: calendar)

        XCTAssertEqual(selection, ClockTimeSelection(hour: 12, minute: 0, period: .am))
    }

    func testPassedEndTimeUsesTomorrow() throws {
        let calendar = testCalendar()
        let now = try date(2026, 11, 23, 10, 15, calendar: calendar)
        let selection = ClockTimeSelection(hour: 9, minute: 30, period: .am)

        let result = nextClockTime(selection, after: now, calendar: calendar)

        XCTAssertEqual(
            calendar.startOfDay(for: result),
            calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now))
        )
        XCTAssertEqual(calendar.component(.hour, from: result), 9)
        XCTAssertEqual(calendar.component(.minute, from: result), 30)
    }

    func testEndTimeAtTheCurrentMinuteUsesTheNextOccurrence() throws {
        let calendar = testCalendar()
        let now = try date(2026, 11, 23, 10, 10, calendar: calendar)
        let selection = ClockTimeSelection(hour: 10, minute: 10, period: .am)

        let result = nextClockTime(selection, after: now, calendar: calendar)

        XCTAssertEqual(
            calendar.startOfDay(for: result),
            calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now))
        )
    }

    func testEndTimeOccurrenceRollsOverIfPreviewedMinutePassesBeforeApply() throws {
        let calendar = testCalendar()
        let previewedAt = try date(2026, 11, 23, 9, 29, calendar: calendar).addingTimeInterval(59)
        let appliedAt = previewedAt.addingTimeInterval(2)
        let selection = ClockTimeSelection(hour: 9, minute: 30, period: .am)

        XCTAssertTrue(clockTimeOccurrenceRolledOver(selection, from: previewedAt, to: appliedAt, calendar: calendar))
    }

    func testEndTimeOccurrenceDoesNotRollOverWithinTheSameOccurrence() throws {
        let calendar = testCalendar()
        let previewedAt = try date(2026, 11, 23, 9, 10, calendar: calendar)
        let appliedAt = previewedAt.addingTimeInterval(60)
        let selection = ClockTimeSelection(hour: 9, minute: 30, period: .am)

        XCTAssertFalse(clockTimeOccurrenceRolledOver(selection, from: previewedAt, to: appliedAt, calendar: calendar))
    }

    func testEndTimeSelectionConvertsNoonAndMidnightCorrectly() throws {
        let calendar = testCalendar()
        let beforeNoon = try date(2026, 11, 23, 11, 0, calendar: calendar)
        let beforeMidnight = try date(2026, 11, 23, 23, 0, calendar: calendar)

        let noon = nextClockTime(
            ClockTimeSelection(hour: 12, minute: 0, period: .pm),
            after: beforeNoon,
            calendar: calendar
        )
        let midnight = nextClockTime(
            ClockTimeSelection(hour: 12, minute: 0, period: .am),
            after: beforeMidnight,
            calendar: calendar
        )

        XCTAssertEqual(calendar.component(.hour, from: noon), 12)
        XCTAssertEqual(calendar.component(.hour, from: midnight), 0)
        XCTAssertEqual(
            calendar.startOfDay(for: midnight),
            calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: beforeMidnight))
        )
    }
}

private func testCalendar() -> Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(secondsFromGMT: 0)!
    return calendar
}

private func date(_ year: Int, _ month: Int, _ day: Int, _ hour: Int, _ minute: Int, calendar: Calendar) throws -> Date {
    let components = DateComponents(year: year, month: month, day: day, hour: hour, minute: minute)
    guard let date = calendar.date(from: components) else {
        throw XCTSkip("Test date could not be represented by the calendar")
    }
    return date
}
