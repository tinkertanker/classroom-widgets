import Foundation
import Observation

enum StudioSection: String, CaseIterable, Identifiable, Sendable {
    case explore
    case make
    case myWidgets

    var id: String { rawValue }

    var title: String {
        switch self {
        case .explore: "Explore"
        case .make: "Make"
        case .myWidgets: "My Widgets"
        }
    }

    var symbolName: String {
        switch self {
        case .explore: "sparkle.magnifyingglass"
        case .make: "wand.and.sparkles"
        case .myWidgets: "square.stack.3d.up"
        }
    }
}

enum WorkshopAccessState: Equatable, Sendable {
    case checking
    case registrationRequired
    case ready
}

@MainActor
@Observable
final class StudioStore {
    private struct StoredProjects: Codable {
        let version: Int
        let projects: [WidgetProject]
    }

    private static let storageKey = "classroom-widgets-studio-projects-v1"

    var selectedSection: StudioSection = .explore
    var selectedProjectID: String?
    private(set) var examples: [WidgetProject]
    private(set) var projects: [WidgetProject]
    private(set) var recoveryNotice: String?
    private(set) var workshopAccessState: WorkshopAccessState = .checking
    private(set) var isRestoringFromStudio = false
    var showsWorkshopAccess = false
    var notice: String?
    var errorMessage: String?

    private let defaults: UserDefaults
    private let projectFiles: StudioProjectFileStore?
    private let api: any StudioAPI
    private let isUITesting: Bool
    private var activeRemoteProjectIDs: Set<String> = []

    init(
        repository: FixtureRepository = FixtureRepository(),
        defaults: UserDefaults = .standard,
        storageDirectory: URL? = nil,
        bundle: Bundle = .main,
        api: any StudioAPI = StudioAPIClient.live()
    ) {
        let loadedExamples = repository.loadExamples(from: bundle)
        self.defaults = defaults
        self.api = api
        isUITesting = ProcessInfo.processInfo.arguments.contains("--ui-testing-reset")
        examples = loadedExamples
        projects = []

        var storageFailure: Error?
        do {
            projectFiles = try StudioProjectFileStore(directory: storageDirectory)
        } catch {
            projectFiles = nil
            storageFailure = error
        }

        if isUITesting {
            try? projectFiles?.reset()
            defaults.removeObject(forKey: Self.storageKey)
        }

        guard let projectFiles else {
            if let data = defaults.data(forKey: Self.storageKey),
               let legacy = Self.decodeLegacyProjects(data).projects {
                projects = legacy
            } else {
                projects = Self.seedProjects(from: loadedExamples)
            }
            recoveryNotice = "Studio could not open its protected project folder. Your widgets remain in memory, but new changes may not survive a restart. \(storageFailure?.localizedDescription ?? "")"
            return
        }

        do {
            let loaded = try projectFiles.load()
            projects = loaded.projects
            var recoveryMessages: [String] = []
            if loaded.recoveredCount > 0 {
                recoveryMessages.append(
                    "Recovered \(loaded.recoveredCount) widget \(loaded.recoveredCount == 1 ? "from its backup" : "from backups")."
                )
            }
            if loaded.quarantinedCount > loaded.recoveredCount {
                recoveryMessages.append(
                    "Moved \(loaded.quarantinedCount - loaded.recoveredCount) unreadable project \(loaded.quarantinedCount - loaded.recoveredCount == 1 ? "file" : "files") aside without changing your other widgets."
                )
            }

            if let legacyData = defaults.data(forKey: Self.storageKey) {
                let legacy = Self.decodeLegacyProjects(legacyData)
                if let legacyProjects = legacy.projects {
                    let existingIDs = Set(projects.map(\.id))
                    let missing = legacyProjects.filter { !existingIDs.contains($0.id) }
                    for project in missing {
                        try projectFiles.save(project)
                    }
                    projects.append(contentsOf: missing)
                    projects.sort { $0.updatedAt > $1.updatedAt }
                    try projectFiles.markInitialised()
                    if legacy.skippedCount > 0 {
                        try projectFiles.quarantineLegacyLibrary(legacyData)
                    }
                    defaults.removeObject(forKey: Self.storageKey)
                    let detail = legacy.skippedCount > 0
                        ? " \(legacy.skippedCount) unreadable legacy widget \(legacy.skippedCount == 1 ? "was" : "were") placed in a 30-day recovery quarantine without affecting the widgets that could be recovered."
                        : ""
                    recoveryMessages.append("Moved your existing widgets into protected project files.\(detail)")
                } else {
                    recoveryMessages.append(
                        "The previous project library could not be read, so it was preserved unchanged for recovery."
                    )
                }
            } else if !loaded.hadStoredProjects {
                projects = Self.seedProjects(from: loadedExamples)
                for project in projects {
                    try projectFiles.save(project)
                }
                try projectFiles.markInitialised()
            }

            recoveryNotice = recoveryMessages.isEmpty ? nil : recoveryMessages.joined(separator: " ")
        } catch {
            recoveryNotice = "Studio could not safely open all project files. Existing files were left in place. \(error.localizedDescription)"
        }
    }

    func dismissRecoveryNotice() {
        recoveryNotice = nil
    }

    func refreshWorkshopAccess() async {
        if isUITesting {
            workshopAccessState = .ready
            showsWorkshopAccess = false
            return
        }
        if await api.hasDeviceCredential() {
            workshopAccessState = .ready
        } else {
            workshopAccessState = .registrationRequired
            showsWorkshopAccess = true
        }
    }

