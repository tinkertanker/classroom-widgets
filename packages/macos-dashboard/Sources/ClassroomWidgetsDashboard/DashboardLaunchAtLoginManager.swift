import Foundation
import ServiceManagement

enum DashboardLaunchAtLoginError: LocalizedError {
    case serviceUnavailable
    case registrationFailed(any Error)

    var errorDescription: String? {
        switch self {
        case .serviceUnavailable:
            return "Launch at login is not available in this build."
        case .registrationFailed(let error):
            return "Could not update launch at login: \(error.localizedDescription). Try moving Classroom Widgets Dashboard to Applications, then try again."
        }
    }
}

@MainActor
final class DashboardLaunchAtLoginManager {
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
            return true
        case .notRegistered, .notFound:
            return false
        @unknown default:
            return false
        }
    }

    var canConfigure: Bool {
        true
    }

    func setEnabled(_ isEnabled: Bool) throws -> ChangeResult {
        DashboardLog.app.info("Updating launch at login to \(isEnabled, privacy: .public)")

        if isEnabled {
            guard service.status != .enabled else {
                return .updated
            }

            do {
                try service.register()
            } catch {
                DashboardLog.app.error("Launch at login registration failed: \(error.localizedDescription, privacy: .public)")
                throw DashboardLaunchAtLoginError.registrationFailed(error)
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
            throw DashboardLaunchAtLoginError.serviceUnavailable
        }
    }
}
