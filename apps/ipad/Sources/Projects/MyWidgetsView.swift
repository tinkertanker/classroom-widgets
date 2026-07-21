import SwiftUI

struct MyWidgetsView: View {
    let store: StudioStore
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var projectToDelete: WidgetProject?
    @State private var isDeleting = false
    @State private var failedRemoteDeletionProject: WidgetProject?
    @State private var remoteDeletionError: StudioErrorPresentation?
    @State private var localDeletionError: StudioErrorPresentation?
    @State private var restorationError: StudioErrorPresentation?

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
                    VStack(alignment: .leading, spacing: 4) {
                        Text(restorationError.title)
                            .font(.callout.weight(.semibold))
                        Text(restorationError.message)
                            .font(.callout)
                    }
                        .foregroundStyle(StudioTheme.danger)
                }

                if store.projects.isEmpty {
                    VStack(spacing: 16) {
                        TKRobotStickerView(sticker: .happy, size: 136)
                        Text("Your widgets will appear here")
                            .font(StudioTheme.Typography.question)
                            .foregroundStyle(StudioTheme.ink)
                        Text("Make a widget from your lesson needs, or start with an example.")
                            .foregroundStyle(StudioTheme.mutedInk)
                            .multilineTextAlignment(.center)
                        HStack {
                            Button("Make a widget") { store.selectedSection = .make }
                                .buttonStyle(.borderedProminent)
                            Button("Browse examples") { store.selectedSection = .explore }
                                .buttonStyle(.bordered)
                        }
                    }
                    .frame(maxWidth: 420)
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
                            .disabled(store.isRestoringFromStudio)
                        }
                    }
                }
            }
            .padding(32)
        }
        .accessibilityIdentifier("my-widgets-screen")
        .alert(
            localDeletionError?.title ?? "Couldn’t remove this iPad copy",
            isPresented: Binding(
                get: { localDeletionError != nil },
                set: { if !$0 { localDeletionError = nil } }
            )
        ) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(localDeletionError?.message ?? "Try again.")
        }
        .alert(
            remoteDeletionError?.title ?? "Studio could not verify deletion everywhere",
            isPresented: Binding(
                get: { failedRemoteDeletionProject != nil },
                set: { if !$0 { failedRemoteDeletionProject = nil } }
            )
        ) {
            Button("Try again") {
                guard let project = failedRemoteDeletionProject else { return }
                failedRemoteDeletionProject = nil
                projectToDelete = project
                deleteSelectedProject()
            }
            Button("Remove from this iPad only", role: .destructive) {
                removeFailedProjectFromThisIPad()
            }
            Button("Keep widget", role: .cancel) {
                failedRemoteDeletionProject = nil
            }
        } message: {
            Text("\(remoteDeletionError?.message ?? "Studio could not verify deletion everywhere.") Removing it only from this iPad can leave the recovery copy and student link available. You will no longer be able to manage it here.")
        }
        .confirmationDialog(
            "Delete \(projectToDelete?.spec.metadata.title ?? "this widget")?",
            isPresented: Binding(
                get: { projectToDelete != nil },
                set: { if !$0 && !isDeleting { projectToDelete = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Delete widget", role: .destructive) {
                deleteSelectedProject()
            }
            .disabled(isDeleting)
            Button("Cancel", role: .cancel) {
                projectToDelete = nil
            }
        } message: {
            Text("This removes the Studio copy and disables the student link. If Studio cannot verify that, it will leave this widget on your iPad so you can try again.")
        }
    }

    private var pageHeader: some View {
        PageHeader(
            title: "Your widgets",
            subtitle: "Widgets stay on this iPad, with a recovery copy saved when Studio is connected."
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
                    Label("Find missing widgets", systemImage: "icloud.and.arrow.down")
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

    private func deleteSelectedProject() {
        guard let project = projectToDelete else { return }
        isDeleting = true
        Task { @MainActor in
            defer {
                isDeleting = false
                projectToDelete = nil
            }
            do {
                try await store.deleteProject(projectID: project.id)
            } catch {
                remoteDeletionError = store.present(error, during: .delete)
                failedRemoteDeletionProject = project
            }
        }
    }

    private func removeFailedProjectFromThisIPad() {
        guard let project = failedRemoteDeletionProject else { return }
        isDeleting = true
        failedRemoteDeletionProject = nil
        Task { @MainActor in
            defer { isDeleting = false }
            do {
                try store.deleteLocalProject(projectID: project.id)
            } catch {
                localDeletionError = store.present(error, during: .delete)
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
                restorationError = store.present(error, during: .restore)
            }
        }
    }
}
