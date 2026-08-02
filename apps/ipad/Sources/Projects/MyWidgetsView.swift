import SwiftUI

struct MyWidgetsView: View {
    let store: StudioStore
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack {
                    PageHeader(
                        title: "Your widgets",
                        subtitle: "HTML sources are cached on this iPad for offline preview."
                    )
                    Spacer()
                    Button("Find missing widgets") {
                        Task {
                            do { _ = try await store.restoreFromStudio() }
                            catch { self.error = error.localizedDescription }
                        }
                    }
                    Button("Make a widget") { store.selectedSection = .make }
                        .buttonStyle(.borderedProminent)
                }

                if store.projects.isEmpty {
                    ContentUnavailableView(
                        "Your widgets will appear here",
                        systemImage: "square.stack.3d.up"
                    )
                } else {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 280))], spacing: 18) {
                        ForEach(store.projects.sorted { $0.updatedAt > $1.updatedAt }) { project in
                            WidgetProjectCard(
                                project: project,
                                onPrimary: { store.open(project) },
                                onDelete: {
                                    Task {
                                        do { try await store.deleteProject(projectID: project.id) }
                                        catch { self.error = error.localizedDescription }
                                    }
                                }
                            )
                        }
                    }
                }
            }
            .padding(32)
        }
        .alert(
            "Studio could not complete this action",
            isPresented: Binding(
                get: { error != nil },
                set: { if !$0 { error = nil } }
            )
        ) {
            Button("OK") {}
        } message: {
            Text(error ?? "")
        }
    }
}
