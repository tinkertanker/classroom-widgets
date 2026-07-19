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
    @State private var previewLoadState: PreviewLoadState = .loading
    @State private var promptDraft = ""
    @State private var arrangeTitle: String?
    @State private var arrangeSummary: String?
    @State private var arrangeAccent: String?
    @State private var arrangeDensity: String?
    @State private var promptIsSubmitting = false
    @State private var arrangeIsSaving = false
    @State private var arrangeIsAddingImage = false
    @State private var arrangePendingImageData: Data?
    @State private var arrangeImageDescription = ""
    @State private var arrangeImageIsDecorative = false

    var body: some View {
        if let project = store.selectedProject, project.id == projectID {
            VStack(spacing: 0) {
                editorHeader(project)
                Divider()

                GeometryReader { proxy in
                    if proxy.size.width < 760 {
                        ScrollView {
                            VStack(spacing: 0) {
                                PreviewSurface(
                                    project: project,
                                    showFullScreen: $showStudentPreview,
                                    loadState: $previewLoadState
                                )
                                .frame(height: max(430, min(560, proxy.size.width * 0.78)))
                                Divider()
                                editorPanel(project)
                                    .frame(height: max(520, proxy.size.height * 0.8))
                            }
                        }
                    } else {
                        HStack(spacing: 0) {
                            PreviewSurface(
                                project: project,
                                showFullScreen: $showStudentPreview,
                                loadState: $previewLoadState
                            )
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                            .layoutPriority(1)
                            Divider()
                            editorPanel(project)
                                .frame(minWidth: 340, idealWidth: 370, maxWidth: 390)
                        }
                    }
                }
            }
            .background(StudioTheme.canvas)
            .navigationBarBackButtonHidden()
            .fullScreenCover(isPresented: $showStudentPreview) {
                StudentPreviewView(project: project)
            }
            .sheet(isPresented: $showPublishReadiness) {
                PublishReadinessView(
                    store: store,
                    projectID: project.id,
                    previewLoadState: $previewLoadState
                )
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
                Text(project.isExample ? "Example preview" : projectStateTitle(project))
                    .font(.caption)
                    .foregroundStyle(
                        project.publicationNeedsUpdate ? StudioTheme.terracotta : StudioTheme.mutedInk
                    )
            }

            Spacer()

            if project.isExample {
                Button("Remix to edit") {
                    store.remix(project)
                }
                .buttonStyle(.borderedProminent)
            } else {
                Button("Test as student") {
                    showStudentPreview = true
                }
                .buttonStyle(.bordered)
                .disabled(previewLoadState != .ready)

                Button {
                    showPublishReadiness = true
                } label: {
                    Text(
                        project.publication == nil
                            ? "Publish"
                            : (project.publicationNeedsUpdate ? "Update link" : "Share")
                    )
                }
                .buttonStyle(.borderedProminent)
                .accessibilityHint(
                    previewLoadState == .ready
                        ? "Review publishing checks and create a student link."
                        : "The student preview has not been checked. The publishing sheet will explain what to do."
                )
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
            .disabled(promptIsSubmitting || arrangeIsSaving || arrangeIsAddingImage)

            Divider()

            switch mode {
            case .prompt:
                PromptEditorPanel(
                    store: store,
                    project: project,
                    prompt: $promptDraft,
                    isSubmitting: $promptIsSubmitting
                )
            case .arrange:
                ArrangeEditorPanel(
                    store: store,
                    project: project,
                    title: draftBinding($arrangeTitle, current: project.spec.metadata.title),
                    summary: draftBinding($arrangeSummary, current: project.spec.metadata.summary),
                    accent: draftBinding($arrangeAccent, current: project.spec.theme.accent),
                    density: draftBinding($arrangeDensity, current: project.spec.theme.density),
                    isSaving: $arrangeIsSaving,
                    isAddingImage: $arrangeIsAddingImage,
                    pendingImageData: $arrangePendingImageData,
                    imageDescription: $arrangeImageDescription,
                    imageIsDecorative: $arrangeImageIsDecorative,
                    didFinishSaving: clearArrangeDraft
                )
            case .inspect:
                InspectEditorPanel(project: project)
            }
        }
        .background(StudioTheme.surface)
    }

    private func projectStateTitle(_ project: WidgetProject) -> String {
        if project.publicationNeedsUpdate { return "Link needs updating" }
        if project.publication != nil { return "Student link live" }
        if project.needsRemoteSave { return "Waiting to back up" }
        if project.remoteDraft != nil { return "Backed up" }
        return "On this iPad"
    }

    private func draftBinding(_ draft: Binding<String?>, current: String) -> Binding<String> {
        Binding(
            get: { draft.wrappedValue ?? current },
            set: { draft.wrappedValue = $0 }
        )
    }

    private func clearArrangeDraft() {
        arrangeTitle = nil
        arrangeSummary = nil
        arrangeAccent = nil
        arrangeDensity = nil
    }
}

