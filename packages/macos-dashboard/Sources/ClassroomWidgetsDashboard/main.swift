import AppKit
import Carbon
import SwiftUI
import WebKit

private let dashboardURLScheme = "classroom-widgets"

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    private var controller: DashboardWindowController?
    private var hotKeys: [DashboardHotKey] = []
    private var statusItem: NSStatusItem?
    private lazy var settingsContext = DashboardSettingsContext(
        onShortcutsChanged: { [weak self] in
            self?.registerHotKeys()
            self?.updateStatusMenu()
        },
        onWindowBehaviorChanged: { [weak self] in
            self?.controller?.applySettings()
        },
        onShowDashboard: { [weak self] in
            self?.controller?.showDashboard()
        },
        onShowWidgetLauncher: { [weak self] in
            self?.controller?.showWidgetLauncher()
        }
    )
    private lazy var settingsWindowCoordinator = SettingsWindowCoordinator { [weak self] in
        guard let self else {
            return NSView()
        }

        return NSHostingView(rootView: DashboardSettingsView(context: self.settingsContext))
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        DashboardDefaults.register()
        NSApp.setActivationPolicy(.accessory)

        let controller = DashboardWindowController()
        self.controller = controller
        setupStatusItem()
        registerHotKeys()

        if UserDefaults.standard.bool(forKey: DashboardSettingKeys.showDashboardAtLaunch) {
            controller.showDashboard()
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        hotKeys.removeAll()
    }

    private func setupStatusItem() {
        let statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        statusItem.button?.image = menuBarIcon()
        statusItem.button?.imagePosition = .imageOnly
        self.statusItem = statusItem
        updateStatusMenu()
    }

    private func menuBarIcon() -> NSImage? {
        let symbolNames = [
            "rectangle.3.group",
            "square.grid.2x2"
        ]
        let configuration = NSImage.SymbolConfiguration(pointSize: 16, weight: .medium)

        for symbolName in symbolNames {
            if let image = NSImage(systemSymbolName: symbolName, accessibilityDescription: "Classroom Widgets")?
                .withSymbolConfiguration(configuration) {
                image.isTemplate = true
                return image
            }
        }

        return nil
    }

    private func updateStatusMenu() {
        let menu = NSMenu()

        let toggleTitle = controller?.isDashboardVisible == true ? "Hide Dashboard" : "Show Dashboard"
        let toggleItem = NSMenuItem(title: toggleTitle, action: #selector(toggleDashboard), keyEquivalent: "")
        toggleItem.target = self
        toggleItem.attributedTitle = menuTitle(toggleTitle, shortcut: shortcutTitle(
            keyCode: shortcutKeyCode(for: DashboardSettingKeys.toggleShortcutKeyCode, fallback: DashboardDefaults.toggleShortcutKeyCode),
            modifiers: shortcutModifiers(for: DashboardSettingKeys.toggleShortcutModifiers)
        ))
        menu.addItem(toggleItem)

        let launcherItem = NSMenuItem(title: "Open Widget Launcher", action: #selector(showWidgetLauncher), keyEquivalent: "")
        launcherItem.target = self
        launcherItem.attributedTitle = menuTitle("Open Widget Launcher", shortcut: shortcutTitle(
            keyCode: shortcutKeyCode(for: DashboardSettingKeys.launcherShortcutKeyCode, fallback: DashboardDefaults.launcherShortcutKeyCode),
            modifiers: shortcutModifiers(for: DashboardSettingKeys.launcherShortcutModifiers)
        ))
        menu.addItem(launcherItem)

        menu.addItem(NSMenuItem.separator())

        let settingsItem = NSMenuItem(title: "Settings...", action: #selector(showSettings), keyEquivalent: ",")
        settingsItem.target = self
        menu.addItem(settingsItem)

        menu.addItem(NSMenuItem.separator())

        let quitItem = NSMenuItem(title: "Quit Classroom Widgets", action: #selector(quitApp), keyEquivalent: "q")
        quitItem.target = self
        menu.addItem(quitItem)

        statusItem?.menu = menu
    }

    private func registerHotKeys() {
        hotKeys.removeAll()

        let toggleKeyCode = shortcutKeyCode(for: DashboardSettingKeys.toggleShortcutKeyCode, fallback: DashboardDefaults.toggleShortcutKeyCode)
        if toggleKeyCode != -1, let modifiers = carbonModifiers(from: shortcutModifiers(for: DashboardSettingKeys.toggleShortcutModifiers)) {
            hotKeys.append(DashboardHotKey(id: 1, keyCode: UInt32(toggleKeyCode), modifiers: modifiers) { [weak self] in
                self?.controller?.toggleDashboard()
                self?.updateStatusMenu()
            })
        }

        let launcherKeyCode = shortcutKeyCode(for: DashboardSettingKeys.launcherShortcutKeyCode, fallback: DashboardDefaults.launcherShortcutKeyCode)
        let launcherModifiers = shortcutModifiers(for: DashboardSettingKeys.launcherShortcutModifiers)
        let conflictsWithToggle = launcherKeyCode == toggleKeyCode &&
            launcherModifiers == shortcutModifiers(for: DashboardSettingKeys.toggleShortcutModifiers)

        if !conflictsWithToggle,
           launcherKeyCode != -1,
           let modifiers = carbonModifiers(from: launcherModifiers) {
            hotKeys.append(DashboardHotKey(id: 2, keyCode: UInt32(launcherKeyCode), modifiers: modifiers) { [weak self] in
                self?.controller?.showWidgetLauncher()
                self?.updateStatusMenu()
            })
        }
    }

    @objc private func toggleDashboard() {
        controller?.toggleDashboard()
        updateStatusMenu()
    }

    @objc private func showWidgetLauncher() {
        controller?.showWidgetLauncher()
        updateStatusMenu()
    }

    @objc private func showSettings() {
        settingsWindowCoordinator.show()
    }

    @objc private func quitApp() {
        NSApp.terminate(nil)
    }

    private func shortcutKeyCode(for key: String, fallback: Int) -> Int {
        let defaults = UserDefaults.standard
        guard defaults.object(forKey: key) != nil else {
            return fallback
        }

        return defaults.integer(forKey: key)
    }

    private func shortcutModifiers(for key: String) -> Int {
        let defaults = UserDefaults.standard
        guard defaults.object(forKey: key) != nil else {
            return DashboardDefaults.shortcutModifiers
        }

        return defaults.integer(forKey: key)
    }

    private func carbonModifiers(from rawModifiers: Int) -> UInt32? {
        let flags = NSEvent.ModifierFlags(rawValue: UInt(rawModifiers))
        var carbonModifiers: UInt32 = 0
        if flags.contains(.command) { carbonModifiers |= UInt32(cmdKey) }
        if flags.contains(.option) { carbonModifiers |= UInt32(optionKey) }
        if flags.contains(.control) { carbonModifiers |= UInt32(controlKey) }
        if flags.contains(.shift) { carbonModifiers |= UInt32(shiftKey) }

        return carbonModifiers == 0 ? nil : carbonModifiers
    }

    private func shortcutTitle(keyCode: Int, modifiers: Int) -> String? {
        guard keyCode != -1 else {
            return nil
        }

        let flags = NSEvent.ModifierFlags(rawValue: UInt(modifiers))
        var title = ""
        if flags.contains(.control) { title += "⌃" }
        if flags.contains(.option) { title += "⌥" }
        if flags.contains(.shift) { title += "⇧" }
        if flags.contains(.command) { title += "⌘" }
        title += keyTitle(for: keyCode)
        return title
    }

    private func keyTitle(for keyCode: Int) -> String {
        switch keyCode {
        case kVK_Space:
            return "Space"
        case kVK_ANSI_K:
            return "K"
        default:
            return "\(keyCode)"
        }
    }

    private func menuTitle(_ title: String, shortcut: String?) -> NSAttributedString {
        guard let shortcut else {
            return NSAttributedString(string: title)
        }

        let attributed = NSMutableAttributedString(string: title)
        let shortcutString = NSAttributedString(
            string: "    \(shortcut)",
            attributes: [.foregroundColor: NSColor.secondaryLabelColor]
        )
        attributed.append(shortcutString)
        return attributed
    }
}

final class DashboardWindowController: NSWindowController {
    private let webView: WKWebView
    private let scriptMessageHandler: DashboardScriptMessageHandler
    private var localMouseMonitor: Any?
    private var globalMouseMonitor: Any?
    private var lastHitTestPoint = NSPoint(x: -1, y: -1)
    private var hitTestInFlight = false
    private var dashboardVisible = true
    var isDashboardVisible: Bool { dashboardVisible }

    init() {
        let configuration = WKWebViewConfiguration()
        configuration.setURLSchemeHandler(
            StaticFileSchemeHandler(webRoot: WebRootResolver.resolve()),
            forURLScheme: dashboardURLScheme
        )
        configuration.userContentController.addUserScript(WKUserScript(
            source: "window.__CLASSROOM_WIDGETS_MACOS__ = true;",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        ))
        scriptMessageHandler = DashboardScriptMessageHandler()

        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.setValue(false, forKey: "drawsBackground")

        let window = DashboardWindow(
            contentRect: Self.combinedScreenFrame(),
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )
        window.backgroundColor = .clear
        window.isOpaque = false
        window.hasShadow = false
        window.level = .floating
        window.ignoresMouseEvents = false
        window.contentView = webView

        super.init(window: window)
        applySettings()

        scriptMessageHandler.onVisibilityChanged = { [weak self] visible in
            self?.dashboardVisible = visible
            if !visible {
                self?.window?.ignoresMouseEvents = true
            }
        }
        webView.configuration.userContentController.add(scriptMessageHandler, name: "classroomDashboard")
        loadDashboard()
        installMouseMonitors()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    deinit {
        if let localMouseMonitor {
            NSEvent.removeMonitor(localMouseMonitor)
        }
        if let globalMouseMonitor {
            NSEvent.removeMonitor(globalMouseMonitor)
        }
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "classroomDashboard")
    }

    func showDashboard() {
        dashboardVisible = true
        window?.setFrame(Self.combinedScreenFrame(), display: true)
        applySettings()
        window?.orderFrontRegardless()
        window?.ignoresMouseEvents = false
        setWebDashboardVisible(true)
    }

    func toggleDashboard() {
        dashboardVisible.toggle()
        setWebDashboardVisible(dashboardVisible)

        if dashboardVisible {
            window?.orderFrontRegardless()
            window?.ignoresMouseEvents = false
            updateMousePassthrough(force: true)
        } else {
            window?.ignoresMouseEvents = true
        }
    }

    func showWidgetLauncher() {
        showDashboard()
        let expression = """
        requestAnimationFrame(() => {
          document.querySelector('[title*="More widgets"]')?.click()
        })
        """
        webView.evaluateJavaScript(expression)
    }

    func applySettings() {
        guard let window else { return }

        window.level = UserDefaults.standard.bool(forKey: DashboardSettingKeys.floatingOverlay) ? .floating : .normal

        var behavior: NSWindow.CollectionBehavior = [.stationary]
        if UserDefaults.standard.bool(forKey: DashboardSettingKeys.keepOnAllSpaces) {
            behavior.insert(.canJoinAllSpaces)
            behavior.insert(.fullScreenAuxiliary)
        }
        window.collectionBehavior = behavior

        if !UserDefaults.standard.bool(forKey: DashboardSettingKeys.clickThroughEmptyAreas) {
            window.ignoresMouseEvents = false
        }
    }

    private func loadDashboard() {
        let url = URL(string: "\(dashboardURLScheme)://app/?dashboard=1")!
        webView.load(URLRequest(url: url))
    }

    private func setWebDashboardVisible(_ visible: Bool) {
        let expression = "window.classroomDashboard?.setVisible(\(visible ? "true" : "false"))"
        webView.evaluateJavaScript(expression)
    }

    private func installMouseMonitors() {
        localMouseMonitor = NSEvent.addLocalMonitorForEvents(matching: [.mouseMoved, .leftMouseDragged, .rightMouseDragged, .otherMouseDragged]) { [weak self] event in
            self?.updateMousePassthrough(force: false)
            return event
        }

        globalMouseMonitor = NSEvent.addGlobalMonitorForEvents(matching: [.mouseMoved, .leftMouseDragged, .rightMouseDragged, .otherMouseDragged]) { [weak self] _ in
            self?.updateMousePassthrough(force: false)
        }
    }

    private func updateMousePassthrough(force: Bool) {
        guard UserDefaults.standard.bool(forKey: DashboardSettingKeys.clickThroughEmptyAreas) else {
            window?.ignoresMouseEvents = false
            return
        }

        guard dashboardVisible, let window else {
            window?.ignoresMouseEvents = true
            return
        }

        let screenPoint = NSEvent.mouseLocation
        guard window.frame.contains(screenPoint) else {
            window.ignoresMouseEvents = true
            return
        }

        let pointInWindow = window.convertPoint(fromScreen: screenPoint)
        let x = pointInWindow.x
        let y = webView.bounds.height - pointInWindow.y
        let jsPoint = NSPoint(x: round(x), y: round(y))

        if !force, hitTestInFlight || distance(from: jsPoint, to: lastHitTestPoint) < 4 {
            return
        }

        lastHitTestPoint = jsPoint
        hitTestInFlight = true

        let expression = "Boolean(window.classroomDashboard?.isInteractiveAt(\(Int(jsPoint.x)), \(Int(jsPoint.y))))"
        webView.evaluateJavaScript(expression) { [weak self] result, _ in
            guard let self else { return }
            self.hitTestInFlight = false
            let interactive = result as? Bool ?? false
            self.window?.ignoresMouseEvents = !interactive
        }
    }

    private static func combinedScreenFrame() -> NSRect {
        NSScreen.screens.reduce(NSRect.zero) { partial, screen in
            partial.union(screen.frame)
        }
    }

    private func distance(from first: NSPoint, to second: NSPoint) -> CGFloat {
        hypot(first.x - second.x, first.y - second.y)
    }
}

final class DashboardScriptMessageHandler: NSObject, WKScriptMessageHandler {
    var onVisibilityChanged: ((Bool) -> Void)?

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard
            let body = message.body as? [String: Any],
            let type = body["type"] as? String,
            type == "visibility-changed",
            let visible = body["visible"] as? Bool
        else {
            return
        }

        onVisibilityChanged?(visible)
    }
}

final class DashboardWindow: NSWindow {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}

final class DashboardHotKey {
    private static let signature = OSType(0x43574447)
    private let id: UInt32
    private var hotKeyRef: EventHotKeyRef?
    private var eventHandler: EventHandlerRef?
    private let handler: () -> Void

    init(id: UInt32, keyCode: UInt32, modifiers: UInt32, handler: @escaping () -> Void) {
        self.id = id
        self.handler = handler

        var eventType = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: OSType(kEventHotKeyPressed))
        let callback: EventHandlerUPP = { _, event, userData in
            guard let userData else { return noErr }
            let instance = Unmanaged<DashboardHotKey>.fromOpaque(userData).takeUnretainedValue()

            var hotKeyID = EventHotKeyID()
            let status = GetEventParameter(
                event,
                EventParamName(kEventParamDirectObject),
                EventParamType(typeEventHotKeyID),
                nil,
                MemoryLayout<EventHotKeyID>.size,
                nil,
                &hotKeyID
            )

            guard status == noErr,
                  hotKeyID.signature == DashboardHotKey.signature,
                  hotKeyID.id == instance.id
            else {
                return noErr
            }

            instance.handler()
            return noErr
        }

        InstallEventHandler(GetApplicationEventTarget(), callback, 1, &eventType, Unmanaged.passUnretained(self).toOpaque(), &eventHandler)

        let hotKeyID = EventHotKeyID(signature: Self.signature, id: id)
        RegisterEventHotKey(keyCode, modifiers, hotKeyID, GetApplicationEventTarget(), 0, &hotKeyRef)
    }

    deinit {
        if let hotKeyRef {
            UnregisterEventHotKey(hotKeyRef)
        }
        if let eventHandler {
            RemoveEventHandler(eventHandler)
        }
    }
}

enum WebRootResolver {
    static func resolve() -> URL {
        if let override = ProcessInfo.processInfo.environment["CLASSROOM_WIDGETS_WEB_ROOT"], !override.isEmpty {
            return URL(fileURLWithPath: override, isDirectory: true)
        }

        if let bundledWebRoot = Bundle.main.resourceURL?.appendingPathComponent("Web", isDirectory: true),
           FileManager.default.fileExists(atPath: bundledWebRoot.appendingPathComponent("index.html").path) {
            return bundledWebRoot
        }

        let bundleURL = Bundle.main.bundleURL
        let repoRoot = bundleURL
            .deletingLastPathComponent()
            .deletingLastPathComponent()

        return repoRoot
            .appendingPathComponent("packages")
            .appendingPathComponent("teacher")
            .appendingPathComponent("build")
    }
}

final class StaticFileSchemeHandler: NSObject, WKURLSchemeHandler {
    private let webRoot: URL

    init(webRoot: URL) {
        self.webRoot = webRoot.standardizedFileURL
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let requestURL = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }

        let rawPath = requestURL.path == "/" ? "/index.html" : requestURL.path
        let relativePath = rawPath.split(separator: "/").map(String.init).joined(separator: "/")
        let fileURL = webRoot.appendingPathComponent(relativePath).standardizedFileURL

        guard fileURL.path.hasPrefix(webRoot.path) else {
            urlSchemeTask.didFailWithError(URLError(.noPermissionsToReadFile))
            return
        }

        do {
            let data = try Data(contentsOf: fileURL)
            let response = URLResponse(
                url: requestURL,
                mimeType: mimeType(for: fileURL.pathExtension),
                expectedContentLength: data.count,
                textEncodingName: nil
            )
            urlSchemeTask.didReceive(response)
            urlSchemeTask.didReceive(data)
            urlSchemeTask.didFinish()
        } catch {
            urlSchemeTask.didFailWithError(error)
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}

    private func mimeType(for pathExtension: String) -> String {
        switch pathExtension.lowercased() {
        case "html":
            return "text/html"
        case "js", "mjs":
            return "text/javascript"
        case "css":
            return "text/css"
        case "svg":
            return "image/svg+xml"
        case "png":
            return "image/png"
        case "jpg", "jpeg":
            return "image/jpeg"
        case "gif":
            return "image/gif"
        case "webp":
            return "image/webp"
        case "mp3":
            return "audio/mpeg"
        case "wav":
            return "audio/wav"
        case "json", "webmanifest":
            return "application/json"
        default:
            return "application/octet-stream"
        }
    }
}

MainActor.assumeIsolated {
    let app = NSApplication.shared
    let delegate = AppDelegate()
    app.delegate = delegate
    app.run()
}
