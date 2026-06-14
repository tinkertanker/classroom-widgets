import AppKit
import Carbon
import Combine
import SwiftUI

enum DashboardSettingKeys {
    static let toggleShortcutKeyCode = "dashboardToggleShortcutKeyCode"
    static let toggleShortcutModifiers = "dashboardToggleShortcutModifiers"
    static let launcherShortcutKeyCode = "dashboardLauncherShortcutKeyCode"
    static let launcherShortcutModifiers = "dashboardLauncherShortcutModifiers"
    static let settingsShortcutKeyCode = "dashboardSettingsShortcutKeyCode"
    static let settingsShortcutModifiers = "dashboardSettingsShortcutModifiers"
    static let showDashboardAtLaunch = "showDashboardAtLaunch"
    static let clickThroughEmptyAreas = "clickThroughEmptyAreas"
    static let keepOnAllSpaces = "keepOnAllSpaces"
    static let floatingOverlay = "floatingOverlay"
    static let showMenuBarIcon = "showMenuBarIcon"
    static let hasSeenMenuBarHideInfo = "hasSeenMenuBarHideInfo"
}

enum DashboardDefaults {
    static let toggleShortcutKeyCode = Int(kVK_ANSI_D)
    static let launcherShortcutKeyCode = Int(kVK_ANSI_K)
    static let settingsShortcutKeyCode = Int(kVK_ANSI_Comma)
    static let shortcutModifiers = Int(NSEvent.ModifierFlags([.command, .option]).rawValue)

    static func register() {
        UserDefaults.standard.register(defaults: [
            DashboardSettingKeys.toggleShortcutKeyCode: toggleShortcutKeyCode,
            DashboardSettingKeys.toggleShortcutModifiers: shortcutModifiers,
            DashboardSettingKeys.launcherShortcutKeyCode: launcherShortcutKeyCode,
            DashboardSettingKeys.launcherShortcutModifiers: shortcutModifiers,
            DashboardSettingKeys.settingsShortcutKeyCode: settingsShortcutKeyCode,
            DashboardSettingKeys.settingsShortcutModifiers: shortcutModifiers,
            DashboardSettingKeys.showDashboardAtLaunch: false,
            DashboardSettingKeys.clickThroughEmptyAreas: true,
            DashboardSettingKeys.keepOnAllSpaces: true,
            DashboardSettingKeys.floatingOverlay: true,
            DashboardSettingKeys.showMenuBarIcon: true,
            DashboardSettingKeys.hasSeenMenuBarHideInfo: false
        ])
    }
}

@MainActor
final class DashboardSettingsContext {
    private let launchAtLoginManager: LaunchAtLoginManager
    private let onShortcutsChanged: @MainActor () -> Void
    private let onWindowBehaviorChanged: @MainActor () -> Void
    private let onMenuBarIconChanged: @MainActor () -> Void
    private let onShowDashboard: @MainActor () -> Void
    private let onShowWidgetLauncher: @MainActor () -> Void
    private let onReloadDashboard: @MainActor () -> Void

    init(
        launchAtLoginManager: LaunchAtLoginManager,
        onShortcutsChanged: @escaping @MainActor () -> Void,
        onWindowBehaviorChanged: @escaping @MainActor () -> Void,
        onMenuBarIconChanged: @escaping @MainActor () -> Void,
        onShowDashboard: @escaping @MainActor () -> Void,
        onShowWidgetLauncher: @escaping @MainActor () -> Void,
        onReloadDashboard: @escaping @MainActor () -> Void
    ) {
        self.launchAtLoginManager = launchAtLoginManager
        self.onShortcutsChanged = onShortcutsChanged
        self.onWindowBehaviorChanged = onWindowBehaviorChanged
        self.onMenuBarIconChanged = onMenuBarIconChanged
        self.onShowDashboard = onShowDashboard
        self.onShowWidgetLauncher = onShowWidgetLauncher
        self.onReloadDashboard = onReloadDashboard
    }