    func requestWorkshopAccess() {
        showsWorkshopAccess = true
    }

    func dismissWorkshopAccess() {
        guard workshopAccessState == .ready else { return }
        showsWorkshopAccess = false
    }

    func registerWorkshopAccess(_ code: String) async throws {
        let cleaned = code.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        guard cleaned.range(of: #"^[A-Z0-9-]{8,80}$"#, options: .regularExpression) != nil else {
            throw StudioAccessError.invalidAccessCodeFormat
        }
        _ = try await api.registerDevice(accessCode: cleaned)
        workshopAccessState = .ready
        showsWorkshopAccess = false
        notice = "Workshop access active"
    }

    func handleStudioError(_ error: Error) {
        guard let apiError = error as? StudioAPIError,
              case let .server(status, code, _) = apiError,
              status == 401,
              ["DEVICE_REGISTRATION_REQUIRED", "DEVICE_TOKEN_REQUIRED"].contains(code)
        else { return }
        workshopAccessState = .registrationRequired
        showsWorkshopAccess = true
    }

    var selectedProject: WidgetProject? {
        guard let selectedProjectID else { return nil }
        return projects.first(where: { $0.id == selectedProjectID })
            ?? examples.first(where: { $0.id == selectedProjectID })
    }

    func open(_ project: WidgetProject) {
        selectedProjectID = project.id
    }

    func closeEditor() {
        selectedProjectID = nil
    }

    @discardableResult
    func remix(_ example: WidgetProject) -> WidgetProject {
        var project = example
        project.id = "project-\(UUID().uuidString.lowercased())"
        project.spec.id = "widget-\(UUID().uuidString.lowercased())"
        project.spec.metadata.title += " Remix"
        project.isExample = false
        project.updatedAt = .now
        project.revisionNotes = []
        project.remoteDraft = nil
        project.publication = nil
        project.publicationNeedsUpdate = false
        project.needsRemoteSave = true
        project.previousSpec = nil
        projects.insert(project, at: 0)
        persist()
        selectedProjectID = project.id
        return project
    }

    @discardableResult
    func create(from brief: GuidedBriefDraft) -> WidgetProject {
        let identifier = "widget-\(UUID().uuidString.lowercased())"
        let title = conciseTitle(from: brief)
        let instruction: JSONValue = .object([
            "id": .string("instructions"),
            "kind": .string("text"),
            "role": .string("instruction"),
            "text": .string(brief.studentAction)
        ])
        let question: JSONValue = .object([
            "id": .string("starter-question"),
            "kind": .string("choiceQuestion"),
            "prompt": .string(brief.learningObjective),
            "selectionMode": .string("single"),
            "options": .array([
                textOption(id: "a", text: "First possible answer"),
                textOption(id: "b", text: "Second possible answer"),
                textOption(id: "c", text: "I need a hint")
            ]),
            "correctOptionIds": .array([.string("a")]),
            "shuffleOptions": .boolean(false),
            "feedback": .object([
                "correct": .string(brief.feedback),
                "incorrect": .string("Try once more and explain what changed."),
                "explanation": .string("This local first draft is ready for safe AI refinement.")
            ])
        ])
        let spec = WidgetSpec(
            schemaVersion: "1.0",
            id: identifier,
            metadata: WidgetMetadata(
                title: title,
                summary: "\(brief.studentAction). \(brief.classroomFit).",
                subject: inferredSubject(from: brief.learnerContext),
                level: inferredLevel(from: brief.learnerContext),
                learningObjective: brief.learningObjective,
                estimatedMinutes: inferredMinutes(from: brief.classroomFit),
                tags: ["guided-draft"]
            ),
            theme: WidgetTheme(accent: "sage", colourScheme: "light", density: "comfortable"),
            assets: [],
            variables: [],
            screens: [WidgetScreen(id: "main", title: nil, components: [instruction, question])]
        )
        let project = WidgetProject(
            spec: spec,
            family: .quiz,
            updatedAt: .now,
            isExample: false,
            revisionNotes: [],
            needsRemoteSave: true
        )
        projects.insert(project, at: 0)
        persist()
        selectedProjectID = project.id
        return project
    }

    func updateDetails(
        for projectID: String,
        title: String,
        summary: String,
        accent: String,
        density: String
    ) {
        guard let index = projects.firstIndex(where: { $0.id == projectID }) else { return }
        projects[index].spec.metadata.title = title.trimmingCharacters(in: .whitespacesAndNewlines)
        projects[index].spec.metadata.summary = summary.trimmingCharacters(in: .whitespacesAndNewlines)
        projects[index].spec.theme.accent = accent
        projects[index].spec.theme.density = density
        projects[index].updatedAt = .now
        projects[index].needsRemoteSave = true
        projects[index].publicationNeedsUpdate = projects[index].publication != nil
        projects[index].previousSpec = nil
        persist()
    }

