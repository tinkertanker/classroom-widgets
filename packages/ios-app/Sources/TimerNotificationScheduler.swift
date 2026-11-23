import Foundation
import UserNotifications

@MainActor
final class TimerNotificationScheduler {
    private let identifier = "classroom-timer-finished"
    private var generation = 0

    func schedule(deadline: TimeInterval, muted: Bool) {
        guard !ProcessInfo.processInfo.arguments.contains("--ui-testing") else { return }
        guard deadline.isFinite else { return }

        generation &+= 1
        let requestGeneration = generation
        let center = UNUserNotificationCenter.current()

        Task { [weak self] in
            guard let self else { return }
            let settings = await center.notificationSettings()
            if settings.authorizationStatus == .notDetermined {
                guard (try? await center.requestAuthorization(options: [.alert, .sound])) == true else { return }
            } else {
                switch settings.authorizationStatus {
                case .authorized, .provisional, .ephemeral:
                    break
                default:
                    return
                }
            }

            guard self.generation == requestGeneration else { return }
            center.removePendingNotificationRequests(withIdentifiers: [self.identifier])

            guard let interval = notificationDelay(until: deadline, now: Date().timeIntervalSince1970) else { return }
            let content = UNMutableNotificationContent()
            content.title = "Time’s up!"
            content.body = "Your timer has finished."
            if !muted {
                content.sound = .default
            }
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: interval, repeats: false)
            let request = UNNotificationRequest(identifier: self.identifier, content: content, trigger: trigger)
            try? await center.add(request)
        }
    }

    func cancel() {
        generation &+= 1
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [identifier])
    }
}
