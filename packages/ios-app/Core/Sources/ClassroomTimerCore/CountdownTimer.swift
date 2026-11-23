import Foundation
import Observation

public enum CountdownState: String, Codable, Equatable, Sendable {
    case ready
    case running
    case paused
    case finished
}

public struct CountdownSnapshot: Codable, Equatable, Sendable {
    public let duration: TimeInterval
    public let remaining: TimeInterval
    public let state: CountdownState
    public let deadline: TimeInterval?
    public let runDuration: TimeInterval

    public init(
        duration: TimeInterval,
        remaining: TimeInterval,
        state: CountdownState,
        deadline: TimeInterval?,
        runDuration: TimeInterval
    ) {
        self.duration = duration
        self.remaining = remaining
        self.state = state
        self.deadline = deadline
        self.runDuration = runDuration
    }
}

@Observable
public final class CountdownTimer {
    public static let maximumDuration: TimeInterval = 99 * 60 * 60 + 59 * 60 + 59

    public private(set) var duration: TimeInterval
    public private(set) var remaining: TimeInterval
    public private(set) var state: CountdownState
    public private(set) var runDuration: TimeInterval
    public private(set) var revision: UInt64 = 0

    @ObservationIgnored private var deadline: TimeInterval?
    @ObservationIgnored private let now: () -> TimeInterval

    public var isRunning: Bool { state == .running }
    public var isPaused: Bool { state == .paused }
    public var isFinished: Bool { state == .finished }
    public var progress: Double {
        guard runDuration > 0 else { return 0 }
        return min(1, max(0, remaining / runDuration))
    }

    public var snapshot: CountdownSnapshot {
        CountdownSnapshot(
            duration: duration,
            remaining: remaining,
            state: state,
            deadline: deadline,
            runDuration: runDuration
        )
    }

    public init(
        duration: TimeInterval = 60,
        snapshot: CountdownSnapshot? = nil,
        now: @escaping () -> TimeInterval = { Date().timeIntervalSince1970 }
    ) {
        self.now = now

        let fallbackDuration = duration.isFinite ? min(Self.maximumDuration, max(0, duration)) : 60
        guard let snapshot else {
            self.duration = fallbackDuration
            self.remaining = fallbackDuration
            self.state = .ready
            self.runDuration = fallbackDuration
            return
        }

        let restoredDuration = snapshot.duration.isFinite
            ? min(Self.maximumDuration, max(0, snapshot.duration))
            : fallbackDuration
        let restoredRunDuration = snapshot.runDuration.isFinite
            ? min(Self.maximumDuration, max(0, snapshot.runDuration))
            : restoredDuration
        self.duration = restoredDuration
        self.runDuration = restoredRunDuration

        switch snapshot.state {
        case .ready:
            self.remaining = restoredDuration
            self.state = .ready
            self.deadline = nil
        case .paused:
            self.remaining = Self.validRemaining(snapshot.remaining)
            self.state = .paused
            self.deadline = nil
        case .finished:
            self.remaining = 0
            self.state = .finished
            self.deadline = nil
        case .running:
            guard let storedDeadline = snapshot.deadline, storedDeadline.isFinite else {
                self.remaining = restoredDuration
                self.state = .ready
                self.deadline = nil
                return
            }
            let restoredRemaining = min(Self.maximumDuration, max(0, storedDeadline - now()))
            if restoredRemaining == 0 {
                self.remaining = 0
                self.state = .finished
                self.deadline = nil
            } else {
                self.remaining = restoredRemaining
                self.state = .running
                self.deadline = min(storedDeadline, now() + Self.maximumDuration)
            }
        }
    }

    public func start() {
        guard state == .ready else { return }
        startRunning(with: remaining)
    }

    public func resume() {
        guard state == .paused else { return }
        startRunning(with: remaining)
    }

    public func pause() {
        guard state == .running else { return }
        update()
        guard state == .running else { return }

        deadline = nil
        state = .paused
        revision &+= 1
    }

    public func restart() {
        deadline = nil
        remaining = duration
        runDuration = duration
        state = .ready
        revision &+= 1
    }

    public func reset() {
        restart()
    }

    public func setDuration(_ duration: TimeInterval) {
        guard duration.isFinite, duration >= 0, duration <= Self.maximumDuration else { return }

        self.duration = duration
        remaining = duration
        runDuration = duration
        deadline = nil
        state = .ready
        revision &+= 1
    }

    public func editRemaining(_ remaining: TimeInterval) {
        guard state == .paused, remaining.isFinite, remaining >= 0, remaining <= Self.maximumDuration else { return }

        self.remaining = remaining
        runDuration = max(runDuration, remaining)
        revision &+= 1
    }

    public func addTime(_ delta: TimeInterval) {
        guard delta.isFinite, delta > 0, state != .finished else { return }

        if state == .running {
            update()
            guard state == .running, canAddTime(delta), let deadline else { return }
            let extendedDeadline = deadline + delta
            let extendedDuration = duration + delta
            let extendedRunDuration = runDuration + delta
            guard extendedDeadline.isFinite, extendedDuration.isFinite, extendedRunDuration.isFinite else { return }

            self.deadline = extendedDeadline
            duration = extendedDuration
            runDuration = extendedRunDuration
            remaining = max(0, extendedDeadline - now())
            revision &+= 1
            return
        }

        guard canAddTime(delta) else { return }
        let extendedDuration = duration + delta
        let extendedRemaining = remaining + delta
        let extendedRunDuration = runDuration + delta
        guard extendedDuration.isFinite, extendedRemaining.isFinite, extendedRunDuration.isFinite else { return }

        duration = extendedDuration
        remaining = extendedRemaining
        runDuration = extendedRunDuration
        revision &+= 1
    }

    @discardableResult
    public func update() -> Bool {
        guard state == .running, let deadline else { return false }

        remaining = max(0, deadline - now())
        if remaining == 0 {
            self.deadline = nil
            state = .finished
            revision &+= 1
            return true
        }
        return false
    }

    public func canAddTime(_ delta: TimeInterval) -> Bool {
        guard delta.isFinite, delta > 0, state != .finished else { return false }
        let currentRemaining: TimeInterval
        if state == .running, let deadline {
            currentRemaining = max(0, deadline - now())
        } else {
            currentRemaining = remaining
        }
        return duration + delta <= Self.maximumDuration
            && currentRemaining + delta <= Self.maximumDuration
    }

    private func startRunning(with remaining: TimeInterval) {
        guard remaining > 0, remaining.isFinite, remaining <= Self.maximumDuration else { return }
        let newDeadline = now() + remaining
        guard newDeadline.isFinite else { return }

        deadline = newDeadline
        state = .running
        revision &+= 1
    }

    private static func validRemaining(_ value: TimeInterval) -> TimeInterval {
        value.isFinite ? min(maximumDuration, max(0, value)) : 0
    }
}
