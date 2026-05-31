import ServiceManagement

enum LaunchAtLoginError: LocalizedError {
    case serviceUnavailable
    case registrationFailed(underlying: any Error)

    var errorDescription: String? {
        switch self {
        case .serviceUnavailable:
            "Launch at login is not available in this build."
        case .registrationFailed(let underlying):
            "Could not toggle launch at login: \(underlying.localizedDescription). Try moving Classroom Widgets Dashboard to /Applications, or restart your Mac."
        }
    }
}

@MainActor
final class LaunchAtLoginManager {
    enum ChangeResult {
        case updated
        case requiresApproval
    }

    private let service: SMAppService

    init(service: SMAppService = .mainApp) {
        self.service = service
    }

    var isEnabled: Bool {
        switch service.status {
        case .enabled, .requiresApproval:
            true
        case .notRegistered, .notFound:
            false
        @unknown default:
            false
        }
    }

    var canConfigure: Bool {
        true
    }

    func setEnabled(_ isEnabled: Bool) throws -> ChangeResult {
        if isEnabled {
            if service.status != .enabled {
                do {
                    try service.register()
                } catch {
                    throw LaunchAtLoginError.registrationFailed(underlying: error)
                }
            }

            return service.status == .requiresApproval ? .requiresApproval : .updated
        }

        switch service.status {
        case .enabled, .requiresApproval:
            try service.unregister()
            return .updated
        case .notRegistered, .notFound:
            return .updated
        @unknown default:
            throw LaunchAtLoginError.serviceUnavailable
        }
    }
}
