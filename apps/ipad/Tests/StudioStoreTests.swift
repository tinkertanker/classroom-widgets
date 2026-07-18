import CryptoKit
import XCTest
@testable import ClassroomWidgetsStudio

final class StudioStoreTests: XCTestCase {
    @MainActor
    func testGuidedBriefCreatesAFrontEndOnlyDraftAndPersistsIt() throws {
        let (suiteName, defaults) = makeDefaults()
        let storage = makeStorageDirectory()
        defer { cleanUp(suiteName: suiteName, defaults: defaults, storage: storage) }
        let store = StudioStore(defaults: defaults, storageDirectory: storage, bundle: Bundle(for: StudioStore.self))
        let initialCount = store.projects.count
        var brief = GuidedBriefDraft()
        brief.learnerContext = "Secondary 3 Physics"
        brief.learningObjective = "Explain how launch angle changes range"
        brief.studentAction = "Move a slider, predict, then compare"
        brief.sourceContent = "Use Earth gravity"
        brief.feedback = "Explain why the prediction is close"
        brief.classroomFit = "Eight minutes in pairs"

        let project = store.create(from: brief)

        XCTAssertEqual(store.projects.count, initialCount + 1)
        XCTAssertEqual(project.spec.schemaVersion, "1.0")
        XCTAssertTrue(project.spec.assets.isEmpty)
        XCTAssertEqual(project.spec.metadata.subject, "science")
        XCTAssertFalse(project.spec.prettyPrintedJSON().contains("http"))

        let restored = StudioStore(defaults: defaults, storageDirectory: storage, bundle: Bundle(for: StudioStore.self))
        XCTAssertNotNil(restored.projects.first(where: { $0.id == project.id }))
    }

    @MainActor
    func testRemixNeverMutatesTheCuratedExample() throws {
        let (suiteName, defaults) = makeDefaults()
        let storage = makeStorageDirectory()
        defer { cleanUp(suiteName: suiteName, defaults: defaults, storage: storage) }
        let store = StudioStore(defaults: defaults, storageDirectory: storage, bundle: Bundle(for: StudioStore.self))
        let example = try XCTUnwrap(store.examples.first)

        let remix = store.remix(example)

        XCTAssertNotEqual(remix.id, example.id)
        XCTAssertEqual(store.examples.first?.id, example.id)
        XCTAssertFalse(remix.isExample)
        XCTAssertTrue(remix.spec.metadata.title.hasSuffix("Remix"))
    }

    @MainActor
    func testRemoteCreateRefinePublishAndUnpublishFlow() async throws {
        let (suiteName, defaults) = makeDefaults()
        let storage = makeStorageDirectory()
        defer { cleanUp(suiteName: suiteName, defaults: defaults, storage: storage) }
        let fixtureStore = StudioStore(defaults: defaults, storageDirectory: storage, bundle: Bundle(for: StudioStore.self))
        var generatedSpec = try XCTUnwrap(fixtureStore.examples.first).spec
        generatedSpec.id = "widget-from-service"
        defaults.removePersistentDomain(forName: suiteName)
        try FileManager.default.removeItem(at: storage)

        let api = RecordingStudioAPI(spec: generatedSpec)
        let store = StudioStore(
            defaults: defaults,
            storageDirectory: storage,
            bundle: Bundle(for: StudioStore.self),
            api: api
        )
        var brief = GuidedBriefDraft()
        brief.learnerContext = "Secondary 2 Science"
        brief.learningObjective = "Explain balanced forces"
        brief.studentAction = "Choose the force diagram that is balanced"
        brief.feedback = "Compare the size and direction of each force"
        brief.classroomFit = "Six minutes individually"

        let created = try await store.createApprovedBrief(brief)
        XCTAssertEqual(created.remoteDraft, RemoteDraftReference(id: "draft-1", version: 1))
        XCTAssertFalse(created.needsRemoteSave)

        try await store.refine("Use a bus-stop example", projectID: created.id)
        let refined = try XCTUnwrap(store.projects.first(where: { $0.id == created.id }))
        XCTAssertEqual(refined.remoteDraft?.version, 2)
        XCTAssertEqual(refined.revisionNotes.first?.prompt, "Use a bus-stop example")

        let publication = try await store.publish(projectID: created.id)
        XCTAssertEqual(publication.slug, "student-link")
        XCTAssertEqual(store.projects.first(where: { $0.id == created.id })?.publication, publication)

        let extended = try await store.extendPublication(projectID: created.id)
        XCTAssertEqual(extended.expiresAt, "2027-01-16T12:00:00.000Z")
        XCTAssertEqual(store.projects.first(where: { $0.id == created.id })?.publication, extended)

        try await store.unpublish(projectID: created.id)
        XCTAssertNil(store.projects.first(where: { $0.id == created.id })?.publication)
        let calls = await api.recordedCalls()
        XCTAssertEqual(
            calls,
            [
                "generate",
                "fetch:draft-1",
                "patch:draft-1:1",
                "fetch:draft-1",
                "publish:draft-1",
                "extend:student-link:90",
                "revoke:student-link"
            ]
        )
    }

