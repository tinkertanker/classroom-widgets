import Foundation
import Observation

enum StudioSection: String, CaseIterable, Identifiable { case explore, make, myWidgets; var id: String { rawValue }
    var title: String { self == .myWidgets ? "My Widgets" : rawValue.capitalized }
    var symbolName: String { self == .explore ? "square.grid.2x2" : self == .make ? "plus.square" : "square.stack.3d.up" }
}
enum WorkshopAccessState: Equatable { case checking, registrationRequired, ready }
enum StudioOperation { case activation, generation, refinement, undo, directSave, publish, unpublish, extend, restore, delete, image }
struct StudioErrorPresentation { let title, message: String; let requestsWorkshopAccess: Bool }

@MainActor @Observable final class StudioStore {
    var selectedSection: StudioSection = .explore
    var selectedProjectID: String?
    var projects: [ArtifactProject] = []
    var examples: [ArtifactProject] = []
    var notice: String?
    var recoveryNotice: String?
    var workshopAccessState: WorkshopAccessState = .checking
    var showsWorkshopAccess = false
    var isRestoringFromStudio = false
    var guidedMakeDraft = GuidedBriefDraft(); var guidedMakeQuestionIndex = 0; var guidedMakeResponse = ""; var guidedMakeShowsSummary = false
    var isCreatingGuidedDraft = false
    private let api: any StudioAPI
    private let projectDirectory: URL
    private let isUITesting: Bool
    private var uploadedSnapshotRevisionIDs: Set<String> = []

