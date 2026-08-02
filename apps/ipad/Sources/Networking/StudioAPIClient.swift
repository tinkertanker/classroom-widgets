import Foundation
import Security

protocol StudioAPI: Sendable {
    func hasDeviceCredential() async -> Bool
    func registerDevice(accessCode: String) async throws
    func generate(request: GuidedGenerationRequest) async throws -> ArtifactProject
    func listArtifacts() async throws -> [Artifact]
    func searchExamples(brief: String) async throws -> [ExampleSearchDescriptor]
    func getArtifact(id: String) async throws -> ArtifactProject
    func updateArtifact(_ artifact: Artifact) async throws -> Artifact
    func deleteArtifact(id: String) async throws
    func revise(id: String, instruction: String, expectedHeadRevisionId: String) async throws -> ArtifactProject
    func revisions(id: String) async throws -> [ArtifactRevision]
    func source(revision: ArtifactRevision) async throws -> ArtifactSource
    func setHead(id: String, revisionId: String, expectedHeadRevisionId: String) async throws -> ArtifactProject
    func remix(id: String, revisionId: String?) async throws -> ArtifactProject
    func downloadAsset(id: String) async throws -> DownloadedWidgetAsset
    func uploadScreenshot(revisionId: String, jpeg: Data) async throws
    func publish(id: String, revisionId: String?) async throws -> ArtifactPublication
    func revoke(slug: String) async throws
    func extend(slug: String, days: Int) async throws -> ArtifactPublication
    func uploadImage(_ image: PreparedWidgetImage, alternativeText: String?, decorative: Bool) async throws -> UploadedWidgetImage
}

protocol DeviceTokenProviding: Sendable {
    func token() async throws -> String
    func storeToken(_ value: String) async throws
}

protocol StudioHTTPTransport: Sendable {
    func data(for request: URLRequest) async throws -> (Data, HTTPURLResponse)
}

struct URLSessionStudioTransport: StudioHTTPTransport, @unchecked Sendable {
    let session: URLSession
    init(session: URLSession = .shared) { self.session = session }
    func data(for request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let (data, response) = try await session.data(for: request)
        guard let response = response as? HTTPURLResponse else { throw StudioAPIError.invalidResponse }
        return (data, response)
    }
}

actor KeychainDeviceTokenStore: DeviceTokenProviding {
    static let shared = KeychainDeviceTokenStore()
    private let service = "sg.tinkertanker.ClassroomWidgetsStudio"
    private let account = "device-ownership-token-v1"
    private var cached: String?

    func token() throws -> String {
        if let cached { return cached }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data, let value = String(data: data, encoding: .utf8)
        else { throw StudioAPIError.registrationRequired }
        cached = value
        return value
    }

    func storeToken(_ value: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        let attributes: [String: Any] = [
            kSecValueData as String: Data(value.utf8),
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock
        ]
        let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var item = query
            attributes.forEach { item[$0.key] = $0.value }
            guard SecItemAdd(item as CFDictionary, nil) == errSecSuccess else { throw StudioAPIError.registrationRequired }
        } else if status != errSecSuccess {
            throw StudioAPIError.registrationRequired
        }
        cached = value
    }
}

struct StudioAPIClient: StudioAPI, Sendable {
    let baseURL: URL
    let transport: any StudioHTTPTransport
    let tokenStore: any DeviceTokenProviding

    static func live() -> Self {
        let configured = ProcessInfo.processInfo.environment["STUDIO_API_BASE_URL"]
            ?? Bundle.main.object(forInfoDictionaryKey: "StudioAPIBaseURL") as? String
            ?? "http://127.0.0.1:8787"
        return Self(baseURL: URL(string: configured)!, transport: URLSessionStudioTransport(), tokenStore: KeychainDeviceTokenStore.shared)
    }

    func hasDeviceCredential() async -> Bool {
        guard let token = try? await tokenStore.token() else { return false }
        do { _ = try await refresh(using: token); return true }
        catch let error as StudioAPIError { return !error.requiresRegistration }
        catch { return true }
    }