    func applyLocalRefinement(_ prompt: String, to projectID: String) {
        let cleanPrompt = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanPrompt.isEmpty,
              let index = projects.firstIndex(where: { $0.id == projectID })
        else { return }

        let lowercased = cleanPrompt.lowercased()
        if lowercased.contains("simpler") {
            projects[index].spec.theme.density = "comfortable"
            if let duration = projects[index].spec.metadata.estimatedMinutes {
                projects[index].spec.metadata.estimatedMinutes = max(2, duration - 2)
            }
        } else if lowercased.contains("challenge") {
            var tags = projects[index].spec.metadata.tags ?? []
            if !tags.contains("increased-challenge") { tags.append("increased-challenge") }
            projects[index].spec.metadata.tags = tags
        } else if lowercased.contains("accessible") {
            var tags = projects[index].spec.metadata.tags ?? []
            if !tags.contains("accessibility-review") { tags.append("accessibility-review") }
            projects[index].spec.metadata.tags = tags
            projects[index].spec.theme.density = "comfortable"
        }

        projects[index].revisionNotes.insert(
            RevisionNote(id: UUID(), prompt: cleanPrompt, createdAt: .now),
            at: 0
        )
        projects[index].updatedAt = .now
        projects[index].needsRemoteSave = true
        projects[index].publicationNeedsUpdate = projects[index].publication != nil
        projects[index].previousSpec = nil
        notice = "Revision saved locally"
        persist()
    }

    @discardableResult
    func createApprovedBrief(_ brief: GuidedBriefDraft) async throws -> WidgetProject {
        if isUITesting { return create(from: brief) }
        let remote = try await api.generate(from: brief)
        let project = WidgetProject(
            spec: remote.spec,
            family: family(for: remote.spec),
            updatedAt: .now,
            isExample: false,
            revisionNotes: [],
            remoteDraft: remote.reference,
            publication: nil,
            needsRemoteSave: false
        )
        projects.insert(project, at: 0)
        do {
            try persistProjectOrThrow(project.id)
        } catch {
            projects.removeAll(where: { $0.id == project.id })
            try? await api.deleteDraft(draftID: remote.id)
            throw error
        }
        selectedProjectID = project.id
        notice = "First draft created"
        return project
    }

    func refine(_ prompt: String, projectID: String) async throws {
        try beginRemoteOperation(projectID)
        defer { finishRemoteOperation(projectID) }
        let cleanPrompt = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanPrompt.isEmpty else { return }
        let remote = try await ensureRemote(projectID: projectID)
        let baseSpec = try currentProject(projectID).spec
        let revised: RemoteDraft
        do {
            revised = try await patchWithRecovery(
                draft: remote,
                baseSpec: baseSpec,
                instruction: cleanPrompt
            )
        } catch PatchReconciliationError.remoteChanged(let latest) {
            try apply(latest, to: projectID, replacing: baseSpec)
            notice = "Restored the latest server revision"
            throw StudioStoreError.remoteRevisionRestored
        }
        guard let index = projects.firstIndex(where: { $0.id == projectID }) else { return }
        guard projects[index].spec == baseSpec else {
            let local = projects[index]
            try preserveConcurrentVersions(local: local, remote: revised)
            throw StudioStoreError.remoteSaveConflict
        }
        projects[index].spec = revised.spec
        projects[index].family = family(for: revised.spec)
        projects[index].previousSpec = baseSpec
        projects[index].remoteDraft = revised.reference
        projects[index].needsRemoteSave = false
        projects[index].publicationNeedsUpdate = projects[index].publication != nil
        projects[index].updatedAt = .now
        projects[index].revisionNotes.insert(
            RevisionNote(id: UUID(), prompt: cleanPrompt, createdAt: .now),
            at: 0
        )
        try persistProjectOrThrow(projectID)
        notice = "Preview updated"
    }

    func undoLastGeneratedChange(projectID: String) async throws {
        try beginRemoteOperation(projectID)
        defer { finishRemoteOperation(projectID) }
        guard let index = projects.firstIndex(where: { $0.id == projectID }),
              let previous = projects[index].previousSpec
        else { return }
        projects[index].spec = previous
        projects[index].family = family(for: previous)
        projects[index].needsRemoteSave = true
        projects[index].publicationNeedsUpdate = projects[index].publication != nil
        projects[index].previousSpec = nil
        projects[index].updatedAt = .now
        projects[index].revisionNotes.insert(
            RevisionNote(id: UUID(), prompt: "Undo previous generated change", createdAt: .now),
            at: 0
        )
        try persistProjectOrThrow(projectID)
        _ = try await ensureRemote(projectID: projectID, note: "Undo generated change")
        notice = "Previous version restored"
    }

    func saveDirectEdits(projectID: String, note: String = "Direct edit") async throws {
        try beginRemoteOperation(projectID)
        defer { finishRemoteOperation(projectID) }
        _ = try await ensureRemote(projectID: projectID, note: note)
        notice = "Changes saved"
    }

