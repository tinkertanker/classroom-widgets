import Foundation
import Security

protocol StudioAPI: Sendable {
    func hasDeviceCredential() async -> Bool
    func registerDevice(accessCode: String) async throws -> DeviceRegistration
    func listDrafts() async throws -> [RemoteDraftSummary]
    func downloadAsset(id: String) async throws -> DownloadedWidgetAsset
    func generate(from brief: GuidedBriefDraft) async throws -> RemoteDraft
    func importDraft(spec: WidgetSpec) async throws -> RemoteDraft
    func fetchDraft(draftID: String) async throws -> RemoteDraft
    func patch(draftID: String, version: Int, instruction: String) async throws -> RemoteDraft
    func save(draftID: String, version: Int, spec: WidgetSpec, note: String) async throws -> RemoteDraft
    func deleteDraft(draftID: String) async throws
    func publish(draftID: String, version: Int) async throws -> WidgetPublication
    func extend(slug: String, days: Int) async throws -> WidgetPublication
    func revoke(slug: String) async throws
    func uploadImage(
        _ image: PreparedWidgetImage,
        alternativeText: String?,
        decorative: Bool
    ) async throws -> UploadedWidgetImage
}

extension StudioAPI {
    func hasDeviceCredential() async -> Bool { true }

    func registerDevice(accessCode: String) async throws -> DeviceRegistration {
        throw StudioAPIError.deviceRegistrationRequired
    }

    func listDrafts() async throws -> [RemoteDraftSummary] { [] }

    func downloadAsset(id: String) async throws -> DownloadedWidgetAsset {
        throw StudioAPIError.invalidResponse
    }
}

protocol DeviceTokenProviding: Sendable {
    func token() async throws -> String
    func storeToken(_ value: String) async throws
    func clearToken() async
}

protocol StudioHTTPTransport: Sendable {
    func data(for request: URLRequest) async throws -> (Data, HTTPURLResponse)
}

struct URLSessionStudioTransport: StudioHTTPTransport, @unchecked Sendable {
    let session: URLSession

    init(session: URLSession = .shared) {
        self.session = session
    }

    func data(for request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw StudioAPIError.invalidResponse
        }
        return (data, http)
    }
}

actor KeychainDeviceTokenStore: DeviceTokenProviding {
    static let shared = KeychainDeviceTokenStore()

    private let service = "sg.tinkertanker.ClassroomWidgetsStudio"
    private let account = "device-ownership-token-v1"
    private var cachedToken: String?

    func token() throws -> String {
        if let cachedToken { return cachedToken }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecSuccess,
           let data = result as? Data,
           let value = String(data: data, encoding: .utf8) {
            // Non-ThisDeviceOnly items can be restored from an encrypted device
            // backup, which avoids permanently orphaning a teacher's links when
            // they replace their iPad.
            let update: [String: Any] = [
                kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock
            ]
            let updateQuery: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: service,
                kSecAttrAccount as String: account
            ]
            SecItemUpdate(updateQuery as CFDictionary, update as CFDictionary)
            cachedToken = value
            return value
        }
        guard status == errSecItemNotFound else {
            throw StudioAPIError.deviceTokenUnavailable(status)
        }
        throw StudioAPIError.deviceRegistrationRequired
    }

    func storeToken(_ value: String) throws {
        let data = Data(value.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        let update: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock
        ]
        let updateStatus = SecItemUpdate(query as CFDictionary, update as CFDictionary)
        if updateStatus == errSecSuccess {
            cachedToken = value
            return
        }
        guard updateStatus == errSecItemNotFound else {
            throw StudioAPIError.deviceTokenUnavailable(updateStatus)
        }
        let add: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock
        ]
        let addStatus = SecItemAdd(add as CFDictionary, nil)
        guard addStatus == errSecSuccess else {
            throw StudioAPIError.deviceTokenUnavailable(addStatus)
        }
        cachedToken = value
    }

    func clearToken() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        SecItemDelete(query as CFDictionary)
        cachedToken = nil
    }
}