    func registerDevice(accessCode: String) async throws {
        struct Body: Encodable { let accessCode: String }
        let cleaned = accessCode.trimmingCharacters(in: .whitespacesAndNewlines).uppercased().replacingOccurrences(of: "-", with: "")
        let registration: DeviceRegistration = try await unauthorised("/v1/devices/register", method: "POST", body: Body(accessCode: cleaned))
        try await tokenStore.storeToken(registration.token)
    }

    func generate(request: GuidedGenerationRequest) async throws -> ArtifactProject {
        let envelope: ProjectEnvelope = try await send("/v1/artifacts/generate", method: "POST", body: request)
        return try await hydrate(envelope)
    }

    func listArtifacts() async throws -> [Artifact] {
        struct Envelope: Decodable { let artifacts: [Artifact] }
        let envelope: Envelope = try await sendWithoutBody("/v1/artifacts", method: "GET")
        return envelope.artifacts
    }

    func searchExamples(brief: String) async throws -> [ExampleSearchDescriptor] {
        struct Envelope: Decodable { let examples: [ExampleSearchDescriptor] }
        var components = URLComponents(); components.path = "/v1/examples/search"
        components.queryItems = [.init(name: "q", value: brief)]
        let envelope: Envelope = try await sendWithoutBody(components.string!, method: "GET")
        return envelope.examples
    }

    func getArtifact(id: String) async throws -> ArtifactProject {
        let envelope: ProjectEnvelope = try await sendWithoutBody("/v1/artifacts/\(path(id))", method: "GET")
        return try await hydrate(envelope)
    }

    func updateArtifact(_ artifact: Artifact) async throws -> Artifact {
        struct Body: Encodable {
            let title, summary: String
            let subject, level, locale, learningObjective: String?
            let tags: [String]; let creationBrief: String
        }
        let envelope: ArtifactEnvelope = try await send("/v1/artifacts/\(path(artifact.id))", method: "PATCH", body: Body(
            title: artifact.title, summary: artifact.summary, subject: artifact.subject, level: artifact.level,
            locale: artifact.locale, learningObjective: artifact.learningObjective, tags: artifact.tags,
            creationBrief: artifact.creationBrief
        ))
        return envelope.artifact
    }

    func deleteArtifact(id: String) async throws { try await sendEmpty("/v1/artifacts/\(path(id))", method: "DELETE") }

    func revise(id: String, instruction: String, expectedHeadRevisionId: String) async throws -> ArtifactProject {
        struct Body: Encodable { let instruction, expectedHeadRevisionId: String }
        let envelope: ProjectEnvelope = try await send("/v1/artifacts/\(path(id))/revisions", method: "POST", body: Body(instruction: instruction, expectedHeadRevisionId: expectedHeadRevisionId))
        return try await hydrate(envelope)
    }

    func revisions(id: String) async throws -> [ArtifactRevision] {
        let envelope: RevisionsEnvelope = try await sendWithoutBody("/v1/artifacts/\(path(id))/revisions", method: "GET")
        return envelope.revisions
    }

    func source(revision: ArtifactRevision) async throws -> ArtifactSource {
        let (data, _) = try await perform("/v1/revisions/\(path(revision.id))/source", method: "GET", body: nil, contentType: nil)
        guard let html = String(data: data, encoding: .utf8) else { throw StudioAPIError.invalidResponse }
        return ArtifactSource(revision: revision, html: html)
    }

    func setHead(id: String, revisionId: String, expectedHeadRevisionId: String) async throws -> ArtifactProject {
        struct Body: Encodable { let headRevisionId, expectedHeadRevisionId: String }
        let envelope: ProjectEnvelope = try await send("/v1/artifacts/\(path(id))", method: "PATCH", body: Body(headRevisionId: revisionId, expectedHeadRevisionId: expectedHeadRevisionId))
        return try await hydrate(envelope)
    }

    func remix(id: String, revisionId: String?) async throws -> ArtifactProject {
        let selected: String
        if let revisionId {
            selected = revisionId
        } else {
            let source: ProjectEnvelope = try await sendWithoutBody("/v1/artifacts/\(path(id))", method: "GET")
            selected = source.headRevision.id
        }
        struct Body: Encodable { let title: String? }
        let envelope: ProjectEnvelope = try await send("/v1/revisions/\(path(selected))/remix", method: "POST", body: Body(title: nil))
        return try await hydrate(envelope)
    }

