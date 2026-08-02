import XCTest
@testable import ClassroomWidgetsStudio

final class ArtifactModelsTests: XCTestCase {
    func testArtifactResponseDecodesHeadHTMLAndRevision() throws {
        let data = Data(#"{"id":"a1","title":"Forces","summary":"Check forces","tags":[],"creationBrief":"brief","headRevisionId":"r1","createdAt":"2026-08-02T00:00:00Z","updatedAt":"2026-08-02T00:00:00Z","headRevision":{"id":"r1","artifactId":"a1","sourceHash":"abc","byteLength":20,"kind":"generate","model":"model","promptVersion":"1","createdAt":"2026-08-02T00:00:00Z"},"html":"<html></html>"}"#.utf8)
        let artifact = try JSONDecoder().decode(Artifact.self, from: data)
        XCTAssertEqual(artifact.headRevision?.kind, .generate)
        XCTAssertEqual(artifact.html, "<html></html>")
        XCTAssertEqual(artifact.createdAt, "2026-08-02T00:00:00Z", "ISO timestamps remain wire-format strings")
    }

    @MainActor func testBundledHTMLExampleLoads() {
        let store = StudioStore(storageDirectory: FileManager.default.temporaryDirectory.appending(path: UUID().uuidString), bundle: Bundle(for: Self.self))
        XCTAssertFalse(store.examples.isEmpty)
        XCTAssertTrue(store.examples.allSatisfy { $0.source.html.contains("<html") })
    }

    func testRelativeAssetURLResolvesThroughControlledPreviewScheme() throws {
        let url = try XCTUnwrap(URL(string: "assets/image-1", relativeTo: AssetSchemeHandler.documentBaseURL)?.absoluteURL)
        XCTAssertEqual(url.absoluteString, "classroom-widget://preview/assets/image-1")
        XCTAssertEqual(AssetSchemeHandler.assetID(from: url), "image-1")
    }
}