    @MainActor
    func testProjectsSavedBeforeRemoteFieldsStillDecode() throws {
        let (suiteName, defaults) = makeDefaults()
        let seedStorage = makeStorageDirectory()
        let storage = makeStorageDirectory()
        defer {
            cleanUp(suiteName: suiteName, defaults: defaults, storage: storage)
            try? FileManager.default.removeItem(at: seedStorage)
        }
        let seed = StudioStore(defaults: defaults, storageDirectory: seedStorage, bundle: Bundle(for: StudioStore.self))
        let project = try XCTUnwrap(seed.projects.first)
        var object = try XCTUnwrap(
            JSONSerialization.jsonObject(with: JSONEncoder().encode(project)) as? [String: Any]
        )
        object.removeValue(forKey: "remoteDraft")
        object.removeValue(forKey: "publication")
        object.removeValue(forKey: "needsRemoteSave")
        let legacyEnvelope: [String: Any] = ["version": 1, "projects": [object]]
        defaults.set(try JSONSerialization.data(withJSONObject: legacyEnvelope), forKey: "classroom-widgets-studio-projects-v1")

        let restored = StudioStore(defaults: defaults, storageDirectory: storage, bundle: Bundle(for: StudioStore.self))

        XCTAssertEqual(restored.projects.first?.id, project.id)
        XCTAssertFalse(try XCTUnwrap(restored.projects.first).needsRemoteSave)
        XCTAssertNil(defaults.data(forKey: "classroom-widgets-studio-projects-v1"))
        XCTAssertNotNil(restored.recoveryNotice)
    }

    @MainActor
    func testCorruptProjectRecoversFromItsOwnBackupWithoutAffectingOthers() throws {
        let (suiteName, defaults) = makeDefaults()
        let storage = makeStorageDirectory()
        defer { cleanUp(suiteName: suiteName, defaults: defaults, storage: storage) }
        let store = StudioStore(defaults: defaults, storageDirectory: storage, bundle: Bundle(for: StudioStore.self))
        let project = try XCTUnwrap(store.projects.first)
        store.updateDetails(
            for: project.id,
            title: "Latest title",
            summary: project.spec.metadata.summary,
            accent: project.spec.theme.accent,
            density: project.spec.theme.density
        )
        let expectedIDs = Set(store.projects.map(\.id))
        let primary = try projectFile(for: project.id, in: storage)
        XCTAssertTrue(FileManager.default.fileExists(atPath: primary.appendingPathExtension("backup").path))
        try Data("damaged".utf8).write(to: primary, options: .atomic)

        let restored = StudioStore(defaults: defaults, storageDirectory: storage, bundle: Bundle(for: StudioStore.self))

        XCTAssertEqual(Set(restored.projects.map(\.id)), expectedIDs)
        XCTAssertTrue(restored.recoveryNotice?.contains("Recovered 1 widget") == true)
    }