    func downloadAsset(id: String) async throws -> DownloadedWidgetAsset {
        let (data, response) = try await perform(
            "/v1/assets/\(path(id))",
            method: "GET",
            body: nil,
            contentType: nil
        )
        let mediaType = response.value(forHTTPHeaderField: "Content-Type")?
            .split(separator: ";", maxSplits: 1)
            .first?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        guard let mediaType, mediaType.hasPrefix("image/"), !data.isEmpty else {
            throw StudioAPIError.invalidResponse
        }
        return DownloadedWidgetAsset(data: data, mediaType: mediaType)
    }

    func uploadScreenshot(revisionId: String, jpeg: Data) async throws {
        try await upload("/v1/revisions/\(path(revisionId))/screenshot", data: jpeg, contentType: "image/jpeg", headers: [:])
    }

    func publish(id: String, revisionId: String?) async throws -> ArtifactPublication {
        struct Body: Encodable { let expectedHeadRevisionId: String }
        let envelope: PublicationEnvelope = try await send("/v1/artifacts/\(path(id))/publish", method: "POST", body: Body(expectedHeadRevisionId: revisionId ?? ""))
        return envelope.publication
    }

    func revoke(slug: String) async throws { try await sendEmpty("/v1/publications/\(path(slug))", method: "DELETE") }

    func extend(slug: String, days: Int) async throws -> ArtifactPublication {
        struct Body: Encodable { let days: Int }
        let envelope: PublicationEnvelope = try await send("/v1/publications/\(path(slug))", method: "PATCH", body: Body(days: days))
        return envelope.publication
    }

    func uploadImage(_ image: PreparedWidgetImage, alternativeText: String?, decorative: Bool) async throws -> UploadedWidgetImage {
        var headers = [
            "Content-Length": String(image.data.count), "X-Image-Width": String(image.width),
            "X-Image-Height": String(image.height), "X-Image-SHA256": image.sha256,
            "X-Image-Decorative": decorative ? "true" : "false"
        ]
        if let alternativeText { headers["X-Image-Alt-Base64"] = Data(alternativeText.utf8).base64EncodedString() }
        let data = try await upload("/v1/assets", data: image.data, contentType: image.mediaType, headers: headers)
        return try decode(data)
    }

    private struct ArtifactEnvelope: Decodable { let artifact: Artifact }
    private struct RevisionsEnvelope: Decodable { let revisions: [ArtifactRevision] }
    private struct PublicationEnvelope: Decodable { let publication: ArtifactPublication }
    private struct ProjectEnvelope: Decodable { let artifact: Artifact; let headRevision: ArtifactRevision; let html: String? }

    private func hydrate(_ envelope: ProjectEnvelope) async throws -> ArtifactProject {
        let source = envelope.html.map { ArtifactSource(revision: envelope.headRevision, html: $0) }
            ?? (try await self.source(revision: envelope.headRevision))
        let history = try await revisions(id: envelope.artifact.id)
        return ArtifactProject(artifact: envelope.artifact, source: source, revisions: history)
    }

    private func send<Response: Decodable, Body: Encodable>(_ route: String, method: String, body: Body) async throws -> Response {
        let data = try JSONEncoder().encode(body)
        let (payload, _) = try await perform(route, method: method, body: data, contentType: "application/json")
        return try decode(payload)
    }

    private func unauthorised<Response: Decodable, Body: Encodable>(_ route: String, method: String, body: Body) async throws -> Response {
        var request = try request(route, method: method)
        request.httpBody = try JSONEncoder().encode(body)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let (payload, response) = try await transport.data(for: request)
        try validate(response, payload: payload)
        return try decode(payload)
    }

    private func sendWithoutBody<Response: Decodable>(_ route: String, method: String) async throws -> Response {
        let (payload, _) = try await perform(route, method: method, body: nil, contentType: nil)
        return try decode(payload)
    }

    private func sendEmpty(_ route: String, method: String) async throws {
        _ = try await perform(route, method: method, body: nil, contentType: nil)
    }