struct StaticDeviceTokenStore: DeviceTokenProviding {
    let value: String
    func token() async throws -> String { value }
    func storeToken(_ value: String) async throws {}
    func clearToken() async {}
}

struct StudioAPIClient: StudioAPI, Sendable {
    let baseURL: URL
    let transport: any StudioHTTPTransport
    let tokenStore: any DeviceTokenProviding

    static func live() -> StudioAPIClient {
        let environmentValue = ProcessInfo.processInfo.environment["STUDIO_API_BASE_URL"]
        let configuredValue = Bundle.main.object(forInfoDictionaryKey: "StudioAPIBaseURL") as? String
        #if DEBUG
        let fallback = "http://127.0.0.1:8787"
        #else
        let fallback = "https://classroom-widgets-studio-api.dark-cell-6287.workers.dev"
        #endif
        let value = environmentValue ?? configuredValue ?? fallback
        return StudioAPIClient(
            baseURL: URL(string: value) ?? URL(string: fallback)!,
            transport: URLSessionStudioTransport(),
            tokenStore: KeychainDeviceTokenStore.shared
        )
    }

    func hasDeviceCredential() async -> Bool {
        guard let token = try? await tokenStore.token() else { return false }
        if Self.credentialHasTimeRemaining(token) { return true }

        do {
            _ = try await refreshDeviceCredential(using: token)
            return true
        } catch let error as StudioAPIError {
            // A transient network/service/decoding failure does not prove that
            // the ownership credential is lost. Keep it available for another
            // refresh attempt instead of directing the teacher to register a
            // new owner. Only an authoritative rejection permits that fallback.
            return !error.requiresDeviceRegistration
        } catch {
            return true
        }
    }