    @MainActor
    func testOneUnrecoverableProjectIsQuarantinedWithoutErasingOthers() throws {
        let (suiteName, defaults) = makeDefaults()
        let storage = makeStorageDirectory()
        defer { cleanUp(suiteName: suiteName, defaults: defaults, storage: storage) }
        let store = StudioStore(defaults: defaults, storageDirectory: storage, bundle: Bundle(for: StudioStore.self))
        let project = try XCTUnwrap(store.projects.first)
        store.updateDetails(
            for: project.id,
            title: "Create backup",
            summary: project.spec.metadata.summary,
            accent: project.spec.theme.accent,
            density: project.spec.theme.density
        )
        let otherIDs = Set(store.projects.filter { $0.id != project.id }.map(\.id))
        let primary = try projectFile(for: project.id, in: storage)
        try Data("damaged".utf8).write(to: primary, options: .atomic)
        try Data("also damaged".utf8).write(
            to: primary.appendingPathExtension("backup"),
            options: .atomic
        )

        let restored = StudioStore(defaults: defaults, storageDirectory: storage, bundle: Bundle(for: StudioStore.self))

        XCTAssertEqual(Set(restored.projects.map(\.id)), otherIDs)
        XCTAssertNotNil(restored.recoveryNotice)
        XCTAssertTrue(FileManager.default.fileExists(atPath: storage.appending(path: "Quarantine").path))
    }

    @MainActor
    func testOrphanedBackupIsRestoredWhenPrimaryIsMissing() throws {
        let (suiteName, defaults) = makeDefaults()
        let storage = makeStorageDirectory()
        defer { cleanUp(suiteName: suiteName, defaults: defaults, storage: storage) }
        let store = StudioStore(defaults: defaults, storageDirectory: storage, bundle: Bundle(for: StudioStore.self))
        let project = try XCTUnwrap(store.projects.first)
        store.updateDetails(
            for: project.id,
            title: "Create backup",
            summary: project.spec.metadata.summary,
            accent: project.spec.theme.accent,
            density: project.spec.theme.density
        )
        let primary = try projectFile(for: project.id, in: storage)
        try FileManager.default.removeItem(at: primary)

        let restored = StudioStore(defaults: defaults, storageDirectory: storage, bundle: Bundle(for: StudioStore.self))

        XCTAssertNotNil(restored.projects.first(where: { $0.id == project.id }))
        XCTAssertTrue(restored.recoveryNotice?.contains("Recovered 1 widget") == true)
    }

    @MainActor
    func testLostPatchResponseUsesCommittedRevisionWithoutPatchingTwice() async throws {
        let context = try makeRemoteContext()
        defer { cleanUp(suiteName: context.suiteName, defaults: context.defaults, storage: context.storage) }
        let created = try await context.store.createApprovedBrief(sampleBrief())
        await context.api.setMode(.losePatchResponseAfterCommit)

        try await context.store.refine("Use a bus-stop example", projectID: created.id)

        let saved = try XCTUnwrap(context.store.projects.first(where: { $0.id == created.id }))
        XCTAssertEqual(saved.remoteDraft?.version, 2)
        XCTAssertEqual(saved.spec.metadata.summary, "Revised: Use a bus-stop example")
        let calls = await context.api.recordedCalls()
        XCTAssertEqual(calls.filter { $0.hasPrefix("patch:") }.count, 1)
    }

    @MainActor
    func testGeneratedRevisionCanBeUndoneAndSynchronised() async throws {
        let context = try makeRemoteContext()
        defer { cleanUp(suiteName: context.suiteName, defaults: context.defaults, storage: context.storage) }
        let created = try await context.store.createApprovedBrief(sampleBrief())
        let original = created.spec
        try await context.store.refine("Use a bus-stop example", projectID: created.id)

        try await context.store.undoLastGeneratedChange(projectID: created.id)

        let restored = try XCTUnwrap(context.store.projects.first(where: { $0.id == created.id }))
        XCTAssertEqual(restored.spec, original)
        XCTAssertEqual(restored.remoteDraft?.version, 3)
        XCTAssertNil(restored.previousSpec)
        XCTAssertEqual(context.store.notice, "Previous version restored")
    }

    @MainActor
    func testLostSaveResponseFetchesCommittedSpecAndClearsDirtyFlag() async throws {
        let context = try makeRemoteContext()
        defer { cleanUp(suiteName: context.suiteName, defaults: context.defaults, storage: context.storage) }
        let created = try await context.store.createApprovedBrief(sampleBrief())
        context.store.updateDetails(
            for: created.id,
            title: "Locally edited title",
            summary: created.spec.metadata.summary,
            accent: created.spec.theme.accent,
            density: created.spec.theme.density
        )
        await context.api.setMode(.loseSaveResponseAfterCommit)

        try await context.store.saveDirectEdits(projectID: created.id)

        let saved = try XCTUnwrap(context.store.projects.first(where: { $0.id == created.id }))
        XCTAssertEqual(saved.spec.metadata.title, "Locally edited title")
        XCTAssertEqual(saved.remoteDraft?.version, 2)
        XCTAssertFalse(saved.needsRemoteSave)
        let calls = await context.api.recordedCalls()
        XCTAssertEqual(calls.filter { $0.hasPrefix("save:") }.count, 1)
    }

