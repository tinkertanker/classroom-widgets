import PhotosUI
import SwiftUI
import UIKit

struct ArrangeEditorPanel: View {
    let store: StudioStore
    let project: WidgetProject

    @State private var title: String
    @State private var summary: String
    @State private var accent: String
    @State private var density: String
    @State private var didSave = false
    @State private var isSaving = false
    @State private var saveError: String?
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var showsFileImporter = false
    @State private var showsCamera = false
    @State private var pendingImageData: Data?
    @State private var imageDescription = ""
    @State private var imageIsDecorative = false
    @State private var isAddingImage = false

    private let accents = ["sage", "terracotta", "sky", "indigo", "amber", "rose"]

    init(store: StudioStore, project: WidgetProject) {
        self.store = store
        self.project = project
        _title = State(initialValue: project.spec.metadata.title)
        _summary = State(initialValue: project.spec.metadata.summary)
        _accent = State(initialValue: project.spec.theme.accent)
        _density = State(initialValue: project.spec.theme.density)
    }

    var body: some View {
        Form {
            Section("Words students see") {
                TextField("Title", text: $title)
                    .disabled(project.isExample)
                TextField("Short introduction", text: $summary, axis: .vertical)
                    .lineLimit(3...6)
                    .disabled(project.isExample)
            }

            Section("Appearance") {
                Picker("Accent", selection: $accent) {
                    ForEach(accents, id: \.self) { value in
                        Label(value.capitalized, systemImage: value == accent ? "circle.fill" : "circle")
                            .tag(value)
                    }
                }
                .disabled(project.isExample)

                Picker("Spacing", selection: $density) {
                    Text("Comfortable").tag("comfortable")
                    Text("Compact").tag("compact")
                }
                .pickerStyle(.segmented)
                .disabled(project.isExample)
            }

            Section {
                ForEach(project.localAssets) { asset in
                    HStack {
                        Label("Classroom image", systemImage: "photo")
                        Spacer()
                        Button("Remove", role: .destructive) {
                            removeImage(asset.id)
                        }
                        .disabled(project.isExample || isAddingImage || isSaving)
                    }
                }

                PhotosPicker(selection: $selectedPhoto, matching: .images) {
                    Label(
                        "Choose from Photos",
                        systemImage: "photo.badge.plus"
                    )
                }
                .disabled(project.isExample || project.spec.assets.count >= 3 || isAddingImage || isSaving)

                Button {
                    showsFileImporter = true
                } label: {
                    Label("Choose from Files", systemImage: "folder.badge.plus")
                }
                .disabled(project.isExample || project.spec.assets.count >= 3 || isAddingImage || isSaving)

                if UIImagePickerController.isSourceTypeAvailable(.camera) {
                    Button {
                        showsCamera = true
                    } label: {
                        Label("Take a photo", systemImage: "camera.fill")
                    }
                    .disabled(project.isExample || project.spec.assets.count >= 3 || isAddingImage || isSaving)
                }

                if let pendingImageData, let preview = UIImage(data: pendingImageData) {
                    Image(uiImage: preview)
                        .resizable()
                        .scaledToFit()
                        .frame(maxHeight: 180)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .accessibilityHidden(true)

                    TextField("Describe the image for students", text: $imageDescription, axis: .vertical)
                        .lineLimit(2...4)
                        .disabled(imageIsDecorative)

                    Toggle("Decorative image", isOn: $imageIsDecorative)

                    Button {
                        addImage(pendingImageData)
                    } label: {
                        Group {
                            if isAddingImage {
                                HStack(spacing: 8) {
                                    ProgressView().controlSize(.small)
                                    Text("Preparing and uploading…")
                                }
                            } else {
                                Label("Add to widget", systemImage: "plus.circle.fill")
                            }
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(
                        isAddingImage ||
                        isSaving ||
                        (!imageIsDecorative && imageDescription.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    )
                }
            } header: {
                Text("Images (\(project.spec.assets.count)/3)")
            } footer: {
                Text("Studio checks for faces and obvious personal details on this iPad, strips metadata, resizes each image and allows up to three images per widget.")
            }

            Section {
                Button {
                    save()
                } label: {
                    Group {
                        if isSaving {
                            HStack(spacing: 8) {
                                ProgressView().controlSize(.small)
                                Text("Saving…")
                            }
                        } else {
                            Label(
                                didSave ? "Saved" : "Save changes",
                                systemImage: didSave ? "checkmark" : "square.and.arrow.down"
                            )
                        }
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(
                    project.isExample ||
                    isSaving ||
                    isAddingImage ||
                    title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                )

                if let saveError {
                    Label(saveError, systemImage: "exclamationmark.triangle.fill")
                        .font(.callout)
                        .foregroundStyle(StudioTheme.terracotta)
                }
            } footer: {
                Text("Content and interaction controls will appear here as the shared widget player adds them.")
            }
        }
        .formStyle(.grouped)
        .scrollContentBackground(.hidden)
        .onChange(of: selectedPhoto) { _, item in
            loadPhoto(item)
        }
        .fileImporter(
            isPresented: $showsFileImporter,
            allowedContentTypes: [.image],
            allowsMultipleSelection: false
        ) { result in
            loadFile(result)
        }
        .sheet(isPresented: $showsCamera) {
            CameraImagePicker { data in
                do {
                    guard let data else { throw WidgetImageError.invalidImage }
                    try acceptPendingImage(data)
                } catch {
                    pendingImageData = nil
                    saveError = error.localizedDescription
                }
                showsCamera = false
            }
            .ignoresSafeArea()
        }
    }

    private func save() {
        isSaving = true
        didSave = false
        saveError = nil
        store.updateDetails(
            for: project.id,
            title: title,
            summary: summary,
            accent: accent,
            density: density
        )
        Task {
            do {
                try await store.saveDirectEdits(projectID: project.id)
                didSave = true
            } catch {
                store.handleStudioError(error)
                saveError = error.localizedDescription
            }
            isSaving = false
        }
    }

    private func loadPhoto(_ item: PhotosPickerItem?) {
        guard let item else { return }
        saveError = nil
        Task { @MainActor in
            do {
                guard let data = try await item.loadTransferable(type: Data.self) else {
                    throw WidgetImageError.invalidImage
                }
                try acceptPendingImage(data)
            } catch {
                pendingImageData = nil
                saveError = error.localizedDescription
            }
        }
    }

    private func loadFile(_ result: Result<[URL], Error>) {
        saveError = nil
        do {
            let url = try result.get().first
            guard let url else { throw WidgetImageError.invalidImage }
            let accessed = url.startAccessingSecurityScopedResource()
            defer { if accessed { url.stopAccessingSecurityScopedResource() } }
            let values = try url.resourceValues(forKeys: [.fileSizeKey])
            guard (values.fileSize ?? 0) <= 30_000_000 else {
                throw WidgetImageError.couldNotReduceSize
            }
            try acceptPendingImage(Data(contentsOf: url, options: [.mappedIfSafe]))
        } catch {
            pendingImageData = nil
            saveError = error.localizedDescription
        }
    }

    private func acceptPendingImage(_ data: Data) throws {
        guard data.count <= 30_000_000 else {
            throw WidgetImageError.couldNotReduceSize
        }
        guard UIImage(data: data) != nil else { throw WidgetImageError.invalidImage }
        pendingImageData = data
    }

    private func addImage(_ data: Data) {
        isAddingImage = true
        saveError = nil
        Task { @MainActor in
            defer { isAddingImage = false }
            do {
                try await store.addImage(
                    data,
                    alternativeText: imageDescription,
                    decorative: imageIsDecorative,
                    projectID: project.id
                )
                pendingImageData = nil
                selectedPhoto = nil
                imageDescription = ""
                imageIsDecorative = false
            } catch {
                store.handleStudioError(error)
                saveError = error.localizedDescription
            }
        }
    }

    private func removeImage(_ assetID: String) {
        store.removeImage(assetID: assetID, projectID: project.id)
        isSaving = true
        Task { @MainActor in
            defer { isSaving = false }
            do {
                try await store.saveDirectEdits(projectID: project.id, note: "Remove classroom image")
                store.discardLocalAsset(assetID: assetID, projectID: project.id)
            } catch {
                store.handleStudioError(error)
                saveError = error.localizedDescription
            }
        }
    }
}
