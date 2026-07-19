import SwiftUI

struct MyWidgetsView: View {
    let store: StudioStore
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var projectToDelete: WidgetProject?
    @State private var isDeleting = false
    @State private var deletionError: String?
    @State private var restorationError: String?

    private var columns: [GridItem] {
        dynamicTypeSize.isAccessibilitySize
            ? [GridItem(.flexible())]
            : [GridItem(.adaptive(minimum: 280), spacing: 18)]
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                ViewThatFits(in: .horizontal) {
                    HStack(alignment: .bottom) {
                        pageHeader
                        Spacer()
                        headerActions
                    }
                    VStack(alignment: .leading, spacing: 14) {
                        pageHeader
                        headerActions
                    }
                }

                if let restorationError {
                    Label(restorationError, systemImage: "exclamationmark.icloud.fill")
                        .font(.callout)
                        .foregroundStyle(StudioTheme.terracotta)
                }

                if store.projects.isEmpty {
                    ContentUnavailableView {
                        Label("No widgets yet", systemImage: "square.stack.3d.up")
                    } description: {
                        Text("Answer a few guided questions to make your first classroom widget.")
                    } actions: {
                        Button("Make a widget") { store.selectedSection = .make }
                            .buttonStyle(.borderedProminent)
                    }
                    .frame(maxWidth: .infinity, minHeight: 360)
                } else {
                    LazyVGrid(columns: columns, alignment: .leading, spacing: 18) {
                        ForEach(store.projects.sorted(by: { $0.updatedAt > $1.updatedAt })) { project in
                            WidgetProjectCard(
                                project: project,
                                primaryTitle: "Open",
                                onPrimary: { store.open(project) },
                                onDelete: { projectToDelete = project }
                            )
                        }
                    }
                }
            }
            .padding(32)
        }
        .accessibilityIdentifier("my-widgets-screen")
        .alert(
            "Couldn’t delete widget",
            isPresented: Binding(
                get: { deletionError != nil },
                set: { if !$0 { deletionError = nil } }
            )
        ) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(deletionError ?? "Try again.")
        }
        .confirmationDialog(
            "Delete \(projectToDelete?.spec.metadata.title ?? "this widget")?",
            isPresented: Binding(
                get: { projectToDelete != nil },
                set: { if !$0 && !isDeleting { projectToDelete = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Delete everywhere", role: .destructive) {
                deleteSelectedProject(localOnly: false)
            }
            .disabled(isDeleting)
            Button("Remove from this iPad only", role: .destructive) {
                deleteSelectedProject(localOnly: true)
            }
            .disabled(isDeleting)
            Button("Cancel", role: .cancel) {
                projectToDelete = nil
            }
        } message: {
            Text("Delete everywhere also disables the student link. If Studio cannot verify that deletion, you can explicitly remove only the local copy; its server draft or link may remain active.")
        }
    }

    private var pageHeader: some View {
        PageHeader(
            title: "Your widgets",
            subtitle: "Drafts stay on this iPad and are backed up when Studio saves a change."
        )
    }

    private var headerActions: some View {
        HStack {
            Button {
                restoreFromStudio()
            } label: {
                if store.isRestoringFromStudio {
                    HStack(spacing: 8) {
                        ProgressView().controlSize(.small)
                        Text("Restoring…")
                    }
                } else {
                    Label("Restore from Studio", systemImage: "icloud.and.arrow.down")
                }
            }
            .buttonStyle(.bordered)
            .disabled(store.isRestoringFromStudio)
            Button {
                store.selectedSection = .make
            } label: {
                Label("Make a widget", systemImage: "plus")
            }
            .buttonStyle(.borderedProminent)
        }
    }

    private func deleteSelectedProject(localOnly: Bool) {
        guard let project = projectToDelete else { return }
        isDeleting = true
        Task { @MainActor in
            defer {
                isDeleting = false
                projectToDelete = nil
            }
            do {
                if localOnly {
                    try store.deleteLocalProject(projectID: project.id)
                } else {
                    try await store.deleteProject(projectID: project.id)
                }
            } catch {
                store.handleStudioError(error)
                deletionError = error.localizedDescription
            }
        }
    }

    private func restoreFromStudio() {
        if store.workshopAccessState != .ready {
            store.requestWorkshopAccess()
            return
        }
        restorationError = nil
        Task { @MainActor in
            do {
                _ = try await store.restoreFromStudio()
            } catch {
                store.handleStudioError(error)
                restorationError = error.localizedDescription
            }
        }
    }
}