    func registerDevice(accessCode: String) async throws -> DeviceRegistration {
        guard !(await hasDeviceCredential()) else {
            throw StudioAPIError.deviceCredentialAlreadyActive
        }
        guard let url = URL(string: "/v1/devices/register", relativeTo: baseURL)?.absoluteURL else {
            throw StudioAPIError.invalidURL
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 30
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(
            RegistrationRequest(accessCode: accessCode.trimmingCharacters(in: .whitespacesAndNewlines).uppercased())
        )
        let (data, _) = try await execute(request)
        let registration = try decodeDeviceRegistration(data)
        guard Self.credentialHasTimeRemaining(registration.token) else {
            throw StudioAPIError.decoding("Studio received an invalid workshop credential.")
        }
        try await tokenStore.storeToken(registration.token)
        return registration
    }

    func generate(from brief: GuidedBriefDraft) async throws -> RemoteDraft {
        let body = GenerateRequest(
            level: brief.apiLevel,
            subject: brief.apiSubject,
            learningObjective: brief.learningObjective,
            studentAction: brief.studentAction,
            content: brief.apiContent,
            feedback: brief.feedback.nilIfBlank,
            durationMinutes: brief.durationMinutes,
            accessibilityNeeds: brief.apiLearnerSupport
        )
        let envelope: DraftEnvelope = try await send(
            path: "/v1/drafts/generate",
            method: "POST",
            body: body
        )
        return envelope.draft
    }

    func importDraft(spec: WidgetSpec) async throws -> RemoteDraft {
        let envelope: DraftEnvelope = try await send(
            path: "/v1/drafts",
            method: "POST",
            body: ImportRequest(spec: spec)
        )
        return envelope.draft
    }

    func listDrafts() async throws -> [RemoteDraftSummary] {
        let envelope: DraftListEnvelope = try await sendWithoutBody(
            path: "/v1/drafts",
            method: "GET"
        )
        return envelope.drafts
    }

    func fetchDraft(draftID: String) async throws -> RemoteDraft {
        let envelope: DraftEnvelope = try await sendWithoutBody(
            path: "/v1/drafts/\(pathComponent(draftID))",
            method: "GET"
        )
        return envelope.draft
    }

    func downloadAsset(id: String) async throws -> DownloadedWidgetAsset {
        let (data, response) = try await perform(
            path: "/v1/assets/\(pathComponent(id))",
            method: "GET",
            body: nil
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

    func patch(draftID: String, version: Int, instruction: String) async throws -> RemoteDraft {
        let envelope: DraftEnvelope = try await send(
            path: "/v1/drafts/\(pathComponent(draftID))/patch",
            method: "POST",
            body: PatchRequest(instruction: instruction, expectedVersion: version)
        )
        return envelope.draft
    }

    func save(
        draftID: String,
        version: Int,
        spec: WidgetSpec,
        note: String
    ) async throws -> RemoteDraft {
        let envelope: DraftEnvelope = try await send(
            path: "/v1/drafts/\(pathComponent(draftID))",
            method: "PUT",
            body: SaveRequest(spec: spec, expectedVersion: version, note: note)
        )
        return envelope.draft
    }

    func deleteDraft(draftID: String) async throws {
        _ = try await perform(
            path: "/v1/drafts/\(pathComponent(draftID))",
            method: "DELETE",
            body: nil
        )
    }

    func publish(draftID: String, version: Int) async throws -> WidgetPublication {
        let envelope: PublicationEnvelope = try await send(
            path: "/v1/drafts/\(pathComponent(draftID))/publish",
            method: "POST",
            body: PublishRequest(expectedVersion: version)
        )
        return envelope.publication
    }

    func extend(slug: String, days: Int) async throws -> WidgetPublication {
        let envelope: PublicationEnvelope = try await send(
            path: "/v1/publications/\(pathComponent(slug))",
            method: "PATCH",
            body: ExtendRequest(days: days)
        )
        return envelope.publication
    }

    func revoke(slug: String) async throws {
        _ = try await perform(
            path: "/v1/publications/\(pathComponent(slug))",
            method: "DELETE",
            body: nil
        )
    }

    func uploadImage(
        _ image: PreparedWidgetImage,
        alternativeText: String?,
        decorative: Bool
    ) async throws -> UploadedWidgetImage {
        var request = try await authorisedRequest(path: "/v1/assets", method: "POST")
        request.httpBody = image.data
        request.setValue(image.mediaType, forHTTPHeaderField: "Content-Type")
        request.setValue(String(image.data.count), forHTTPHeaderField: "Content-Length")
        request.setValue(String(image.width), forHTTPHeaderField: "X-Image-Width")
        request.setValue(String(image.height), forHTTPHeaderField: "X-Image-Height")
        request.setValue(image.sha256, forHTTPHeaderField: "X-Image-SHA256")
        request.setValue(decorative ? "true" : "false", forHTTPHeaderField: "X-Image-Decorative")
        if let alternativeText {
            request.setValue(
                Data(alternativeText.utf8).base64EncodedString(),
                forHTTPHeaderField: "X-Image-Alt-Base64"
            )
        }
        let (data, _) = try await execute(request)
        do {
            return try JSONDecoder().decode(UploadedWidgetImage.self, from: data)
        } catch {
            throw StudioAPIError.decoding(error.localizedDescription)
        }
    }

    private func send<Response: Decodable, Body: Encodable>(
        path: String,
        method: String,
        body: Body
    ) async throws -> Response {
        let encoded = try JSONEncoder().encode(body)
        let (data, _) = try await perform(path: path, method: method, body: encoded)
        do {
            return try JSONDecoder().decode(Response.self, from: data)
        } catch {
            throw StudioAPIError.decoding(error.localizedDescription)
        }
    }

    private func sendWithoutBody<Response: Decodable>(
        path: String,
        method: String
    ) async throws -> Response {
        let (data, _) = try await perform(path: path, method: method, body: nil)
        do {
            return try JSONDecoder().decode(Response.self, from: data)
        } catch {
            throw StudioAPIError.decoding(error.localizedDescription)
        }
    }

    private func perform(
        path: String,
        method: String,
        body: Data?
    ) async throws -> (Data, HTTPURLResponse) {
        var request = try await authorisedRequest(path: path, method: method)
        if let body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        return try await execute(request)
    }

    private func authorisedRequest(path: String, method: String) async throws -> URLRequest {
        guard let url = URL(string: path, relativeTo: baseURL)?.absoluteURL else {
            throw StudioAPIError.invalidURL
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 150
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue(try await tokenStore.token(), forHTTPHeaderField: "X-Device-Token")
        return request
    }

    private func execute(
        _ request: URLRequest,
        allowsCredentialRefresh: Bool = true
    ) async throws -> (Data, HTTPURLResponse) {
        let data: Data
        let response: HTTPURLResponse
        do {
            (data, response) = try await transport.data(for: request)
        } catch let error as StudioAPIError {
            throw error
        } catch {
            throw StudioAPIError.transport(error.localizedDescription)
        }

        guard (200..<300).contains(response.statusCode) else {
            let envelope = try? JSONDecoder().decode(APIErrorEnvelope.self, from: data)
            let serverError = StudioAPIError.server(
                status: response.statusCode,
                code: envelope?.error.code,
                message: envelope?.error.message ?? "Studio could not complete this request."
            )
            if allowsCredentialRefresh,
               serverError.requiresCredentialRefresh,
               let rejectedToken = request.value(forHTTPHeaderField: "X-Device-Token") {
                let replacement = try await refreshDeviceCredential(using: rejectedToken)
                var retriedRequest = request
                retriedRequest.setValue(replacement.token, forHTTPHeaderField: "X-Device-Token")
                return try await execute(retriedRequest, allowsCredentialRefresh: false)
            }
            throw serverError
        }
        return (data, response)
    }

    private func refreshDeviceCredential(using rejectedToken: String) async throws -> DeviceRegistration {
        guard let url = URL(string: "/v1/devices/refresh", relativeTo: baseURL)?.absoluteURL else {
            throw StudioAPIError.invalidURL
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 30
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue(rejectedToken, forHTTPHeaderField: "X-Device-Token")

        let (data, _) = try await execute(request, allowsCredentialRefresh: false)
        let registration = try decodeDeviceRegistration(data)
        guard Self.credentialHasTimeRemaining(registration.token),
              let previousOwner = Self.credentialOwnerID(rejectedToken),
              Self.credentialOwnerID(registration.token) == previousOwner
        else {
            throw StudioAPIError.decoding(
                "Studio received a replacement credential for a different workshop owner."
            )
        }
        // Persist only after the replacement is decoded, unexpired and proven
        // to retain the same owner identity. The rejected token remains in the
        // keychain if any earlier step fails.
        try await tokenStore.storeToken(registration.token)
        return registration
    }

    private func decodeDeviceRegistration(_ data: Data) throws -> DeviceRegistration {
        do {
            return try JSONDecoder().decode(DeviceRegistration.self, from: data)
        } catch {
            throw StudioAPIError.decoding(error.localizedDescription)
        }
    }

    private static func credentialHasTimeRemaining(_ token: String, now: Date = .now) -> Bool {
        guard let expiry = credentialPayload(token)?.expiresAt else { return false }
        return expiry > now.timeIntervalSince1970 * 1_000
    }

    private static func credentialOwnerID(_ token: String) -> String? {
        credentialPayload(token)?.ownerId
    }

    private static func credentialPayload(_ token: String) -> DeviceCredentialPayload? {
        let parts = token.split(separator: ".", omittingEmptySubsequences: false)
        guard parts.count == 3,
              parts[0] == "cw1",
              let payloadData = Data(base64URL: String(parts[1])),
              let payload = try? JSONDecoder().decode(DeviceCredentialPayload.self, from: payloadData),
              payload.version == 1,
              payload.ownerId.range(of: #"^[A-Za-z0-9_-]{32}$"#, options: .regularExpression) != nil
        else { return nil }
        return payload
    }

    private func pathComponent(_ value: String) -> String {
        var allowed = CharacterSet.alphanumerics
        allowed.insert(charactersIn: "-._~")
        return value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
    }
}

enum StudioAPIError: LocalizedError, Equatable {
    case invalidURL
    case invalidResponse
    case deviceTokenUnavailable(OSStatus)
    case deviceRegistrationRequired
    case deviceCredentialAlreadyActive
    case transport(String)
    case decoding(String)
    case server(status: Int, code: String?, message: String)

    var errorDescription: String? {
        switch self {
        case .invalidURL, .invalidResponse:
            "Studio’s service address is invalid."
        case .deviceTokenUnavailable:
            "Studio could not create secure ownership for this iPad."
        case .deviceRegistrationRequired:
            "Enter your workshop access code before using Studio."
        case .deviceCredentialAlreadyActive:
            "Studio access is already active. Your existing ownership was kept safe."
        case let .transport(message), let .decoding(message):
            message
        case let .server(_, _, message):
            message
        }
    }
}

private struct GenerateRequest: Encodable {
    let level: String
    let subject: String
    let learningObjective: String
    let studentAction: String
    let content: String?
    let feedback: String?
    let durationMinutes: Int?
    let accessibilityNeeds: String?
}

struct DeviceRegistration: Codable, Equatable, Sendable {
    let token: String
    let expiresAt: String
}

private struct DeviceCredentialPayload: Decodable {
    let version: Int
    let ownerId: String
    let expiresAt: Double
}

private struct RegistrationRequest: Encodable { let accessCode: String }

private struct ImportRequest: Encodable { let spec: WidgetSpec }
private struct PatchRequest: Encodable { let instruction: String; let expectedVersion: Int }
private struct SaveRequest: Encodable { let spec: WidgetSpec; let expectedVersion: Int; let note: String }
private struct PublishRequest: Encodable { let expectedVersion: Int }
private struct ExtendRequest: Encodable { let days: Int }
private struct DraftEnvelope: Decodable { let draft: RemoteDraft }
private struct DraftListEnvelope: Decodable { let drafts: [RemoteDraftSummary] }
private struct PublicationEnvelope: Decodable { let publication: WidgetPublication }
private struct APIErrorEnvelope: Decodable { let error: APIErrorPayload }
private struct APIErrorPayload: Decodable { let code: String; let message: String }

private extension StudioAPIError {
    var requiresDeviceRegistration: Bool {
        guard case let .server(status, code, _) = self else { return false }
        return status == 401 && ["DEVICE_REGISTRATION_REQUIRED", "DEVICE_TOKEN_REQUIRED"].contains(code)
    }

    var requiresCredentialRefresh: Bool {
        guard case let .server(status, code, _) = self else { return false }
        return requiresDeviceRegistration
            || (status == 422 && code == "PUBLICATION_EXPIRY_LIMIT_REACHED")
    }
}

private extension String {
    var nilIfBlank: String? {
        let value = trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }
}

private extension Data {
    init?(base64URL value: String) {
        let standard = value.replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        let padded = standard.padding(
            toLength: ((standard.count + 3) / 4) * 4,
            withPad: "=",
            startingAt: 0
        )
        self.init(base64Encoded: padded)
    }
}

private extension GuidedBriefDraft {
    var apiLevel: String {
        if let value = matchedLevel(prefixes: ["primary", "p"], range: 1...6) {
            return "Primary \(value)"
        }
        if let value = matchedLevel(prefixes: ["secondary", "sec", "s"], range: 1...5) {
            return "Secondary \(value)"
        }

        if containsPhrase(["upper", "primary"]) { return "Upper primary" }
        if containsPhrase(["lower", "primary"]) { return "Lower primary" }
        if normalisedTokens.contains("primary") { return "Primary" }
        if normalisedTokens.contains("secondary") { return "Secondary" }
        if containsPhrase(["junior", "college"]) || normalisedTokens.contains("jc") {
            return "Junior college"
        }

        return "Other"
    }

    var apiSubject: String {
        if containsPhrase(["computer", "science"]) || containsAnyToken(["computing"]) {
            return "Computing"
        }
        if containsAnyToken(["mathematics", "maths", "math"]) { return "Mathematics" }
        if containsAnyToken(["physics"]) { return "Physics" }
        if containsAnyToken(["chemistry"]) { return "Chemistry" }
        if containsAnyToken(["biology"]) { return "Biology" }
        if containsAnyToken(["science"]) { return "Science" }
        if containsAnyToken(["english"]) { return "English" }
        if containsAnyToken(["history"]) { return "History" }
        if containsAnyToken(["geography"]) { return "Geography" }
        if containsAnyToken(["humanities"]) { return "Humanities" }
        if containsAnyToken(["chinese"]) { return "Chinese" }
        if containsAnyToken(["malay"]) { return "Malay" }
        if containsAnyToken(["tamil"]) { return "Tamil" }
        if containsPhrase(["social", "studies"]) { return "Social Studies" }
        if containsPhrase(["physical", "education"]) || containsAnyToken(["pe"]) {
            return "Physical Education"
        }
        if containsAnyToken(["language", "languages"]) { return "Languages" }
        if containsAnyToken(["music"]) { return "Music" }
        if containsAnyToken(["art", "arts"]) { return "Art" }
        return "Other"
    }

    var apiContent: String? {
        labelledValues([
            ("Required content", sourceContent),
            ("Classroom fit and mode", classroomFit)
        ], maximumUTF16Length: 4_000)
    }

    var apiLearnerSupport: String? {
        labelledValues([
            ("Full learner context, including any language or support needs", learnerContext)
        ], maximumUTF16Length: 1_000)
    }

    var durationMinutes: Int? {
        if let digits = classroomFit.split(whereSeparator: { !$0.isNumber }).compactMap({ Int($0) }).first {
            return digits
        }
        let words: [String: Int] = [
            "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
            "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
            "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14,
            "fifteen": 15, "sixteen": 16, "seventeen": 17, "eighteen": 18,
            "nineteen": 19, "twenty": 20
        ]
        return classroomFit.lowercased()
            .split(whereSeparator: { !$0.isLetter })
            .compactMap { words[String($0)] }
            .first
    }

    private func matchedLevel(prefixes: [String], range: ClosedRange<Int>) -> Int? {
        let tokens = normalisedTokens

        for (index, token) in tokens.enumerated() {
            for prefix in prefixes {
                if token == prefix,
                   tokens.indices.contains(index + 1),
                   let value = Int(tokens[index + 1]),
                   range.contains(value) {
                    return value
                }
                if token.hasPrefix(prefix),
                   let value = Int(token.dropFirst(prefix.count)),
                   range.contains(value) {
                    return value
                }
            }
        }
        return nil
    }

    private var normalisedTokens: [String] {
        learnerContext.lowercased()
            .replacingOccurrences(of: #"[^a-z0-9]+"#, with: " ", options: .regularExpression)
            .split(separator: " ")
            .map(String.init)
    }

    private func containsAnyToken(_ candidates: [String]) -> Bool {
        let tokens = Set(normalisedTokens)
        return candidates.contains(where: tokens.contains)
    }

    private func containsPhrase(_ phrase: [String]) -> Bool {
        let tokens = normalisedTokens
        guard !phrase.isEmpty, tokens.count >= phrase.count else { return false }
        return (0...(tokens.count - phrase.count)).contains { start in
            Array(tokens[start..<(start + phrase.count)]) == phrase
        }
    }

    private func labelledValues(
        _ values: [(String, String)],
        maximumUTF16Length: Int
    ) -> String? {
        let lines = values.compactMap { label, rawValue -> String? in
            guard let value = rawValue.nilIfBlank else { return nil }
            return "\(label): \(value)"
        }
        guard !lines.isEmpty else { return nil }
        return boundedUTF16(lines.joined(separator: "\n"), maximumLength: maximumUTF16Length)
    }

    private func boundedUTF16(_ value: String, maximumLength: Int) -> String {
        guard value.utf16.count > maximumLength else { return value }
        var result = ""
        var length = 0
        for character in value {
            let text = String(character)
            let characterLength = text.utf16.count
            guard length + characterLength <= maximumLength else { break }
            result.append(character)
            length += characterLength
        }
        return result
    }
}