    func addImage(
        _ input: Data,
        alternativeText: String,
        decorative: Bool,
        projectID: String
    ) async throws {
        try beginRemoteOperation(projectID)
        defer { finishRemoteOperation(projectID) }
        guard let current = projects.first(where: { $0.id == projectID }) else {
            throw StudioStoreError.projectUnavailable
        }
        guard current.spec.assets.count < 3 else { throw WidgetImageError.limitReached }
        let cleanDescription = alternativeText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard decorative || !cleanDescription.isEmpty else {
            throw WidgetImageError.descriptionRequired
        }

        let prepared = try await Task.detached(priority: .userInitiated) {
            try WidgetImageProcessor.prepare(input)
        }.value
        let uploaded = try await api.uploadImage(
            prepared,
            alternativeText: cleanDescription.isEmpty ? nil : cleanDescription,
            decorative: decorative
        )
        let localFile = try LocalWidgetAssetStorage.store(prepared, id: uploaded.asset.id)

        guard let index = projects.firstIndex(where: { $0.id == projectID }) else {
            LocalWidgetAssetStorage.remove(localFile)
            throw StudioStoreError.projectUnavailable
        }
        guard projects[index].spec.assets.count < 3 else {
            LocalWidgetAssetStorage.remove(localFile)
            throw WidgetImageError.limitReached
        }
        projects[index].spec.assets.append(uploaded.asset.jsonValue)
        let imageComponent: JSONValue = .object([
            "id": .string("image-\(uploaded.asset.id.dropFirst(6))"),
            "kind": .string("image"),
            "assetId": .string(uploaded.asset.id),
            "altText": .string(cleanDescription),
            "decorative": .boolean(decorative),
            "fit": .string("contain")
        ])
        if projects[index].spec.screens.isEmpty {
            projects[index].spec.screens = [WidgetScreen(id: "main", title: nil, components: [imageComponent])]
        } else {
            projects[index].spec.screens[0].components.append(imageComponent)
        }
        projects[index].localAssets.removeAll(where: { $0.id == localFile.id })
        projects[index].localAssets.append(localFile)
        projects[index].updatedAt = .now
        projects[index].needsRemoteSave = true
        projects[index].publicationNeedsUpdate = projects[index].publication != nil
        projects[index].previousSpec = nil
        try persistProjectOrThrow(projectID)

        _ = try await ensureRemote(projectID: projectID, note: "Add classroom image")
        notice = "Image added"
    }

    func removeImage(assetID: String, projectID: String) {
        guard !activeRemoteProjectIDs.contains(projectID) else {
            errorMessage = "Wait for the current Studio update before removing this image."
            return
        }
        guard let index = projects.firstIndex(where: { $0.id == projectID }) else { return }
        projects[index].spec.assets.removeAll(where: { jsonID($0) == assetID })
        for screenIndex in projects[index].spec.screens.indices {
            projects[index].spec.screens[screenIndex].components.removeAll(where: {
                referencesAsset($0, assetID: assetID)
            })
        }
        projects[index].updatedAt = .now
        projects[index].needsRemoteSave = true
        projects[index].publicationNeedsUpdate = projects[index].publication != nil
        projects[index].previousSpec = nil
        persist()
        notice = "Image removed from this widget"
    }

    func discardLocalAsset(assetID: String, projectID: String) {
        guard let index = projects.firstIndex(where: { $0.id == projectID }),
              let asset = projects[index].localAssets.first(where: { $0.id == assetID })
        else { return }
        let usedElsewhere = projects.contains {
            $0.id != projectID && $0.localAssets.contains(where: { $0.id == assetID })
        }
        if !usedElsewhere { LocalWidgetAssetStorage.remove(asset) }
        projects[index].localAssets.removeAll(where: { $0.id == assetID })
        persist()
    }

    @discardableResult
    func publish(projectID: String) async throws -> WidgetPublication {
        guard let project = projects.first(where: { $0.id == projectID }) else {
            throw StudioStoreError.projectUnavailable
        }
        let readiness = WidgetPublishReadiness.audit(project.spec)
        guard readiness.isReady else {
            throw StudioStoreError.publishReadinessFailed(readiness.blockerMessage)
        }
        try beginRemoteOperation(projectID)
        defer { finishRemoteOperation(projectID) }
        let remote = try await ensureRemote(projectID: projectID, note: "Prepare for publishing")
        let projectBeforePublishing = try currentProject(projectID)
        let publication = try await api.publish(draftID: remote.id)
        guard let index = projects.firstIndex(where: { $0.id == projectID }) else {
            if projectBeforePublishing.publication == nil {
                try? await api.revoke(slug: publication.slug)
            }
            throw StudioStoreError.projectUnavailable
        }
        projects[index].publication = publication
        projects[index].publicationNeedsUpdate = projects[index].spec != projectBeforePublishing.spec
            || projects[index].remoteDraft != projectBeforePublishing.remoteDraft
        do {
            try persistProjectOrThrow(projectID)
        } catch {
            if projectBeforePublishing.publication == nil {
                try? await api.revoke(slug: publication.slug)
                projects[index].publication = nil
                projects[index].publicationNeedsUpdate = projectBeforePublishing.publicationNeedsUpdate
            }
            throw error
        }
        notice = "Student link ready"
        return publication
    }

    func unpublish(projectID: String) async throws {
        try beginRemoteOperation(projectID)
        defer { finishRemoteOperation(projectID) }
        guard let publication = projects.first(where: { $0.id == projectID })?.publication
        else { return }
        do {
            try await api.revoke(slug: publication.slug)
        } catch let error as StudioAPIError {
            guard error.isServerError(status: 404, code: "PUBLICATION_NOT_FOUND") else {
                throw error
            }
        }
        guard let currentIndex = projects.firstIndex(where: { $0.id == projectID }) else {
            throw StudioStoreError.projectUnavailable
        }
        projects[currentIndex].publication = nil
        projects[currentIndex].publicationNeedsUpdate = false
        try persistProjectOrThrow(projectID)
        notice = "Widget unpublished"
    }

    @discardableResult
    func extendPublication(projectID: String, days: Int = 90) async throws -> WidgetPublication {
        try beginRemoteOperation(projectID)
        defer { finishRemoteOperation(projectID) }
        guard let publication = projects.first(where: { $0.id == projectID })?.publication else {
            throw StudioStoreError.projectUnavailable
        }
        let extended = try await api.extend(slug: publication.slug, days: days)
        guard let currentIndex = projects.firstIndex(where: { $0.id == projectID }) else {
            throw StudioStoreError.projectUnavailable
        }
        projects[currentIndex].publication = extended
        try persistProjectOrThrow(projectID)
        notice = "Student link extended"
        return extended
    }

