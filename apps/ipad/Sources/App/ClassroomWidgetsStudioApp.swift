import SwiftUI

@main
struct ClassroomWidgetsStudioApp: App {
    @State private var store = StudioStore()

    var body: some Scene {
        WindowGroup {
            StudioRootView(store: store)
                .tint(StudioTheme.sage)
        }
    }
}
