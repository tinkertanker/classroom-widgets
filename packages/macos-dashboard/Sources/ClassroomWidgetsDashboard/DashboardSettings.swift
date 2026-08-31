import AppKit
import Carbon
import Combine
import SwiftUI

enum DashboardSettingKeys {
    static let settingsShortcutKeyCode = "dashboardSettingsShortcutKeyCode"
    static let settingsShortcutModifiers = "dashboardSettingsShortcutModifiers"
    static let keepOnAllSpaces = "keepOnAllSpaces"
    static let compactBackgroundOpacity = "compactBackgroundOpacity"
}

enum DashboardDefaults {
    static let settingsShortcutKeyCode = Int(kVK_ANSI_Comma)
    static let shortcutModifiers = Int(NSEvent.ModifierFlags([.command, .option]).rawValue)

    static func register() {
        UserDefaults.standard.register(defaults: [
            DashboardSettingKeys.settingsShortcutKeyCode: settingsShortcutKeyCode,
            DashboardSettingKeys.settingsShortcutModifiers: shortcutModifiers,
            DashboardSettingKeys.keepOnAllSpaces: true,
            DashboardSettingKeys.compactBackgroundOpacity: 1.0
        ])
    }
}

@MainActor
final class DashboardSettingsContext {
    private let launchAtLoginManager: LaunchAtLoginManager
    private let onShortcutChanged: @MainActor () -> Void
    private let onWidgetSettingsChanged: @MainActor () -> Void

    init(
        launchAtLoginManager: LaunchAtLoginManager,
        onShortcutChanged: @escaping @MainActor () -> Void,
        onWidgetSettingsChanged: @escaping @MainActor () -> Void
    ) {
        self.launchAtLoginManager = launchAtLoginManager
        self.onShortcutChanged = onShortcutChanged
        self.onWidgetSettingsChanged = onWidgetSettingsChanged
    }

    var canConfigureLaunchAtLogin: Bool { launchAtLoginManager.canConfigure }
    func launchAtLoginEnabled() -> Bool { launchAtLoginManager.isEnabled }
    func setLaunchAtLoginEnabled(_ enabled: Bool) throws -> LaunchAtLoginManager.ChangeResult {
        try launchAtLoginManager.setEnabled(enabled)
    }
    func shortcutChanged() { onShortcutChanged() }
    func widgetSettingsChanged() { onWidgetSettingsChanged() }
}

struct DashboardGeneralSettingsView: View {
    @AppStorage(DashboardSettingKeys.keepOnAllSpaces) private var keepOnAllSpaces = true
    @AppStorage(DashboardSettingKeys.compactBackgroundOpacity) private var compactBackgroundOpacity = 1.0
    @State private var launchAtLoginEnabled = false
    @State private var launchAtLoginAlertMessage: String?
    let context: DashboardSettingsContext

    var body: some View {
        Form {
            Section("Startup") {
                Toggle("Launch at login", isOn: launchAtLoginBinding)
                    .disabled(!context.canConfigureLaunchAtLogin)
                Text("If macOS asks for approval, enable Classroom Widgets in System Settings > General > Login Items.")
                    .font(.caption).foregroundStyle(.secondary)
            }

            Section("Floating Widgets") {
                Toggle("Show on all Spaces", isOn: $keepOnAllSpaces)
                HStack {
                    Text("Background opacity")
                    Slider(value: $compactBackgroundOpacity, in: 0...1, step: 0.05)
                    Text("\(Int((compactBackgroundOpacity * 100).rounded()))%")
                        .monospacedDigit().frame(width: 38, alignment: .trailing)
                }
            }
        }
        .formStyle(.grouped)
        .task { syncLaunchAtLoginState() }
        .onReceive(NotificationCenter.default.publisher(for: NSWindow.didBecomeKeyNotification)) { _ in
            syncLaunchAtLoginState()
        }
        .onChange(of: widgetSettingsSignature) { _ in context.widgetSettingsChanged() }
        .alert("Launch at login", isPresented: launchAtLoginAlertIsPresented) {
            Button("OK", role: .cancel) { launchAtLoginAlertMessage = nil }
        } message: { Text(launchAtLoginAlertMessage ?? "") }
    }

    private func syncLaunchAtLoginState() { launchAtLoginEnabled = context.launchAtLoginEnabled() }

    private var launchAtLoginBinding: Binding<Bool> {
        Binding(get: { launchAtLoginEnabled }, set: { newValue in
            let previous = launchAtLoginEnabled
            launchAtLoginEnabled = newValue
            do {
                let result = try context.setLaunchAtLoginEnabled(newValue)
                syncLaunchAtLoginState()
                if result == .requiresApproval {
                    launchAtLoginAlertMessage = "macOS needs approval before Classroom Widgets can launch at login. Enable it in System Settings > General > Login Items."
                }
            } catch {
                launchAtLoginEnabled = previous
                launchAtLoginAlertMessage = error.localizedDescription
            }
        })
    }

    private var launchAtLoginAlertIsPresented: Binding<Bool> {
        Binding(get: { launchAtLoginAlertMessage != nil }, set: { if !$0 { launchAtLoginAlertMessage = nil } })
    }
    private var widgetSettingsSignature: String { "\(keepOnAllSpaces):\(compactBackgroundOpacity)" }
}

struct DashboardShortcutSettingsView: View {
    @AppStorage(DashboardSettingKeys.settingsShortcutKeyCode) private var keyCode = DashboardDefaults.settingsShortcutKeyCode
    @AppStorage(DashboardSettingKeys.settingsShortcutModifiers) private var modifiers = DashboardDefaults.shortcutModifiers
    let context: DashboardSettingsContext

    var body: some View {
        Form {
            Section("Keyboard Shortcut") {
                LabeledContent("Open Settings") {
                    KeyboardShortcutRecorder(keyCode: $keyCode, modifiers: $modifiers, placeholder: "None")
                        .frame(width: 210, alignment: .trailing)
                }
                Text("This shortcut works across macOS while Classroom Widgets is running.")
                    .font(.caption).foregroundStyle(.secondary)
            }
            Section {
                Button("Restore Default Shortcut") {
                    keyCode = DashboardDefaults.settingsShortcutKeyCode
                    modifiers = DashboardDefaults.shortcutModifiers
                }
            }
        }
        .formStyle(.grouped)
        .onChange(of: shortcutSignature) { _ in context.shortcutChanged() }
    }

    private var shortcutSignature: String { "\(keyCode):\(modifiers)" }
}

struct DashboardSettingsView: View {
    let context: DashboardSettingsContext
    var body: some View {
        TabView {
            DashboardGeneralSettingsView(context: context).tabItem { Text("General") }
            DashboardShortcutSettingsView(context: context).tabItem { Text("Shortcuts") }
        }
        .dashboardTabBarStyle()
        .frame(width: 600, height: 640)
        .navigationTitle("Classroom Widgets Settings")
    }
}

private extension View {
    @ViewBuilder func dashboardTabBarStyle() -> some View {
        if #available(macOS 15.0, *) { tabViewStyle(.tabBarOnly) } else { self }
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
        let window = NSWindow(contentRect: NSRect(origin: .zero, size: Self.windowSize), styleMask: [.titled, .closable], backing: .buffered, defer: false)
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
        guard sender === window else { return true }
        sender.orderOut(nil)
        return false
    }
}