    func deleteProject(projectID: String) async throws {
        try beginRemoteOperation(projectID)
        defer { finishRemoteOperation(projectID) }
        guard let project = projects.first(where: { $0.id == projectID }) else { return }
        if let remoteDraft = project.remoteDraft {
            do {
                try await api.deleteDraft(draftID: remoteDraft.id)
            } catch let error as StudioAPIError {
                if error.isServerError(status: 404, code: "DRAFT_NOT_FOUND") {
                    throw StudioStoreError.remoteDeletionUnverified
                }
                throw error
            }
        }
        try removeLocalProject(try currentProject(projectID))
        notice = "Widget deleted everywhere"
    }

    func deleteLocalProject(projectID: String) throws {
        guard !activeRemoteProjectIDs.contains(projectID) else {
            throw StudioStoreError.operationInProgress
        }
        guard let project = projects.first(where: { $0.id == projectID }) else { return }
        try removeLocalProject(project)
        notice = "Removed from this iPad only; the server copy was not changed"
    }

    @discardableResult
    func restoreFromStudio() async throws -> Int {
        guard !isRestoringFromStudio, activeRemoteProjectIDs.isEmpty else {
            throw StudioStoreError.operationInProgress
        }
        isRestoringFromStudio = true
        defer { isRestoringFromStudio = false }

        let summaries = try await api.listDrafts()
        var addedCount = 0
        var conflictCount = 0
        var processedIDs: Set<String> = []

        for summary in summaries where processedIDs.insert(summary.id).inserted {
            let remote: RemoteDraft
            do {
                remote = try await api.fetchDraft(draftID: summary.id)
            } catch let error as StudioAPIError {
                if error.isServerError(status: 404, code: "DRAFT_NOT_FOUND") { continue }
                throw error
            }

            let restoredAssets: [LocalWidgetAssetFile]
            do {
                restoredAssets = try await restoreLocalAssets(for: remote.spec)
            } catch {
                throw StudioStoreError.assetRestoreFailed(
                    "Studio could not restore the images in \(remote.title). Nothing in the local widget was changed. \(error.localizedDescription)"
                )
            }

            if let index = projects.firstIndex(where: { $0.remoteDraft?.id == summary.id }) {
                let local = projects[index]
                if local.needsRemoteSave,
                   summary.version > (local.remoteDraft?.version ?? 0),
                   local.spec != remote.spec {
                    try preserveConcurrentVersions(
                        local: local,
                        remote: remote,
                        selectLocalCopy: false,
                        remoteAssets: restoredAssets
                    )
                    conflictCount += 1
                } else if !local.needsRemoteSave || local.spec == remote.spec {
                    projects[index].spec = remote.spec
                    projects[index].family = family(for: remote.spec)
                    projects[index].remoteDraft = remote.reference
                    projects[index].publication = summary.publication
                    projects[index].localAssets = restoredAssets
                    projects[index].publicationNeedsUpdate = false
                    projects[index].needsRemoteSave = false
                    projects[index].previousSpec = nil
                    projects[index].updatedAt = Self.date(from: remote.updatedAt) ?? .now
                    try persistProjectOrThrow(local.id)
                } else {
                    projects[index].publication = summary.publication
                    try persistProjectOrThrow(local.id)
                }
                continue
            }

            let restored = WidgetProject(
                spec: remote.spec,
                family: family(for: remote.spec),
                updatedAt: Self.date(from: remote.updatedAt) ?? .now,
                isExample: false,
                revisionNotes: [],
                remoteDraft: remote.reference,
                publication: summary.publication,
                localAssets: restoredAssets,
                publicationNeedsUpdate: false,
                needsRemoteSave: false
            )
            projects.insert(restored, at: 0)
            try persistProjectOrThrow(restored.id)
            addedCount += 1
        }

        projects.sort { $0.updatedAt > $1.updatedAt }
        if conflictCount > 0 {
            notice = "Restored \(addedCount) missing \(addedCount == 1 ? "widget" : "widgets") and kept \(conflictCount) conflicting local \(conflictCount == 1 ? "copy" : "copies")."
        } else if addedCount > 0 {
            notice = "Restored \(addedCount) \(addedCount == 1 ? "widget" : "widgets") from Studio"
        } else {
            notice = "All Studio widgets are already on this iPad"
        }
        return addedCount
    }

    private func removeLocalProject(_ project: WidgetProject) throws {
        let projectID = project.id
        try projectFiles?.delete(projectID: projectID)
        for asset in project.localAssets {
            let usedElsewhere = projects.contains {
                $0.id != projectID && $0.localAssets.contains(where: { $0.id == asset.id })
            }
            if !usedElsewhere { LocalWidgetAssetStorage.remove(asset) }
        }
        projects.removeAll(where: { $0.id == projectID })
        if selectedProjectID == projectID { selectedProjectID = nil }
    }

