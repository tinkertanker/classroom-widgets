import SwiftUI

struct StudioRootView: View {
    @Bindable var store: StudioStore

    var body: some View {
        NavigationSplitView {
            List {
                Section {
                    ForEach(StudioSection.allCases) { section in
                        Button {
                            store.selectedSection = section
                            store.closeEditor()
                        } label: {
                            Label(section.title, systemImage: section.symbolName)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .contentShape(Rectangle())
                        }
                            .buttonStyle(.plain)
                            .foregroundStyle(store.selectedSection == section ? StudioTheme.sage : StudioTheme.ink)
                            .listRowBackground(store.selectedSection == section ? StudioTheme.sageSoft : Color.clear)
                            .accessibilityIdentifier("sidebar-\(section.rawValue)")
                    }
                }

                Section("Designed for class") {
                    Label("No student accounts", systemImage: "person.crop.circle.badge.xmark")
                    Label("No response collection", systemImage: "tray.and.arrow.down.fill")
                    Label("One focused widget", systemImage: "link")
                }
                .font(.caption)
                .foregroundStyle(StudioTheme.mutedInk)

                Section {
                    Button {
                        store.requestWorkshopAccess()
                    } label: {
                        Label(
                            store.workshopAccessState == .ready ? "Workshop access active" : "Enter workshop access",
                            systemImage: store.workshopAccessState == .ready ? "checkmark.shield.fill" : "key.fill"
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .scrollContentBackground(.hidden)
            .background(StudioTheme.canvas)
            .navigationTitle("Classroom Widgets")
            .safeAreaInset(edge: .top) {
                HStack(spacing: 8) {
                    Image(systemName: "square.grid.2x2.fill")
                        .foregroundStyle(StudioTheme.sage)
                    Text("STUDIO")
                        .font(.caption.weight(.bold))
                        .tracking(1.4)
                        .foregroundStyle(StudioTheme.sage)
                    Spacer()
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 8)
                .background(StudioTheme.canvas)
            }
        } detail: {
            Group {
                if let project = store.selectedProject {
                    WidgetEditorView(store: store, projectID: project.id)
                        .id(project.id)
                } else {
                    switch store.selectedSection {
                    case .explore:
                        ExploreView(store: store)
                    case .make:
                        GuidedMakeView(store: store)
                    case .myWidgets:
                        MyWidgetsView(store: store)
                    }
                }
            }
            .background(StudioTheme.canvas)
        }
        .navigationSplitViewStyle(.balanced)
        .onChange(of: store.selectedSection) {
            store.closeEditor()
        }
        .task {
            await store.refreshWorkshopAccess()
        }
        .sheet(
            isPresented: Binding(
                get: { store.showsWorkshopAccess },
                set: { if !$0 { store.dismissWorkshopAccess() } }
            )
        ) {
            WorkshopAccessView(store: store)
                .interactiveDismissDisabled(store.workshopAccessState != .ready)
        }
        .alert(
            "Project recovery",
            isPresented: Binding(
                get: { store.recoveryNotice != nil },
                set: { if !$0 { store.dismissRecoveryNotice() } }
            )
        ) {
            Button("OK") { store.dismissRecoveryNotice() }
        } message: {
            Text(store.recoveryNotice ?? "")
        }
    }
}