    var canConfigureLaunchAtLogin: Bool {
        launchAtLoginManager.canConfigure
    }

    func launchAtLoginEnabled() -> Bool {
        launchAtLoginManager.isEnabled
    }

    func setLaunchAtLoginEnabled(_ isEnabled: Bool) throws -> LaunchAtLoginManager.ChangeResult {
        try launchAtLoginManager.setEnabled(isEnabled)
    }

    func shortcutsChanged() {
        onShortcutsChanged()
    }

    func windowBehaviorChanged() {
        onWindowBehaviorChanged()
    }

    func menuBarIconChanged() {
        onMenuBarIconChanged()
    }

    func showDashboard() {
        onShowDashboard()
    }

    func showWidgetLauncher() {
        onShowWidgetLauncher()
    }

    func reloadDashboard() {
        onReloadDashboard()
    }
}

struct DashboardGeneralSettingsView: View {
    @AppStorage(DashboardSettingKeys.showDashboardAtLaunch) private var showDashboardAtLaunch = false
    @AppStorage(DashboardSettingKeys.clickThroughEmptyAreas) private var clickThroughEmptyAreas = true
    @AppStorage(DashboardSettingKeys.keepOnAllSpaces) private var keepOnAllSpaces = true
    @AppStorage(DashboardSettingKeys.floatingOverlay) private var floatingOverlay = true
    @AppStorage(DashboardSettingKeys.showMenuBarIcon) private var showMenuBarIcon = true
    @AppStorage(DashboardSettingKeys.hasSeenMenuBarHideInfo) private var hasSeenMenuBarHideInfo = false
    @State private var launchAtLoginEnabled = false
    @State private var launchAtLoginAlertMessage: String?
    @State private var showHideIconInfoAlert = false

    let context: DashboardSettingsContext