private struct PreviewSurface: View {
    let project: WidgetProject
    @Binding var showFullScreen: Bool
    @Binding var loadState: PreviewLoadState

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
                .frame(width: 44, height: 44)
                .disabled(loadState != .ready)
                .accessibilityLabel("Open full-screen student preview")
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 6)
            .background(StudioTheme.surface)

            PreviewPlayer(project: project, loadState: $loadState)
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(StudioTheme.border, lineWidth: 1)
                }
                .padding(22)
        }
        .background(StudioTheme.canvas)
    }

    @ViewBuilder
    private var previewStatus: some View {
        switch loadState {
        case .loading:
            ProgressView("Opening preview")
                .controlSize(.small)
                .labelsHidden()
                .accessibilityLabel("Opening student preview")
        case .ready:
            EmptyView()
        case .failed:
            Label("Preview issue", systemImage: "exclamationmark.triangle")
                .foregroundStyle(StudioTheme.terracotta)
        }
    }
}

private struct PreviewPlayer: View {
    let project: WidgetProject
    @Binding var loadState: PreviewLoadState
    @State private var reloadID = UUID()

    var body: some View {
        ZStack {
            WidgetPreviewWebView(
                spec: project.spec,
                localAssets: project.localAssets,
                state: $loadState
            )
            .id(reloadID)
            .allowsHitTesting(loadState == .ready)
            .accessibilityHidden(loadState != .ready)
            .accessibilityIdentifier(
                loadState == .ready ? "widget-preview-ready" : "widget-preview-loading"
            )

            switch loadState {
            case .loading:
                VStack(spacing: 12) {
                    ProgressView()
                    Text("Opening student preview…")
                        .font(.callout)
                        .foregroundStyle(StudioTheme.mutedInk)
                }
                .padding(24)
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14))
                .accessibilityElement(children: .combine)
            case .ready:
                EmptyView()
            case let .failed(message):
                VStack(spacing: 12) {
                    Image(systemName: "arrow.clockwise.circle")
                        .font(.title)
                        .foregroundStyle(StudioTheme.terracotta)
                        .accessibilityHidden(true)
                    Text("Preview unavailable")
                        .font(.headline)
                    Text(message)
                        .font(.callout)
                        .foregroundStyle(StudioTheme.mutedInk)
                        .multilineTextAlignment(.center)
                    Button("Reload preview") {
                        loadState = .loading
                        reloadID = UUID()
                    }
                    .buttonStyle(.borderedProminent)
                }
                .frame(maxWidth: 360)
                .padding(24)
                .background(StudioTheme.surface, in: RoundedRectangle(cornerRadius: 14))
                .overlay {
                    RoundedRectangle(cornerRadius: 14)
                        .stroke(StudioTheme.border, lineWidth: 1)
                }
                .padding(24)
            }
        }
    }
}

private struct StudentPreviewView: View {
    let project: WidgetProject
    @Environment(\.dismiss) private var dismiss
    @State private var loadState: PreviewLoadState = .loading

