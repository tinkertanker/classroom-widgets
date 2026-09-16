import Foundation

enum DisplayPreviewStartTrigger {
    case explicit
    case visibilityResume
}

enum DisplayPreviewPermissionPolicy {
    static func shouldRequestPermission(
        for trigger: DisplayPreviewStartTrigger,
        preflightGranted: Bool
    ) -> Bool {
        switch trigger {
        case .explicit: !preflightGranted
        case .visibilityResume: false
        }
    }

    static func canStart(
        for trigger: DisplayPreviewStartTrigger,
        preflightGranted: Bool
    ) -> Bool {
        switch trigger {
        case .explicit: true
        case .visibilityResume: preflightGranted
        }
    }
}

enum DisplayPreviewStatus {
    static func ready(sourceName: String) -> String {
        "Ready to preview \(sourceName)."
    }
}

struct DisplayPreviewStopLifecycle {
    private enum Phase {
        case idle
        case active(ObjectIdentifier)
        case stopping(ObjectIdentifier)
        case blocked(ObjectIdentifier)
    }

    private var phase: Phase = .idle
    private(set) var terminating = false

    var isStopping: Bool {
        if case .stopping = phase { return true }
        return false
    }

    var isBlocked: Bool {
        if case .blocked = phase { return true }
        return false
    }

    var canStart: Bool {
        if case .idle = phase { return !terminating }
        return false
    }

    mutating func adopt(_ owner: AnyObject) {
        phase = .active(ObjectIdentifier(owner))
    }

    func owns(_ owner: AnyObject) -> Bool {
        let id = ObjectIdentifier(owner)
        return switch phase {
        case .active(let ownerID), .stopping(let ownerID), .blocked(let ownerID): ownerID == id
        default: false
        }
    }

    mutating func beginStop(of owner: AnyObject) -> Bool {
        let id = ObjectIdentifier(owner)
        guard case .active(let ownerID) = phase, ownerID == id else { return false }
        phase = .stopping(id)
        return true
    }

    mutating func confirmedStopCompleted(for owner: AnyObject) -> Bool {
        let id = ObjectIdentifier(owner)
        switch phase {
        case .stopping(let ownerID) where ownerID == id:
            break
        case .blocked(let ownerID) where ownerID == id:
            break
        default:
            return false
        }
        phase = .idle
        return true
    }

    mutating func stopDidNotComplete(for owner: AnyObject) -> Bool {
        let id = ObjectIdentifier(owner)
        guard case .stopping(let ownerID) = phase, ownerID == id else { return false }
        phase = .blocked(id)
        return true
    }

    mutating func retryBlockedStop(of owner: AnyObject) -> Bool {
        let id = ObjectIdentifier(owner)
        guard case .blocked(let ownerID) = phase, ownerID == id else { return false }
        phase = .stopping(id)
        return true
    }

    mutating func terminalStopConfirmed(for owner: AnyObject) -> Bool {
        let id = ObjectIdentifier(owner)
        switch phase {
        case .active(let ownerID) where ownerID == id:
            break
        case .stopping(let ownerID) where ownerID == id:
            break
        case .blocked(let ownerID) where ownerID == id:
            break
        default:
            return false
        }
        phase = .idle
        return true
    }

    mutating func release(_ owner: AnyObject) -> Bool {
        let id = ObjectIdentifier(owner)
        guard case .active(let ownerID) = phase, ownerID == id else { return false }
        phase = .idle
        return true
    }

    mutating func beginTermination() {
        terminating = true
    }

    mutating func cancelTermination() {
        terminating = false
    }
}

struct DisplayPreviewVisibilityResumeState {
    enum Action: Equatable {
        case none
        case startNow
        case startAfterStop
    }

    private var suspendedSourceUUID: String?
    private var revealedBeforeStop = false

    mutating func hidden(wasRunning: Bool, sourceUUID: String?) {
        guard wasRunning, let sourceUUID else { return }
        suspendedSourceUUID = sourceUUID
        revealedBeforeStop = false
    }

    mutating func revealed(sessionExists: Bool, currentSourceUUID: String?) -> Action {
        guard let suspendedSourceUUID, suspendedSourceUUID == currentSourceUUID else {
            cancel()
            return .none
        }
        if sessionExists {
            revealedBeforeStop = true
            return .startAfterStop
        }
        cancel()
        return .startNow
    }

    mutating func requestRestart(sourceUUID: String?) {
        suspendedSourceUUID = sourceUUID
        revealedBeforeStop = true
    }

    mutating func stopCompleted(currentSourceUUID: String?, terminating: Bool) -> Bool {
        guard suspendedSourceUUID == currentSourceUUID, !terminating else {
            cancel()
            return false
        }
        guard revealedBeforeStop else { return false }
        cancel()
        return true
    }

    mutating func pauseRequested(preservingDeferredRestart: Bool) {
        if !preservingDeferredRestart { cancel() }
    }

    mutating func cancel() {
        suspendedSourceUUID = nil
        revealedBeforeStop = false
    }
}

struct DisplayPreviewAutoResumeState {
    enum Action: Equatable {
        case none
        case suspend
        case startNow
        case startAfterStop
    }

    private var visibility = DisplayPreviewVisibilityResumeState()
    var hasPendingRestart: Bool { false }

    mutating func hidden(wasRunning: Bool, sourceUUID: String?) -> Action {
        visibility.hidden(wasRunning: wasRunning, sourceUUID: sourceUUID)
        return wasRunning ? .suspend : .none
    }

    mutating func revealed(sessionExists: Bool, currentSourceUUID: String?) -> Action {
        switch visibility.revealed(sessionExists: sessionExists, currentSourceUUID: currentSourceUUID) {
        case .none: return .none
        case .startNow: return .startNow
        case .startAfterStop: return .startAfterStop
        }
    }

    mutating func placementChanged(
        overlapsSource: Bool,
        wasRunning: Bool,
        sessionExists: Bool,
        sourceUUID: String?
    ) -> Action {
        guard overlapsSource, wasRunning else { return .none }
        visibility.cancel()
        return .suspend
    }

    mutating func requestRestart(sourceUUID: String?) {
        visibility.requestRestart(sourceUUID: sourceUUID)
    }

    mutating func stopCompleted(currentSourceUUID: String?, terminating: Bool) -> Bool {
        visibility.stopCompleted(currentSourceUUID: currentSourceUUID, terminating: terminating)
    }

    mutating func pauseRequested(preservingDeferredRestart: Bool) {
        visibility.pauseRequested(preservingDeferredRestart: preservingDeferredRestart)
    }

    mutating func cancel() { visibility.cancel() }
}
