import AppKit
import Carbon
import Combine
import SwiftUI

enum DashboardShortenerSettings {
    static let providerKey = "linkShortenerProvider"
    static let apiKeyKey = "linkShortenerPublicApiKey"
    static let domainKey = "linkShortenerDomain"

    // This is a public client-side key, not a Short.io secret key. Keep the
    // native preferences authoritative; compact WebViews have ephemeral storage.
    static func script(defaults: UserDefaults = .standard) -> String {
        let provider = defaults.string(forKey: providerKey) ?? "tinyurl"
        let settings = [
            "provider": ["tinyurl", "spoo", "shortio"].contains(provider) ? provider : "tinyurl",
            "shortioApiKey": defaults.string(forKey: apiKeyKey) ?? "",
            "shortioDomain": defaults.string(forKey: domainKey) ?? ""
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: settings, options: [.sortedKeys]),
              let json = String(data: data, encoding: .utf8) else { return "" }
        return "window.classroomShortenerSettings = \(json); window.dispatchEvent(new Event('classroom-shortener-settings-changed'));"
    }
}

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
    @Published private(set) var widgetShortcuts: [Int: WidgetShortcutBinding] = [:]
    @Published private(set) var widgetShortcutStatuses: [ShortcutBindingState.Owner: String] = [:]
    @Published private(set) var shortcutStatus: String?
    private let launchAtLoginManager: LaunchAtLoginManager
    private let onShortcutChanged: @MainActor (DashboardShortcut) -> Void
    private let onWidgetSettingsChanged: @MainActor () -> Void
    private let onWidgetShortcutChanged: @MainActor (Int, WidgetShortcutAction, DashboardShortcut) -> Void
    private let onResetWidgetShortcuts: @MainActor () -> Void
    private let onShortcutRecordingChanged: @MainActor (Bool) -> Void

    init(
        launchAtLoginManager: LaunchAtLoginManager,
        onShortcutChanged: @escaping @MainActor (DashboardShortcut) -> Void,
        onWidgetSettingsChanged: @escaping @MainActor () -> Void,
        onWidgetShortcutChanged: @escaping @MainActor (Int, WidgetShortcutAction, DashboardShortcut) -> Void,
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
    func setWidgetShortcut(_ shortcut: DashboardShortcut, action: WidgetShortcutAction, for widgetType: Int) {
        onWidgetShortcutChanged(widgetType, action, shortcut)
    }
    func resetWidgetShortcuts() { onResetWidgetShortcuts() }
    func shortcutRecordingChanged(_ isRecording: Bool) { onShortcutRecordingChanged(isRecording) }
    func updateWidgetShortcuts(
        options: [CompactWidgetOption],
        shortcuts: [Int: WidgetShortcutBinding],
        widgetStatuses: [ShortcutBindingState.Owner: String],
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
                    Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 8) {
                        GridRow {
                            Text("Widget").foregroundStyle(.secondary)
                            Text("Show").foregroundStyle(.secondary)
                            Text("Dismiss").foregroundStyle(.secondary)
                        }
                        ForEach(context.widgetOptions, id: \.widgetType) { option in
                            GridRow {
                                Text(option.title).frame(maxWidth: .infinity, alignment: .leading)
                                widgetShortcutRecorder(option: option, action: .show)
                                widgetShortcutRecorder(option: option, action: .dismiss)
                            }
                            ForEach(statuses(for: option.widgetType), id: \.self) { status in
                                GridRow {
                                    Text("")
                                    Text(status).font(.caption).foregroundStyle(.red).gridCellColumns(2)
                                }
                            }
                        }
                    }
                }
                Text("When Show and Dismiss match, the shortcut toggles the widget. Make them different to let Show create additional widgets.")
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

    @ViewBuilder
    private func widgetShortcutRecorder(option: CompactWidgetOption, action: WidgetShortcutAction) -> some View {
        KeyboardShortcutRecorder(
            keyCode: widgetKeyCodeBinding(for: option.widgetType, action: action),
            modifiers: widgetModifiersBinding(for: option.widgetType, action: action),
            placeholder: "None",
            accessibilityLabel: "\(action == .show ? "Show" : "Dismiss") \(option.title) keyboard shortcut",
            onShortcutChanged: { keyCode, modifiers in
                context.setWidgetShortcut(DashboardShortcut(keyCode: keyCode, modifiers: modifiers), action: action, for: option.widgetType)
            },
            onRecordingChanged: context.shortcutRecordingChanged
        )
        .frame(width: 190)
    }

    private func statuses(for widgetType: Int) -> [String] {
        let show = context.widgetShortcutStatuses[.widget(widgetType)]
        let dismiss = context.widgetShortcutStatuses[.widgetDismiss(widgetType)]
        return show == dismiss ? [show].compactMap { $0 } : [show, dismiss].compactMap { $0 }
    }

    private func shortcut(for widgetType: Int, action: WidgetShortcutAction) -> DashboardShortcut? {
        guard let binding = context.widgetShortcuts[widgetType] else { return nil }
        return action == .show ? binding.show : binding.dismiss
    }

    private func widgetKeyCodeBinding(for widgetType: Int, action: WidgetShortcutAction) -> Binding<Int> {
        Binding(
            get: { shortcut(for: widgetType, action: action)?.keyCode ?? -1 },
            set: { context.setWidgetShortcut(DashboardShortcut(keyCode: $0, modifiers: shortcut(for: widgetType, action: action)?.modifiers ?? 0), action: action, for: widgetType) }
        )
    }

    private func widgetModifiersBinding(for widgetType: Int, action: WidgetShortcutAction) -> Binding<Int> {
        Binding(
            get: { shortcut(for: widgetType, action: action)?.modifiers ?? 0 },
            set: { context.setWidgetShortcut(DashboardShortcut(keyCode: shortcut(for: widgetType, action: action)?.keyCode ?? -1, modifiers: $0), action: action, for: widgetType) }
        )
    }
}