    @MainActor
    func testSaveConflictKeepsLocalAndRemoteAsSeparateProjects() async throws {
        let context = try makeRemoteContext()
        defer { cleanUp(suiteName: context.suiteName, defaults: context.defaults, storage: context.storage) }
        let initialCount = context.store.projects.count
        let created = try await context.store.createApprovedBrief(sampleBrief())
        context.store.updateDetails(
            for: created.id,
            title: "My local change",
            summary: created.spec.metadata.summary,
            accent: created.spec.theme.accent,
            density: created.spec.theme.density
        )
        await context.api.setMode(.conflictOnSave)

        do {
            try await context.store.saveDirectEdits(projectID: created.id)
            XCTFail("Expected a conflict")
        } catch StudioStoreError.remoteSaveConflict {}

        XCTAssertEqual(context.store.projects.count, initialCount + 2)
        let localCopy = try XCTUnwrap(context.store.projects.first(where: { $0.spec.metadata.title.contains("Local Copy") }))
        XCTAssertTrue(localCopy.spec.metadata.title.contains("My local change"))
        XCTAssertNil(localCopy.remoteDraft)
        let remoteCopy = try XCTUnwrap(context.store.projects.first(where: { $0.id == created.id }))
        XCTAssertEqual(remoteCopy.spec.metadata.summary, "Changed on another iPad")
        XCTAssertFalse(remoteCopy.needsRemoteSave)
    }

    @MainActor
    func testPatch409RestoresLatestRevisionWithoutIssuingPromptTwice() async throws {
        let context = try makeRemoteContext()
        defer { cleanUp(suiteName: context.suiteName, defaults: context.defaults, storage: context.storage) }
        let created = try await context.store.createApprovedBrief(sampleBrief())
        await context.api.setMode(.conflictOnPatch)

        do {
            try await context.store.refine("Add one more hint", projectID: created.id)
            XCTFail("Expected the restored revision notice")
        } catch StudioStoreError.remoteRevisionRestored {}

        let restored = try XCTUnwrap(context.store.projects.first(where: { $0.id == created.id }))
        XCTAssertEqual(restored.spec.metadata.summary, "Changed on another iPad")
        XCTAssertEqual(restored.remoteDraft?.version, 2)
        let calls = await context.api.recordedCalls()
        XCTAssertEqual(calls.filter { $0.hasPrefix("patch:") }.count, 1)
    }

    @MainActor
    func testUnpublishTreatsAlreadyMissingPublicationAsInactive() async throws {
        let context = try makeRemoteContext()
        defer { cleanUp(suiteName: context.suiteName, defaults: context.defaults, storage: context.storage) }
        let created = try await context.store.createApprovedBrief(sampleBrief())
        _ = try await context.store.publish(projectID: created.id)
        await context.api.setMode(.publicationNotFoundOnRevoke)

        try await context.store.unpublish(projectID: created.id)

        XCTAssertNil(context.store.projects.first(where: { $0.id == created.id })?.publication)
        XCTAssertEqual(context.store.notice, "Widget unpublished")
    }

    @MainActor
    func testProjectRejectsASecondPromptWhileFirstIsInFlight() async throws {
        let context = try makeRemoteContext()
        defer { cleanUp(suiteName: context.suiteName, defaults: context.defaults, storage: context.storage) }
        let created = try await context.store.createApprovedBrief(sampleBrief())
        await context.api.setMode(.holdPatch)
        let first = Task { @MainActor in
            try await context.store.refine("First change", projectID: created.id)
        }
        while !(await context.api.recordedCalls()).contains(where: { $0.hasPrefix("patch:") }) {
            await Task.yield()
        }

        do {
            try await context.store.refine("Second change", projectID: created.id)
            XCTFail("Expected the operation guard")
        } catch StudioStoreError.operationInProgress {}

        await context.api.releaseHeldPatch()
        try await first.value
        let calls = await context.api.recordedCalls()
        XCTAssertEqual(calls.filter { $0.hasPrefix("patch:") }.count, 1)
    }

