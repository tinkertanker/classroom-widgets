import AppKit

let dashboardURLScheme = "classroom-widgets"
private var appDelegate: AppDelegate?

MainActor.assumeIsolated {
    let app = NSApplication.shared
    let delegate = AppDelegate()
    appDelegate = delegate
    app.delegate = delegate
    app.run()
}
