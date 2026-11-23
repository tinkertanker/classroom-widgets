import SwiftUI
import UIKit
import UserNotifications

@main
struct ClassroomWidgetsApp: App {
    @UIApplicationDelegateAdaptor(TimerNotificationDelegate.self) private var appDelegate

    var body: some Scene {
        WindowGroup {
            TimerScreen()
        }
    }
}

final class TimerNotificationDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([])
    }
}
