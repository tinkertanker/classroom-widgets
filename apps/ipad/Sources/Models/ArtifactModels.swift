import Foundation

struct Artifact: Codable, Equatable, Identifiable, Sendable {
    var id: String
    var title: String
    var summary: String
    var subject: String? = nil
    var level: String? = nil
    var locale: String? = nil
    var learningObjective: String? = nil
    var tags: [String]
    var creationBrief: String
    var headRevisionId: String
    var remixedFromRevisionId: String? = nil
    var createdAt: String
    var updatedAt: String
    var publication: ArtifactPublication? = nil
    var publicationStale: Bool? = nil
    var headRevision: ArtifactRevision? = nil
    var html: String? = nil
}

struct ArtifactRevision: Codable, Equatable, Identifiable, Sendable {
    enum Kind: String, Codable, Sendable { case generate, revise, remix, seed }
    var id: String
    var artifactId: String
    var parentRevisionId: String? = nil
    var sourceHash: String
    var byteLength: Int
    var kind: Kind
    var instruction: String? = nil
    var designCard: String? = nil
    var screenshotUrl: URL? = nil
    var model: String
    var promptVersion: String
    var createdAt: String
}

struct ArtifactSource: Codable, Equatable, Sendable {
    var revision: ArtifactRevision
    var html: String
}

struct ArtifactPublication: Codable, Equatable, Sendable {
    var slug: String
    var url: URL
    var title: String
    var createdAt: String
    var expiresAt: String
    var revokedAt: String? = nil

    var expirationDate: Date? { ISO8601DateFormatter.fractional.date(from: expiresAt) ?? ISO8601DateFormatter().date(from: expiresAt) }
    func isExpired(at date: Date = .now) -> Bool { expirationDate.map { $0 <= date } ?? true }
    func formattedExpirationDate() -> String {
        guard let expirationDate else { return expiresAt }
        return expirationDate.formatted(date: .abbreviated, time: .omitted)
    }
}

struct ArtifactProject: Codable, Equatable, Identifiable, Sendable {
    var artifact: Artifact
    var source: ArtifactSource
    var revisions: [ArtifactRevision]
    var localAssets: [LocalWidgetAssetFile] = []
    var isExample = false
    var id: String { artifact.id }
    var updatedAt: Date {
        ISO8601DateFormatter.fractional.date(from: artifact.updatedAt)
            ?? ISO8601DateFormatter().date(from: artifact.updatedAt)
            ?? .distantPast
    }
}

struct ExampleArtifact: Codable, Equatable, Identifiable, Sendable {
    var id: String
    var title: String
    var summary: String
    var subject: String? = nil
    var level: String? = nil
    var locale: String? = nil
    var learningObjective: String? = nil
    var tags: [String]
    var htmlFile: String
}

extension ISO8601DateFormatter {
    static var fractional: ISO8601DateFormatter {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }
}