    @discardableResult
    private func upload(_ route: String, data: Data, contentType: String, headers: [String: String]) async throws -> Data {
        var request = try await authorisedRequest(route, method: "POST")
        request.httpBody = data
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        headers.forEach { request.setValue($0.value, forHTTPHeaderField: $0.key) }
        return try await execute(request).0
    }

    private func perform(_ route: String, method: String, body: Data?, contentType: String?) async throws -> (Data, HTTPURLResponse) {
        var request = try await authorisedRequest(route, method: method)
        request.httpBody = body
        if let contentType { request.setValue(contentType, forHTTPHeaderField: "Content-Type") }
        return try await execute(request)
    }

    private func authorisedRequest(_ route: String, method: String) async throws -> URLRequest {
        var result = try request(route, method: method)
        result.setValue(try await tokenStore.token(), forHTTPHeaderField: "X-Device-Token")
        return result
    }

    private func request(_ route: String, method: String) throws -> URLRequest {
        guard let url = URL(string: route, relativeTo: baseURL)?.absoluteURL else { throw StudioAPIError.invalidURL }
        var result = URLRequest(url: url)
        result.httpMethod = method
        result.timeoutInterval = 150
        result.setValue("application/json", forHTTPHeaderField: "Accept")
        return result
    }

    private func execute(_ request: URLRequest, mayRefresh: Bool = true) async throws -> (Data, HTTPURLResponse) {
        let (data, response): (Data, HTTPURLResponse)
        do { (data, response) = try await transport.data(for: request) }
        catch { throw StudioAPIError.transport(error.localizedDescription) }
        do { try validate(response, payload: data) }
        catch let error as StudioAPIError where mayRefresh && error.requiresRefresh {
            guard let old = request.value(forHTTPHeaderField: "X-Device-Token") else { throw error }
            let registration = try await refresh(using: old)
            var retry = request
            retry.setValue(registration.token, forHTTPHeaderField: "X-Device-Token")
            return try await execute(retry, mayRefresh: false)
        }
        return (data, response)
    }

    private func refresh(using token: String) async throws -> DeviceRegistration {
        var request = try request("/v1/devices/refresh", method: "POST")
        request.setValue(token, forHTTPHeaderField: "X-Device-Token")
        let (data, response) = try await transport.data(for: request)
        try validate(response, payload: data)
        let registration: DeviceRegistration = try decode(data)
        try await tokenStore.storeToken(registration.token)
        return registration
    }

    private func validate(_ response: HTTPURLResponse, payload: Data) throws {
        guard (200..<300).contains(response.statusCode) else {
            let error = try? JSONDecoder().decode(APIErrorEnvelope.self, from: payload).error
            throw StudioAPIError.server(response.statusCode, error?.code, error?.message ?? "Studio request failed.")
        }
    }

    private func decode<T: Decodable>(_ data: Data) throws -> T {
        do { return try JSONDecoder().decode(T.self, from: data) }
        catch { throw StudioAPIError.decoding(error.localizedDescription) }
    }

    private func path(_ value: String) -> String {
        var allowed = CharacterSet.alphanumerics
        allowed.insert(charactersIn: "-._~")
        return value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
    }
}

struct DeviceRegistration: Codable, Equatable, Sendable { let token, expiresAt: String }
private struct APIErrorEnvelope: Decodable { let error: APIErrorPayload }
private struct APIErrorPayload: Decodable { let code, message: String }

enum StudioAPIError: LocalizedError, Equatable {
    case invalidURL, invalidResponse, registrationRequired
    case transport(String), decoding(String), server(Int, String?, String)

    var errorDescription: String? {
        switch self {
        case .registrationRequired: "Enter your workshop access code before using Studio."
        case .invalidURL, .invalidResponse, .transport, .decoding, .server: "Studio could not complete this request. Check your connection and try again."
        }
    }
    var requiresRegistration: Bool { if case .server(401, let code, _) = self { return code == "DEVICE_REGISTRATION_REQUIRED" || code == "DEVICE_TOKEN_REQUIRED" }; return false }
    var requiresRefresh: Bool {
        if requiresRegistration { return true }
        if case .server(422, let code, _) = self { return code == "PUBLICATION_EXPIRY_LIMIT_REACHED" }
        return false
    }
}
