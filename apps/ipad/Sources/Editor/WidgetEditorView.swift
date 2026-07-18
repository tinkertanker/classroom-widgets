import CoreImage.CIFilterBuiltins
import SwiftUI
import UIKit

private enum EditorMode: String, CaseIterable, Identifiable {
    case prompt
    case arrange
    case inspect

    var id: String { rawValue }

    var title: String { rawValue.capitalized }

    var symbolName: String {
        switch self {
        case .prompt: "text.bubble"
        case .arrange: "slider.horizontal.3"
        case .inspect: "list.bullet.rectangle"
        }
    }
}

struct WidgetEditorView: View {
    let store: StudioStore
    let projectID: String

    @State private var mode: EditorMode = .prompt
    @State private var showStudentPreview = false
    @State private var showPublishReadiness = false
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var body: some View {
        if let project = store.selectedProject, project.id == projectID {
            VStack(spacing: 0) {
                editorHeader(project)
                Divider()

                if horizontalSizeClass == .compact {
                    VStack(spacing: 0) {
                        PreviewSurface(project: project, showFullScreen: $showStudentPreview)
                            .frame(minHeight: 380)
                        Divider()
                        editorPanel(project)
                            .frame(minHeight: 320)
                    }
                } else {
                    HStack(spacing: 0) {
                        PreviewSurface(project: project, showFullScreen: $showStudentPreview)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                        Divider()
                        editorPanel(project)
                            .frame(width: 370)
                    }
                }
            }
            .background(StudioTheme.canvas)
            .navigationBarBackButtonHidden()
            .fullScreenCover(isPresented: $showStudentPreview) {
                StudentPreviewView(project: project)
            }
            .sheet(isPresented: $showPublishReadiness) {
                PublishReadinessView(store: store, projectID: project.id)
                    .presentationDetents([.large])
            }
        } else {
            ContentUnavailableView(
                "Widget unavailable",
                systemImage: "exclamationmark.triangle",
                description: Text("Return to My Widgets and open it again.")
            )
        }
    }

    private func editorHeader(_ project: WidgetProject) -> some View {
        HStack(spacing: 14) {
            Button {
                store.closeEditor()
            } label: {
                Label("Back", systemImage: "chevron.left")
            }
            .buttonStyle(.borderless)
            .accessibilityIdentifier("close-editor")

            Divider().frame(height: 24)

            VStack(alignment: .leading, spacing: 2) {
                Text(project.spec.metadata.title)
                    .font(.headline)
                    .lineLimit(1)
                Text(project.isExample ? "Example preview" : "Saved on this iPad")
                    .font(.caption)
                    .foregroundStyle(StudioTheme.mutedInk)
            }

            Spacer()

            if project.isExample {
                Button("Remix to edit") {
                    store.remix(project)
                }
                .buttonStyle(.borderedProminent)
            } else {
                Button {
                    showStudentPreview = true
                } label: {
                    Label("Test as student", systemImage: "rectangle.inset.filled.and.person.filled")
                }
                .buttonStyle(.bordered)

                Button {
                    showPublishReadiness = true
                } label: {
                    Label(
                        project.publication == nil
                            ? "Publish"
                            : (project.publicationNeedsUpdate ? "Update link" : "Share"),
                        systemImage: project.publication == nil
                            ? "link.badge.plus"
                            : (project.publicationNeedsUpdate ? "arrow.triangle.2.circlepath" : "square.and.arrow.up")
                    )
                }
                .buttonStyle(.borderedProminent)
                .accessibilityIdentifier("publish-widget")
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 13)
        .background(StudioTheme.surface)
    }

    private func editorPanel(_ project: WidgetProject) -> some View {
        VStack(spacing: 0) {
            Picker("Editing mode", selection: $mode) {
                ForEach(EditorMode.allCases) { item in
                    Label(item.title, systemImage: item.symbolName).tag(item)
                }
            }
            .pickerStyle(.segmented)
            .padding(16)

            Divider()

            Group {
                switch mode {
                case .prompt:
                    PromptEditorPanel(store: store, project: project)
                case .arrange:
                    ArrangeEditorPanel(store: store, project: project)
                case .inspect:
                    InspectEditorPanel(project: project)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(StudioTheme.surface)
    }
}

private struct PreviewSurface: View {
    let project: WidgetProject
    @Binding var showFullScreen: Bool
    @State private var loadState: PreviewLoadState = .loading

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Label("Student preview", systemImage: "ipad.landscape")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(StudioTheme.ink)
                Spacer()
                previewStatus
                Button {
                    showFullScreen = true
                } label: {
                    Image(systemName: "arrow.up.left.and.arrow.down.right")
                }
                .buttonStyle(.borderless)
                .accessibilityLabel("Open full-screen student preview")
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 12)
            .background(StudioTheme.surface)

            WidgetPreviewWebView(spec: project.spec, localAssets: project.localAssets, state: $loadState)
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke(StudioTheme.border, lineWidth: 1)
                }
                .shadow(color: .black.opacity(0.08), radius: 15, y: 6)
                .padding(22)
        }
        .background(StudioTheme.canvas)
    }

