import AppKit

private var appDelegate: AppDelegate?

MainActor.assumeIsolated {
    PerfProbe.mark("main")
    PerfProbe.monitorMainThread()
    let app = NSApplication.shared
    let delegate = AppDelegate()
    PerfProbe.mark("app.delegate.init")
    appDelegate = delegate
    app.delegate = delegate
    app.run()
}