    private func ensureRemote(
        projectID: String,
        note: String = "Synchronise local edits",
        reconciliationAttempt: Int = 0
    ) async throws -> RemoteDraftReference {
        guard let initialIndex = projects.firstIndex(where: { $0.id == projectID }) else {
            throw StudioStoreError.projectUnavailable
        }
        let snapshot = projects[initialIndex]

        let remote: RemoteDraft
        if let existing = snapshot.remoteDraft {
            if snapshot.needsRemoteSave {
                remote = try await saveWithRecovery(snapshot: snapshot, note: note)
            } else {
                do {
                    remote = try await api.fetchDraft(draftID: existing.id)
                } catch let error as StudioAPIError {
                    guard error.isServerError(status: 404, code: "DRAFT_NOT_FOUND") else {
                        throw error
                    }
                    remote = try await api.importDraft(spec: snapshot.spec)
                    notice = "The expired server draft was safely recreated"
                }
            }
        } else {
            remote = try await api.importDraft(spec: snapshot.spec)
        }

        try apply(remote, to: projectID, replacing: snapshot.spec)
        let current = try currentProject(projectID)
        if current.needsRemoteSave, current.spec != snapshot.spec {
            guard reconciliationAttempt < 2 else {
                throw StudioStoreError.localEditsChangedDuringUpdate
            }
            return try await ensureRemote(
                projectID: projectID,
                note: note,
                reconciliationAttempt: reconciliationAttempt + 1
            )
        }
        return current.remoteDraft ?? remote.reference
    }

    private func saveWithRecovery(snapshot: WidgetProject, note: String) async throws -> RemoteDraft {
        guard let existing = snapshot.remoteDraft else {
            return try await api.importDraft(spec: snapshot.spec)
        }
        do {
            return try await api.save(
                draftID: existing.id,
                version: existing.version,
                spec: snapshot.spec,
                note: note
            )
        } catch let original as StudioAPIError {
            if original.isServerError(status: 404, code: "DRAFT_NOT_FOUND") {
                notice = "The expired server draft was safely recreated"
                return try await api.importDraft(spec: snapshot.spec)
            }
            guard original.needsMutationReconciliation else { throw original }
            let definiteConflict = original.isServerError(
                status: 409,
                code: "DRAFT_VERSION_CONFLICT"
            )

            let latest: RemoteDraft
            do {
                latest = try await api.fetchDraft(draftID: existing.id)
            } catch let fetchError as StudioAPIError {
                if fetchError.isServerError(status: 404, code: "DRAFT_NOT_FOUND") {
                    notice = "The expired server draft was safely recreated"
                    return try await api.importDraft(spec: snapshot.spec)
                }
                throw original
            }

            // The server committed the PUT but its response did not reach us.
            if latest.spec == snapshot.spec {
                return latest
            }

            if definiteConflict || latest.version > existing.version {
                try preserveConcurrentVersions(
                    local: try currentProject(snapshot.id),
                    remote: latest
                )
                throw StudioStoreError.remoteSaveConflict
            }

            do {
                return try await api.save(
                    draftID: latest.id,
                    version: latest.version,
                    spec: snapshot.spec,
                    note: note
                )
            } catch let retryError as StudioAPIError {
                guard retryError.needsMutationReconciliation else { throw retryError }
                let reconciled = try await api.fetchDraft(draftID: latest.id)
                if reconciled.spec == snapshot.spec { return reconciled }
                try preserveConcurrentVersions(
                    local: try currentProject(snapshot.id),
                    remote: reconciled
                )
                throw StudioStoreError.remoteSaveConflict
            }
        }
    }

    private func patchWithRecovery(
        draft: RemoteDraftReference,
        baseSpec: WidgetSpec,
        instruction: String
    ) async throws -> RemoteDraft {
        do {
            return try await api.patch(
                draftID: draft.id,
                version: draft.version,
                instruction: instruction
            )
        } catch let original as StudioAPIError {
            if original.isServerError(status: 404, code: "DRAFT_NOT_FOUND") {
                let recreated = try await api.importDraft(spec: baseSpec)
                return try await api.patch(
                    draftID: recreated.id,
                    version: recreated.version,
                    instruction: instruction
                )
            }

            if original.isServerError(status: 409, code: "DRAFT_VERSION_CONFLICT") {
                let latest = try await api.fetchDraft(draftID: draft.id)
                throw PatchReconciliationError.remoteChanged(latest)
            }
            guard original.isAmbiguousCommit else { throw original }

            let latest = try await api.fetchDraft(draftID: draft.id)
            if latest.version > draft.version {
                // The model patch committed once; use that exact revision rather
                // than issuing the same natural-language instruction twice.
                return latest
            }

            do {
                return try await api.patch(
                    draftID: latest.id,
                    version: latest.version,
                    instruction: instruction
                )
            } catch let retryError as StudioAPIError {
                if retryError.isServerError(status: 409, code: "DRAFT_VERSION_CONFLICT") {
                    throw PatchReconciliationError.remoteChanged(
                        try await api.fetchDraft(draftID: latest.id)
                    )
                }
                guard retryError.isAmbiguousCommit else { throw retryError }
                let reconciled = try await api.fetchDraft(draftID: latest.id)
                if reconciled.version > latest.version { return reconciled }
                throw retryError
            }
        }
    }

    private func currentProject(_ projectID: String) throws -> WidgetProject {
        guard let project = projects.first(where: { $0.id == projectID }) else {
            throw StudioStoreError.projectUnavailable
        }
        return project
    }

    private func beginRemoteOperation(_ projectID: String) throws {
        guard !activeRemoteProjectIDs.contains(projectID) else {
            throw StudioStoreError.operationInProgress
        }
        activeRemoteProjectIDs.insert(projectID)
    }

    private func finishRemoteOperation(_ projectID: String) {
        activeRemoteProjectIDs.remove(projectID)
    }