    @MainActor
    func testDelete404KeepsProjectUntilTeacherChoosesLocalOnlyRemoval() async throws {
        let context = try makeRemoteContext()
        defer { cleanUp(suiteName: context.suiteName, defaults: context.defaults, storage: context.storage) }
        let created = try await context.store.createApprovedBrief(sampleBrief())
        await context.api.setMode(.draftNotFoundOnDelete)

        do {
            try await context.store.deleteProject(projectID: created.id)
            XCTFail("Expected unverified deletion")
        } catch StudioStoreError.remoteDeletionUnverified {}
        XCTAssertNotNil(context.store.projects.first(where: { $0.id == created.id }))

        try context.store.deleteLocalProject(projectID: created.id)
        XCTAssertNil(context.store.projects.first(where: { $0.id == created.id }))
        XCTAssertTrue(context.store.notice?.contains("this iPad only") == true)
    }

    @MainActor
    func testRestoreFromStudioRecoversMissingDraftWithoutDuplicatingIt() async throws {
        let context = try makeRemoteContext()
        defer { cleanUp(suiteName: context.suiteName, defaults: context.defaults, storage: context.storage) }
        let created = try await context.store.createApprovedBrief(sampleBrief())
        try context.store.deleteLocalProject(projectID: created.id)

        let added = try await context.store.restoreFromStudio()
        let secondAdded = try await context.store.restoreFromStudio()

        XCTAssertEqual(added, 1)
        XCTAssertEqual(secondAdded, 0)
        XCTAssertEqual(context.store.projects.filter { $0.remoteDraft?.id == "draft-1" }.count, 1)
    }

    @MainActor
    func testRestoreDownloadsDeclaredImagesBeforeAddingRecoveredDraft() async throws {
        let context = try makeRemoteContext()
        defer { cleanUp(suiteName: context.suiteName, defaults: context.defaults, storage: context.storage) }
        let created = try await context.store.createApprovedBrief(sampleBrief())
        let bytes = Data([0xff, 0xd8, 0xff, 0xd9])
        let assetID = "asset-0123456789abcdef0123456789abcdef"
        var remoteSpec = created.spec
        remoteSpec.assets = [imageAssetRecord(id: assetID, data: bytes).jsonValue]
        remoteSpec.screens[0].components.append(imageComponent(assetID: assetID, altText: "A force diagram"))
        await context.api.replaceSpecForRestore(
            remoteSpec,
            download: DownloadedWidgetAsset(data: bytes, mediaType: "image/jpeg")
        )
        try context.store.deleteLocalProject(projectID: created.id)

        let added = try await context.store.restoreFromStudio()
        XCTAssertEqual(added, 1)

        let restored = try XCTUnwrap(context.store.projects.first(where: { $0.remoteDraft?.id == "draft-1" }))
        let localAsset = try XCTUnwrap(restored.localAssets.first(where: { $0.id == assetID }))
        XCTAssertNotNil(LocalWidgetAssetStorage.url(for: localAsset))
        let calls = await context.api.recordedCalls()
        XCTAssertTrue(calls.contains("download:\(assetID)"))
    }

    @MainActor
    func testAssetRestoreFailureLeavesDirtyLocalProjectUnchanged() async throws {
        let context = try makeRemoteContext()
        defer { cleanUp(suiteName: context.suiteName, defaults: context.defaults, storage: context.storage) }
        let created = try await context.store.createApprovedBrief(sampleBrief())
        context.store.updateDetails(
            for: created.id,
            title: "My unsynchronised title",
            summary: created.spec.metadata.summary,
            accent: created.spec.theme.accent,
            density: created.spec.theme.density
        )
        let bytes = Data([0xff, 0xd8, 0xff, 0xd9])
        let assetID = "asset-0123456789abcdef0123456789abcdef"
        var remoteSpec = created.spec
        remoteSpec.metadata.title = "Remote title"
        remoteSpec.assets = [imageAssetRecord(id: assetID, data: bytes).jsonValue]
        remoteSpec.screens[0].components.append(imageComponent(assetID: assetID, altText: "A force diagram"))
        await context.api.replaceSpecForRestore(remoteSpec, download: nil)

        do {
            _ = try await context.store.restoreFromStudio()
            XCTFail("Expected image recovery to fail")
        } catch StudioStoreError.assetRestoreFailed {}

        let unchanged = try XCTUnwrap(context.store.projects.first(where: { $0.id == created.id }))
        XCTAssertEqual(unchanged.spec.metadata.title, "My unsynchronised title")
        XCTAssertTrue(unchanged.localAssets.isEmpty)
        XCTAssertNil(context.store.projects.first(where: { $0.spec.metadata.title.contains("Local Copy") }))
    }

