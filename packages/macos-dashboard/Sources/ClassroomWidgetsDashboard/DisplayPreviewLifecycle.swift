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
        !preflightGranted
    }
}

struct DisplayPreviewVisibilityResumeState {
    enum Action: Equatable {
        case none
        case startNow
        case startAfterStop
    }

    private var resumeAfterVisibilitySuspension = false
    private var restartAfterStop = false
    private var restartSourceUUID: String?

    mutating func hidden(wasRunning: Bool) {
        if wasRunning { resumeAfterVisibilitySuspension = true }
    }

    mutating func revealed(sessionExists: Bool) -> Action {
        guard resumeAfterVisibilitySuspension else { return .none }
        resumeAfterVisibilitySuspension = false
        if sessionExists {
            restartAfterStop = true
            return .startAfterStop
        }
        return .startNow
    }

    mutating func requestRestart(sourceUUID: String?) {
        restartAfterStop = true
        restartSourceUUID = sourceUUID
    }

    mutating func stopCompleted(currentSourceUUID: String?, terminating: Bool) -> Bool {
        defer { cancel() }
        return restartAfterStop && restartSourceUUID == currentSourceUUID && !terminating
    }

    mutating func cancel() {
        restartAfterStop = false
        restartSourceUUID = nil
        resumeAfterVisibilitySuspension = false
    }
}