    private func apply(_ remote: RemoteDraft, to projectID: String, replacing baseSpec: WidgetSpec) throws {
        guard let index = projects.firstIndex(where: { $0.id == projectID }) else { return }
        let changedWhileWaiting = projects[index].spec != baseSpec
        if changedWhileWaiting, remote.spec != baseSpec {
            try preserveConcurrentVersions(local: projects[index], remote: remote)
            throw StudioStoreError.remoteSaveConflict
        }
        projects[index].remoteDraft = remote.reference
        if changedWhileWaiting {
            projects[index].needsRemoteSave = true
        } else {
            if projects[index].spec != remote.spec {
                projects[index].previousSpec = nil
            }
            projects[index].spec = remote.spec
            projects[index].needsRemoteSave = false
            projects[index].updatedAt = .now
        }
        try persistProjectOrThrow(projectID)
    }

    private func preserveConcurrentVersions(
        local: WidgetProject,
        remote: RemoteDraft,
        selectLocalCopy: Bool = true,
        remoteAssets: [LocalWidgetAssetFile]? = nil
    ) throws {
        guard let index = projects.firstIndex(where: { $0.id == local.id }) else { return }
        var localCopy = local
        localCopy.id = "project-\(UUID().uuidString.lowercased())"
        localCopy.spec.id = "widget-\(UUID().uuidString.lowercased())"
        localCopy.spec.metadata.title += " Local Copy"
        localCopy.remoteDraft = nil
        localCopy.publication = nil
        localCopy.publicationNeedsUpdate = false
        localCopy.needsRemoteSave = true
        localCopy.updatedAt = .now

        projects[index].spec = remote.spec
        projects[index].family = family(for: remote.spec)
        projects[index].remoteDraft = remote.reference
        if let remoteAssets { projects[index].localAssets = remoteAssets }
        projects[index].needsRemoteSave = false
        projects[index].previousSpec = nil
        projects[index].updatedAt = .now
        projects.insert(localCopy, at: index)
        if selectLocalCopy { selectedProjectID = localCopy.id }
        try persistOrThrow()
        notice = "Kept both versions; your edits are in Local Copy"
    }

    private func persistOrThrow() throws {
        guard let projectFiles else {
            throw StudioPersistenceError.projectFolderUnavailable
        }
        for project in projects {
            try projectFiles.save(project)
        }
        try projectFiles.markInitialised()
    }

    private func persistProjectOrThrow(_ projectID: String) throws {
        guard let projectFiles else {
            throw StudioPersistenceError.projectFolderUnavailable
        }
        guard let project = projects.first(where: { $0.id == projectID }) else {
            throw StudioStoreError.projectUnavailable
        }
        try projectFiles.save(project)
    }

    private func persist() {
        do {
            try persistOrThrow()
        } catch {
            errorMessage = "Studio could not safely save one of your widgets: \(error.localizedDescription)"
            recoveryNotice = errorMessage
        }
    }

    private struct LegacyDecodeResult {
        let projects: [WidgetProject]?
        let skippedCount: Int
    }

    private static func decodeLegacyProjects(_ data: Data) -> LegacyDecodeResult {
        if let stored = try? JSONDecoder().decode(StoredProjects.self, from: data),
           stored.version == 1 {
            return LegacyDecodeResult(projects: stored.projects, skippedCount: 0)
        }

        guard let envelope = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              (envelope["version"] as? NSNumber)?.intValue == 1,
              let rawProjects = envelope["projects"] as? [Any]
        else {
            return LegacyDecodeResult(projects: nil, skippedCount: 0)
        }

        var projects: [WidgetProject] = []
        var skippedCount = 0
        for rawProject in rawProjects {
            guard JSONSerialization.isValidJSONObject(rawProject),
                  let projectData = try? JSONSerialization.data(withJSONObject: rawProject),
                  let project = try? JSONDecoder().decode(WidgetProject.self, from: projectData)
            else {
                skippedCount += 1
                continue
            }
            projects.append(project)
        }
        return LegacyDecodeResult(projects: projects, skippedCount: skippedCount)
    }

