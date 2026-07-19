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
        let body = try XCTUnwrap(request.httpBody)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: Any])
        XCTAssertNotNil(object["spec"] as? [String: Any])
    }

    func testGeneratePreservesTheCompleteTeacherBriefInRequestBody() async throws {
        let remote = try sampleRemote()
        let transport = RecordingTransport(
            data: try JSONEncoder().encode(DraftResponse(draft: remote)),
            status: 201
        )
        let client = makeClient(transport: transport)
        var brief = GuidedBriefDraft()
        brief.learnerContext = "P5 Science, dyslexic learners, larger text"
        brief.learningObjective = "Explain how forces affect motion"
        brief.studentAction = "Adjust the force and predict the motion"
        brief.sourceContent = "Use familiar playground examples"
        brief.feedback = "Give a hint, then explain the answer"
        brief.classroomFit = "Eight minutes, students work in pairs on phones"

        _ = try await client.generate(from: brief)

        let recordedRequest = await transport.lastRequest()
        let request = try XCTUnwrap(recordedRequest)
        let object = try requestJSONObject(request)
        XCTAssertEqual(request.url?.absoluteString, "https://studio.example/v1/drafts/generate")
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(object["level"] as? String, "Primary 5")
        XCTAssertEqual(object["subject"] as? String, "Science")
        XCTAssertEqual(object["learningObjective"] as? String, brief.learningObjective)
        XCTAssertEqual(object["studentAction"] as? String, brief.studentAction)
        XCTAssertEqual(
            object["content"] as? String,
            "Required content: \(brief.sourceContent)\nClassroom fit and mode: \(brief.classroomFit)"
        )
        XCTAssertEqual(object["feedback"] as? String, brief.feedback)
        XCTAssertEqual(object["durationMinutes"] as? Int, 8)
        XCTAssertEqual(
            object["accessibilityNeeds"] as? String,
            "Full learner context, including any language or support needs: \(brief.learnerContext)"
        )
    }

    func testGeneratePrefersComputerScienceAndDoesNotTreatSmartboardAsArt() async throws {
        let remote = try sampleRemote()
        let transport = RecordingTransport(
            data: try JSONEncoder().encode(DraftResponse(draft: remote)),
            status: 201
        )
        let client = makeClient(transport: transport)
        var brief = GuidedBriefDraft()
        brief.learnerContext = "Secondary 3 Computer Science using a smartboard"
        brief.learningObjective = "Explain a searching algorithm"
        brief.studentAction = "Trace each comparison"
        brief.feedback = "Show the next comparison"
        brief.classroomFit = "Ten minutes in pairs"

        _ = try await client.generate(from: brief)

        let recordedRequest = await transport.lastRequest()
        let request = try XCTUnwrap(recordedRequest)
        let object = try requestJSONObject(request)
        XCTAssertEqual(object["level"] as? String, "Secondary 3")
        XCTAssertEqual(object["subject"] as? String, "Computing")
        XCTAssertEqual(
            object["accessibilityNeeds"] as? String,
            "Full learner context, including any language or support needs: \(brief.learnerContext)"
        )
    }

    func testGenerateUsesNeutralLevelAndKeepsLongUnknownContextWithinServerLimit() async throws {
        let remote = try sampleRemote()
        let transport = RecordingTransport(
            data: try JSONEncoder().encode(DraftResponse(draft: remote)),
            status: 201
        )
        let client = makeClient(transport: transport)
        var brief = GuidedBriefDraft()
        brief.learnerContext = "Year 9 design using a smartboard. "
            + Array(repeating: "Needs enlarged controls.", count: 35).joined(separator: " ")
        brief.learningObjective = "Compare two interface layouts"
        brief.studentAction = "Choose the clearer layout"
        brief.feedback = "Explain the accessibility trade-off"
        brief.classroomFit = "Twelve minutes individually"

        _ = try await client.generate(from: brief)

        let recordedRequest = await transport.lastRequest()
        let request = try XCTUnwrap(recordedRequest)
        let object = try requestJSONObject(request)
        let accessibility = try XCTUnwrap(object["accessibilityNeeds"] as? String)
        XCTAssertEqual(object["level"] as? String, "Other")
        XCTAssertEqual(object["subject"] as? String, "Other")
        XCTAssertEqual(
            accessibility,
            "Full learner context, including any language or support needs: \(brief.learnerContext)"
        )
        XCTAssertLessThanOrEqual(accessibility.utf16.count, 1_000)
    }

    func testGenerateRecognisesPEOnlyAsAStandaloneToken() async throws {
        let remote = try sampleRemote()
        let transport = RecordingTransport(
            data: try JSONEncoder().encode(DraftResponse(draft: remote)),
            status: 201
        )
        let client = makeClient(transport: transport)
        var brief = GuidedBriefDraft()
        brief.learnerContext = "Secondary 2 PE"
        brief.learningObjective = "Explain safe landing technique"
        brief.studentAction = "Sequence the movement cues"
        brief.feedback = "Explain each cue"
        brief.classroomFit = "Five minutes individually"

        _ = try await client.generate(from: brief)

        let recordedRequest = await transport.lastRequest()
        let request = try XCTUnwrap(recordedRequest)
        let object = try requestJSONObject(request)
        XCTAssertEqual(object["subject"] as? String, "Physical Education")
    }

    func testPatchUsesExpectedRouteMethodAndBody() async throws {
        let remote = try sampleRemote(version: 5)
        let transport = RecordingTransport(
            data: try JSONEncoder().encode(DraftResponse(draft: remote)),
            status: 200
        )
        let client = makeClient(transport: transport)

        _ = try await client.patch(
            draftID: "draft/with space",
            version: 4,
            instruction: "Use larger labels"
        )

        let recordedRequest = await transport.lastRequest()
        let request = try XCTUnwrap(recordedRequest)
        let object = try requestJSONObject(request)
        XCTAssertEqual(request.url?.absoluteString, "https://studio.example/v1/drafts/draft%2Fwith%20space/patch")
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(object["instruction"] as? String, "Use larger labels")
        XCTAssertEqual(object["expectedVersion"] as? Int, 4)
    }

    func testSaveUsesExpectedRouteMethodAndBody() async throws {
        let spec = try sampleSpec()
        let remote = try sampleRemote(version: 3)
        let transport = RecordingTransport(
            data: try JSONEncoder().encode(DraftResponse(draft: remote)),
            status: 200
        )
        let client = makeClient(transport: transport)

        _ = try await client.save(
            draftID: "draft-transport",
            version: 2,
            spec: spec,
            note: "Direct edit"
        )

        let recordedRequest = await transport.lastRequest()
        let request = try XCTUnwrap(recordedRequest)
        let object = try requestJSONObject(request)
        XCTAssertEqual(request.url?.absoluteString, "https://studio.example/v1/drafts/draft-transport")
        XCTAssertEqual(request.httpMethod, "PUT")
        XCTAssertEqual(object["expectedVersion"] as? Int, 2)
        XCTAssertEqual(object["note"] as? String, "Direct edit")
        XCTAssertNotNil(object["spec"] as? [String: Any])
    }

    func testPublishBindsTheReviewedDraftVersionToTheExpectedRoute() async throws {
        let publication = samplePublication()
        let transport = RecordingTransport(
            data: try JSONEncoder().encode(PublicationResponse(publication: publication)),
            status: 201
        )
        let client = makeClient(transport: transport)

        let received = try await client.publish(draftID: "draft-transport", version: 4)
        XCTAssertEqual(received, publication)

        let recordedRequest = await transport.lastRequest()
        let request = try XCTUnwrap(recordedRequest)
        XCTAssertEqual(request.url?.absoluteString, "https://studio.example/v1/drafts/draft-transport/publish")
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(try requestJSONObject(request)["expectedVersion"] as? Int, 4)
    }

    func testExtendUsesExpectedRouteMethodAndBody() async throws {
        let publication = samplePublication()
        let transport = RecordingTransport(
            data: try JSONEncoder().encode(PublicationResponse(publication: publication)),
            status: 200
        )
        let client = makeClient(transport: transport)

        _ = try await client.extend(slug: "student/link", days: 90)

        let recordedRequest = await transport.lastRequest()
        let request = try XCTUnwrap(recordedRequest)
        let object = try requestJSONObject(request)
        XCTAssertEqual(request.url?.absoluteString, "https://studio.example/v1/publications/student%2Flink")
        XCTAssertEqual(request.httpMethod, "PATCH")
        XCTAssertEqual(object["days"] as? Int, 90)
    }

    func testExtensionAtCredentialLimitRefreshesThenRetriesTheSameRequest() async throws {
        let oldToken = makeCredential(expiry: Date().addingTimeInterval(86_400))
        let replacementToken = makeCredential(expiry: Date().addingTimeInterval(172_800))
        let registration = DeviceRegistration(
            token: replacementToken,
            expiresAt: "2026-07-21T12:00:00.000Z"
        )
        let publication = samplePublication()
        let transport = SequencedRecordingTransport(responses: [
            .init(
                data: Data(#"{"error":{"code":"PUBLICATION_EXPIRY_LIMIT_REACHED","message":"Refresh this credential before extending the link."}}"#.utf8),
                status: 422
            ),
            .init(data: try JSONEncoder().encode(registration), status: 200),
            .init(data: try JSONEncoder().encode(PublicationResponse(publication: publication)), status: 200)
        ])
        let credentials = RecordingCredentialStore(value: oldToken)
        let client = StudioAPIClient(
            baseURL: URL(string: "https://studio.example")!,
            transport: transport,
            tokenStore: credentials
        )

        let received = try await client.extend(slug: "student/link", days: 90)

        XCTAssertEqual(received, publication)
        let requests = await transport.recordedRequests()
        XCTAssertEqual(requests.count, 3)
        XCTAssertEqual(requests[0].url?.path, "/v1/publications/student/link")
        XCTAssertEqual(requests[0].httpMethod, "PATCH")
        XCTAssertEqual(requests[0].value(forHTTPHeaderField: "X-Device-Token"), oldToken)
        XCTAssertEqual(requests[1].url?.path, "/v1/devices/refresh")
        XCTAssertEqual(requests[1].httpMethod, "POST")
        XCTAssertEqual(requests[1].value(forHTTPHeaderField: "X-Device-Token"), oldToken)
        XCTAssertEqual(requests[2].url?.path, "/v1/publications/student/link")
        XCTAssertEqual(requests[2].httpMethod, "PATCH")
        XCTAssertEqual(requests[2].value(forHTTPHeaderField: "X-Device-Token"), replacementToken)
        XCTAssertEqual(requests[2].httpBody, requests[0].httpBody)
        let storedToken = await credentials.storedToken()
        XCTAssertEqual(storedToken, replacementToken)
    }

    func testRevokeUsesExpectedRouteAndHasNoBody() async throws {
        let transport = RecordingTransport(data: Data(#"{"ok":true}"#.utf8), status: 200)
        let client = makeClient(transport: transport)

        try await client.revoke(slug: "student/link")

        let recordedRequest = await transport.lastRequest()
        let request = try XCTUnwrap(recordedRequest)
        XCTAssertEqual(request.url?.absoluteString, "https://studio.example/v1/publications/student%2Flink")
        XCTAssertEqual(request.httpMethod, "DELETE")
        XCTAssertNil(request.httpBody)
    }

    func testDeleteDraftUsesExpectedRouteAndHasNoBody() async throws {
        let transport = RecordingTransport(data: Data(#"{"ok":true}"#.utf8), status: 200)
        let client = makeClient(transport: transport)

        try await client.deleteDraft(draftID: "draft/with space")

        let recordedRequest = await transport.lastRequest()
        let request = try XCTUnwrap(recordedRequest)
        XCTAssertEqual(request.url?.absoluteString, "https://studio.example/v1/drafts/draft%2Fwith%20space")
        XCTAssertEqual(request.httpMethod, "DELETE")
        XCTAssertNil(request.httpBody)
    }

    func testUploadImageUsesBinaryBodyAndAccessibilityHeaders() async throws {
        let bytes = Data([0xff, 0xd8, 0xff, 0xd9])
        let prepared = PreparedWidgetImage(
            data: bytes,
            mediaType: "image/jpeg",
            width: 320,
            height: 180,
            sha256: String(repeating: "a", count: 64)
        )
        let uploaded = UploadedWidgetImage(
            asset: WidgetImageAssetRecord(
                id: "asset-0123456789abcdef0123456789abcdef",
                kind: "image",
                mediaType: prepared.mediaType,
                width: prepared.width,
                height: prepared.height,
                byteLength: prepared.data.count,
                sha256: prepared.sha256
            ),
            accessibility: .init(alternativeText: "A force diagram", decorative: false)
        )
        let transport = RecordingTransport(data: try JSONEncoder().encode(uploaded), status: 201)
        let client = makeClient(transport: transport)

        let received = try await client.uploadImage(
            prepared,
            alternativeText: "A force diagram",
            decorative: false
        )
        XCTAssertEqual(received, uploaded)

        let recordedRequest = await transport.lastRequest()
        let request = try XCTUnwrap(recordedRequest)
        XCTAssertEqual(request.url?.absoluteString, "https://studio.example/v1/assets")
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(request.httpBody, bytes)
        XCTAssertEqual(request.value(forHTTPHeaderField: "Content-Type"), "image/jpeg")
        XCTAssertEqual(request.value(forHTTPHeaderField: "X-Image-Width"), "320")
        XCTAssertEqual(request.value(forHTTPHeaderField: "X-Image-Height"), "180")
        XCTAssertEqual(request.value(forHTTPHeaderField: "X-Image-SHA256"), prepared.sha256)
        XCTAssertEqual(request.value(forHTTPHeaderField: "X-Image-Decorative"), "false")
        XCTAssertEqual(
            request.value(forHTTPHeaderField: "X-Image-Alt-Base64"),
            Data("A force diagram".utf8).base64EncodedString()
        )
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

    func testWorkshopRegistrationCannotReplaceAnActiveOwnerCredential() async throws {
        let activeToken = makeCredential(expiry: Date().addingTimeInterval(86_400))
        let transport = RecordingTransport(
            data: Data(#"{"unexpected":true}"#.utf8),
            status: 500
        )
        let credentials = RecordingCredentialStore(value: activeToken)
        let client = StudioAPIClient(
            baseURL: URL(string: "https://studio.example")!,
            transport: transport,
            tokenStore: credentials
        )

        do {
            _ = try await client.registerDevice(accessCode: "ANOTHER-CODE")
            XCTFail("Expected the current owner credential to be preserved")
        } catch let error as StudioAPIError {
            XCTAssertEqual(error, .deviceCredentialAlreadyActive)
        }

        let request = await transport.lastRequest()
        XCTAssertNil(request)
        let storedToken = await credentials.storedToken()
        XCTAssertEqual(storedToken, activeToken)
    }

    func testExpiredCredentialRefreshesWithTheOldOwnerTokenAndPersistsReplacement() async throws {
        let oldToken = makeCredential(expiry: Date().addingTimeInterval(-60))
        let replacementToken = makeCredential(expiry: Date().addingTimeInterval(86_400))
        let registration = DeviceRegistration(
            token: replacementToken,
            expiresAt: "2026-07-20T12:00:00.000Z"
        )
        let transport = RecordingTransport(
            data: try JSONEncoder().encode(registration),
            status: 200
        )
        let credentials = RecordingCredentialStore(value: oldToken)
        let client = StudioAPIClient(
            baseURL: URL(string: "https://studio.example")!,
            transport: transport,
            tokenStore: credentials
        )

        let isValid = await client.hasDeviceCredential()

        XCTAssertTrue(isValid)
        let recordedRequest = await transport.lastRequest()
        let request = try XCTUnwrap(recordedRequest)
        XCTAssertEqual(request.url?.absoluteString, "https://studio.example/v1/devices/refresh")
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(request.value(forHTTPHeaderField: "X-Device-Token"), oldToken)
        XCTAssertNil(request.httpBody)
        let storedToken = await credentials.storedToken()
        let clearCount = await credentials.clearCount()
        XCTAssertEqual(storedToken, replacementToken)
        XCTAssertEqual(clearCount, 0)
    }

    func testRejectedAuthorisedRequestRefreshesAndRetriesWithReplacementCredential() async throws {
        let oldToken = makeCredential(expiry: Date().addingTimeInterval(86_400))
        let replacementToken = makeCredential(expiry: Date().addingTimeInterval(172_800))
        let registration = DeviceRegistration(
            token: replacementToken,
            expiresAt: "2026-07-21T12:00:00.000Z"
        )
        let remote = try sampleRemote()
        let transport = SequencedRecordingTransport(responses: [
            .init(
                data: Data(#"{"error":{"code":"DEVICE_REGISTRATION_REQUIRED","message":"Refresh this credential."}}"#.utf8),
                status: 401
            ),
            .init(data: try JSONEncoder().encode(registration), status: 200),
            .init(data: try JSONEncoder().encode(DraftResponse(draft: remote)), status: 201)
        ])
        let credentials = RecordingCredentialStore(value: oldToken)
        let client = StudioAPIClient(
            baseURL: URL(string: "https://studio.example")!,
            transport: transport,
            tokenStore: credentials
        )

        let received = try await client.importDraft(spec: remote.spec)

        XCTAssertEqual(received, remote)
        let requests = await transport.recordedRequests()
        XCTAssertEqual(requests.count, 3)
        XCTAssertEqual(requests[0].url?.path, "/v1/drafts")
        XCTAssertEqual(requests[0].value(forHTTPHeaderField: "X-Device-Token"), oldToken)
        XCTAssertEqual(requests[1].url?.path, "/v1/devices/refresh")
        XCTAssertEqual(requests[1].httpMethod, "POST")
        XCTAssertEqual(requests[1].value(forHTTPHeaderField: "X-Device-Token"), oldToken)
        XCTAssertNil(requests[1].httpBody)
        XCTAssertEqual(requests[2].url?.path, "/v1/drafts")
        XCTAssertEqual(requests[2].value(forHTTPHeaderField: "X-Device-Token"), replacementToken)
        XCTAssertEqual(requests[2].httpBody, requests[0].httpBody)
        let storedToken = await credentials.storedToken()
        let clearCount = await credentials.clearCount()
        XCTAssertEqual(storedToken, replacementToken)
        XCTAssertEqual(clearCount, 0)
    }

    func testDefinitiveRefreshRejectionAllowsRegistrationFallbackWithoutClearingOldToken() async {
        let oldToken = makeCredential(expiry: Date().addingTimeInterval(-60))
        let payload = Data(#"{"error":{"code":"DEVICE_REGISTRATION_REQUIRED","message":"Enter a workshop access code."}}"#.utf8)
        let transport = RecordingTransport(data: payload, status: 401)
        let credentials = RecordingCredentialStore(value: oldToken)
        let client = StudioAPIClient(
            baseURL: URL(string: "https://studio.example")!,
            transport: transport,
            tokenStore: credentials
        )

        let isValid = await client.hasDeviceCredential()
        let storedToken = await credentials.storedToken()
        let clearCount = await credentials.clearCount()
        XCTAssertFalse(isValid)
        XCTAssertEqual(storedToken, oldToken)
        XCTAssertEqual(clearCount, 0)
    }

    func testTransientRefreshFailureKeepsOwnershipAndDoesNotFallBackToRegistration() async {
        let oldToken = makeCredential(expiry: Date().addingTimeInterval(-60))
        let payload = Data(#"{"error":{"code":"SERVICE_UNAVAILABLE","message":"Try again shortly."}}"#.utf8)
        let transport = RecordingTransport(data: payload, status: 503)
        let credentials = RecordingCredentialStore(value: oldToken)
        let client = StudioAPIClient(
            baseURL: URL(string: "https://studio.example")!,
            transport: transport,
            tokenStore: credentials
        )

        let isValid = await client.hasDeviceCredential()
        let storedToken = await credentials.storedToken()
        XCTAssertTrue(isValid)
        XCTAssertEqual(storedToken, oldToken)
    }

    func testRefreshNeverOverwritesCredentialWithADifferentOwner() async throws {
        let oldToken = makeCredential(
            expiry: Date().addingTimeInterval(-60),
            ownerID: String(repeating: "a", count: 32)
        )
        let differentOwnerToken = makeCredential(
            expiry: Date().addingTimeInterval(86_400),
            ownerID: String(repeating: "b", count: 32)
        )
        let registration = DeviceRegistration(
            token: differentOwnerToken,
            expiresAt: "2026-07-20T12:00:00.000Z"
        )
        let transport = RecordingTransport(
            data: try JSONEncoder().encode(registration),
            status: 200
        )
        let credentials = RecordingCredentialStore(value: oldToken)
        let client = StudioAPIClient(
            baseURL: URL(string: "https://studio.example")!,
            transport: transport,
            tokenStore: credentials
        )

        let isValid = await client.hasDeviceCredential()
        let storedToken = await credentials.storedToken()
        XCTAssertTrue(isValid)
        XCTAssertEqual(storedToken, oldToken)
    }

    func testLegacyOrExpiredCredentialRequiresRegistration() async throws {
        let payload = Data(#"{"error":{"code":"DEVICE_REGISTRATION_REQUIRED","message":"Enter a workshop access code."}}"#.utf8)
        let transport = RecordingTransport(data: payload, status: 401)
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

    func testRegistrationRequiredResponsePreservesStoredCredentialAfterRefreshRejection() async throws {
        let payload = Data(#"{"error":{"code":"DEVICE_REGISTRATION_REQUIRED","message":"Enter a workshop access code."}}"#.utf8)
        let transport = RecordingTransport(data: payload, status: 401)
        let oldToken = makeCredential(expiry: Date().addingTimeInterval(86_400))
        let credentials = RecordingCredentialStore(value: oldToken)
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
        let clearCount = await credentials.clearCount()
        XCTAssertEqual(storedToken, oldToken)
        XCTAssertEqual(clearCount, 0)
    }

    private func sampleSpec() throws -> WidgetSpec {
        let repository = FixtureRepository()
        return try XCTUnwrap(repository.loadExamples(from: Bundle(for: StudioStore.self)).first?.spec)
    }

    private func sampleRemote(version: Int = 1) throws -> RemoteDraft {
        let spec = try sampleSpec()
        return RemoteDraft(
            id: "draft-transport",
            title: spec.metadata.title,
            schemaVersion: spec.schemaVersion,
            spec: spec,
            version: version,
            createdAt: "2026-07-18T12:00:00.000Z",
            updatedAt: "2026-07-18T12:05:00.000Z"
        )
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

    private func makeClient(transport: RecordingTransport) -> StudioAPIClient {
        StudioAPIClient(
            baseURL: URL(string: "https://studio.example")!,
            transport: transport,
            tokenStore: StaticDeviceTokenStore(value: "secure-device-token")
        )
    }

    private func requestJSONObject(_ request: URLRequest) throws -> [String: Any] {
        let body = try XCTUnwrap(request.httpBody)
        return try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: Any])
    }

    private func makeCredential(
        expiry: Date,
        ownerID: String = String(repeating: "a", count: 32)
    ) -> String {
        let payload: [String: Any] = [
            "version": 1,
            "ownerId": ownerID,
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
private struct PublicationResponse: Encodable { let publication: WidgetPublication }

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

private struct StubbedTransportResponse: Sendable {
    let data: Data
    let status: Int
    let headers: [String: String]

    init(
        data: Data,
        status: Int,
        headers: [String: String] = ["Content-Type": "application/json"]
    ) {
        self.data = data
        self.status = status
        self.headers = headers
    }
}

private actor SequencedRecordingTransport: StudioHTTPTransport {
    private var responses: [StubbedTransportResponse]
    private var requests: [URLRequest] = []

    init(responses: [StubbedTransportResponse]) {
        self.responses = responses
    }

    func data(for request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        requests.append(request)
        guard !responses.isEmpty else {
            throw StudioAPIError.transport("No stubbed response remains.")
        }
        let stub = responses.removeFirst()
        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: stub.status,
            httpVersion: "HTTP/2",
            headerFields: stub.headers
        )!
        return (stub.data, response)
    }

    func recordedRequests() -> [URLRequest] { requests }
}

private actor RecordingCredentialStore: DeviceTokenProviding {
    private var value: String?
    private var clears = 0

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
        clears += 1
        value = nil
    }

    func storedToken() -> String? { value }

    func clearCount() -> Int { clears }
}
