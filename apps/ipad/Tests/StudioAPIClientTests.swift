import XCTest
@testable import ClassroomWidgetsStudio

final class StudioAPIClientTests: XCTestCase {
    func testImportUsesDeviceOwnershipHeaderAndExpectedRoute() async throws {
        let spec = try sampleSpec()
        let remote = RemoteDraft(
            id: "draft-transport",
            title: spec.metadata.title,
            schemaVersion: spec.schemaVersion,
            spec: spec,
            version: 1,
            createdAt: "2026-07-18T12:00:00.000Z",
            updatedAt: "2026-07-18T12:00:00.000Z"
        )
        let data = try JSONEncoder().encode(DraftResponse(draft: remote))
        let transport = RecordingTransport(data: data, status: 201)
        let client = StudioAPIClient(
            baseURL: URL(string: "https://studio.example")!,
            transport: transport,
            tokenStore: StaticDeviceTokenStore(value: "secure-device-token")
        )

        let received = try await client.importDraft(spec: spec)
        let recordedRequest = await transport.lastRequest()
        let request = try XCTUnwrap(recordedRequest)

        XCTAssertEqual(received.id, remote.id)
        XCTAssertEqual(request.url?.absoluteString, "https://studio.example/v1/drafts")
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(request.value(forHTTPHeaderField: "X-Device-Token"), "secure-device-token")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Content-Type"), "application/json")
    }

    func testServerMessageIsPreservedForTeacher() async throws {
        let payload = Data(#"{"error":{"code":"POSSIBLE_PERSONAL_DATA","message":"Remove possible personal information before continuing."}}"#.utf8)
        let transport = RecordingTransport(data: payload, status: 422)
        let client = StudioAPIClient(
            baseURL: URL(string: "https://studio.example")!,
            transport: transport,
            tokenStore: StaticDeviceTokenStore(value: "secure-device-token")
        )

        do {
            _ = try await client.importDraft(spec: sampleSpec())
            XCTFail("Expected the server error")
        } catch let error as StudioAPIError {
            XCTAssertEqual(
                error,
                .server(
                    status: 422,
                    code: "POSSIBLE_PERSONAL_DATA",
                    message: "Remove possible personal information before continuing."
                )
            )
        }
    }

    func testFetchDraftUsesOwnedGetRoute() async throws {
        let spec = try sampleSpec()
        let remote = RemoteDraft(
            id: "draft/with space",
            title: spec.metadata.title,
            schemaVersion: spec.schemaVersion,
            spec: spec,
            version: 4,
            createdAt: "2026-07-18T12:00:00.000Z",
            updatedAt: "2026-07-18T12:05:00.000Z"
        )
        let transport = RecordingTransport(
            data: try JSONEncoder().encode(DraftResponse(draft: remote)),
            status: 200
        )
        let client = StudioAPIClient(
            baseURL: URL(string: "https://studio.example")!,
            transport: transport,
            tokenStore: StaticDeviceTokenStore(value: "secure-device-token")
        )

        let received = try await client.fetchDraft(draftID: remote.id)
        let recordedRequest = await transport.lastRequest()
        let request = try XCTUnwrap(recordedRequest)

        XCTAssertEqual(received, remote)
        XCTAssertEqual(request.httpMethod, "GET")
        XCTAssertEqual(request.url?.absoluteString, "https://studio.example/v1/drafts/draft%2Fwith%20space")
        XCTAssertEqual(request.value(forHTTPHeaderField: "X-Device-Token"), "secure-device-token")
        XCTAssertNil(request.httpBody)
    }

    func testListDraftsUsesOwnedCollectionRoute() async throws {
        let summary = RemoteDraftSummary(
            id: "draft-1",
            title: "Forces",
            schemaVersion: "1.0",
            version: 2,
            createdAt: "2026-07-18T12:00:00.000Z",
            updatedAt: "2026-07-18T12:05:00.000Z",
            publication: nil
        )
        let transport = RecordingTransport(
            data: try JSONEncoder().encode(DraftListResponse(drafts: [summary])),
            status: 200
        )
        let client = StudioAPIClient(
            baseURL: URL(string: "https://studio.example")!,
            transport: transport,
            tokenStore: StaticDeviceTokenStore(value: "secure-device-token")
        )

        let received = try await client.listDrafts()
        let recordedRequest = await transport.lastRequest()
        let request = try XCTUnwrap(recordedRequest)

        XCTAssertEqual(received, [summary])
        XCTAssertEqual(request.url?.absoluteString, "https://studio.example/v1/drafts")
        XCTAssertEqual(request.httpMethod, "GET")
        XCTAssertEqual(request.value(forHTTPHeaderField: "X-Device-Token"), "secure-device-token")
    }

    func testDownloadAssetUsesOwnedRouteAndPreservesMediaType() async throws {
        let bytes = Data([0xff, 0xd8, 0xff, 0xd9])
        let transport = RecordingTransport(
            data: bytes,
            status: 200,
            headers: ["Content-Type": "image/jpeg"]
        )
        let client = StudioAPIClient(
            baseURL: URL(string: "https://studio.example")!,
            transport: transport,
            tokenStore: StaticDeviceTokenStore(value: "secure-device-token")
        )

        let received = try await client.downloadAsset(id: "asset/one")
        let recordedRequest = await transport.lastRequest()
        let request = try XCTUnwrap(recordedRequest)

        XCTAssertEqual(received, DownloadedWidgetAsset(data: bytes, mediaType: "image/jpeg"))
        XCTAssertEqual(request.url?.absoluteString, "https://studio.example/v1/assets/asset%2Fone")
        XCTAssertEqual(request.httpMethod, "GET")
        XCTAssertEqual(request.value(forHTTPHeaderField: "X-Device-Token"), "secure-device-token")
    }

    func testWorkshopRegistrationIsUnauthorisedAndStoresIssuedCredential() async throws {
        let token = makeCredential(expiry: Date().addingTimeInterval(86_400))
        let registration = DeviceRegistration(
            token: token,
            expiresAt: "2026-07-19T12:00:00.000Z"
        )
        let transport = RecordingTransport(
            data: try JSONEncoder().encode(registration),
            status: 201
        )
        let credentials = RecordingCredentialStore()
        let client = StudioAPIClient(
            baseURL: URL(string: "https://studio.example")!,
            transport: transport,
            tokenStore: credentials
        )

        let received = try await client.registerDevice(accessCode: " pilot-ab12 ")
        let recordedRequest = await transport.lastRequest()
        let request = try XCTUnwrap(recordedRequest)
        let body = try XCTUnwrap(request.httpBody)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: String])

