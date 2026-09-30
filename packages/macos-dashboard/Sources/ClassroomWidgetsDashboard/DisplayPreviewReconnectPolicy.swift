import CoreGraphics

/// Hides Display when the external display goes away and brings it back when
/// one returns, but only if the hide was ours, not the user's.
/// Mirrors DisplayReconnectPolicy.cs and displayReconnect.ts.
struct DisplayPreviewReconnectPolicy {
    enum Action: Equatable {
        case none
        case hide
        case show
    }

    private enum Phase {
        case idle
        case hiding
        case hiddenByDisconnect
    }

    /// Screen notices arrive in bursts during one plug or unplug.
    static let debounceNanoseconds: UInt64 = 750_000_000
    /// How long after an automatic reopen a live stand-in may still move to the saved display.
    static let standInSwitchSeconds: Double = 10

    private var phase = Phase.idle
    private var externalDisplayAvailable: Bool

    init(externalDisplayAvailable: Bool) {
        self.externalDisplayAvailable = externalDisplayAvailable
    }

    var hiddenByDisconnect: Bool { phase == .hiddenByDisconnect }

    /// A mirror set lists once; a mirror-set master reports 0 as its master.
    static func hasExternalDisplay(in displays: [DisplayDescriptor]) -> Bool {
        displays.filter { $0.isActive && ($0.mirrorMasterID ?? 0) == 0 }.count > 1
    }

    mutating func displaysChanged(externalDisplayAvailable available: Bool, isOpen: Bool, showOnReconnect: Bool) -> Action {
        let wasAvailable = externalDisplayAvailable
        externalDisplayAvailable = available
        if isOpen {
            guard wasAvailable, !available else { return .none }
            phase = .hiding
            return .hide
        }
        guard phase == .hiddenByDisconnect, available else { return .none }
        phase = .idle
        return showOnReconnect ? .show : .none
    }

    mutating func windowOpened() { phase = .idle }

    mutating func windowClosed() { phase = phase == .hiding ? .hiddenByDisconnect : .idle }
}
