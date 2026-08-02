import SwiftUI
import CoreImage.CIFilterBuiltins
import PhotosUI
import UniformTypeIdentifiers

struct WidgetEditorView: View {
    let store: StudioStore; let projectID: String
    @State private var prompt = ""; @State private var working = false; @State private var showStudent = false; @State private var showShare = false; @State private var operationError: String?
    @State private var previewLoadState: PreviewLoadState = .loading
    @State private var previewError: String?
    var project: ArtifactProject? { store.projects.first { $0.id == projectID } ?? store.examples.first { $0.id == projectID } }
    var body: some View { if let project { VStack(spacing: 0) {
        HStack { Button("Back", systemImage: "chevron.left") { store.closeEditor() }; Text(project.artifact.title).font(.headline); Spacer(); Button("Test as student") { showStudent = true }.disabled(previewLoadState != .ready); if !project.isExample { Button("Share") { showShare = true }.buttonStyle(.borderedProminent) } }
            .padding().background(StudioTheme.surface)
        HStack(spacing: 0) { WidgetPreviewWebView(source: project.source, localAssets: project.localAssets, state: $previewLoadState, presentableError: $previewError, onSnapshot: { store.uploadSnapshot($0, revisionID: project.source.revision.id) }).background(.white)
            VStack { if project.isExample { Button("Make a copy") { Task { do { try await store.remix(project) } catch { operationError = error.localizedDescription } } }.buttonStyle(.borderedProminent) } else { editor(project) } }.frame(width: 360).background(StudioTheme.surface) }
    }.fullScreenCover(isPresented: $showStudent) { StudentPreviewView(project: project) }.sheet(isPresented: $showShare) { ShareArtifactView(store: store, projectID: projectID) }.alert("Studio could not complete this action", isPresented: Binding(get: { operationError != nil || previewError != nil }, set: { if !$0 { operationError = nil; previewError = nil } })) { Button("OK") {} } message: { Text(operationError ?? previewError ?? "") } } else { ContentUnavailableView("Widget unavailable", systemImage: "exclamationmark.triangle") } }
    private func editor(_ project: ArtifactProject) -> some View { Form {
        Section("Ask Studio") { TextEditor(text: $prompt).frame(height: 90); Button(working ? "Updating…" : "Make this change") { working = true; Task { defer { working = false }; do { try await store.refine(prompt, projectID: project.id); prompt = "" } catch { operationError = error.localizedDescription } } }.disabled(working || prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty); Button("Undo") { Task { do { try await store.undo(projectID: project.id) } catch { operationError = error.localizedDescription } } }.disabled(project.source.revision.parentRevisionId == nil) }
        Section("Details") { DetailsFields(store: store, project: project) }
        Section("Images") { ImageManagementView(store: store, projectID: project.id, assets: project.localAssets) }
        Section("History") { ForEach(project.revisions.reversed()) { revision in HStack { VStack(alignment: .leading) { Text(revision.instruction ?? revision.kind.rawValue.capitalized); Text(revision.createdAt).font(.caption).foregroundStyle(.secondary) }; Spacer(); if let url = revision.screenshotUrl { AsyncImage(url: url) { $0.resizable().scaledToFill() } placeholder: { Color.gray.opacity(0.2) }.frame(width: 64, height: 44).clipped() }; Button("Restore") { Task { do { try await store.restore(revision: revision, projectID: project.id) } catch { operationError = error.localizedDescription } } }.disabled(revision.id == project.artifact.headRevisionId) } } }
        Section("Source") { Text(project.source.html).font(.caption.monospaced()).textSelection(.enabled).lineLimit(12) }
    }.formStyle(.grouped) }
}

private struct ImageManagementView: View {
    let store: StudioStore
    let projectID: String
    let assets: [LocalWidgetAssetFile]
    @State private var photo: PhotosPickerItem?
    @State private var pendingData: Data?
    @State private var description = ""
    @State private var decorative = false
    @State private var importsFile = false
    @State private var showsCamera = false
    @State private var error: String?