        XCTAssertEqual(received, registration)
        XCTAssertEqual(request.url?.absoluteString, "https://studio.example/v1/devices/register")
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertNil(request.value(forHTTPHeaderField: "X-Device-Token"))
        XCTAssertEqual(object["accessCode"], "PILOT-AB12")
        let storedToken = try await credentials.token()
        XCTAssertEqual(storedToken, token)
    }

    func testLegacyOrExpiredCredentialRequiresRegistration() async throws {
        let transport = RecordingTransport(data: Data(), status: 200)
        let legacyClient = StudioAPIClient(
            baseURL: URL(string: "https://studio.example")!,
            transport: transport,
            tokenStore: StaticDeviceTokenStore(value: "legacy-random-device-token-that-is-long-enough")
        )
        let expiredClient = StudioAPIClient(
            baseURL: URL(string: "https://studio.example")!,
            transport: transport,
            tokenStore: StaticDeviceTokenStore(value: makeCredential(expiry: Date(timeIntervalSince1970: 0)))
        )

        let legacyIsValid = await legacyClient.hasDeviceCredential()
        let expiredIsValid = await expiredClient.hasDeviceCredential()
        XCTAssertFalse(legacyIsValid)
        XCTAssertFalse(expiredIsValid)
    }

    func testRegistrationRequiredResponseClearsStoredCredential() async throws {
        let payload = Data(#"{"error":{"code":"DEVICE_REGISTRATION_REQUIRED","message":"Enter a workshop access code."}}"#.utf8)
        let transport = RecordingTransport(data: payload, status: 401)
        let credentials = RecordingCredentialStore(
            value: makeCredential(expiry: Date().addingTimeInterval(86_400))
        )
        let client = StudioAPIClient(
            baseURL: URL(string: "https://studio.example")!,
            transport: transport,
            tokenStore: credentials
        )

        do {
            _ = try await client.importDraft(spec: sampleSpec())
            XCTFail("Expected registration to be required")
        } catch let error as StudioAPIError {
            XCTAssertEqual(
                error,
                .server(status: 401, code: "DEVICE_REGISTRATION_REQUIRED", message: "Enter a workshop access code.")
            )
        }
        let storedToken = await credentials.storedToken()
        XCTAssertNil(storedToken)
    }

    private func sampleSpec() throws -> WidgetSpec {
        let repository = FixtureRepository()
        return try XCTUnwrap(repository.loadExamples(from: Bundle(for: StudioStore.self)).first?.spec)
    }

    private func makeCredential(expiry: Date) -> String {
        let payload: [String: Any] = [
            "version": 1,
            "ownerId": String(repeating: "a", count: 32),
            "expiresAt": Int(expiry.timeIntervalSince1970 * 1_000)
        ]
        let data = try! JSONSerialization.data(withJSONObject: payload)
        let encoded = data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
        return "cw1.\(encoded).\(String(repeating: "s", count: 43))"
    }
}

private struct DraftResponse: Encodable { let draft: RemoteDraft }
private struct DraftListResponse: Encodable { let drafts: [RemoteDraftSummary] }

private actor RecordingTransport: StudioHTTPTransport {
    private let data: Data
    private let status: Int
    private let headers: [String: String]
    private var request: URLRequest?

    init(data: Data, status: Int, headers: [String: String] = ["Content-Type": "application/json"]) {
        self.data = data
        self.status = status
        self.headers = headers
    }

    func data(for request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        self.request = request
        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: status,
            httpVersion: "HTTP/2",
            headerFields: headers
        )!
        return (data, response)
    }

    func lastRequest() -> URLRequest? { request }
}

private actor RecordingCredentialStore: DeviceTokenProviding {
    private var value: String?

    init(value: String? = nil) {
        self.value = value
    }

    func token() throws -> String {
        guard let value else { throw StudioAPIError.deviceRegistrationRequired }
        return value
    }

    func storeToken(_ value: String) {
        self.value = value
    }

    func clearToken() {
        value = nil
    }

    func storedToken() -> String? { value }
}
