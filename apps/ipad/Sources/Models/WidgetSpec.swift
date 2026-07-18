import Foundation

struct WidgetSpec: Codable, Equatable, Sendable {
    var schemaVersion: String
    var id: String
    var metadata: WidgetMetadata
    var theme: WidgetTheme
    var assets: [JSONValue]
    var variables: [JSONValue]
    var screens: [WidgetScreen]

    var componentCount: Int {
        screens.reduce(0) { $0 + $1.components.count }
    }

    func prettyPrintedJSON() -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        guard let data = try? encoder.encode(self) else { return "Unable to encode this widget." }
        return String(decoding: data, as: UTF8.self)
    }

    func jsonObject() throws -> Any {
        let data = try JSONEncoder().encode(self)
        return try JSONSerialization.jsonObject(with: data)
    }
}

struct WidgetMetadata: Codable, Equatable, Sendable {
    var title: String
    var summary: String
    var subject: String?
    var level: String?
    var locale: String? = nil
    var learningObjective: String?
    var estimatedMinutes: Int?
    var tags: [String]?
}

struct WidgetTheme: Codable, Equatable, Sendable {
    var accent: String
    var colourScheme: String
    var density: String
}

struct WidgetScreen: Codable, Equatable, Sendable, Identifiable {
    var id: String
    var title: String?
    var components: [JSONValue]
}

enum WidgetFamily: String, Codable, CaseIterable, Sendable {
    case quiz
    case matching
    case diagram
    case simulation
    case classroomTool

    var title: String {
        switch self {
        case .quiz: "Quiz & retrieval"
        case .matching: "Matching & sorting"
        case .diagram: "Interactive diagram"
        case .simulation: "Graph & simulation"
        case .classroomTool: "Classroom tool"
        }
    }

    var symbolName: String {
        switch self {
        case .quiz: "checkmark.bubble"
        case .matching: "square.grid.2x2"
        case .diagram: "point.topleft.down.to.point.bottomright.curvepath"
        case .simulation: "chart.xyaxis.line"
        case .classroomTool: "timer"
        }
    }
}

struct WidgetProject: Codable, Equatable, Identifiable, Sendable {
    var id: String = "project-\(UUID().uuidString.lowercased())"
    var spec: WidgetSpec
    var family: WidgetFamily
    var updatedAt: Date
    var isExample: Bool
    var revisionNotes: [RevisionNote]
    var remoteDraft: RemoteDraftReference? = nil
    var publication: WidgetPublication? = nil
    var localAssets: [LocalWidgetAssetFile] = []
    var publicationNeedsUpdate: Bool = false
    var needsRemoteSave: Bool = false
    var previousSpec: WidgetSpec? = nil
}

extension WidgetProject {
    private enum CodingKeys: String, CodingKey {
        case id
        case spec
        case family
        case updatedAt
        case isExample
        case revisionNotes
        case remoteDraft
        case publication
        case localAssets
        case publicationNeedsUpdate
        case needsRemoteSave
        case previousSpec
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        spec = try container.decode(WidgetSpec.self, forKey: .spec)
        id = try container.decodeIfPresent(String.self, forKey: .id)
            ?? "project-\(UUID().uuidString.lowercased())"
        family = try container.decode(WidgetFamily.self, forKey: .family)
        updatedAt = try container.decode(Date.self, forKey: .updatedAt)
        isExample = try container.decodeIfPresent(Bool.self, forKey: .isExample) ?? false
        revisionNotes = try container.decodeIfPresent([RevisionNote].self, forKey: .revisionNotes) ?? []
        remoteDraft = try container.decodeIfPresent(RemoteDraftReference.self, forKey: .remoteDraft)
        publication = try container.decodeIfPresent(WidgetPublication.self, forKey: .publication)
        localAssets = try container.decodeIfPresent([LocalWidgetAssetFile].self, forKey: .localAssets) ?? []
        publicationNeedsUpdate = try container.decodeIfPresent(Bool.self, forKey: .publicationNeedsUpdate) ?? false
        needsRemoteSave = try container.decodeIfPresent(Bool.self, forKey: .needsRemoteSave) ?? false
        previousSpec = try container.decodeIfPresent(WidgetSpec.self, forKey: .previousSpec)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(spec, forKey: .spec)
        try container.encode(family, forKey: .family)
        try container.encode(updatedAt, forKey: .updatedAt)
        try container.encode(isExample, forKey: .isExample)
        try container.encode(revisionNotes, forKey: .revisionNotes)
        try container.encodeIfPresent(remoteDraft, forKey: .remoteDraft)
        try container.encodeIfPresent(publication, forKey: .publication)
        try container.encode(localAssets, forKey: .localAssets)
        try container.encode(publicationNeedsUpdate, forKey: .publicationNeedsUpdate)
        try container.encode(needsRemoteSave, forKey: .needsRemoteSave)
        try container.encodeIfPresent(previousSpec, forKey: .previousSpec)
    }
}

struct RemoteDraft: Codable, Equatable, Sendable {
    var id: String
    var title: String
    var schemaVersion: String
    var spec: WidgetSpec
    var version: Int
    var createdAt: String
    var updatedAt: String

    var reference: RemoteDraftReference {
        RemoteDraftReference(id: id, version: version)
    }
}

struct RemoteDraftReference: Codable, Equatable, Sendable {
    var id: String
    var version: Int
}

struct RemoteDraftSummary: Codable, Equatable, Identifiable, Sendable {
    var id: String
    var title: String
    var schemaVersion: String
    var version: Int
    var createdAt: String
    var updatedAt: String
    var publication: WidgetPublication?
}

struct WidgetPublication: Codable, Equatable, Sendable {
    var slug: String
    var url: URL
    var title: String
    var schemaVersion: String
    var createdAt: String
    var expiresAt: String
    var revokedAt: String?
}

struct RevisionNote: Codable, Equatable, Identifiable, Sendable {
    let id: UUID
    let prompt: String
    let createdAt: Date
}

struct SampleWidgetRecord: Codable, Sendable {
    var family: WidgetFamily
    var spec: WidgetSpec
}
