import CoreGraphics
import Foundation

enum DisplayPreviewStartTrigger {
    /// A direct power-button press. May request Screen Recording access.
    case explicit
    /// An automatic start from `open()` on a deliberate launch. Preflight only:
    /// it must never present a new permission dialog.
    case launch
    /// An automatic resume after hidden/overlap. Preflight only.
    case visibilityResume

    var logLabel: String {
        switch self {
        case .explicit: return "explicit"
        case .launch: return "launch"
        case .visibilityResume: return "visibilityResume"
        }
    }
}

enum DisplayPreviewPermissionPolicy {
    static func shouldRequestPermission(
        for trigger: DisplayPreviewStartTrigger,
        preflightGranted: Bool
    ) -> Bool {
        switch trigger {
        case .explicit: !preflightGranted
        case .launch, .visibilityResume: false
        }
    }

    static func canStart(
        for trigger: DisplayPreviewStartTrigger,
        preflightGranted: Bool
    ) -> Bool {
        switch trigger {
        case .explicit: true
        case .launch, .visibilityResume: preflightGranted
        }
    }
}

enum DisplayPreviewStatus {
    static func ready(sourceName _: String) -> String {
        "Click to see display"
    }

    static func live(sourceName: String) -> String {
        "Live: \(sourceName)"
    }

    /// Shown while the last good image is held across a temporary frame gap.
    static func reconnecting(sourceName: String) -> String {
        "Reconnecting to \(sourceName)…"
    }

    static func waitingForFirstFrame(sourceName: String) -> String {
        "Waiting for \(sourceName) to send its first frame…"
    }

    /// Truthful terminal status for a source that stopped sending frames.
    static func unavailable(sourceName: String) -> String {
        "\(sourceName) stopped sending frames. Turn the preview on to retry."
    }
}

/// Stable, privacy-safe identifiers for coordinator transitions. These are logged
/// instead of localized status text so a later occurrence is diagnosable.
enum DisplayPreviewTransition: String {
    case open
    case raise
    case start
    case startFailed
    case firstFrame
    case frameGap
    case hold
    case recovered
    case recoveryExhausted
    case streamStopped
    case firstFrameTimeout
    case topologyNotice
    case topologyPreserved
    case topologyReset
    case sourceSelected
    case pause
    case close
    case overlapSuspend
    case overlapResume
    case hidden
    case revealed
    case deferredRestart
    case termination
}

/// What a `didChangeScreenParameters` notice means for the current preview.
enum DisplayPreviewTopologyOutcome: Equatable {
    /// Nothing to do: no preview window or no selected source.
    case ignore
    /// The selected source is still uniquely present and eligible; keep intent and image.
    case preserveSource
    /// The selected source changed, disappeared, or is no longer eligible.
    case reset
}

enum DisplayPreviewTopologyPolicy {
    /// A screen-parameter notice is only relevant when it changes the source that
    /// is actually being previewed. Notices also fire for menu bar, Dock, colour,
    /// and unrelated display changes, so they must not reset a live preview.
    static func outcome(
        hasWindow: Bool,
        selectedSourceID: CGDirectDisplayID?,
        currentMatchID: CGDirectDisplayID?,
        isStillEligible: Bool
    ) -> DisplayPreviewTopologyOutcome {
        guard hasWindow, let selectedSourceID else { return .ignore }
        guard isStillEligible, currentMatchID == selectedSourceID else { return .reset }
        return .preserveSource
    }
}

/// What the first-frame deadline should do once it expires.
enum DisplayPreviewFirstFrameOutcome: Equatable {
    /// A frame was delivered; nothing to do.
    case wait
    /// The stream is delivering frame statuses but no image yet; hold with bounded recovery.
    case hold
    /// Nothing arrived at all; the stream is broken.
    case pauseBroken
}

enum DisplayPreviewFirstFramePolicy {
    /// A static display can report only `.idle` frames, which still proves the
    /// stream is alive. Only total silence means the stream never started.
    static func outcome(deliveredFrame: Bool, streamActivity: Bool) -> DisplayPreviewFirstFrameOutcome {
        if deliveredFrame { return .wait }
        return streamActivity ? .hold : .pauseBroken
    }
}

/// What a deliberate `open()` (menu, shortcut, widget launch) should do.
enum DisplayPreviewLaunchOutcome: Equatable {
    case raiseOnly
    case raiseAndStart
    case createWithoutStart
    case createAndStart
}

enum DisplayPreviewLaunchPolicy {
    /// A deliberate launch starts the saved or sole eligible source, but an
    /// incidental notice must never turn an explicitly paused preview back on.
    static func outcome(
        existingWindow: Bool,
        wantsCapture: Bool,
        hasPendingRestart: Bool,
        hasSelectedSource: Bool
    ) -> DisplayPreviewLaunchOutcome {
        if existingWindow {
            guard !wantsCapture, !hasPendingRestart, hasSelectedSource else { return .raiseOnly }
            return .raiseAndStart
        }
        return hasSelectedSource ? .createAndStart : .createWithoutStart
    }
}

/// Bounded hold state for temporary frame gaps on an already-authorized source.
/// It never restarts the stream; it only keeps the last good image and enabled
/// intent while the same source reports `.blank`/`.suspended`/missing-image frames.
struct DisplayPreviewFrameRecovery {
    enum Decision: Equatable {
        case ignored
        case holdBegan
        case holdExtended
        case restored
        case exhausted
    }

    /// Two bounded hold windows before the preview falls back to a truthful paused state.
    static let maximumHoldWindows = 2
    static let holdWindowNanoseconds: UInt64 = 6_000_000_000

    private(set) var generation: UInt64?
    private(set) var holdWindows = 0

    var isHolding: Bool { generation != nil }

    mutating func gapDetected(generation: UInt64) -> Decision {
        if self.generation == generation { return .holdExtended }
        guard self.generation == nil else { return .ignored }
        self.generation = generation
        holdWindows = 1
        return .holdBegan
    }

    mutating func frameRestored(generation: UInt64) -> Decision {
        guard self.generation == generation else { return .ignored }
        self.generation = nil
        holdWindows = 0
        return .restored
    }

    mutating func windowExpired(generation: UInt64) -> Decision {
        guard self.generation == generation else { return .ignored }
        guard holdWindows < Self.maximumHoldWindows else {
            self.generation = nil
            holdWindows = 0
            return .exhausted
        }
        holdWindows += 1
        return .holdExtended
    }

    mutating func cancel() {
        generation = nil
        holdWindows = 0
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
