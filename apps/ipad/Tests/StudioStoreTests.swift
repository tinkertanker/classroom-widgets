import CryptoKit
import SwiftUI
import UIKit
@preconcurrency import WebKit
import XCTest
@testable import ClassroomWidgetsStudio

final class StudioStoreTests: XCTestCase {
    @MainActor
    func testPreviewNavigationWatchdogFailsAStalledLoad() async {
        var loadState = PreviewLoadState.ready
        let coordinator = WidgetPreviewWebView.Coordinator(
            state: Binding(
                get: { loadState },
                set: { loadState = $0 }
            ),
            localAssets: [],
            navigationTimeout: .milliseconds(100)
        )

        coordinator.webView(
            WKWebView(frame: .zero),
            didStartProvisionalNavigation: nil
        )
        XCTAssertEqual(loadState, .loading)

        try? await Task.sleep(for: .milliseconds(500))

        XCTAssertEqual(
            loadState,
            .failed("The student preview took too long to open. Reload it and try again.")
        )
        coordinator.detach()
    }

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
        XCTAssertTrue(remix.spec.metadata.title.hasSuffix("Copy"))
    }

    @MainActor
    func testNewInstallStartsWithNoProjectsAndStaysEmptyAfterRestart() throws {
        let (suiteName, defaults) = makeDefaults()
        let storage = makeStorageDirectory()
        defer { cleanUp(suiteName: suiteName, defaults: defaults, storage: storage) }

        let firstLaunch = StudioStore(
            defaults: defaults,
            storageDirectory: storage,
            bundle: Bundle(for: StudioStore.self)
        )
        XCTAssertTrue(firstLaunch.projects.isEmpty)
        XCTAssertFalse(firstLaunch.examples.isEmpty)

        let restarted = StudioStore(
            defaults: defaults,
            storageDirectory: storage,
            bundle: Bundle(for: StudioStore.self)
        )
        XCTAssertTrue(restarted.projects.isEmpty)
    }

    func testTeacherFacingErrorPresentationHidesRawServiceDetailsAndKeepsCuratedMessages() {
        let serverError = StudioAPIError.server(
            status: 500,
            code: "WORKER_EXCEPTION",
            message: "upstream Redis socket closed at /v1/drafts"
        )

        let generated = StudioErrorPresentation.presenting(serverError, during: .generation)
        XCTAssertEqual(generated.title, "Could not make the widget")
        XCTAssertEqual(generated.message, "Your answers are still here. Check your connection and try again.")
        XCTAssertFalse(generated.message.contains("Redis"))
        XCTAssertFalse(generated.message.contains("/v1/drafts"))

        let personalData = StudioErrorPresentation.presenting(
            StudioAPIError.server(
                status: 422,
                code: "POSSIBLE_PERSONAL_DATA",
                message: "Internal classifier result: entity=PERSON"
            ),
            during: .generation
        )
        XCTAssertEqual(personalData.title, "Remove personal information")
        XCTAssertEqual(
            personalData.message,
            "Remove student names or other personal information, then try again."
        )
        XCTAssertFalse(personalData.message.contains("classifier"))

        let undo = StudioErrorPresentation.presenting(
            StudioAPIError.transport("offline"),
            during: .undo
        )
        XCTAssertEqual(undo.title, "Previous version restored on this iPad")
        XCTAssertTrue(undo.message.contains("could not update its recovery copy"))

        let image = StudioErrorPresentation.presenting(
            WidgetImageError.descriptionRequired,
            during: .image
        )
        XCTAssertEqual(
            image.message,
            "Describe the image for students, or mark it as decorative."
        )

        let deletion = StudioErrorPresentation.presenting(
            StudioStoreError.remoteDeletionUnverified,
            during: .delete
        )
        XCTAssertEqual(
            deletion.message,
            "Studio could not verify that the recovery copy and student link were deleted, so the widget remains on this iPad. Try again when you are connected."
        )
    }

    @MainActor
    func testRegistrationRequiredPresentationReopensAccessWithoutDiscardingTeacherWork() throws {
        let (suiteName, defaults) = makeDefaults()
        let storage = makeStorageDirectory()
        defer { cleanUp(suiteName: suiteName, defaults: defaults, storage: storage) }
        let store = StudioStore(defaults: defaults, storageDirectory: storage, bundle: Bundle(for: StudioStore.self))
        let project = store.create(from: sampleBrief())
        store.guidedMakeDraft = sampleBrief()
        let error = StudioAPIError.server(
            status: 401,
            code: "DEVICE_REGISTRATION_REQUIRED",
            message: "JWT signature verification failed"
        )

        let presentation = store.present(error, during: .generation)

        XCTAssertTrue(presentation.requestsWorkshopAccess)
        XCTAssertEqual(presentation.title, "Studio access needed")
        XCTAssertEqual(
            presentation.message,
            "Enter your workshop code to make a widget. Your answers are still here."
        )
        XCTAssertTrue(store.showsWorkshopAccess)
        XCTAssertEqual(store.workshopAccessState, .registrationRequired)
        XCTAssertEqual(store.projects.map(\.id), [project.id])
        XCTAssertEqual(store.guidedMakeDraft.learningObjective, sampleBrief().learningObjective)
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
                "publish:draft-1:2",
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
        let project = seed.create(from: sampleBrief())
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
        let project = store.create(from: sampleBrief())
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
        let project = store.create(from: sampleBrief())
        let otherProject = store.create(from: sampleBrief())
        store.updateDetails(
            for: project.id,
            title: "Create backup",
            summary: project.spec.metadata.summary,
            accent: project.spec.theme.accent,
            density: project.spec.theme.density
        )
        let otherIDs = Set(store.projects.filter { $0.id != project.id }.map(\.id))
        XCTAssertEqual(otherIDs, Set([otherProject.id]))
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
        let project = store.create(from: sampleBrief())
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
    func testLostPatchResponseSurfacesTheFetchedRevisionWithoutClaimingPromptSuccess() async throws {
        let context = try makeRemoteContext()
        defer { cleanUp(suiteName: context.suiteName, defaults: context.defaults, storage: context.storage) }
        let created = try await context.store.createApprovedBrief(sampleBrief())
        await context.api.setMode(.losePatchResponseAfterCommit)

        do {
            try await context.store.refine("Use a bus-stop example", projectID: created.id)
            XCTFail("Expected the ambiguous result to require review")
        } catch StudioStoreError.remoteRevisionRestored {}

        let saved = try XCTUnwrap(context.store.projects.first(where: { $0.id == created.id }))
        XCTAssertEqual(saved.remoteDraft?.version, 2)
        XCTAssertEqual(saved.spec.metadata.summary, "Revised: Use a bus-stop example")
        XCTAssertTrue(saved.revisionNotes.isEmpty)
        XCTAssertEqual(context.store.notice, "Opened the latest saved version")
        let calls = await context.api.recordedCalls()
        XCTAssertEqual(calls.filter { $0.hasPrefix("patch:") }.count, 1)
    }

    @MainActor
    func testAmbiguousPatchNeverAttributesAnUnrelatedHigherRevisionToThePrompt() async throws {
        let context = try makeRemoteContext()
        defer { cleanUp(suiteName: context.suiteName, defaults: context.defaults, storage: context.storage) }
        let created = try await context.store.createApprovedBrief(sampleBrief())
        await context.api.setMode(.ambiguousPatchWithUnrelatedRevision)

        do {
            try await context.store.refine("Add one more hint", projectID: created.id)
            XCTFail("Expected the unrelated revision to be surfaced")
        } catch StudioStoreError.remoteRevisionRestored {}

        let restored = try XCTUnwrap(context.store.projects.first(where: { $0.id == created.id }))
        XCTAssertEqual(restored.remoteDraft?.version, 2)
        XCTAssertEqual(restored.spec.metadata.summary, "Changed independently on another iPad")
        XCTAssertFalse(restored.spec.metadata.summary.contains("Add one more hint"))
        XCTAssertTrue(restored.revisionNotes.isEmpty)
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
        let localCopy = try XCTUnwrap(context.store.projects.first(where: { $0.spec.metadata.title.hasSuffix(" Copy") }))
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
        XCTAssertEqual(context.store.notice, "Student link turned off")
    }

    @MainActor
    func testPublishStopsWhenSynchronisationRestoresANewerCrossDeviceRevision() async throws {
        let context = try makeRemoteContext()
        defer { cleanUp(suiteName: context.suiteName, defaults: context.defaults, storage: context.storage) }
        let created = try await context.store.createApprovedBrief(sampleBrief())
        let existingPublication = try await context.store.publish(projectID: created.id)
        var remoteSpec = created.spec
        remoteSpec.metadata.summary = "Changed on the other iPad after this preview"
        await context.api.replaceSpecForRestore(remoteSpec, download: nil)

        do {
            _ = try await context.store.publish(projectID: created.id)
            XCTFail("Expected the newer revision to require another review")
        } catch StudioStoreError.remoteRevisionRestored {}

        let restored = try XCTUnwrap(context.store.projects.first(where: { $0.id == created.id }))
        XCTAssertEqual(restored.spec.metadata.summary, remoteSpec.metadata.summary)
        XCTAssertEqual(restored.remoteDraft?.version, 2)
        XCTAssertEqual(restored.publication, existingPublication)
        XCTAssertTrue(restored.publicationNeedsUpdate)
        let calls = await context.api.recordedCalls()
        XCTAssertEqual(calls.filter { $0.hasPrefix("publish:") }.count, 1)
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
    func testRestoreMarksAStudentLinkStaleWhenTheDraftChangedAfterPublishing() async throws {
        let context = try makeRemoteContext()
        defer { cleanUp(suiteName: context.suiteName, defaults: context.defaults, storage: context.storage) }
        let created = try await context.store.createApprovedBrief(sampleBrief())
        let publication = try await context.store.publish(projectID: created.id)
        var newerSpec = created.spec
        newerSpec.metadata.summary = "Newer draft that was never published"
        await context.api.replaceSpecForRestore(newerSpec, download: nil)
        await context.api.setPublicationForRestore(publication, needsUpdate: true)
        try context.store.deleteLocalProject(projectID: created.id)

        _ = try await context.store.restoreFromStudio()

        let restored = try XCTUnwrap(context.store.projects.first(where: { $0.remoteDraft?.id == "draft-1" }))
        XCTAssertEqual(restored.spec.metadata.summary, newerSpec.metadata.summary)
        XCTAssertEqual(restored.publication, publication)
        XCTAssertTrue(restored.publicationNeedsUpdate)
    }

    @MainActor
    func testRestoreMarksANewlyDiscoveredLinkStaleAgainstUnsavedLocalEdits() async throws {
        let context = try makeRemoteContext()
        defer { cleanUp(suiteName: context.suiteName, defaults: context.defaults, storage: context.storage) }
        let created = try await context.store.createApprovedBrief(sampleBrief())
        context.store.updateDetails(
            for: created.id,
            title: "Unsaved local teaching version",
            summary: created.spec.metadata.summary,
            accent: created.spec.theme.accent,
            density: created.spec.theme.density
        )
        let publication = samplePublication()
        await context.api.setPublicationForRestore(publication, needsUpdate: false)

        _ = try await context.store.restoreFromStudio()

        let local = try XCTUnwrap(context.store.projects.first(where: { $0.id == created.id }))
        XCTAssertEqual(local.spec.metadata.title, "Unsaved local teaching version")
        XCTAssertEqual(local.publication, publication)
        XCTAssertTrue(local.publicationNeedsUpdate)
    }

    @MainActor
    func testRestoreKeepsTheLiveLinkOnTheRemoteHalfOfAConflict() async throws {
        let context = try makeRemoteContext()
        defer { cleanUp(suiteName: context.suiteName, defaults: context.defaults, storage: context.storage) }
        let created = try await context.store.createApprovedBrief(sampleBrief())
        context.store.updateDetails(
            for: created.id,
            title: "Unsaved local teaching version",
            summary: created.spec.metadata.summary,
            accent: created.spec.theme.accent,
            density: created.spec.theme.density
        )
        var remoteSpec = created.spec
        remoteSpec.metadata.summary = "Newer published server version"
        await context.api.replaceSpecForRestore(remoteSpec, download: nil)
        let publication = samplePublication()
        await context.api.setPublicationForRestore(publication, needsUpdate: false)

        _ = try await context.store.restoreFromStudio()

        let remote = try XCTUnwrap(context.store.projects.first(where: { $0.id == created.id }))
        XCTAssertEqual(remote.spec.metadata.summary, remoteSpec.metadata.summary)
        XCTAssertEqual(remote.publication, publication)
        XCTAssertFalse(remote.publicationNeedsUpdate)
        let localCopy = try XCTUnwrap(
            context.store.projects.first(where: { $0.spec.metadata.title.hasSuffix(" Copy") })
        )
        XCTAssertNil(localCopy.publication)
    }

    @MainActor
    func testRestoreBlocksRemoteAndLocalDeletionUntilItsSnapshotIsApplied() async throws {
        let context = try makeRemoteContext()
        defer { cleanUp(suiteName: context.suiteName, defaults: context.defaults, storage: context.storage) }
        let created = try await context.store.createApprovedBrief(sampleBrief())
        await context.api.setMode(.holdFetch)
        let restoration = Task { @MainActor in
            try await context.store.restoreFromStudio()
        }
        while !(await context.api.recordedCalls()).contains(where: { $0.hasPrefix("fetch:") }) {
            await Task.yield()
        }

        do {
            try await context.store.deleteProject(projectID: created.id)
            XCTFail("Expected remote deletion to wait for restoration")
        } catch StudioStoreError.operationInProgress {}
        do {
            try context.store.deleteLocalProject(projectID: created.id)
            XCTFail("Expected local deletion to wait for restoration")
        } catch StudioStoreError.operationInProgress {}

        await context.api.releaseHeldFetch()
        _ = try await restoration.value
        XCTAssertNotNil(context.store.projects.first(where: { $0.id == created.id }))
        let calls = await context.api.recordedCalls()
        XCTAssertFalse(calls.contains(where: { $0.hasPrefix("delete:") }))
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
        XCTAssertNil(context.store.projects.first(where: { $0.spec.metadata.title.hasSuffix(" Copy") }))
    }

    @MainActor
    func testPublishReadinessFailureMakesNoNetworkRequest() async throws {
        let context = try makeRemoteContext()
        defer { cleanUp(suiteName: context.suiteName, defaults: context.defaults, storage: context.storage) }
        let project = context.store.create(from: sampleBrief())
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

    @MainActor
    func testDecorativeImageIgnoresExistingDescriptionInUploadAndPersistedSpec() async throws {
        let imageData = Data("prepared image".utf8)
        let prepared = PreparedWidgetImage(
            data: imageData,
            mediaType: "image/jpeg",
            width: 64,
            height: 64,
            sha256: SHA256.hash(data: imageData).map { String(format: "%02x", $0) }.joined()
        )
        let context = try makeRemoteContext(preparedImage: prepared)
        defer { cleanUp(suiteName: context.suiteName, defaults: context.defaults, storage: context.storage) }
        let created = try await context.store.createApprovedBrief(sampleBrief())

        try await context.store.addImage(
            imageData,
            alternativeText: "This must not survive the decorative toggle",
            decorative: true,
            projectID: created.id
        )

        let accessibility = await context.api.lastUploadedAccessibility()
        XCTAssertEqual(accessibility?.alternativeText, nil)
        XCTAssertEqual(accessibility?.decorative, true)
        let saved = try XCTUnwrap(context.store.projects.first(where: { $0.id == created.id }))
        let image = try XCTUnwrap(saved.spec.screens.first?.components.last)
        guard case let .object(component) = image else {
            return XCTFail("Expected an image component")
        }
        XCTAssertEqual(component["altText"], .string(""))
        XCTAssertEqual(component["decorative"], .boolean(true))
        XCTAssertTrue(WidgetPublishReadiness.audit(saved.spec).isReady)
    }

    @MainActor
    func testImageUploadCachesValidatedCanonicalServerBytes() async throws {
        let preparedData = Data("prepared bytes with encoder metadata".utf8)
        let canonicalData = Data("canonical bytes returned by Studio".utf8)
        let prepared = PreparedWidgetImage(
            data: preparedData,
            mediaType: "image/jpeg",
            width: 64,
            height: 64,
            sha256: SHA256.hash(data: preparedData).map { String(format: "%02x", $0) }.joined()
        )
        let context = try makeRemoteContext(
            preparedImage: prepared,
            canonicalUpload: DownloadedWidgetAsset(data: canonicalData, mediaType: "image/jpeg")
        )
        defer { cleanUp(suiteName: context.suiteName, defaults: context.defaults, storage: context.storage) }
        let created = try await context.store.createApprovedBrief(sampleBrief())

        try await context.store.addImage(
            preparedData,
            alternativeText: "A force diagram",
            decorative: false,
            projectID: created.id
        )

        let saved = try XCTUnwrap(context.store.projects.first(where: { $0.id == created.id }))
        let local = try XCTUnwrap(saved.localAssets.first)
        let localURL = try XCTUnwrap(LocalWidgetAssetStorage.url(for: local))
        XCTAssertEqual(try Data(contentsOf: localURL), canonicalData)
        XCTAssertNotEqual(try Data(contentsOf: localURL), preparedData)

        let recordValue = try XCTUnwrap(saved.spec.assets.first)
        let recordData = try JSONEncoder().encode(recordValue)
        let record = try JSONDecoder().decode(WidgetImageAssetRecord.self, from: recordData)
        XCTAssertEqual(record.byteLength, canonicalData.count)
        XCTAssertEqual(
            record.sha256,
            SHA256.hash(data: canonicalData).map { String(format: "%02x", $0) }.joined()
        )
        let calls = await context.api.recordedCalls()
        XCTAssertTrue(calls.contains("upload"))
        XCTAssertTrue(calls.contains("download:\(record.id)"))
    }

    @MainActor
    func testExpiredImageDraftReuploadsLocalCanonicalBytesAndRewritesAssetReferences() async throws {
        let canonicalData = Data("canonical classroom image".utf8)
        let prepared = PreparedWidgetImage(
            data: canonicalData,
            mediaType: "image/jpeg",
            width: 64,
            height: 64,
            sha256: SHA256.hash(data: canonicalData).map { String(format: "%02x", $0) }.joined()
        )
        let context = try makeRemoteContext(
            preparedImage: prepared,
            canonicalUpload: DownloadedWidgetAsset(data: canonicalData, mediaType: "image/jpeg")
        )
        defer { cleanUp(suiteName: context.suiteName, defaults: context.defaults, storage: context.storage) }
        let created = try await context.store.createApprovedBrief(sampleBrief())
        try await context.store.addImage(
            canonicalData,
            alternativeText: "A labelled force diagram",
            decorative: false,
            projectID: created.id
        )
        let before = try XCTUnwrap(context.store.projects.first(where: { $0.id == created.id }))
        let oldRecordData = try JSONEncoder().encode(try XCTUnwrap(before.spec.assets.first))
        let oldRecord = try JSONDecoder().decode(WidgetImageAssetRecord.self, from: oldRecordData)
        await context.api.setMode(.draftNotFoundOnFetch)

        try await context.store.saveDirectEdits(projectID: created.id)

        let recreated = try XCTUnwrap(context.store.projects.first(where: { $0.id == created.id }))
        let newRecordData = try JSONEncoder().encode(try XCTUnwrap(recreated.spec.assets.first))
        let newRecord = try JSONDecoder().decode(WidgetImageAssetRecord.self, from: newRecordData)
        XCTAssertNotEqual(newRecord.id, oldRecord.id)
        XCTAssertEqual(recreated.localAssets.map(\.id), [newRecord.id])
        let component = try XCTUnwrap(recreated.spec.screens.first?.components.last)
        guard case let .object(fields) = component else {
            return XCTFail("Expected the recreated image component")
        }
        XCTAssertEqual(fields["assetId"], .string(newRecord.id))
        let calls = await context.api.recordedCalls()
        XCTAssertEqual(calls.filter { $0 == "upload" }.count, 2)
        XCTAssertTrue(calls.contains("download:\(newRecord.id)"))
        let accessibility = await context.api.lastUploadedAccessibility()
        XCTAssertEqual(accessibility?.alternativeText, "A labelled force diagram")
        XCTAssertEqual(accessibility?.decorative, false)
    }

    func testPublicationExpiresAtTheBoundaryAndInvalidExpiryIsNotTreatedAsLive() {
        let boundary = Date(timeIntervalSince1970: 1_800_000_000.125)
        var publication = WidgetPublication(
            slug: "student-link",
            url: URL(string: "https://studio.example/student-link")!,
            title: "Forces",
            schemaVersion: "1.0",
            createdAt: "2026-07-18T12:00:00.000Z",
            expiresAt: "2027-01-15T08:00:00.125Z",
            revokedAt: nil
        )

        XCTAssertFalse(publication.isExpired(at: boundary.addingTimeInterval(-0.001)))
        XCTAssertTrue(publication.isExpired(at: boundary))
        XCTAssertTrue(publication.isExpired(at: boundary.addingTimeInterval(0.001)))
        XCTAssertEqual(
            publication.expirationRefreshDate(after: boundary.addingTimeInterval(-0.001)),
            boundary
        )
        XCTAssertNil(publication.expirationRefreshDate(after: boundary))
        XCTAssertEqual(
            publication.formattedExpirationDate(
                locale: Locale(identifier: "en_GB"),
                timeZone: TimeZone(secondsFromGMT: 0)!
            ),
            "15 Jan 2027"
        )

        publication.expiresAt = "not-a-date"
        XCTAssertTrue(publication.isExpired(at: boundary))
        XCTAssertEqual(publication.formattedExpirationDate(), "not-a-date")
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
    private func makeRemoteContext(
        preparedImage: PreparedWidgetImage? = nil,
        canonicalUpload: DownloadedWidgetAsset? = nil
    ) throws -> RemoteTestContext {
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
        let api = RecordingStudioAPI(spec: spec, canonicalUpload: canonicalUpload)
        let store: StudioStore
        if let preparedImage {
            store = StudioStore(
                defaults: defaults,
                storageDirectory: storage,
                bundle: Bundle(for: StudioStore.self),
                api: api,
                prepareImage: { _ in preparedImage }
            )
        } else {
            store = StudioStore(
                defaults: defaults,
                storageDirectory: storage,
                bundle: Bundle(for: StudioStore.self),
                api: api
            )
        }
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

    private func samplePublication() -> WidgetPublication {
        WidgetPublication(
            slug: "student-link",
            url: URL(string: "https://studio.example/student-link")!,
            title: "Forces",
            schemaVersion: "1.0",
            createdAt: "2026-07-18T12:00:00.000Z",
            expiresAt: "2026-10-16T12:00:00.000Z",
            revokedAt: nil
        )
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
    case ambiguousPatchWithUnrelatedRevision
    case loseSaveResponseAfterCommit
    case conflictOnSave
    case conflictOnPatch
    case draftNotFoundOnDelete
    case draftNotFoundOnFetch
    case publicationNotFoundOnRevoke
    case holdPatch
    case holdFetch
}

private actor RecordingStudioAPI: StudioAPI {
    private var spec: WidgetSpec
    private var version = 1
    private var downloadableAsset: DownloadedWidgetAsset?
    private var uploadedAccessibility: UploadedWidgetImage.Accessibility?
    private let canonicalUpload: DownloadedWidgetAsset?
    private var calls: [String] = []
    private var mode: TestAPIMode = .normal
    private var heldPatch: CheckedContinuation<Void, Never>?
    private var heldFetch: CheckedContinuation<Void, Never>?
    private var listedPublication: WidgetPublication?
    private var listedPublicationNeedsUpdate = false
    private var uploadCount = 0

    init(spec: WidgetSpec, canonicalUpload: DownloadedWidgetAsset? = nil) {
        self.spec = spec
        self.canonicalUpload = canonicalUpload
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
        if mode == .draftNotFoundOnFetch {
            mode = .normal
            throw StudioAPIError.server(
                status: 404,
                code: "DRAFT_NOT_FOUND",
                message: "This draft expired."
            )
        }
        if mode == .holdFetch {
            mode = .normal
            await withCheckedContinuation { continuation in
                heldFetch = continuation
            }
        }
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
                publication: listedPublication,
                publicationNeedsUpdate: listedPublicationNeedsUpdate
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
        if mode == .ambiguousPatchWithUnrelatedRevision {
            mode = .normal
            self.version += 1
            spec.metadata.summary = "Changed independently on another iPad"
            throw StudioAPIError.transport("The response was interrupted")
        }
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

    func publish(draftID: String, version: Int) async throws -> WidgetPublication {
        calls.append("publish:\(draftID):\(version)")
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
        uploadCount += 1
        uploadedAccessibility = .init(alternativeText: alternativeText, decorative: decorative)
        let canonical = canonicalUpload ?? DownloadedWidgetAsset(
            data: image.data,
            mediaType: image.mediaType
        )
        downloadableAsset = canonical
        let assetID = uploadCount == 1
            ? "asset-0123456789abcdef0123456789abcdef"
            : "asset-fedcba9876543210fedcba9876543210"
        return UploadedWidgetImage(
            asset: WidgetImageAssetRecord(
                id: assetID,
                kind: "image",
                mediaType: canonical.mediaType,
                width: image.width,
                height: image.height,
                byteLength: canonical.data.count,
                sha256: SHA256.hash(data: canonical.data)
                    .map { String(format: "%02x", $0) }
                    .joined()
            ),
            accessibility: .init(alternativeText: alternativeText, decorative: decorative)
        )
    }

    func recordedCalls() -> [String] { calls }

    func lastUploadedAccessibility() -> UploadedWidgetImage.Accessibility? {
        uploadedAccessibility
    }

    func setMode(_ value: TestAPIMode) { mode = value }

    func replaceSpecForRestore(_ value: WidgetSpec, download: DownloadedWidgetAsset?) {
        spec = value
        version += 1
        downloadableAsset = download
    }

    func setPublicationForRestore(_ publication: WidgetPublication, needsUpdate: Bool) {
        listedPublication = publication
        listedPublicationNeedsUpdate = needsUpdate
    }

    func releaseHeldPatch() {
        heldPatch?.resume()
        heldPatch = nil
    }

    func releaseHeldFetch() {
        heldFetch?.resume()
        heldFetch = nil
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