    init(api: any StudioAPI = StudioAPIClient.live(), storageDirectory: URL? = nil, bundle: Bundle = .main) {
        self.api = api
        isUITesting = ProcessInfo.processInfo.arguments.contains("--ui-testing-reset")
        if let storageDirectory {
            projectDirectory = storageDirectory.appending(path: "ArtifactProjects", directoryHint: .isDirectory)
        } else {
            let applicationSupport = (try? FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)) ?? FileManager.default.temporaryDirectory
            projectDirectory = applicationSupport
                .appending(path: "Classroom Widgets Studio", directoryHint: .isDirectory)
                .appending(path: "ArtifactProjects", directoryHint: .isDirectory)
            if let caches = try? FileManager.default.url(for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: false) {
                Self.copyLegacyProjects(
                    from: caches.appending(path: "ArtifactProjects", directoryHint: .isDirectory),
                    to: projectDirectory
                )
            }
        }
        if isUITesting {
            try? FileManager.default.removeItem(at: projectDirectory)
        }
        try? FileManager.default.createDirectory(at: projectDirectory, withIntermediateDirectories: true)
        projects = Self.loadCachedProjects(from: projectDirectory)
        examples = Self.loadExamples(bundle: bundle)
    }
    var selectedProject: ArtifactProject? { projects.first { $0.id == selectedProjectID } ?? examples.first { $0.id == selectedProjectID } }
    func open(_ project: ArtifactProject) { selectedProjectID = project.id }
    func closeEditor() { selectedProjectID = nil }
    func dismissRecoveryNotice() { recoveryNotice = nil }
    func refreshWorkshopAccess() async {
        if isUITesting {
            if ProcessInfo.processInfo.arguments.contains("--ui-testing-registration-required") {
                workshopAccessState = .registrationRequired
                showsWorkshopAccess = true
            } else {
                workshopAccessState = .ready
                showsWorkshopAccess = false
            }
            return
        }
        let hasCredential = await api.hasDeviceCredential()
        workshopAccessState = hasCredential ? .ready : .registrationRequired
        if !hasCredential { showsWorkshopAccess = true }
    }
    func requestWorkshopAccess() { showsWorkshopAccess = true }
    func dismissWorkshopAccess() { showsWorkshopAccess = false }
    func registerWorkshopAccess(_ code: String) async throws { try await api.registerDevice(accessCode: code); workshopAccessState = .ready; showsWorkshopAccess = false }
    func present(_ error: Error, during operation: StudioOperation) -> StudioErrorPresentation {
        if let apiError = error as? StudioAPIError, apiError.requiresRegistration {
            workshopAccessState = .registrationRequired
            showsWorkshopAccess = true
            return StudioErrorPresentation(
                title: "Studio access needed",
                message: "Enter your workshop code to continue.",
                requestsWorkshopAccess: true
            )
        }
        return StudioErrorPresentation(title: "Studio could not complete this action", message: (error as? LocalizedError)?.errorDescription ?? error.localizedDescription, requestsWorkshopAccess: false)
    }
    func resetGuidedMake() { guidedMakeDraft = .init(); guidedMakeQuestionIndex = 0; guidedMakeResponse = ""; guidedMakeShowsSummary = false }
    func createApprovedBrief(_ brief: GuidedBriefDraft) async throws -> ArtifactProject {
        isCreatingGuidedDraft = true; defer { isCreatingGuidedDraft = false }
        let text = brief.answers.enumerated().map { "\(BriefQuestion.all[$0.offset].prompt)\n\($0.element)" }.joined(separator: "\n\n")
        if isUITesting {
            let project = Self.testingProject(brief: brief, creationBrief: text)
            upsert(project)
            open(project)
            return project
        }
        let request = GuidedGenerationRequest(creationBrief: text, brief: .init(
            learnerContext: brief.learnerContext, learningObjective: brief.learningObjective,
            studentAction: brief.studentAction, sourceContent: brief.sourceContent.isEmpty ? nil : brief.sourceContent,
            feedback: brief.feedback, classroomFit: brief.classroomFit
        ), preferredExampleRevisionId: nil)
        let project = try await api.generate(request: request); upsert(project); open(project); return project
    }
    func remix(_ example: ArtifactProject) async throws {
        let project: ArtifactProject
        if example.artifact.id == "example-fallback" {
            let artifact = example.artifact
            project = try await api.generate(request: GuidedGenerationRequest(
                creationBrief: artifact.creationBrief,
                brief: .init(
                    learnerContext: artifact.level ?? artifact.subject ?? "General learners",
                    learningObjective: artifact.learningObjective ?? artifact.title,
                    studentAction: artifact.summary,
                    sourceContent: nil,
                    feedback: "Provide clear feedback",
                    classroomFit: "Use in a short classroom activity"
                ),
                preferredExampleRevisionId: nil
            ))
        } else {
            project = try await api.remix(
                id: example.artifact.id,
                revisionId: example.source.revision.id
            )
        }
        upsert(project)
        open(project)
    }
    func refine(_ instruction: String, projectID: String) async throws {
        let current = try project(projectID)
        let updated = try await api.revise(id: projectID, instruction: instruction, expectedHeadRevisionId: current.artifact.headRevisionId)
        upsert(updated)
    }
    func restore(revision: ArtifactRevision, projectID: String) async throws {
        let current = try project(projectID)
        upsert(try await api.setHead(id: projectID, revisionId: revision.id, expectedHeadRevisionId: current.artifact.headRevisionId))
    }
    func undo(projectID: String) async throws {
        let current = try project(projectID); guard let parent = current.source.revision.parentRevisionId else { return }
        upsert(try await api.setHead(id: projectID, revisionId: parent, expectedHeadRevisionId: current.artifact.headRevisionId))
    }
    func updateDetails(_ artifact: Artifact) async throws { var current = try project(artifact.id); current.artifact = try await api.updateArtifact(artifact); upsert(current) }
    func publish(projectID: String) async throws -> ArtifactPublication {
        let publication = try await api.publish(id: projectID, revisionId: try project(projectID).artifact.headRevisionId)
        var current = try project(projectID); current.artifact.publication = publication; current.artifact.publicationStale = false; upsert(current); return publication
    }
    func unpublish(projectID: String) async throws { var current = try project(projectID); if let slug = current.artifact.publication?.slug { try await api.revoke(slug: slug) }; current.artifact.publication = nil; upsert(current) }
    func extendPublication(projectID: String) async throws { var current = try project(projectID); guard let slug = current.artifact.publication?.slug else { return }; current.artifact.publication = try await api.extend(slug: slug, days: 90); upsert(current) }
    func deleteProject(projectID: String) async throws {
        let current = try project(projectID)
        do {
            try await api.deleteArtifact(id: projectID)
        } catch let error as StudioAPIError
            where error.isArtifactNotFound
                && Self.hasNoPotentiallyLivePublication(current.artifact.publication) {
            // The server may have expired the recovery copy already. The local
            // project must still remain deletable.
        }
        projects.removeAll { $0.id == projectID }
        let name = projectID.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? projectID
        try? FileManager.default.removeItem(at: projectDirectory.appending(path: "\(name).json"))
    }
    private static func hasNoPotentiallyLivePublication(_ publication: ArtifactPublication?) -> Bool {
        guard let publication else { return true }
        if publication.revokedAt != nil { return true }
        guard let expirationDate = publication.expirationDate else { return false }
        return expirationDate <= .now
    }
    func restoreFromStudio() async throws -> Int {
        isRestoringFromStudio = true
        defer { isRestoringFromStudio = false }
        let artifacts = try await api.listArtifacts()
        var count = 0
        var failures = 0
        for artifact in artifacts {
            do {
                let fetched = try await api.getArtifact(id: artifact.id)
                let remote = try await cacheAssets(in: fetched)
                upsert(remote)
                count += 1
            } catch let error as StudioAPIError where error.requiresRegistration {
                _ = present(error, during: .restore)
                throw error
            } catch {
                failures += 1
            }
        }
        if failures > 0 {
            recoveryNotice = count > 0
                ? "Studio restored \(count) widget(s), but could not restore \(failures). Try again later."
                : "Studio could not restore your widgets. Try again later."
        }
        return count
    }
    func uploadSnapshot(_ data: Data, revisionID: String) {
        guard uploadedSnapshotRevisionIDs.insert(revisionID).inserted else { return }
        Task {
            do { try await api.uploadScreenshot(revisionId: revisionID, jpeg: data) }
            catch { uploadedSnapshotRevisionIDs.remove(revisionID) }
        }
    }
    func addImage(_ data: Data, description: String, decorative: Bool, projectID: String) async throws {
        guard decorative || !description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw WidgetImageError.descriptionRequired }
        let current = try project(projectID)
        guard current.localAssets.count < 3 else { throw WidgetImageError.limitReached }
        let image = try await Task.detached(priority: .userInitiated) {
            try WidgetImageProcessor.prepare(data)
        }.value
        let upload = try await api.uploadImage(image, alternativeText: decorative ? nil : description, decorative: decorative)
        let local = try LocalWidgetAssetStorage.store(image, id: upload.asset.id)
        do {
            let context = decorative ? "decorative and ignored by assistive technology" : "described as: \(description)"
            try await refine("Insert the uploaded image using relative URL assets/\(upload.asset.id). It is \(context).", projectID: projectID)
            if let index = projects.firstIndex(where: { $0.id == projectID }) {
                projects[index].localAssets.removeAll { $0.id == local.id }
                projects[index].localAssets.append(local)
                persist(projects[index])
            }
        } catch {
            LocalWidgetAssetStorage.remove(local)
            throw error
        }
    }
    func removeImage(assetID: String, projectID: String) async throws {
        let current = try project(projectID)
        try await refine(
            "Remove the image at relative URL assets/\(assetID), including its surrounding caption or empty layout container.",
            projectID: projectID
        )
        guard let index = projects.firstIndex(where: { $0.id == projectID }) else { return }
        if let local = current.localAssets.first(where: { $0.id == assetID }) {
            LocalWidgetAssetStorage.remove(local)
        }
        projects[index].localAssets.removeAll { $0.id == assetID }
        persist(projects[index])
    }
    private func project(_ id: String) throws -> ArtifactProject { guard let result = projects.first(where: { $0.id == id }) else { throw StudioAPIError.invalidResponse }; return result }
    private func cacheAssets(in project: ArtifactProject) async throws -> ArtifactProject {
        var project = project
        let existingIDs = Set(project.localAssets.map(\.id))
        let assetIDs = Self.referencedAssetIDs(in: project.source.html)
        for assetID in assetIDs where !existingIDs.contains(assetID) {
            let downloaded = try await api.downloadAsset(id: assetID)
            project.localAssets.append(try LocalWidgetAssetStorage.store(downloaded, id: assetID))
        }
        return project
    }
    private func upsert(_ project: ArtifactProject) {
        var project = project
        if let cached = projects.first(where: { $0.id == project.id }) {
            let incomingIDs = Set(project.localAssets.map(\.id))
            project.localAssets.append(contentsOf: cached.localAssets.filter { !incomingIDs.contains($0.id) })
        }
        projects.removeAll { $0.id == project.id }
        projects.append(project)
        persist(project)
    }
    private func persist(_ project: ArtifactProject) {
        let name = project.id.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? UUID().uuidString
        do { try JSONEncoder().encode(project).write(to: projectDirectory.appending(path: "\(name).json"), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication]) }
        catch { recoveryNotice = "Studio could not save this widget for offline use." }
    }
    private static func loadCachedProjects(from directory: URL) -> [ArtifactProject] {
        let files = (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)) ?? []
        return files.compactMap { url in
            guard url.pathExtension == "json", let data = try? Data(contentsOf: url) else { return nil }
            return try? JSONDecoder().decode(ArtifactProject.self, from: data)
        }
    }
    static func referencedAssetIDs(in html: String) -> Set<String> {
        let patterns = [
            #"\b(?:src|href|action)\s*=\s*(?:"\s*assets/([A-Za-z0-9_-]+)\s*"|'\s*assets/([A-Za-z0-9_-]+)\s*'|assets/([A-Za-z0-9_-]+))"#,
            #"\burl\(\s*(?:"\s*assets/([A-Za-z0-9_-]+)\s*"|'\s*assets/([A-Za-z0-9_-]+)\s*'|assets/([A-Za-z0-9_-]+))\s*\)"#
        ]
        var result: Set<String> = []
        for pattern in patterns {
            guard let expression = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else { continue }
            let range = NSRange(html.startIndex..., in: html)
            for match in expression.matches(in: html, range: range) {
                for capture in 1..<match.numberOfRanges {
                    guard match.range(at: capture).location != NSNotFound,
                          let range = Range(match.range(at: capture), in: html)
                    else { continue }
                    result.insert(String(html[range]))
                }
            }
        }
        return result
    }
    static func copyLegacyProjects(from source: URL, to destination: URL) {
        let marker = destination.appending(path: ".legacy-cache-migrated", directoryHint: .notDirectory)
        guard !FileManager.default.fileExists(atPath: marker.path),
              FileManager.default.fileExists(atPath: source.path),
              let files = try? FileManager.default.contentsOfDirectory(at: source, includingPropertiesForKeys: nil)
        else { return }
        try? FileManager.default.createDirectory(at: destination, withIntermediateDirectories: true)
        var completed = true
        for file in files where file.pathExtension == "json" {
            let target = destination.appending(path: file.lastPathComponent, directoryHint: .notDirectory)
            guard !FileManager.default.fileExists(atPath: target.path) else { continue }
            do { try FileManager.default.copyItem(at: file, to: target) }
            catch { completed = false }
        }
        if completed { try? Data().write(to: marker, options: .atomic) }
    }
    private static func loadExamples(bundle: Bundle) -> [ArtifactProject] {
        guard let url = bundle.url(forResource: "manifest", withExtension: "json", subdirectory: "Examples"), let data = try? Data(contentsOf: url), let records = try? JSONDecoder().decode([ExampleArtifact].self, from: data) else { return [fallback] }
        return records.compactMap { record in guard let htmlURL = bundle.url(forResource: record.htmlFile, withExtension: nil, subdirectory: "Examples"), let html = try? String(contentsOf: htmlURL, encoding: .utf8) else { return nil }; return example(record, html: html) }
    }
    private static var fallback: ArtifactProject { example(.init(id: "example-fallback", title: "Quick classroom check", summary: "A tiny offline example.", subject: "other", level: "other", locale: "en-SG", learningObjective: "Check understanding", tags: ["fallback"], htmlFile: ""), html: "<html><body><main><h1>Quick classroom check</h1><button>Show answer</button></main></body></html>") }
    private static func testingProject(brief: GuidedBriefDraft, creationBrief: String) -> ArtifactProject {
        let artifactID = "ui-test-artifact"
        let revisionID = "ui-test-revision"
        let now = "2026-08-02T00:00:00Z"
        let html = """
        <!doctype html><html><body><main><h1>\(brief.learningObjective)</h1><p>\(brief.studentAction)</p></main></body></html>
        """
        let revision = ArtifactRevision(
            id: revisionID,
            artifactId: artifactID,
            sourceHash: "ui-test",
            byteLength: html.utf8.count,
            kind: .generate,
            model: "ui-test",
            promptVersion: "ui-test",
            createdAt: now
        )
        let artifact = Artifact(
            id: artifactID,
            title: brief.learningObjective,
            summary: brief.studentAction,
            tags: ["ui-test"],
            creationBrief: creationBrief,
            headRevisionId: revisionID,
            createdAt: now,
            updatedAt: now,
            headRevision: revision,
            html: html
        )
        return ArtifactProject(
            artifact: artifact,
            source: ArtifactSource(revision: revision, html: html),
            revisions: [revision]
        )
    }
    private static func example(_ record: ExampleArtifact, html: String) -> ArtifactProject { let now = "2026-08-02T00:00:00Z"; let revision = ArtifactRevision(id: "\(record.id)-seed", artifactId: record.id, parentRevisionId: nil, sourceHash: "bundled", byteLength: html.utf8.count, kind: .seed, instruction: nil, designCard: nil, screenshotUrl: nil, model: "bundled", promptVersion: "seed", createdAt: now); let creationBrief = "\(record.learningObjective ?? record.title)\n\nStudents should \(record.summary)"; let artifact = Artifact(id: record.id, title: record.title, summary: record.summary, subject: record.subject, level: record.level, locale: record.locale, learningObjective: record.learningObjective, tags: record.tags, creationBrief: creationBrief, headRevisionId: revision.id, createdAt: now, updatedAt: now, headRevision: revision, html: html); return ArtifactProject(artifact: artifact, source: .init(revision: revision, html: html), revisions: [revision], isExample: true) }
}