    var body: some View {
        ForEach(assets) { asset in
            HStack {
                Label(asset.id, systemImage: "photo")
                Spacer()
                Button("Remove", role: .destructive) {
                    Task {
                        do { try await store.removeImage(assetID: asset.id, projectID: projectID) }
                        catch { self.error = error.localizedDescription }
                    }
                }
            }
        }
        PhotosPicker("Choose from Photos", selection: $photo, matching: .images)
        Button("Choose a file") { importsFile = true }
        if UIImagePickerController.isSourceTypeAvailable(.camera) { Button("Take a photo") { showsCamera = true } }
        if pendingData != nil {
            TextField("Describe this image", text: $description, axis: .vertical)
            Toggle("Decorative image", isOn: $decorative)
            Button("Upload and ask Studio to insert") { upload() }
                .disabled(!decorative && description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
        if let error { Text(error).foregroundStyle(StudioTheme.danger) }
        Text("Images are prepared and checked on this iPad. Studio inserts them through a new revision; the HTML is never edited directly.")
            .font(.footnote).foregroundStyle(.secondary)
        .onChange(of: photo) { _, item in Task { pendingData = try? await item?.loadTransferable(type: Data.self) } }
        .fileImporter(isPresented: $importsFile, allowedContentTypes: [.image]) { result in
            do { let url = try result.get(); guard url.startAccessingSecurityScopedResource() else { throw CocoaError(.fileReadNoPermission) }; defer { url.stopAccessingSecurityScopedResource() }; pendingData = try Data(contentsOf: url) }
            catch { self.error = error.localizedDescription }
        }
        .sheet(isPresented: $showsCamera) { CameraImagePicker { pendingData = $0 } }
    }

    private func upload() {
        guard let pendingData else { return }
        error = nil
        Task {
            do {
                try await store.addImage(pendingData, description: description, decorative: decorative, projectID: projectID)
                self.pendingData = nil; description = ""; decorative = false; photo = nil
            } catch { self.error = error.localizedDescription }
        }
    }
}

private struct DetailsFields: View { let store: StudioStore; let project: ArtifactProject; @State private var draft: Artifact; @State private var error: String?
    init(store: StudioStore, project: ArtifactProject) { self.store = store; self.project = project; _draft = State(initialValue: project.artifact) }
    var body: some View { Group { TextField("Title", text: $draft.title); TextField("Summary", text: $draft.summary, axis: .vertical); TextField("Subject", text: optional($draft.subject)); TextField("Level", text: optional($draft.level)); TextField("Locale", text: optional($draft.locale)); TextField("Learning objective", text: optional($draft.learningObjective), axis: .vertical); TextField("Tags (comma separated)", text: Binding(get: { draft.tags.joined(separator: ", ") }, set: { draft.tags = $0.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) } })); Button("Save details") { Task { do { try await store.updateDetails(draft); error = nil } catch { self.error = error.localizedDescription } } }; if let error { Text(error).foregroundStyle(StudioTheme.danger) } }
    }
    private func optional(_ value: Binding<String?>) -> Binding<String> { Binding(get: { value.wrappedValue ?? "" }, set: { value.wrappedValue = $0.isEmpty ? nil : $0 }) }
}

struct StudentPreviewView: View { let project: ArtifactProject; @Environment(\.dismiss) var dismiss
    var body: some View { NavigationStack { WidgetPreviewWebView(source: project.source, localAssets: project.localAssets).navigationTitle(project.artifact.title).toolbar { Button("Done") { dismiss() } } } }
}

private struct ShareArtifactView: View { let store: StudioStore; let projectID: String; @Environment(\.dismiss) var dismiss; @State private var working = false; @State private var error: String?
    var project: ArtifactProject? { store.projects.first { $0.id == projectID } }
    var body: some View { NavigationStack { VStack(spacing: 20) { if let publication = project?.artifact.publication { if let qr = qrCode(publication.url) { Image(uiImage: qr).interpolation(.none).resizable().frame(width: 220, height: 220).accessibilityLabel("QR code for student link") }; Text(publication.url.absoluteString).textSelection(.enabled); ShareLink(item: publication.url); Text("Expires \(publication.formattedExpirationDate())"); Button("Extend 90 days") { perform { try await store.extendPublication(projectID: projectID) } }; Button("Turn off link", role: .destructive) { perform { try await store.unpublish(projectID: projectID) } } } else { Button("Create student link") { perform { _ = try await store.publish(projectID: projectID) } }.disabled(working) }; if let error { Text(error).foregroundStyle(StudioTheme.danger) } }.padding().navigationTitle("Share with students").toolbar { Button("Done") { dismiss() } } } }
    private func perform(_ operation: @escaping @MainActor () async throws -> Void) { working = true; error = nil; Task { defer { working = false }; do { try await operation() } catch { self.error = error.localizedDescription } } }
    private func qrCode(_ url: URL) -> UIImage? { let filter = CIFilter.qrCodeGenerator(); filter.message = Data(url.absoluteString.utf8); filter.correctionLevel = "M"; guard let output = filter.outputImage else { return nil }; return UIImage(ciImage: output.transformed(by: CGAffineTransform(scaleX: 10, y: 10))) }
}