    @ViewBuilder
    private var previewStatus: some View {
        switch loadState {
        case .loading:
            HStack(spacing: 6) {
                ProgressView().controlSize(.small)
                Text("Loading")
            }
            .foregroundStyle(StudioTheme.mutedInk)
        case .ready:
            Label("Local & private", systemImage: "checkmark.shield")
                .foregroundStyle(StudioTheme.sage)
        case .failed:
            Label("Preview issue", systemImage: "exclamationmark.triangle")
                .foregroundStyle(StudioTheme.terracotta)
        }
    }
}

private struct StudentPreviewView: View {
    let project: WidgetProject
    @Environment(\.dismiss) private var dismiss
    @State private var loadState: PreviewLoadState = .loading

    var body: some View {
        NavigationStack {
            WidgetPreviewWebView(spec: project.spec, localAssets: project.localAssets, state: $loadState)
                .background(Color.white)
                .navigationTitle(project.spec.metadata.title)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Label("Student view", systemImage: "person.crop.circle")
                            .foregroundStyle(StudioTheme.mutedInk)
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") { dismiss() }
                    }
                }
        }
    }
}

private struct PublishReadinessView: View {
    let store: StudioStore
    let projectID: String
    @Environment(\.dismiss) private var dismiss
    @State private var isWorking = false
    @State private var errorMessage: String?
    @State private var confirmUnpublish = false

