import PhotosUI
import SwiftUI
import UIKit

struct ArrangeEditorPanel: View {
    let store: StudioStore
    let project: WidgetProject
    @Binding var title: String
    @Binding var summary: String
    @Binding var accent: String
    @Binding var density: String
    @Binding var isSaving: Bool
    @Binding var isAddingImage: Bool
    @Binding var pendingImageData: Data?
    @Binding var imageDescription: String
    @Binding var imageIsDecorative: Bool
    let didFinishSaving: () -> Void

    @State private var didSave = false
    @State private var saveError: StudioErrorPresentation?
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var showsFileImporter = false
    @State private var showsCamera = false
    @State private var imageToRemove: LocalWidgetAssetFile?

    private let accents = ["sage", "terracotta", "sky", "indigo", "amber", "rose"]

    var body: some View {
        Form {
            Section("Text students see") {
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
                    HStack(alignment: .center, spacing: 12) {
                        imageThumbnail(for: asset)

                        VStack(alignment: .leading, spacing: 3) {
                            Text("Classroom image")
                                .font(.body.weight(.medium))
                            let details = imageDetails(for: asset.id)
                            Text(details.decorative ? "Decorative image" : details.description)
                                .font(.caption)
                                .foregroundStyle(StudioTheme.mutedInk)
                                .lineLimit(2)
                        }
                        Spacer(minLength: 8)
                        Button("Remove", role: .destructive) {
                            imageToRemove = asset
                        }
                        .disabled(project.isExample || isAddingImage || isSaving)
                        .frame(minHeight: 44)
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

                    TextField("What should students know about this image?", text: $imageDescription, axis: .vertical)
                        .lineLimit(2...4)
                        .disabled(imageIsDecorative)

                    Toggle("This image is decorative", isOn: $imageIsDecorative)
                        .onChange(of: imageIsDecorative) { _, isDecorative in
                            if isDecorative { imageDescription = "" }
                        }

                    if imageIsDecorative {
                        Text("Students do not need this image to understand the activity.")
                            .font(.caption)
                            .foregroundStyle(StudioTheme.mutedInk)
                    }

                    Button {
                        addImage(pendingImageData)
                    } label: {
                        Group {
                            if isAddingImage {
                                HStack(spacing: 8) {
                                    ProgressView().controlSize(.small)
                                    Text("Checking and adding image…")
                                }
                            } else {
                                Text("Add to widget")
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
                            Text(didSave ? "Saved" : "Save changes")
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
                    VStack(alignment: .leading, spacing: 4) {
                        Text(saveError.title)
                            .font(.callout.weight(.semibold))
                        Text(saveError.message)
                            .font(.callout)
                    }
                        .foregroundStyle(StudioTheme.danger)
                }
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
                guard let data else {
                    showsCamera = false
                    return
                }
                do {
                    try acceptPendingImage(data)
                } catch {
                    pendingImageData = nil
                    saveError = store.present(error, during: .image)
                }
                showsCamera = false
            }
            .ignoresSafeArea()
        }
        .confirmationDialog(
            "Remove this image?",
            isPresented: Binding(
                get: { imageToRemove != nil },
                set: { if !$0 { imageToRemove = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Remove image", role: .destructive) {
                guard let imageToRemove else { return }
                removeImage(imageToRemove.id)
                self.imageToRemove = nil
            }
            Button("Keep image", role: .cancel) { imageToRemove = nil }
        } message: {
            Text("This removes the image from this activity. If you have already shared a student link, update it before sharing again so students get the version without this image.")
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
                didFinishSaving()
            } catch {
                saveError = store.present(error, during: .directSave)
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
                saveError = store.present(error, during: .image)
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
            saveError = store.present(error, during: .image)
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
                saveError = store.present(error, during: .image)
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
                saveError = store.present(error, during: .directSave)
            }
        }
    }

    @ViewBuilder
    private func imageThumbnail(for asset: LocalWidgetAssetFile) -> some View {
        if let url = LocalWidgetAssetStorage.url(for: asset),
           let image = UIImage(contentsOfFile: url.path) {
            Image(uiImage: image)
                .resizable()
                .scaledToFill()
                .frame(width: 52, height: 52)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .accessibilityHidden(true)
        } else {
            Image(systemName: "photo")
                .frame(width: 52, height: 52)
                .foregroundStyle(StudioTheme.mutedInk)
                .background(StudioTheme.canvas, in: RoundedRectangle(cornerRadius: 8))
                .accessibilityHidden(true)
        }
    }

    private func imageDetails(for assetID: String) -> (description: String, decorative: Bool) {
        var pending = project.spec.screens.flatMap(\.components)
        while let value = pending.popLast() {
            switch value {
            case let .object(object):
                let referencedAssetID: String?
                if case let .string(assetID)? = object["assetId"] {
                    referencedAssetID = assetID
                } else if case let .string(assetID)? = object["imageAssetId"] {
                    referencedAssetID = assetID
                } else {
                    referencedAssetID = nil
                }
                if referencedAssetID == assetID {
                    let description: String
                    if case let .string(text)? = object["altText"], !text.isEmpty {
                        description = text
                    } else {
                        description = "No student description"
                    }
                    let decorative: Bool
                    if case let .boolean(value)? = object["decorative"] {
                        decorative = value
                    } else {
                        decorative = false
                    }
                    return (description, decorative)
                }
                pending.append(contentsOf: object.values)
            case let .array(values):
                pending.append(contentsOf: values)
            case .string, .integer, .number, .boolean, .null:
                break
            }
        }
        return ("No student description", false)
    }
}