    var body: some View {
        NavigationStack {
            PreviewPlayer(project: project, loadState: $loadState)
                .background(Color.white)
                .navigationTitle(project.spec.metadata.title)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
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
    @Binding var previewLoadState: PreviewLoadState
    @Environment(\.dismiss) private var dismiss
    @State private var isWorking = false
    @State private var errorMessage: String?
    @State private var confirmationMessage: String?
    @State private var confirmUnpublish = false

    private var project: WidgetProject? {
        store.projects.first(where: { $0.id == projectID })
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                if let project {
                    VStack(alignment: .leading, spacing: 22) {
                        if let confirmationMessage {
                            Label(confirmationMessage, systemImage: "checkmark.circle.fill")
                                .font(.callout.weight(.semibold))
                                .foregroundStyle(StudioTheme.sage)
                                .padding(14)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(StudioTheme.sageSoft, in: RoundedRectangle(cornerRadius: 14))
                                .accessibilityIdentifier("publish-confirmation")
                        }

                        previewNotice

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
    private var previewNotice: some View {
        switch previewLoadState {
        case .ready:
            EmptyView()
        case .loading:
            Label {
                Text("The student preview is still opening. You can review the publishing checks now, but test the widget before sharing its link.")
            } icon: {
                ProgressView().controlSize(.small)
            }
            .font(.callout)
            .foregroundStyle(StudioTheme.mutedInk)
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(StudioTheme.canvas, in: RoundedRectangle(cornerRadius: 14))
        case .failed:
            Label(
                "The student preview has not loaded. Reload and test it before sharing the link.",
                systemImage: "exclamationmark.triangle.fill"
            )
            .font(.callout.weight(.semibold))
            .foregroundStyle(StudioTheme.terracotta)
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(StudioTheme.terracottaSoft, in: RoundedRectangle(cornerRadius: 14))
        }
    }

    @ViewBuilder
    private func readinessContent(_ project: WidgetProject) -> some View {
        let report = WidgetPublishReadiness.audit(project.spec)
        Text(report.isReady ? "Ready to publish" : "A few things to fix first")
            .font(.title2.weight(.semibold))
            .foregroundStyle(StudioTheme.ink)

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
                    Text("Publish student link")
                }
                Spacer()
            }
        }
        .buttonStyle(.borderedProminent)
        .controlSize(.large)
        .disabled(isWorking || !report.isReady || previewLoadState != .ready)
        .accessibilityIdentifier("confirm-publish-widget")
    }

    @ViewBuilder
    private func publishedContent(_ project: WidgetProject, publication: WidgetPublication) -> some View {
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
                            Text("Update student link")
                        }
                        Spacer()
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(isWorking || !report.isReady || previewLoadState != .ready)
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
                    confirmationMessage = "Student link copied"
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
        let updatesExistingLink = project?.publication != nil
        isWorking = true
        errorMessage = nil
        confirmationMessage = nil
        Task { @MainActor in
            defer { isWorking = false }
            do {
                _ = try await store.publish(projectID: projectID)
                confirmationMessage = updatesExistingLink
                    ? "Student link updated"
                    : "Student link ready"
            } catch {
                store.handleStudioError(error)
                errorMessage = error.localizedDescription
            }
        }
    }

    private func unpublish() {
        isWorking = true
        errorMessage = nil
        confirmationMessage = nil
        Task { @MainActor in
            defer { isWorking = false }
            do {
                try await store.unpublish(projectID: projectID)
                confirmationMessage = "Widget unpublished"
            } catch {
                store.handleStudioError(error)
                errorMessage = error.localizedDescription
            }
        }
    }

    private func extendPublication() {
        isWorking = true
        errorMessage = nil
        confirmationMessage = nil
        Task { @MainActor in
            defer { isWorking = false }
            do {
                _ = try await store.extendPublication(projectID: projectID)
                confirmationMessage = "Student link extended by 90 days"
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
