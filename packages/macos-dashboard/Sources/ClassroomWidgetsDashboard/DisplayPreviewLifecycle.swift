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
    static func ready(sourceName _: String) -> String {
        "Click to see display"
    }
}

struct DisplayPreviewPresentation: Equatable {
    let message: String
    let powerState: DisplayPreviewPowerState
    let powerEnabled: Bool
    let idleStartEnabled: Bool

    static func ready(sourceName: String) -> DisplayPreviewPresentation {
        DisplayPreviewPresentation(
            message: DisplayPreviewStatus.ready(sourceName: sourceName),
            powerState: .off,
            powerEnabled: true,
            idleStartEnabled: true
        )
    }
}

enum DisplayPreviewPowerState: Equatable {
    case off
    case on

    var actionLabel: String { self == .on ? "Turn preview off" : "Turn preview on" }
    var accessibilityValue: String { self == .on ? "On" : "Off" }

    static func current(wantsCapture: Bool, hasPendingRestart: Bool) -> DisplayPreviewPowerState {
        wantsCapture || hasPendingRestart ? .on : .off
    }
}

enum DisplayPreviewCaptureCallbackPolicy {
    static func mayChangeIntent(ownsSession: Bool, acceptsGeneration: Bool) -> Bool {
        ownsSession && acceptsGeneration
    }
}

enum DisplayPreviewStopCompletionPolicy {
    static func shouldPublishStatus(startGeneration: UInt64, currentGeneration: UInt64) -> Bool {
        startGeneration == currentGeneration
    }
}

struct DisplayPreviewPendingStopPresentation {
    private(set) var generation: UInt64?
    private(set) var message: String?
    private(set) var presentation: DisplayPreviewPresentation?

    mutating func update(
        generation: UInt64,
        message: String,
        presentation: DisplayPreviewPresentation?
    ) {
        self.generation = generation
        self.message = message
        self.presentation = presentation
    }

    mutating func consume(currentGeneration: UInt64) -> (
        message: String,
        presentation: DisplayPreviewPresentation?
    )? {
        guard let generation, let message,
              DisplayPreviewStopCompletionPolicy.shouldPublishStatus(
                startGeneration: generation,
                currentGeneration: currentGeneration
              )
        else { return nil }
        let result = (message: message, presentation: presentation)
        clear()
        return result
    }

    mutating func clear() {
        generation = nil
        message = nil
        presentation = nil
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

struct DisplayPreviewAutoResumeState {
    enum Action: Equatable {
        case none
        case suspend
        case startNow
        case startAfterStop
    }

    private enum Blocker: Hashable {
        case hidden
        case overlap
    }

    private var sourceUUID: String?
    private var blockers: Set<Blocker> = []
    private var restartRequested = false
    var hasPendingRestart: Bool { restartRequested }

    mutating func hidden(wasRunning: Bool, sourceUUID: String?) -> Action {
        blockerAdded(.hidden, wasRunning: wasRunning, sourceUUID: sourceUUID)
    }

    mutating func revealed(sessionExists: Bool, currentSourceUUID: String?) -> Action {
        blockerRemoved(.hidden, sessionExists: sessionExists, currentSourceUUID: currentSourceUUID)
    }

    mutating func placementChanged(
        overlapsSource: Bool,
        wasRunning: Bool,
        sessionExists: Bool,
        sourceUUID: String?
    ) -> Action {
        if overlapsSource {
            return blockerAdded(.overlap, wasRunning: wasRunning, sourceUUID: sourceUUID)
        }
        return blockerRemoved(.overlap, sessionExists: sessionExists, currentSourceUUID: sourceUUID)
    }

    mutating func requestRestart(sourceUUID: String?) {
        guard let sourceUUID else { cancel(); return }
        self.sourceUUID = sourceUUID
        blockers.removeAll()
        restartRequested = true
    }

    mutating func stopCompleted(currentSourceUUID: String?, terminating: Bool) -> Bool {
        guard !terminating, sourceUUID == currentSourceUUID else {
            cancel()
            return false
        }
        guard restartRequested, blockers.isEmpty else { return false }
        cancel()
        return true
    }

    mutating func pauseRequested(preservingDeferredRestart: Bool) {
        if !preservingDeferredRestart { cancel() }
    }

    mutating func cancel() {
        sourceUUID = nil
        blockers.removeAll()
        restartRequested = false
    }

    private mutating func blockerAdded(
        _ blocker: Blocker,
        wasRunning: Bool,
        sourceUUID: String?
    ) -> Action {
        guard let sourceUUID else { cancel(); return .none }
        if wasRunning {
            self.sourceUUID = sourceUUID
            restartRequested = true
        } else if !restartRequested || self.sourceUUID != sourceUUID {
            return .none
        }
        blockers.insert(blocker)
        return wasRunning ? .suspend : .none
    }

    private mutating func blockerRemoved(
        _ blocker: Blocker,
        sessionExists: Bool,
        currentSourceUUID: String?
    ) -> Action {
        guard restartRequested, sourceUUID == currentSourceUUID else {
            if restartRequested { cancel() }
            return .none
        }
        blockers.remove(blocker)
        guard blockers.isEmpty else { return .none }
        if sessionExists { return .startAfterStop }
        cancel()
        return .startNow
    }
}
