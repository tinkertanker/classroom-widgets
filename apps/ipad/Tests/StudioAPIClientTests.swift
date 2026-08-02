import XCTest
@testable import ClassroomWidgetsStudio

final class StudioAPIClientTests: XCTestCase {
    func testGenerateSendsStructuredGuidedBriefAndDecodesProjectEnvelope() async throws {
        let transport = RecordingTransport(responses: [projectEnvelopeData, revisionsData])
        let request = GuidedGenerationRequest(
            creationBrief: "A guided brief",
            brief: .init(
                learnerContext: "Primary 5 Mathematics",
                learningObjective: "Compare fractions",
                studentAction: "Choose and explain",
                sourceContent: "Use halves and quarters",
                feedback: "Explain each answer",
                classroomFit: "Five minutes independently"
            ),
            preferredExampleRevisionId: nil
        )

        _ = try await client(transport).generate(request: request)

        let sent = await transport.requests[0]
        XCTAssertEqual(sent.url?.path, "/v1/artifacts/generate")
        let body = try XCTUnwrap(try JSONSerialization.jsonObject(with: sent.httpBody!) as? [String: Any])
        XCTAssertEqual(body["creationBrief"] as? String, "A guided brief")
        XCTAssertEqual((body["brief"] as? [String: Any])?["learnerContext"] as? String, "Primary 5 Mathematics")
        XCTAssertNil(body["preferredExampleRevisionId"], "nil optional fields are omitted by Swift's encoder")
    }

    func testArtifactGETDecodesDirectArtifactThenFetchesRevisionList() async throws {
        let transport = RecordingTransport(responses: [projectEnvelopeData, revisionsData])
        let project = try await client(transport).getArtifact(id: "a1")
        XCTAssertEqual(project.source.html, "<html><img src=\"assets/image-1\"></html>")
        XCTAssertEqual(project.revisions.map(\.id), ["r1"])
        let requests = await transport.requests
        XCTAssertEqual(requests.map { $0.url!.path }, ["/v1/artifacts/a1", "/v1/artifacts/a1/revisions"])
        XCTAssertEqual(requests.first?.value(forHTTPHeaderField: "X-Device-Token"), "device-token")
        XCTAssertNil(requests.first?.value(forHTTPHeaderField: "Authorization"))
    }