    private static func date(from value: String) -> Date? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return fractional.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    }

    private static func seedProjects(from examples: [WidgetProject]) -> [WidgetProject] {
        examples.prefix(2).enumerated().map { index, example in
            var project = example
            project.id = "project-\(UUID().uuidString.lowercased())"
            project.spec.id = "starter-\(index + 1)"
            project.isExample = false
            project.updatedAt = .now.addingTimeInterval(TimeInterval(-index * 3600))
            return project
        }
    }

    private func conciseTitle(from brief: GuidedBriefDraft) -> String {
        let objective = brief.learningObjective.trimmingCharacters(in: .whitespacesAndNewlines)
        let words = objective.split(separator: " ").prefix(6)
        return words.isEmpty ? "New Classroom Widget" : words.joined(separator: " ")
    }

    private func inferredSubject(from learnerContext: String) -> String {
        let value = learnerContext.lowercased()
        if value.contains("math") { return "mathematics" }
        if value.contains("science") || value.contains("physics") || value.contains("chem") || value.contains("bio") { return "science" }
        if value.contains("english") { return "english" }
        if value.contains("history") || value.contains("geography") || value.contains("humanities") { return "humanities" }
        if value.contains("language") || value.contains("chinese") || value.contains("malay") || value.contains("tamil") { return "languages" }
        return "other"
    }

    private func inferredLevel(from learnerContext: String) -> String {
        learnerContext.lowercased().contains("primary") ? "upper-primary" : "secondary"
    }

    private func inferredMinutes(from classroomFit: String) -> Int? {
        classroomFit.split(whereSeparator: { !$0.isNumber }).compactMap { Int($0) }.first
    }

    private func family(for spec: WidgetSpec) -> WidgetFamily {
        let kinds = spec.screens.flatMap(\.components).compactMap { component -> String? in
            guard case let .object(value) = component,
                  case let .string(kind)? = value["kind"]
            else { return nil }
            return kind
        }
        if kinds.contains("plot") || kinds.contains("numberControl") { return .simulation }
        if kinds.contains("hotspots") { return .diagram }
        if kinds.contains("matching") || kinds.contains("sorting") || kinds.contains("sequencing") {
            return .matching
        }
        if !Set(kinds).isDisjoint(with: ["timer", "randomiser", "taskList", "trafficLight"]) {
            return .classroomTool
        }
        return .quiz
    }

    private func textOption(id: String, text: String) -> JSONValue {
        .object([
            "id": .string(id),
            "content": .object(["kind": .string("text"), "text": .string(text)])
        ])
    }

    private func jsonID(_ value: JSONValue) -> String? {
        guard case let .object(object) = value,
              case let .string(id)? = object["id"]
        else { return nil }
        return id
    }

    private func referencesAsset(_ value: JSONValue, assetID: String) -> Bool {
        switch value {
        case let .object(object):
            if case let .string(id)? = object["assetId"], id == assetID { return true }
            if case let .string(id)? = object["imageAssetId"], id == assetID { return true }
            return object.values.contains(where: { referencesAsset($0, assetID: assetID) })
        case let .array(values):
            return values.contains(where: { referencesAsset($0, assetID: assetID) })
        case .string, .integer, .number, .boolean, .null:
            return false
        }
    }

    private func restoreLocalAssets(for spec: WidgetSpec) async throws -> [LocalWidgetAssetFile] {
        var records: [WidgetImageAssetRecord] = []
        var seen: Set<String> = []
        for value in spec.assets {
            guard case let .object(object) = value,
                  case let .string(kind)? = object["kind"],
                  kind == "image"
            else { continue }
            let data = try JSONEncoder().encode(value)
            let record = try JSONDecoder().decode(WidgetImageAssetRecord.self, from: data)
            if seen.insert(record.id).inserted { records.append(record) }
        }

        let knownFiles = Dictionary(
            projects.flatMap(\.localAssets).map { ($0.id, $0) },
            uniquingKeysWith: { first, _ in first }
        )
        var restored: [LocalWidgetAssetFile] = []
        var created: [LocalWidgetAssetFile] = []
        do {
            for record in records {
                if let existing = knownFiles[record.id],
                   existing.mediaType.lowercased() == record.mediaType.lowercased(),
                   let existingURL = LocalWidgetAssetStorage.url(for: existing),
                   let existingData = try? Data(contentsOf: existingURL),
                   (try? record.validated(
                       DownloadedWidgetAsset(data: existingData, mediaType: existing.mediaType)
                   )) != nil {
                    restored.append(existing)
                    continue
                }
                let downloaded = try await api.downloadAsset(id: record.id)
                let validated = try record.validated(downloaded)
                let local = try LocalWidgetAssetStorage.store(validated, id: record.id)
                created.append(local)
                restored.append(local)
            }
            return restored
        } catch {
            for asset in created { LocalWidgetAssetStorage.remove(asset) }
            throw error
        }
    }
}

enum StudioStoreError: LocalizedError {
    case projectUnavailable
    case remoteRevisionRestored
    case localEditsChangedDuringUpdate
    case remoteDeletionUnverified
    case remoteSaveConflict
    case operationInProgress
    case publishReadinessFailed(String)
    case assetRestoreFailed(String)

    var errorDescription: String? {
        switch self {
        case .projectUnavailable:
            "This widget is no longer available on this iPad."
        case .remoteRevisionRestored:
            "Studio restored a newer server revision. Check the preview, then ask for your change again."
        case .localEditsChangedDuringUpdate:
            "Your local edits were kept, but the generated revision was not applied. Save those edits, then try the prompt again."
        case .remoteDeletionUnverified:
            "Studio could not verify that the server copy and student link were deleted, so the widget remains on this iPad. Try again when you are connected."
        case .remoteSaveConflict:
            "This widget also changed on another restored iPad. Studio kept your edits as a separate Local Copy and restored the server version alongside it."
        case .operationInProgress:
            "Wait for the current Studio update to finish before starting another one."
        case let .publishReadinessFailed(message), let .assetRestoreFailed(message):
            message
        }
    }
}

private enum PatchReconciliationError: Error {
    case remoteChanged(RemoteDraft)
}

private enum StudioPersistenceError: LocalizedError {
    case projectFolderUnavailable

    var errorDescription: String? {
        "Studio's protected project folder is unavailable."
    }
}

private enum StudioAccessError: LocalizedError {
    case invalidAccessCodeFormat

    var errorDescription: String? {
        "Enter the 8-character or longer access code provided by your workshop facilitator."
    }
}

private extension StudioAPIError {
    func isServerError(status expectedStatus: Int, code expectedCode: String) -> Bool {
        guard case let .server(status, code, _) = self else { return false }
        return status == expectedStatus && code == expectedCode
    }

    var isAmbiguousCommit: Bool {
        switch self {
        case .transport, .decoding, .invalidResponse:
            true
        case .invalidURL, .deviceTokenUnavailable, .deviceRegistrationRequired, .server:
            false
        }
    }

    var needsMutationReconciliation: Bool {
        isAmbiguousCommit || isServerError(status: 409, code: "DRAFT_VERSION_CONFLICT")
    }
}
