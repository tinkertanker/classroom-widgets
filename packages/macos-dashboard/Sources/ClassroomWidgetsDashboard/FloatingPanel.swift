import AppKit

/// Non-activating floating panel that still activates the app when clicked.
///
/// `.nonactivatingPanel` is what lets a regular-policy app's panel be shown over other
/// apps' full-screen Spaces, but it also stops clicks from making the app active, so the
/// panel never becomes the focused window (no active titlebar, no Window-menu or
/// window-manager shortcuts). Activating explicitly on mouse-down restores focus while the
/// panel stays on the current Space.
class FloatingPanel: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }

    override func sendEvent(_ event: NSEvent) {
        if Self.activatesApp(for: event.type), !NSApp.isActive {
            NSApp.activate(ignoringOtherApps: true)
            makeKeyAndOrderFront(nil)
            makeMain()
        }
        super.sendEvent(event)
    }

    static func activatesApp(for eventType: NSEvent.EventType) -> Bool {
        switch eventType {
        case .leftMouseDown, .rightMouseDown, .otherMouseDown: true
        default: false
        }
    }
}
