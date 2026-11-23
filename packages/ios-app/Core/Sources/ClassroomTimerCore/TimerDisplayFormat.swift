import Foundation

public func timerDisplayText(for remaining: TimeInterval) -> String {
    let safeRemaining = remaining.isFinite ? max(0, remaining) : 0
    let rounded = min(ceil(safeRemaining), TimeInterval(Int.max / 4))
    let totalSeconds = Int(rounded)
    let hours = totalSeconds / 3_600
    let minutes = (totalSeconds % 3_600) / 60
    let seconds = totalSeconds % 60

    if hours > 0 {
        return "\(twoDigits(hours)):\(twoDigits(minutes)):\(twoDigits(seconds))"
    }
    return "\(twoDigits(minutes)):\(twoDigits(seconds))"
}

private func twoDigits(_ value: Int) -> String {
    value < 10 ? "0\(value)" : String(value)
}
