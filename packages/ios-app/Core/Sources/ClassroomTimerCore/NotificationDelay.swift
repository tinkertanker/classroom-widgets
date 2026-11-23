import Foundation

public func notificationDelay(until deadline: TimeInterval, now: TimeInterval) -> TimeInterval? {
    guard deadline.isFinite, now.isFinite else { return nil }
    let remaining = deadline - now
    guard remaining > 0 else { return nil }
    return max(1, remaining)
}