    @MainActor
    func testPublishReadinessFailureMakesNoNetworkRequest() async throws {
        let context = try makeRemoteContext()
        defer { cleanUp(suiteName: context.suiteName, defaults: context.defaults, storage: context.storage) }
        let project = try XCTUnwrap(context.store.projects.first)
        context.store.updateDetails(
            for: project.id,
            title: "  ",
            summary: "",
            accent: project.spec.theme.accent,
            density: project.spec.theme.density
        )

        do {
            _ = try await context.store.publish(projectID: project.id)
            XCTFail("Expected local publish checks to block the request")
        } catch StudioStoreError.publishReadinessFailed(let message) {
            XCTAssertTrue(message.contains("title"))
            XCTAssertTrue(message.contains("summary"))
        }
        let calls = await context.api.recordedCalls()
        XCTAssertTrue(calls.isEmpty)
    }

    func testPublishReadinessChecksImageDescriptionsAndDecorations() throws {
        let repository = FixtureRepository()
        var spec = try XCTUnwrap(repository.loadExamples(from: Bundle(for: StudioStore.self)).first?.spec)
        spec.screens[0].components.append(imageComponent(assetID: "asset-one", altText: ""))
        XCTAssertFalse(WidgetPublishReadiness.audit(spec).isReady)

        spec.screens[0].components.removeLast()
        spec.screens[0].components.append(
            imageComponent(assetID: "asset-one", altText: "Not empty", decorative: true)
        )
        XCTAssertFalse(WidgetPublishReadiness.audit(spec).isReady)

        spec.screens[0].components.removeLast()
        spec.screens[0].components.append(
            imageComponent(assetID: "asset-one", altText: "", decorative: true)
        )
        XCTAssertTrue(WidgetPublishReadiness.audit(spec).isReady)
    }

    func testImagePrivacyTextPatterns() {
        XCTAssertTrue(WidgetImagePrivacyScanner.containsObviousPersonalData(in: "Contact teacher@example.edu.sg"))
        XCTAssertTrue(WidgetImagePrivacyScanner.containsObviousPersonalData(in: "S1234567D"))
        XCTAssertTrue(WidgetImagePrivacyScanner.containsObviousPersonalData(in: "+65 9123 4567"))
        XCTAssertTrue(WidgetImagePrivacyScanner.containsObviousPersonalData(in: "6123-4567"))
        XCTAssertFalse(WidgetImagePrivacyScanner.containsObviousPersonalData(in: "Gravity is 9.81 m/s squared"))
    }

    private func makeDefaults() -> (String, UserDefaults) {
        let suiteName = "StudioStoreTests-\(UUID().uuidString)"
        return (suiteName, UserDefaults(suiteName: suiteName)!)
    }

    private func makeStorageDirectory() -> URL {
        FileManager.default.temporaryDirectory
            .appending(path: "StudioStoreTests-\(UUID().uuidString)", directoryHint: .isDirectory)
    }

    private func projectFile(for projectID: String, in storage: URL) throws -> URL {
        let files = try FileManager.default.contentsOfDirectory(
            at: storage,
            includingPropertiesForKeys: nil
        ).filter { $0.pathExtension == "json" && $0.lastPathComponent.hasPrefix("project-") }
        return try XCTUnwrap(files.first { file in
            guard let data = try? Data(contentsOf: file),
                  let project = try? JSONDecoder().decode(WidgetProject.self, from: data)
            else { return false }
            return project.id == projectID
        })
    }