    private var project: WidgetProject? {
        store.projects.first(where: { $0.id == projectID })
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                if let project {
                    VStack(alignment: .leading, spacing: 22) {
                        if let publication = project.publication {
                            publishedContent(project, publication: publication)
                        } else {
                            readinessContent(project)
                        }

                        if let errorMessage {
                            Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                                .font(.callout)
                                .foregroundStyle(StudioTheme.terracotta)
                                .padding(14)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(StudioTheme.terracottaSoft, in: RoundedRectangle(cornerRadius: 14))
                        }
                    }
                    .padding(28)
                } else {
                    ContentUnavailableView(
                        "Widget unavailable",
                        systemImage: "exclamationmark.triangle",
                        description: Text("Return to My Widgets and open it again.")
                    )
                }
            }
            .navigationTitle(project?.publication == nil ? "Publish" : "Student link")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .confirmationDialog(
                "Unpublish this widget?",
                isPresented: $confirmUnpublish,
                titleVisibility: .visible
            ) {
                Button("Unpublish", role: .destructive) {
                    unpublish()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Students will no longer be able to open this link. This cannot be undone.")
            }
        }
    }

    @ViewBuilder
    private func readinessContent(_ project: WidgetProject) -> some View {
        let report = WidgetPublishReadiness.audit(project.spec)
        Label(
            report.isReady ? "Ready for a student link" : "Finish the publish checks",
            systemImage: report.isReady ? "checkmark.seal.fill" : "exclamationmark.triangle.fill"
        )
            .font(.title2.weight(.semibold))
            .foregroundStyle(report.isReady ? StudioTheme.sage : StudioTheme.terracotta)

        VStack(alignment: .leading, spacing: 12) {
            ForEach(report.checks) { check in
                readinessRow(check)
            }
        }

        Text("Publishing creates an unlisted link. Anyone with the link can use this widget, so check the student preview first and do not include student names or personal information.")
            .font(.callout)
            .foregroundStyle(StudioTheme.mutedInk)

        Button {
            publish()
        } label: {
            HStack {
                Spacer()
                if isWorking {
                    ProgressView()
                        .tint(.white)
                } else {
                    Label("Publish student link", systemImage: "link.badge.plus")
                }
                Spacer()
            }
        }
        .buttonStyle(.borderedProminent)
        .controlSize(.large)
        .disabled(isWorking || !report.isReady)
        .accessibilityIdentifier("confirm-publish-widget")
    }

    @ViewBuilder
    private func publishedContent(_ project: WidgetProject, publication: WidgetPublication) -> some View {
        Label("Your student link is ready", systemImage: "checkmark.seal.fill")
            .font(.title2.weight(.semibold))
            .foregroundStyle(StudioTheme.sage)

        if project.publicationNeedsUpdate {
            let report = WidgetPublishReadiness.audit(project.spec)
            VStack(alignment: .leading, spacing: 12) {
                Label("The draft has newer changes", systemImage: "arrow.triangle.2.circlepath")
                    .font(.headline)
                Text("Update the existing student link when you are ready. Its URL and QR code will stay the same.")
                    .font(.callout)
                    .foregroundStyle(StudioTheme.mutedInk)
                ForEach(report.checks) { check in
                    readinessRow(check)
                }
                Button {
                    publish()
                } label: {
                    HStack {
                        Spacer()
                        if isWorking {
                            ProgressView().tint(.white)
                        } else {
                            Label("Update student link", systemImage: "arrow.triangle.2.circlepath")
                        }
                        Spacer()
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(isWorking || !report.isReady)
            }
            .padding(16)
            .background(StudioTheme.sageSoft, in: RoundedRectangle(cornerRadius: 14))
        }

        HStack(alignment: .top, spacing: 22) {
            if let image = qrImage(for: publication.url) {
                Image(uiImage: image)
                    .interpolation(.none)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 190, height: 190)
                    .padding(10)
                    .background(Color.white, in: RoundedRectangle(cornerRadius: 14))
                    .accessibilityLabel("QR code for the student link")
            }

            VStack(alignment: .leading, spacing: 14) {
                Text(publication.url.absoluteString)
                    .font(.callout.monospaced())
                    .textSelection(.enabled)

                Text("Expires \(formattedExpiry(publication.expiresAt))")
                    .font(.caption)
                    .foregroundStyle(StudioTheme.mutedInk)

                ShareLink(item: publication.url) {
                    Label("Share link", systemImage: "square.and.arrow.up")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)

                Button {
                    UIPasteboard.general.url = publication.url
                    store.notice = "Student link copied"
                } label: {
                    Label("Copy link", systemImage: "doc.on.doc")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)

                Button {
                    extendPublication()
                } label: {
                    Label("Extend 90 days", systemImage: "calendar.badge.plus")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .disabled(isWorking)
                .accessibilityIdentifier("extend-publication")
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }

        Divider()

        Button("Unpublish widget", role: .destructive) {
            confirmUnpublish = true
        }
        .disabled(isWorking)
    }

    private func readinessRow(_ check: WidgetPublishReadinessCheck) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: check.isPassing ? "checkmark.circle.fill" : "xmark.circle.fill")
                .foregroundStyle(check.isPassing ? StudioTheme.sage : StudioTheme.terracotta)
            VStack(alignment: .leading, spacing: 2) {
                Text(check.title)
                    .font(.callout.weight(.semibold))
                    .foregroundStyle(StudioTheme.ink)
                Text(check.detail)
                    .font(.caption)
                    .foregroundStyle(StudioTheme.mutedInk)
            }
        }
    }

    private func publish() {
        isWorking = true
        errorMessage = nil
        Task { @MainActor in
            defer { isWorking = false }
            do {
                _ = try await store.publish(projectID: projectID)
            } catch {
                store.handleStudioError(error)
                errorMessage = error.localizedDescription
            }
        }
    }

    private func unpublish() {
        isWorking = true
        errorMessage = nil
        Task { @MainActor in
            defer { isWorking = false }
            do {
                try await store.unpublish(projectID: projectID)
            } catch {
                store.handleStudioError(error)
                errorMessage = error.localizedDescription
            }
        }
    }

    private func extendPublication() {
        isWorking = true
        errorMessage = nil
        Task { @MainActor in
            defer { isWorking = false }
            do {
                _ = try await store.extendPublication(projectID: projectID)
            } catch {
                store.handleStudioError(error)
                errorMessage = error.localizedDescription
            }
        }
    }

    private func qrImage(for url: URL) -> UIImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(url.absoluteString.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage?.transformed(by: CGAffineTransform(scaleX: 10, y: 10)) else {
            return nil
        }
        let context = CIContext()
        guard let image = context.createCGImage(output, from: output.extent) else { return nil }
        return UIImage(cgImage: image)
    }

    private func formattedExpiry(_ value: String) -> String {
        guard let date = ISO8601DateFormatter().date(from: value) else { return value }
        return date.formatted(date: .abbreviated, time: .omitted)
    }
}
