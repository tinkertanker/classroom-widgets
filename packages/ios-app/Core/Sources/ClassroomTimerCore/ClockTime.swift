import Foundation

public enum ClockPeriod: String, Codable, Equatable, Sendable {
    case am = "AM"
    case pm = "PM"
}

public struct ClockTimeSelection: Equatable, Sendable {
    public let hour: Int
    public let minute: Int
    public let period: ClockPeriod

    public init(hour: Int, minute: Int, period: ClockPeriod) {
        self.hour = hour
        self.minute = minute
        self.period = period
    }
}

public func clockTimeSelection(for date: Date, calendar: Calendar = .current) -> ClockTimeSelection {
    let components = calendar.dateComponents([.hour, .minute], from: date)
    let hour24 = components.hour ?? 0
    return ClockTimeSelection(
        hour: hour24 % 12 == 0 ? 12 : hour24 % 12,
        minute: components.minute ?? 0,
        period: hour24 < 12 ? .am : .pm
    )
}

public func defaultEndTimeSelection(now: Date = Date(), calendar: Calendar = .current) -> ClockTimeSelection {
    let components = calendar.dateComponents([.hour, .minute], from: now)
    let currentHour = components.hour ?? 0
    let currentMinute = components.minute ?? 0
    let nextHour = (currentHour + (currentMinute >= 30 ? 1 : 0)) % 24
    let nextMinute = currentMinute < 30 ? 30 : 0

    return ClockTimeSelection(
        hour: nextHour % 12 == 0 ? 12 : nextHour % 12,
        minute: nextMinute,
        period: nextHour < 12 ? .am : .pm
    )
}

public func nextClockTime(
    _ selection: ClockTimeSelection,
    after now: Date = Date(),
    calendar: Calendar = .current
) -> Date {
    let hour = min(12, max(1, selection.hour)) % 12 + (selection.period == .pm ? 12 : 0)
    let minute = min(59, max(0, selection.minute))
    var matching = DateComponents()
    matching.hour = hour
    matching.minute = minute
    matching.second = 0

    return calendar.nextDate(
        after: now,
        matching: matching,
        matchingPolicy: .nextTime,
        repeatedTimePolicy: .first,
        direction: .forward
    ) ?? now.addingTimeInterval(24 * 60 * 60)
}

public func clockTimeOccurrenceRolledOver(
    _ selection: ClockTimeSelection,
    from previewDate: Date,
    to applyDate: Date,
    calendar: Calendar = .current
) -> Bool {
    let previewOccurrence = nextClockTime(selection, after: previewDate, calendar: calendar)
    let applyOccurrence = nextClockTime(selection, after: applyDate, calendar: calendar)
    return !calendar.isDate(previewOccurrence, inSameDayAs: applyOccurrence)
}