    @MainActor
    private func makeRemoteContext() throws -> RemoteTestContext {
        let (suiteName, defaults) = makeDefaults()
        let storage = makeStorageDirectory()
        let fixtureStorage = makeStorageDirectory()
        defer { try? FileManager.default.removeItem(at: fixtureStorage) }
        let fixtureStore = StudioStore(
            defaults: defaults,
            storageDirectory: fixtureStorage,
            bundle: Bundle(for: StudioStore.self)
        )
        var spec = try XCTUnwrap(fixtureStore.examples.first).spec
        spec.id = "widget-from-service"
        defaults.removePersistentDomain(forName: suiteName)
        let api = RecordingStudioAPI(spec: spec)
        let store = StudioStore(
            defaults: defaults,
            storageDirectory: storage,
            bundle: Bundle(for: StudioStore.self),
            api: api
        )
        return RemoteTestContext(
            suiteName: suiteName,
            defaults: defaults,
            storage: storage,
            api: api,
            store: store
        )
    }

    private func sampleBrief() -> GuidedBriefDraft {
        var brief = GuidedBriefDraft()
        brief.learnerContext = "Secondary 2 Science"
        brief.learningObjective = "Explain balanced forces"
        brief.studentAction = "Choose the force diagram that is balanced"
        brief.feedback = "Compare the size and direction of each force"
        brief.classroomFit = "Six minutes individually"
        return brief
    }

    private func imageAssetRecord(id: String, data: Data) -> WidgetImageAssetRecord {
        WidgetImageAssetRecord(
            id: id,
            kind: "image",
            mediaType: "image/jpeg",
            width: 1,
            height: 1,
            byteLength: data.count,
            sha256: SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
        )
    }

    private func imageComponent(
        assetID: String,
        altText: String,
        decorative: Bool = false
    ) -> JSONValue {
        .object([
            "id": .string("image-test"),
            "kind": .string("image"),
            "assetId": .string(assetID),
            "altText": .string(altText),
            "decorative": .boolean(decorative)
        ])
    }

    private func cleanUp(suiteName: String, defaults: UserDefaults, storage: URL) {
        defaults.removePersistentDomain(forName: suiteName)
        try? FileManager.default.removeItem(at: storage)
    }
}

private struct RemoteTestContext {
    let suiteName: String
    let defaults: UserDefaults
    let storage: URL
    let api: RecordingStudioAPI
    let store: StudioStore
}

private enum TestAPIMode: Sendable, Equatable {
    case normal
    case losePatchResponseAfterCommit
    case loseSaveResponseAfterCommit
    case conflictOnSave
    case conflictOnPatch
    case draftNotFoundOnDelete
    case publicationNotFoundOnRevoke
    case holdPatch
}

