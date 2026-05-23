import AppKit
import Carbon
import SwiftUI

enum DashboardSettingKeys {
    static let toggleShortcutKeyCode = "dashboardToggleShortcutKeyCode"
    static let toggleShortcutModifiers = "dashboardToggleShortcutModifiers"
    static let launcherShortcutKeyCode = "dashboardLauncherShortcutKeyCode"
    static let launcherShortcutModifiers = "dashboardLauncherShortcutModifiers"
    static let showDashboardAtLaunch = "showDashboardAtLaunch"
    static let clickThroughEmptyAreas = "clickThroughEmptyAreas"
    static let keepOnAllSpaces = "keepOnAllSpaces"
    static let floatingOverlay = "floatingOverlay"
}

enum DashboardDefaults {
    static let toggleShortcutKeyCode = Int(kVK_Space)
    static let launcherShortcutKeyCode = Int(kVK_ANSI_K)
    static let shortcutModifiers = Int(NSEvent.ModifierFlags([.command, .option]).rawValue)

    static func register() {
        UserDefaults.standard.register(defaults: [
            DashboardSettingKeys.toggleShortcutKeyCode: toggleShortcutKeyCode,
            DashboardSettingKeys.toggleShortcutModifiers: shortcutModifiers,
            DashboardSettingKeys.launcherShortcutKeyCode: launcherShortcutKeyCode,
            DashboardSettingKeys.launcherShortcutModifiers: shortcutModifiers,
            DashboardSettingKeys.showDashboardAtLaunch: true,
            DashboardSettingKeys.clickThroughEmptyAreas: true,
            DashboardSettingKeys.keepOnAllSpaces: true,
            DashboardSettingKeys.floatingOverlay: true
        ])
    }
}

@MainActor
final class DashboardSettingsContext {
    private let onShortcutsChanged: @MainActor () -> Void
    private let onWindowBehaviorChanged: @MainActor () -> Void
    private let onShowDashboard: @MainActor () -> Void
    private let onShowWidgetLauncher: @MainActor () -> Void

    init(
        onShortcutsChanged: @escaping @MainActor () -> Void,
        onWindowBehaviorChanged: @escaping @MainActor () -> Void,
        onShowDashboard: @escaping @MainActor () -> Void,
        onShowWidgetLauncher: @escaping @MainActor () -> Void
    ) {
        self.onShortcutsChanged = onShortcutsChanged
        self.onWindowBehaviorChanged = onWindowBehaviorChanged
        self.onShowDashboard = onShowDashboard
        self.onShowWidgetLauncher = onShowWidgetLauncher
    }

    func shortcutsChanged() {
        onShortcutsChanged()
    }

    func windowBehaviorChanged() {
        onWindowBehaviorChanged()
    }

    func showDashboard() {
        onShowDashboard()
    }

    func showWidgetLauncher() {
        onShowWidgetLauncher()
    }
}

struct DashboardSettingsView: View {
    @AppStorage(DashboardSettingKeys.toggleShortcutKeyCode) private var toggleShortcutKeyCode = DashboardDefaults.toggleShortcutKeyCode
    @AppStorage(DashboardSettingKeys.toggleShortcutModifiers) private var toggleShortcutModifiers = DashboardDefaults.shortcutModifiers
    @AppStorage(DashboardSettingKeys.launcherShortcutKeyCode) private var launcherShortcutKeyCode = DashboardDefaults.launcherShortcutKeyCode
    @AppStorage(DashboardSettingKeys.launcherShortcutModifiers) private var launcherShortcutModifiers = DashboardDefaults.shortcutModifiers
    @AppStorage(DashboardSettingKeys.showDashboardAtLaunch) private var showDashboardAtLaunch = true
    @AppStorage(DashboardSettingKeys.clickThroughEmptyAreas) private var clickThroughEmptyAreas = true
    @AppStorage(DashboardSettingKeys.keepOnAllSpaces) private var keepOnAllSpaces = true
    @AppStorage(DashboardSettingKeys.floatingOverlay) private var floatingOverlay = true

    let context: DashboardSettingsContext

    var body: some View {
        TabView {
            Form {
                Section("Launch") {
                    Toggle("Show dashboard at launch", isOn: $showDashboardAtLaunch)

                    HStack {
                        Button("Show Dashboard") {
                            context.showDashboard()
                        }

                        Button("Open Widget Launcher") {
                            context.showWidgetLauncher()
                        }
                    }
                }

                Section("Overlay") {
                    Toggle("Click through empty dashboard areas", isOn: $clickThroughEmptyAreas)
                        .onChange(of: clickThroughEmptyAreas) { _ in context.windowBehaviorChanged() }

                    Toggle("Show on all Spaces", isOn: $keepOnAllSpaces)
                        .onChange(of: keepOnAllSpaces) { _ in context.windowBehaviorChanged() }

                    Toggle("Float above other windows", isOn: $floatingOverlay)
                        .onChange(of: floatingOverlay) { _ in context.windowBehaviorChanged() }
                }
            }
            .formStyle(.grouped)
            .tabItem {
                Label("General", systemImage: "switch.2")
            }

            Form {
                Section("Keyboard Shortcuts") {
                    LabeledContent("Show or hide dashboard") {
                        KeyboardShortcutRecorder(
                            keyCode: $toggleShortcutKeyCode,
                            modifiers: $toggleShortcutModifiers,
                            placeholder: "None"
                        )
                        .onChange(of: toggleShortcutKeyCode) { _ in context.shortcutsChanged() }
                        .onChange(of: toggleShortcutModifiers) { _ in context.shortcutsChanged() }
                    }

                    LabeledContent("Open widget launcher") {
                        KeyboardShortcutRecorder(
                            keyCode: $launcherShortcutKeyCode,
                            modifiers: $launcherShortcutModifiers,
                            placeholder: "None"
                        )
                        .onChange(of: launcherShortcutKeyCode) { _ in context.shortcutsChanged() }
                        .onChange(of: launcherShortcutModifiers) { _ in context.shortcutsChanged() }
                    }

                    if shortcutsConflict {
                        Label("Both actions use the same shortcut. The dashboard toggle will take precedence.", systemImage: "exclamationmark.triangle")
                            .foregroundStyle(.orange)
                            .font(.caption)
                    }
                }

                Section {
                    Button("Restore Default Shortcuts") {
                        toggleShortcutKeyCode = DashboardDefaults.toggleShortcutKeyCode
                        toggleShortcutModifiers = DashboardDefaults.shortcutModifiers
                        launcherShortcutKeyCode = DashboardDefaults.launcherShortcutKeyCode
                        launcherShortcutModifiers = DashboardDefaults.shortcutModifiers
                        context.shortcutsChanged()
                    }
                }
            }
            .formStyle(.grouped)
            .tabItem {
                Label("Shortcuts", systemImage: "keyboard")
            }
        }
        .frame(width: 520, height: 330)
        .padding(20)
    }

    private var shortcutsConflict: Bool {
        toggleShortcutKeyCode != -1 &&
            toggleShortcutKeyCode == launcherShortcutKeyCode &&
            toggleShortcutModifiers == launcherShortcutModifiers
    }
}

@MainActor
final class SettingsWindowCoordinator: NSObject, NSWindowDelegate {
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
            contentRect: NSRect(x: 0, y: 0, width: 560, height: 380),
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
        sender.orderOut(nil)
        return false
    }
}
