import Foundation
import XCTest
@testable import ClassroomWidgetsStudio

final class StudioStoreTests: XCTestCase {
    @MainActor
    func testGenerationCachesCanonicalHeadSource() async throws {
        let directory = temporaryDirectory()
        let generated = makeProject(revisionID: "r1", html: "<html><h1>Generated</h1></html>")
        let api = ArtifactAPIStub(generated: generated, revised: generated)
        let store = StudioStore(api: api, storageDirectory: directory, bundle: Bundle(for: Self.self))

        var brief = GuidedBriefDraft()
        brief.learningObjective = "Explain balanced forces"
        brief.studentAction = "Choose and explain"
        let result = try await store.createApprovedBrief(brief)

        XCTAssertEqual(result.artifact.headRevisionId, "r1")
        XCTAssertEqual(store.projects.first?.source.html, generated.source.html)
        let request = await api.lastGenerationRequest
        XCTAssertEqual(request?.brief.learningObjective, "Explain balanced forces")
        XCTAssertEqual(request?.brief.studentAction, "Choose and explain")
        XCTAssertNil(request?.preferredExampleRevisionId)

        let restored = StudioStore(api: api, storageDirectory: directory, bundle: Bundle(for: Self.self))
        XCTAssertEqual(restored.projects.first?.source.html, generated.source.html)
    }

    @MainActor
    func testRefinementUsesCurrentExpectedHeadAndReplacesSourceAfterSuccess() async throws {
        let original = makeProject(revisionID: "r1", html: "<html>Original</html>")
        let revised = makeProject(
            revisionID: "r2",
            parentRevisionID: "r1",
            html: "<html>Revised</html>"
        )
        let api = ArtifactAPIStub(generated: original, revised: revised)
        let directory = temporaryDirectory()
        let store = StudioStore(api: api, storageDirectory: directory, bundle: Bundle(for: Self.self))
        var brief = GuidedBriefDraft()
        brief.learningObjective = "Forces"
        brief.studentAction = "Choose"
        _ = try await store.createApprovedBrief(brief)

        try await store.refine("Use larger labels", projectID: original.id)

        let request = await api.lastRevisionRequest
        XCTAssertEqual(request?.instruction, "Use larger labels")
        XCTAssertEqual(request?.expectedHeadRevisionID, "r1")
        XCTAssertEqual(store.projects.first?.source.html, revised.source.html)
    }

    private func temporaryDirectory() -> URL {
        FileManager.default.temporaryDirectory
            .appending(path: "StudioStoreTests-\(UUID().uuidString)", directoryHint: .isDirectory)
    }
}

private actor ArtifactAPIStub: StudioAPI {
    struct RevisionRequest: Sendable {
        let instruction: String
        let expectedHeadRevisionID: String
    }

    let generated: ArtifactProject
    let revised: ArtifactProject
    private(set) var lastGenerationRequest: GuidedGenerationRequest?
    private(set) var lastRevisionRequest: RevisionRequest?

    init(generated: ArtifactProject, revised: ArtifactProject) {
        self.generated = generated
        self.revised = revised
    }

    func hasDeviceCredential() async -> Bool { true }
    func registerDevice(accessCode: String) async throws {}
    func generate(request: GuidedGenerationRequest) async throws -> ArtifactProject {
        lastGenerationRequest = request
        return generated
    }
    func listArtifacts() async throws -> [Artifact] { [generated.artifact] }
    func searchExamples(brief: String) async throws -> [ExampleSearchDescriptor] { [] }
    func getArtifact(id: String) async throws -> ArtifactProject { generated }
    func updateArtifact(_ artifact: Artifact) async throws -> Artifact { artifact }
    func deleteArtifact(id: String) async throws {}
    func revise(id: String, instruction: String, expectedHeadRevisionId: String) async throws -> ArtifactProject {
        lastRevisionRequest = RevisionRequest(
            instruction: instruction,
            expectedHeadRevisionID: expectedHeadRevisionId
        )
        return revised
    }
    func revisions(id: String) async throws -> [ArtifactRevision] { generated.revisions }
    func source(revision: ArtifactRevision) async throws -> ArtifactSource { generated.source }
    func setHead(id: String, revisionId: String, expectedHeadRevisionId: String) async throws -> ArtifactProject { revised }
    func remix(id: String, revisionId: String?) async throws -> ArtifactProject { revised }
    func downloadAsset(id: String) async throws -> DownloadedWidgetAsset {
        DownloadedWidgetAsset(data: Data([1, 2, 3]), mediaType: "image/jpeg")
    }
    func uploadScreenshot(revisionId: String, jpeg: Data) async throws {}
    func publish(id: String, revisionId: String?) async throws -> ArtifactPublication {
        ArtifactPublication(
            slug: "class",
            url: URL(string: "https://example.test/class")!,
            title: "Artifact",
            createdAt: "2026-08-02T00:00:00Z",
            expiresAt: "2026-11-02T00:00:00Z"
        )
    }
    func revoke(slug: String) async throws {}
    func extend(slug: String, days: Int) async throws -> ArtifactPublication {
        try await publish(id: generated.id, revisionId: nil)
    }
    func uploadImage(
        _ image: PreparedWidgetImage,
        alternativeText: String?,
        decorative: Bool
    ) async throws -> UploadedWidgetImage {
        UploadedWidgetImage(
            asset: WidgetImageAssetRecord(
                id: "asset-1",
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
}

private func makeProject(
    revisionID: String,
    parentRevisionID: String? = nil,
    html: String
) -> ArtifactProject {
    let artifactID = "artifact-1"
    let timestamp = "2026-08-02T00:00:00Z"
    let revision = ArtifactRevision(
        id: revisionID,
        artifactId: artifactID,
        parentRevisionId: parentRevisionID,
        sourceHash: "hash-\(revisionID)",
        byteLength: html.utf8.count,
        kind: parentRevisionID == nil ? .generate : .revise,
        instruction: parentRevisionID == nil ? nil : "Use larger labels",
        model: "test-model",
        promptVersion: "test-v1",
        createdAt: timestamp
    )
    let artifact = Artifact(
        id: artifactID,
        title: "Forces",
        summary: "A forces check",
        tags: ["science"],
        creationBrief: "Create a forces check",
        headRevisionId: revisionID,
        createdAt: timestamp,
        updatedAt: timestamp,
        headRevision: revision,
        html: html
    )
    return ArtifactProject(
        artifact: artifact,
        source: ArtifactSource(revision: revision, html: html),
        revisions: [revision]
    )
}
