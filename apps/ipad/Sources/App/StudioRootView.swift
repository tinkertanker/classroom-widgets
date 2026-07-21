import SwiftUI
import UIKit

struct StudioRootView: View {
    @Bindable var store: StudioStore
    @State private var columnVisibility: NavigationSplitViewVisibility = .automatic

    var body: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            List(
                selection: Binding<StudioSection?>(
                    get: { store.selectedSection },
                    set: { section in
                        guard let section else { return }
                        store.selectedSection = section
                        store.closeEditor()
                    }
                )
            ) {
                Section {
                    ForEach(StudioSection.allCases) { section in
                        Label(section.title, systemImage: section.symbolName)
                            .tag(section)
                            .accessibilityIdentifier("sidebar-\(section.rawValue)")
                    }
                }

                Section {
                    Button {
                        store.requestWorkshopAccess()
                    } label: {
                        HStack {
                            Label("Studio access", systemImage: "key")
                            Spacer()
                            Text(workshopAccessLabel)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(workshopAccessColour)
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityValue(workshopAccessValue)
                }
            }
            .scrollContentBackground(.hidden)
            .background(StudioTheme.canvas)
            .navigationTitle("Classroom Widgets")
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
        .onChange(of: store.selectedProjectID) { _, projectID in
            withAnimation(.easeInOut(duration: 0.2)) {
                columnVisibility = projectID == nil ? .automatic : .detailOnly
            }
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
        .overlay(alignment: .bottom) {
            if let notice = store.notice {
                HStack(spacing: 12) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(StudioTheme.accent)
                        .accessibilityHidden(true)
                    Text(notice)
                        .font(.callout.weight(.medium))
                    Button {
                        withAnimation { store.notice = nil }
                    } label: {
                        Image(systemName: "xmark")
                            .frame(width: 44, height: 44)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Dismiss message")
                }
                .foregroundStyle(StudioTheme.ink)
                .padding(.leading, 16)
                .padding(.trailing, 8)
                .padding(.vertical, 8)
                .background(.regularMaterial, in: Capsule())
                .overlay {
                    Capsule().stroke(StudioTheme.border, lineWidth: 1)
                }
                .padding(20)
                .shadow(color: .black.opacity(0.08), radius: 12, y: 4)
                .accessibilityElement(children: .contain)
                .task(id: notice) {
                    guard !UIAccessibility.isVoiceOverRunning else { return }
                    try? await Task.sleep(for: .seconds(4))
                    guard store.notice == notice else { return }
                    withAnimation { store.notice = nil }
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.easeInOut(duration: 0.2), value: store.notice)
        .onChange(of: store.notice) { _, notice in
            guard let notice else { return }
            UIAccessibility.post(notification: .announcement, argument: notice)
        }
    }

    private var workshopAccessValue: String {
        switch store.workshopAccessState {
        case .checking: "Checking"
        case .registrationRequired: "Code needed"
        case .ready: "Ready"
        }
    }

    private var workshopAccessLabel: String {
        workshopAccessValue
    }

    private var workshopAccessColour: Color {
        switch store.workshopAccessState {
        case .checking: StudioTheme.mutedInk
        case .registrationRequired: StudioTheme.mutedInk
        case .ready: StudioTheme.accent
        }
    }
}
