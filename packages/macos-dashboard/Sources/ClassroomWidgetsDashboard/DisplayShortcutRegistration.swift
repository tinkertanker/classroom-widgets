/// Owns registration lifetimes independently of the teacher's widget inventory.
/// Register returns an RAII token (DashboardHotKey in production).
@MainActor
final class DisplayShortcutRegistration {
    typealias Register = (DashboardShortcut, @escaping @MainActor () -> Void) throws -> AnyObject
    private let register: Register
    private let perform: (WidgetShortcutAction?) -> Void
    private var registrations: [DashboardShortcut: AnyObject] = [:]
    private(set) var binding: WidgetShortcutBinding?

    init(register: @escaping Register, perform: @escaping (WidgetShortcutAction?) -> Void) {
        self.register = register
        self.perform = perform
    }

    func suspend() { registrations.removeAll() }

    func isActive(_ shortcut: DashboardShortcut) -> Bool {
        registrations[shortcut.normalized] != nil
    }

    /// Saved assignments are independent: an unavailable partner must not disable
    /// a working action during startup or recording resume. Never rewrite them.
    func restoreAccepted(_ accepted: WidgetShortcutBinding) {
        let accepted = WidgetShortcutBinding(show: accepted.show.normalized, dismiss: accepted.dismiss.normalized)
        var restored: [DashboardShortcut: AnyObject] = [:]
        var attempted = Set<DashboardShortcut>()
        for shortcut in [accepted.show, accepted.dismiss] where shortcut.isAssigned && attempted.insert(shortcut).inserted {
            restored[shortcut] = registrations[shortcut] ?? (try? register(shortcut) { [weak self] in
                self?.dispatch(shortcut)
            })
        }
        binding = accepted
        registrations = restored
    }

    /// Keep all previously working registrations until every replacement succeeds.
    /// Reusing tokens avoids trying to register an equal Show/Dismiss key twice.
    func replace(with proposed: WidgetShortcutBinding) -> Bool {
        let proposed = WidgetShortcutBinding(show: proposed.show.normalized, dismiss: proposed.dismiss.normalized)
        var replacements: [DashboardShortcut: AnyObject] = [:]
        do {
            for shortcut in [proposed.show, proposed.dismiss] where shortcut.isAssigned && replacements[shortcut] == nil {
                replacements[shortcut] = try registrations[shortcut] ?? register(shortcut) { [weak self] in
                    self?.dispatch(shortcut)
                }
            }
        } catch {
            return false
        }
        binding = proposed
        registrations = replacements
        return true
    }

    private func dispatch(_ shortcut: DashboardShortcut) {
        guard isActive(shortcut), let binding else { return }
        if binding.show == binding.dismiss { perform(nil) }
        else { perform(shortcut == binding.show ? .show : .dismiss) }
    }
}