    func testArtifactGETPairsRawHTMLSourceWithHeadRevisionWhenNotInline() async throws {
        let envelope = Data(#"{"artifact":{"id":"a1","title":"Forces","summary":"Check forces","tags":[],"creationBrief":"brief","headRevisionId":"r1","createdAt":"2026-08-02T00:00:00Z","updatedAt":"2026-08-02T00:00:00Z"},"headRevision":{"id":"r1","artifactId":"a1","sourceHash":"abc","byteLength":50,"kind":"generate","model":"model","promptVersion":"1","createdAt":"2026-08-02T00:00:00Z"},"html":null}"#.utf8)
        let transport = RecordingTransport(responses: [envelope, Data("<!doctype html><html></html>".utf8), revisionsData])

        let project = try await client(transport).getArtifact(id: "a1")

        XCTAssertEqual(project.source.revision.id, "r1")
        XCTAssertEqual(project.source.html, "<!doctype html><html></html>")
        let requests = await transport.requests
        XCTAssertEqual(requests.map { $0.url!.path }, [
            "/v1/artifacts/a1",
            "/v1/revisions/r1/source",
            "/v1/artifacts/a1/revisions"
        ])
    }

    func testReviseSendsConcurrencyBody() async throws {
        let transport = RecordingTransport(responses: [projectEnvelopeData, revisionsData])
        _ = try await client(transport).revise(id: "a1", instruction: "Use larger labels", expectedHeadRevisionId: "r0")
        let request = await transport.requests[0]
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(request.url?.path, "/v1/artifacts/a1/revisions")
        XCTAssertEqual(try JSONSerialization.jsonObject(with: request.httpBody!) as? NSDictionary, ["instruction": "Use larger labels", "expectedHeadRevisionId": "r0"])
    }

    func testSetHeadAndPublishUseExpectedHeadContracts() async throws {
        let publication = Data(#"{"publication":{"slug":"class-1","url":"https://example.test/class-1","title":"Forces","createdAt":"2026-08-02T00:00:00Z","expiresAt":"2026-11-01T00:00:00Z"}}"#.utf8)
        let transport = RecordingTransport(responses: [projectEnvelopeData, revisionsData, publication])
        let client = client(transport)

        _ = try await client.setHead(id: "a1", revisionId: "r1", expectedHeadRevisionId: "r2")
        _ = try await client.publish(id: "a1", revisionId: "r1")

        let requests = await transport.requests
        XCTAssertEqual(requests[0].url?.path, "/v1/artifacts/a1")
        XCTAssertEqual(requests[0].httpMethod, "PATCH")
        XCTAssertEqual(
            try JSONSerialization.jsonObject(with: requests[0].httpBody!) as? NSDictionary,
            ["headRevisionId": "r1", "expectedHeadRevisionId": "r2"]
        )
        XCTAssertEqual(requests[2].url?.path, "/v1/artifacts/a1/publish")
        XCTAssertEqual(
            try JSONSerialization.jsonObject(with: requests[2].httpBody!) as? NSDictionary,
            ["expectedHeadRevisionId": "r1"]
        )
    }

    func testExampleSearchPostsBriefBody() async throws {
        let transport = RecordingTransport(responses: [Data(#"{"examples":[]}"#.utf8)])
        _ = try await client(transport).searchExamples(brief: "Secondary forces diagnostic")
        let request = await transport.requests[0]
        XCTAssertEqual(request.httpMethod, "GET")
        XCTAssertEqual(request.url?.path, "/v1/examples/search")
        XCTAssertEqual(URLComponents(url: request.url!, resolvingAgainstBaseURL: false)?.queryItems?.first?.value, "Secondary forces diagnostic")
    }

    func testPublicationRoutesPreservePatchAndDeleteContract() async throws {
        let publication = Data(#"{"slug":"class-1","url":"https://example.test/p/class-1","title":"Forces","createdAt":"2026-08-02T00:00:00Z","expiresAt":"2026-11-01T00:00:00Z"}"#.utf8)
        let transport = RecordingTransport(responses: [Data(#"{"publication":\#(String(data: publication, encoding: .utf8)!)}"#.utf8), Data()])
        let client = client(transport)
        _ = try await client.extend(slug: "class-1", days: 90)
        try await client.revoke(slug: "class-1")
        let requests = await transport.requests
        XCTAssertEqual(requests.map(\.httpMethod), ["PATCH", "DELETE"])
        XCTAssertEqual(requests.map { $0.url!.path }, ["/v1/publications/class-1", "/v1/publications/class-1"])
        XCTAssertEqual(try JSONSerialization.jsonObject(with: requests[0].httpBody!) as? NSDictionary, ["days": 90])
    }

    func testAssetUploadUsesExistingHeaderContract() async throws {
        let response = Data(#"{"asset":{"id":"image-1","kind":"image","mediaType":"image/jpeg","width":10,"height":20,"byteLength":3,"sha256":"hash"},"accessibility":{"alternativeText":"A diagram","decorative":false}}"#.utf8)
        let transport = RecordingTransport(responses: [response])
        let image = PreparedWidgetImage(data: Data([1, 2, 3]), mediaType: "image/jpeg", width: 10, height: 20, sha256: "hash")
        _ = try await client(transport).uploadImage(image, alternativeText: "A diagram", decorative: false)
        let request = await transport.requests[0]
        XCTAssertEqual(request.url?.path, "/v1/assets")
        XCTAssertEqual(request.value(forHTTPHeaderField: "X-Image-Width"), "10")
        XCTAssertEqual(request.value(forHTTPHeaderField: "X-Image-Alt-Base64"), Data("A diagram".utf8).base64EncodedString())
    }

    private func client(_ transport: RecordingTransport) -> StudioAPIClient {
        StudioAPIClient(baseURL: URL(string: "https://studio.example/")!, transport: transport, tokenStore: TestTokenStore())
    }

    private var projectEnvelopeData: Data { Data(#"{"artifact":{"id":"a1","title":"Forces","summary":"Check forces","tags":[],"creationBrief":"brief","headRevisionId":"r1","createdAt":"2026-08-02T00:00:00.123Z","updatedAt":"2026-08-02T00:00:00Z"},"headRevision":{"id":"r1","artifactId":"a1","sourceHash":"abc","byteLength":50,"kind":"revise","instruction":"Larger labels","model":"model","promptVersion":"1","createdAt":"2026-08-02T00:00:00Z"},"html":"<html><img src=\"assets/image-1\"></html>"}"#.utf8) }
    private var revisionsData: Data { Data(#"{"revisions":[{"id":"r1","artifactId":"a1","sourceHash":"abc","byteLength":50,"kind":"revise","instruction":"Larger labels","model":"model","promptVersion":"1","createdAt":"2026-08-02T00:00:00Z"}]}"#.utf8) }
}

private actor RecordingTransport: StudioHTTPTransport {
    private(set) var requests: [URLRequest] = []
    private var responses: [Data]
    init(responses: [Data]) { self.responses = responses }
    func data(for request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        requests.append(request)
        let data = responses.removeFirst()
        return (data, HTTPURLResponse(url: request.url!, statusCode: data.isEmpty ? 204 : 200, httpVersion: nil, headerFields: nil)!)
    }
}

private actor TestTokenStore: DeviceTokenProviding {
    func token() async throws -> String { "device-token" }
    func storeToken(_ value: String) async throws {}
}
