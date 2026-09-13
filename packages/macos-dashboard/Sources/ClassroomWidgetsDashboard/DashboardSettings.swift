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
final class DashboardSettingsContext: ObservableObject {
    @Published private(set) var widgetOptions: [CompactWidgetOption] = []
    @Published private(set) var widgetShortcuts: [Int: DashboardShortcut] = [:]
    @Published private(set) var widgetShortcutStatuses: [Int: String] = [:]
    @Published private(set) var shortcutStatus: String?
    private let launchAtLoginManager: LaunchAtLoginManager
    private let onShortcutChanged: @MainActor (DashboardShortcut) -> Void
    private let onWidgetSettingsChanged: @MainActor () -> Void
    private let onWidgetShortcutChanged: @MainActor (Int, DashboardShortcut) -> Void
    private let onResetWidgetShortcuts: @MainActor () -> Void
    private let onShortcutRecordingChanged: @MainActor (Bool) -> Void

    init(
        launchAtLoginManager: LaunchAtLoginManager,
        onShortcutChanged: @escaping @MainActor (DashboardShortcut) -> Void,
        onWidgetSettingsChanged: @escaping @MainActor () -> Void,
        onWidgetShortcutChanged: @escaping @MainActor (Int, DashboardShortcut) -> Void,
        onResetWidgetShortcuts: @escaping @MainActor () -> Void,
        onShortcutRecordingChanged: @escaping @MainActor (Bool) -> Void
    ) {
        self.launchAtLoginManager = launchAtLoginManager
        self.onShortcutChanged = onShortcutChanged
        self.onWidgetSettingsChanged = onWidgetSettingsChanged
        self.onWidgetShortcutChanged = onWidgetShortcutChanged
        self.onResetWidgetShortcuts = onResetWidgetShortcuts
        self.onShortcutRecordingChanged = onShortcutRecordingChanged
    }

    var canConfigureLaunchAtLogin: Bool { launchAtLoginManager.canConfigure }
    func launchAtLoginEnabled() -> Bool { launchAtLoginManager.isEnabled }
    func setLaunchAtLoginEnabled(_ enabled: Bool) throws -> LaunchAtLoginManager.ChangeResult {
        try launchAtLoginManager.setEnabled(enabled)
    }
    func setSettingsShortcut(_ shortcut: DashboardShortcut) { onShortcutChanged(shortcut) }
    func widgetSettingsChanged() { onWidgetSettingsChanged() }
    func setWidgetShortcut(_ shortcut: DashboardShortcut, for widgetType: Int) {
        onWidgetShortcutChanged(widgetType, shortcut)
    }
    func resetWidgetShortcuts() { onResetWidgetShortcuts() }
    func shortcutRecordingChanged(_ isRecording: Bool) { onShortcutRecordingChanged(isRecording) }
    func updateWidgetShortcuts(
        options: [CompactWidgetOption],
        shortcuts: [Int: DashboardShortcut],
        widgetStatuses: [Int: String],
        status: String?
    ) {
        widgetOptions = options
        widgetShortcuts = shortcuts
        widgetShortcutStatuses = widgetStatuses
        shortcutStatus = status
    }
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
    @ObservedObject var context: DashboardSettingsContext

    var body: some View {
        Form {
            Section("Keyboard Shortcut") {
                LabeledContent("Open Settings") {
                    KeyboardShortcutRecorder(
                        keyCode: $keyCode,
                        modifiers: $modifiers,
                        placeholder: "None",
                        accessibilityLabel: "Open Settings keyboard shortcut",
                        onShortcutChanged: { keyCode, modifiers in
                            context.setSettingsShortcut(DashboardShortcut(keyCode: keyCode, modifiers: modifiers))
                        },
                        onRecordingChanged: context.shortcutRecordingChanged
                    )
                    .frame(width: 210, alignment: .trailing)
                }
                Text("This shortcut works across macOS while Classroom Widgets is running.")
                    .font(.caption).foregroundStyle(.secondary)
            }
            Section("Launch Widgets") {
                if context.widgetOptions.isEmpty {
                    Text("Widget shortcuts will appear when the widget inventory is available.")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(context.widgetOptions, id: \.widgetType) { option in
                        VStack(alignment: .leading, spacing: 3) {
                            LabeledContent(option.title) {
                                KeyboardShortcutRecorder(
                                    keyCode: widgetKeyCodeBinding(for: option.widgetType),
                                    modifiers: widgetModifiersBinding(for: option.widgetType),
                                    placeholder: "None",
                                    accessibilityLabel: "\(option.title) keyboard shortcut",
                                    onShortcutChanged: { keyCode, modifiers in
                                        context.setWidgetShortcut(DashboardShortcut(keyCode: keyCode, modifiers: modifiers), for: option.widgetType)
                                    },
                                    onRecordingChanged: context.shortcutRecordingChanged
                                )
                                .frame(width: 210, alignment: .trailing)
                            }
                            if let status = context.widgetShortcutStatuses[option.widgetType] {
                                Text(status).font(.caption).foregroundStyle(.red)
                            }
                        }
                    }
                }
                Text("These shortcuts work across macOS while Classroom Widgets is running.")
                    .font(.caption).foregroundStyle(.secondary)
                if let status = context.shortcutStatus {
                    Text(status).font(.caption).foregroundStyle(.red)
                }
            }
            Section {
                Button("Restore Default Shortcut") {
                    context.setSettingsShortcut(DashboardShortcut(
                        keyCode: DashboardDefaults.settingsShortcutKeyCode,
                        modifiers: DashboardDefaults.shortcutModifiers
                    ))
                }
                Button("Reset Widget Shortcuts") { context.resetWidgetShortcuts() }
                    .disabled(context.widgetOptions.isEmpty)
            }
        }
        .formStyle(.grouped)
    }

    private func widgetKeyCodeBinding(for widgetType: Int) -> Binding<Int> {
        Binding(
            get: { context.widgetShortcuts[widgetType]?.keyCode ?? -1 },
            set: { context.setWidgetShortcut(DashboardShortcut(keyCode: $0, modifiers: context.widgetShortcuts[widgetType]?.modifiers ?? 0), for: widgetType) }
        )
    }

    private func widgetModifiersBinding(for widgetType: Int) -> Binding<Int> {
        Binding(
            get: { context.widgetShortcuts[widgetType]?.modifiers ?? 0 },
            set: { context.setWidgetShortcut(DashboardShortcut(keyCode: context.widgetShortcuts[widgetType]?.keyCode ?? -1, modifiers: $0), for: widgetType) }
        )
    }
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