private actor RecordingStudioAPI: StudioAPI {
    private var spec: WidgetSpec
    private var version = 1
    private var downloadableAsset: DownloadedWidgetAsset?
    private var calls: [String] = []
    private var mode: TestAPIMode = .normal
    private var heldPatch: CheckedContinuation<Void, Never>?

    init(spec: WidgetSpec) {
        self.spec = spec
    }

    func generate(from brief: GuidedBriefDraft) async throws -> RemoteDraft {
        calls.append("generate")
        return draft()
    }

    func importDraft(spec: WidgetSpec) async throws -> RemoteDraft {
        calls.append("import")
        self.spec = spec
        return draft()
    }

    func fetchDraft(draftID: String) async throws -> RemoteDraft {
        calls.append("fetch:\(draftID)")
        return draft()
    }

    func listDrafts() async throws -> [RemoteDraftSummary] {
        calls.append("list")
        return [
            RemoteDraftSummary(
                id: "draft-1",
                title: spec.metadata.title,
                schemaVersion: spec.schemaVersion,
                version: version,
                createdAt: "2026-07-18T12:00:00.000Z",
                updatedAt: "2026-07-18T12:00:00.000Z",
                publication: nil
            )
        ]
    }

    func downloadAsset(id: String) async throws -> DownloadedWidgetAsset {
        calls.append("download:\(id)")
        guard let downloadableAsset else {
            throw StudioAPIError.transport("The image could not be restored")
        }
        return downloadableAsset
    }

    func patch(draftID: String, version: Int, instruction: String) async throws -> RemoteDraft {
        calls.append("patch:\(draftID):\(version)")
        if mode == .conflictOnPatch {
            mode = .normal
            self.version += 1
            spec.metadata.summary = "Changed on another iPad"
            throw StudioAPIError.server(
                status: 409,
                code: "DRAFT_VERSION_CONFLICT",
                message: "This draft changed elsewhere."
            )
        }
        if mode == .holdPatch {
            mode = .normal
            await withCheckedContinuation { continuation in
                heldPatch = continuation
            }
        }
        self.version += 1
        spec.metadata.summary = "Revised: \(instruction)"
        if mode == .losePatchResponseAfterCommit {
            mode = .normal
            throw StudioAPIError.transport("The response was interrupted")
        }
        return draft()
    }

    func save(draftID: String, version: Int, spec: WidgetSpec, note: String) async throws -> RemoteDraft {
        calls.append("save:\(draftID):\(version)")
        if mode == .conflictOnSave {
            mode = .normal
            self.version += 1
            self.spec.metadata.summary = "Changed on another iPad"
            throw StudioAPIError.server(
                status: 409,
                code: "DRAFT_VERSION_CONFLICT",
                message: "This draft changed elsewhere."
            )
        }
        self.spec = spec
        self.version += 1
        if mode == .loseSaveResponseAfterCommit {
            mode = .normal
            throw StudioAPIError.transport("The response was interrupted")
        }
        return draft()
    }

    func deleteDraft(draftID: String) async throws {
        calls.append("delete:\(draftID)")
        if mode == .draftNotFoundOnDelete {
            throw StudioAPIError.server(
                status: 404,
                code: "DRAFT_NOT_FOUND",
                message: "This draft is unavailable."
            )
        }
    }

    func publish(draftID: String) async throws -> WidgetPublication {
        calls.append("publish:\(draftID)")
        return WidgetPublication(
            slug: "student-link",
            url: URL(string: "https://studio.example/student-link")!,
            title: spec.metadata.title,
            schemaVersion: spec.schemaVersion,
            createdAt: "2026-07-18T12:00:00.000Z",
            expiresAt: "2026-10-16T12:00:00.000Z",
            revokedAt: nil
        )
    }

    func extend(slug: String, days: Int) async throws -> WidgetPublication {
        calls.append("extend:\(slug):\(days)")
        return WidgetPublication(
            slug: slug,
            url: URL(string: "https://studio.example/\(slug)")!,
            title: spec.metadata.title,
            schemaVersion: spec.schemaVersion,
            createdAt: "2026-07-18T12:00:00.000Z",
            expiresAt: "2027-01-16T12:00:00.000Z",
            revokedAt: nil
        )
    }

    func revoke(slug: String) async throws {
        calls.append("revoke:\(slug)")
        if mode == .publicationNotFoundOnRevoke {
            mode = .normal
            throw StudioAPIError.server(
                status: 404,
                code: "PUBLICATION_NOT_FOUND",
                message: "This publication is unavailable."
            )
        }
    }

    func uploadImage(
        _ image: PreparedWidgetImage,
        alternativeText: String?,
        decorative: Bool
    ) async throws -> UploadedWidgetImage {
        calls.append("upload")
        return UploadedWidgetImage(
            asset: WidgetImageAssetRecord(
                id: "asset-0123456789abcdef0123456789abcdef",
                kind: "image",
                mediaType: image.mediaType,
                width: image.width,
                height: image.height,
                byteLength: image.data.count,
                sha256: image.sha256
            ),
            accessibility: .init(alternativeText: alternativeText, decorative: decorative)
        )
    }

    func recordedCalls() -> [String] { calls }

    func setMode(_ value: TestAPIMode) { mode = value }

    func replaceSpecForRestore(_ value: WidgetSpec, download: DownloadedWidgetAsset?) {
        spec = value
        version += 1
        downloadableAsset = download
    }

    func releaseHeldPatch() {
        heldPatch?.resume()
        heldPatch = nil
    }

    private func draft() -> RemoteDraft {
        RemoteDraft(
            id: "draft-1",
            title: spec.metadata.title,
            schemaVersion: spec.schemaVersion,
            spec: spec,
            version: version,
            createdAt: "2026-07-18T12:00:00.000Z",
            updatedAt: "2026-07-18T12:00:00.000Z"
        )
    }
}
