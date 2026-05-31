import AppKit

let dashboardURLScheme = "classroom-widgets"

MainActor.assumeIsolated {
    let app = NSApplication.shared
    let delegate = AppDelegate()
    app.delegate = delegate
    app.run()
}