struct DashboardSettingsView: View {
    let context: DashboardSettingsContext
    var body: some View {
        TabView {
            DashboardGeneralSettingsView(context: context).tabItem { Text("General") }
            DashboardShortenerSettingsView(context: context).tabItem { Text("Link Shortener") }
            DashboardShortcutSettingsView(context: context).tabItem { Text("Shortcuts") }
        }
        .dashboardTabBarStyle()
        .frame(width: 760, height: 640)
        .navigationTitle("Classroom Widgets Settings")
    }
}

struct DashboardShortenerSettingsView: View {
    @AppStorage(DashboardShortenerSettings.providerKey) private var provider = "tinyurl"
    @AppStorage(DashboardShortenerSettings.apiKeyKey) private var apiKey = ""
    @AppStorage(DashboardShortenerSettings.domainKey) private var domain = ""
    let context: DashboardSettingsContext

    var body: some View {
        Form {
            Section("Shortening service") {
                Picker("Provider", selection: $provider) {
                    Text("TinyURL — no sign-up").tag("tinyurl")
                    Text("spoo.me — no sign-up").tag("spoo")
                    Text("Short.io — your branded domain").tag("shortio")
                }
                if provider == "shortio" {
                    SecureField("Public API key (pk_…)", text: $apiKey)
                    TextField("Domain (e.g. go.myschool.edu)", text: $domain)
                    Text("Use a public key, never a secret API key. These settings are saved on this Mac and shared by all Link Shortener and QR Code widgets.")
                        .font(.caption).foregroundStyle(.secondary)
                }
                Text("If your school blocks a shortening domain, try another service. Creating a short link sends its destination to the selected provider.")
                    .font(.caption).foregroundStyle(.secondary)
            }
        }
        .formStyle(.grouped)
        .onChange(of: provider) { _ in context.widgetSettingsChanged() }
        .onChange(of: apiKey) { _ in context.widgetSettingsChanged() }
        .onChange(of: domain) { _ in context.widgetSettingsChanged() }
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