    var body: some View {
        Form {
            Section("Startup") {
                Toggle("Launch at login", isOn: launchAtLoginBinding)
                    .disabled(!context.canConfigureLaunchAtLogin)

                Text("If macOS asks for approval, enable Classroom Widgets Dashboard in System Settings > General > Login Items.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)

                Toggle("Show dashboard at launch", isOn: $showDashboardAtLaunch)
            }

            Section("Menu Bar") {
                Toggle("Show menu bar icon", isOn: $showMenuBarIcon)
                    .onChange(of: showMenuBarIcon) { newValue in
                        context.menuBarIconChanged()

                        if !newValue && !hasSeenMenuBarHideInfo {
                            showHideIconInfoAlert = true
                            hasSeenMenuBarHideInfo = true
                        }
                    }

                Text("If the icon is hidden, use the Settings shortcut or relaunch the app to reopen Settings.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Section("Actions") {
                HStack {
                    Button("Show Dashboard", systemImage: "rectangle.inset.filled") {
                        context.showDashboard()
                    }

                    Button("Open Widget Launcher", systemImage: "square.grid.2x2") {
                        context.showWidgetLauncher()
                    }

                    Button("Reload Dashboard", systemImage: "arrow.clockwise") {
                        context.reloadDashboard()
                    }
                }

                Text("Keep the native companion ready from the menu bar, then show the dashboard only when class needs it.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Section("Dashboard Layer") {
                Toggle("Show on all Spaces", isOn: $keepOnAllSpaces)

                Toggle("Float above other windows", isOn: $floatingOverlay)

                Toggle("Click through empty dashboard areas", isOn: $clickThroughEmptyAreas)
            }
        }
        .formStyle(.grouped)
        .task {
            syncLaunchAtLoginState()
        }
        // The Settings window is reused (orderOut, not closed), so .task runs
        // only once. Re-read the login-item state whenever the window comes
        // back to the front, in case it changed via the menu or System Settings.
        .onReceive(NotificationCenter.default.publisher(for: NSWindow.didBecomeKeyNotification)) { _ in
            syncLaunchAtLoginState()
        }
        .onChange(of: windowBehaviorSignature) { _ in context.windowBehaviorChanged() }
        .alert("Launch at login", isPresented: launchAtLoginAlertIsPresented) {
            Button("OK", role: .cancel) {
                launchAtLoginAlertMessage = nil
            }
        } message: {
            Text(launchAtLoginAlertMessage ?? "")
        }
        .alert("Menu bar icon hidden", isPresented: $showHideIconInfoAlert) {
            Button("Got it", role: .cancel) { }
        } message: {
            Text("Use the Settings shortcut or relaunch Classroom Widgets Dashboard to reopen Settings.")
        }
    }

    private func syncLaunchAtLoginState() {
        launchAtLoginEnabled = context.launchAtLoginEnabled()
    }

    private var launchAtLoginBinding: Binding<Bool> {
        Binding(
            get: { launchAtLoginEnabled },
            set: { newValue in
                let previousValue = launchAtLoginEnabled
                launchAtLoginEnabled = newValue

                do {
                    let result = try context.setLaunchAtLoginEnabled(newValue)
                    syncLaunchAtLoginState()

                    if result == .requiresApproval {
                        launchAtLoginAlertMessage = "macOS needs approval before Classroom Widgets Dashboard can launch at login. Enable it in System Settings > General > Login Items."
                    }
                } catch {
                    launchAtLoginEnabled = previousValue
                    launchAtLoginAlertMessage = error.localizedDescription
                }
            }
        )
    }

    private var launchAtLoginAlertIsPresented: Binding<Bool> {
        Binding(
            get: { launchAtLoginAlertMessage != nil },
            set: { isPresented in
                if !isPresented {
                    launchAtLoginAlertMessage = nil
                }
            }
        )
    }

    private var windowBehaviorSignature: String {
        [
            clickThroughEmptyAreas,
            keepOnAllSpaces,
            floatingOverlay
        ].map(String.init).joined(separator: ":")
    }
}

struct DashboardShortcutSettingsView: View {
    @AppStorage(DashboardSettingKeys.toggleShortcutKeyCode) private var toggleShortcutKeyCode = DashboardDefaults.toggleShortcutKeyCode
    @AppStorage(DashboardSettingKeys.toggleShortcutModifiers) private var toggleShortcutModifiers = DashboardDefaults.shortcutModifiers
    @AppStorage(DashboardSettingKeys.launcherShortcutKeyCode) private var launcherShortcutKeyCode = DashboardDefaults.launcherShortcutKeyCode
    @AppStorage(DashboardSettingKeys.launcherShortcutModifiers) private var launcherShortcutModifiers = DashboardDefaults.shortcutModifiers
    @AppStorage(DashboardSettingKeys.settingsShortcutKeyCode) private var settingsShortcutKeyCode = DashboardDefaults.settingsShortcutKeyCode
    @AppStorage(DashboardSettingKeys.settingsShortcutModifiers) private var settingsShortcutModifiers = DashboardDefaults.shortcutModifiers

    let context: DashboardSettingsContext

    var body: some View {
        Form {
            Section("Keyboard Shortcuts") {
                shortcutRow("Show or hide dashboard") {
                    KeyboardShortcutRecorder(
                        keyCode: $toggleShortcutKeyCode,
                        modifiers: $toggleShortcutModifiers,
                        placeholder: "None"
                    )
                }

                shortcutRow("Open widget launcher") {
                    KeyboardShortcutRecorder(
                        keyCode: $launcherShortcutKeyCode,
                        modifiers: $launcherShortcutModifiers,
                        placeholder: "None"
                    )
                }

                shortcutRow("Open Settings") {
                    KeyboardShortcutRecorder(
                        keyCode: $settingsShortcutKeyCode,
                        modifiers: $settingsShortcutModifiers,
                        placeholder: "None"
                    )
                }

                Text("These shortcuts work across macOS while Classroom Widgets Dashboard is running. Keep each action on a distinct shortcut.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)

                if let shortcutConflictMessage {
                    Label(shortcutConflictMessage, systemImage: "exclamationmark.triangle")
                        .font(.caption)
                        .foregroundStyle(.orange)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            Section {
                Button("Restore Default Shortcuts") {
                    toggleShortcutKeyCode = DashboardDefaults.toggleShortcutKeyCode
                    toggleShortcutModifiers = DashboardDefaults.shortcutModifiers
                    launcherShortcutKeyCode = DashboardDefaults.launcherShortcutKeyCode
                    launcherShortcutModifiers = DashboardDefaults.shortcutModifiers
                    settingsShortcutKeyCode = DashboardDefaults.settingsShortcutKeyCode
                    settingsShortcutModifiers = DashboardDefaults.shortcutModifiers
                }
            }
        }
        .formStyle(.grouped)
        .onChange(of: shortcutsSignature) { _ in context.shortcutsChanged() }
    }

    @ViewBuilder
    private func shortcutRow<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        LabeledContent {
            content()
                .frame(width: 210, alignment: .trailing)
        } label: {
            Text(title)
        }
    }

    private var shortcutConflictMessage: String? {
        let shortcuts: [(label: String, keyCode: Int, modifiers: Int)] = [
            ("Show or hide dashboard", toggleShortcutKeyCode, toggleShortcutModifiers),
            ("Open widget launcher", launcherShortcutKeyCode, launcherShortcutModifiers),
            ("Open Settings", settingsShortcutKeyCode, settingsShortcutModifiers)
        ]

        for index in shortcuts.indices {
            let current = shortcuts[index]
            guard current.keyCode != -1 else { continue }
            guard index + 1 < shortcuts.count else { continue }

            for comparisonIndex in (index + 1)..<shortcuts.count {
                let comparison = shortcuts[comparisonIndex]
                guard comparison.keyCode != -1 else { continue }

                if current.keyCode == comparison.keyCode && current.modifiers == comparison.modifiers {
                    return "\(current.label) and \(comparison.label) should not share the same shortcut."
                }
            }
        }

        return nil
    }

    private var shortcutsSignature: String {
        [
            toggleShortcutKeyCode,
            toggleShortcutModifiers,
            launcherShortcutKeyCode,
            launcherShortcutModifiers,
            settingsShortcutKeyCode,
            settingsShortcutModifiers
        ].map(String.init).joined(separator: ":")
    }
}

struct DashboardSettingsView: View {
    let context: DashboardSettingsContext

    var body: some View {
        TabView {
            DashboardGeneralSettingsView(context: context)
                .tabItem { Text("General") }

            DashboardShortcutSettingsView(context: context)
                .tabItem { Text("Shortcuts") }
        }
        .dashboardTabBarStyle()
        .frame(width: 600, height: 640)
        .navigationTitle("Classroom Widgets Settings")
    }
}

private extension View {
    // .tabBarOnly is macOS 15+, but the app deploys to 13; the default tab
    // style renders as a top tab bar on older systems anyway.
    @ViewBuilder
    func dashboardTabBarStyle() -> some View {
        if #available(macOS 15.0, *) {
            tabViewStyle(.tabBarOnly)
        } else {
            self
        }
    }
}

@MainActor
final class SettingsWindowCoordinator: NSObject, NSWindowDelegate {
    private static let windowSize = NSSize(width: 600, height: 640)

    private let makeContentView: @MainActor () -> NSView
    private(set) var window: NSWindow?

    init(makeContentView: @escaping @MainActor () -> NSView) {
        self.makeContentView = makeContentView
        super.init()
    }

    func show() {
        if let window {
            window.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
            return
        }

        let window = NSWindow(
            contentRect: NSRect(origin: .zero, size: Self.windowSize),
            styleMask: [.titled, .closable],
            backing: .buffered,
            defer: false
        )
        window.title = "Classroom Widgets Settings"
        window.isReleasedWhenClosed = false
        window.delegate = self
        window.contentView = makeContentView()
        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        self.window = window
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        guard sender === window else {
            return true
        }

        sender.orderOut(nil)
        return false
    }
}
