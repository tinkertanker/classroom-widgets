import CryptoKit
import Foundation

struct StudioProjectLoadResult {
    let projects: [WidgetProject]
    let hadStoredProjects: Bool
    let recoveredCount: Int
    let quarantinedCount: Int
}

/// Stores each project independently so one damaged file cannot make every
/// classroom widget unreadable. Writes are atomic and retain the previous
/// valid representation as a one-generation backup.
final class StudioProjectFileStore {
    private static let manifestName = "manifest.json"
    private static let storeVersion = 1

    private let directory: URL
    private let quarantineDirectory: URL
    private let fileManager: FileManager
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    init(directory: URL? = nil, fileManager: FileManager = .default) throws {
        self.fileManager = fileManager
        if let directory {
            self.directory = directory
        } else {
            let applicationSupport = try fileManager.url(
                for: .applicationSupportDirectory,
                in: .userDomainMask,
                appropriateFor: nil,
                create: true
            )
            self.directory = applicationSupport
                .appending(path: "Classroom Widgets Studio", directoryHint: .isDirectory)
                .appending(path: "Projects", directoryHint: .isDirectory)
        }
        quarantineDirectory = self.directory
            .appending(path: "Quarantine", directoryHint: .isDirectory)

        encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        decoder = JSONDecoder()
    }

    func load() throws -> StudioProjectLoadResult {
        try createDirectoryIfNeeded()
        try? purgeExpiredQuarantine()
        let contents = try fileManager.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: [.isRegularFileKey],
            options: [.skipsHiddenFiles]
        )
        let projectFiles = contents.filter {
            $0.lastPathComponent.hasPrefix("project-") && $0.pathExtension == "json"
        }
        let orphanedBackups = contents.filter {
            $0.lastPathComponent.hasPrefix("project-")
                && $0.lastPathComponent.hasSuffix(".json.backup")
                && !fileManager.fileExists(atPath: $0.deletingPathExtension().path)
        }
        let hadStoredProjects = fileManager.fileExists(atPath: manifestURL.path)
            || !projectFiles.isEmpty
            || contents.contains(where: { $0.lastPathComponent.hasSuffix(".json.backup") })

        var projectsByID: [String: WidgetProject] = [:]
        var recoveredCount = 0
        var quarantinedCount = 0

        for backup in orphanedBackups {
            if let recovered = decodeProject(at: backup) {
                let primary = backup.deletingPathExtension()
                let recoveredData = try encoder.encode(recovered)
                try write(recoveredData, to: primary)
                projectsByID[recovered.id] = recovered
                recoveredCount += 1
            } else {
                try quarantine(backup)
                quarantinedCount += 1
            }
        }

        for file in projectFiles {
            if let project = decodeProject(at: file) {
                if let existing = projectsByID[project.id], existing.updatedAt >= project.updatedAt {
                    try quarantine(file)
                    quarantinedCount += 1
                } else {
                    projectsByID[project.id] = project
                }
                continue
            }

            let backup = backupURL(for: file)
            if let recovered = decodeProject(at: backup) {
                try quarantine(file)
                quarantinedCount += 1
                let recoveredData = try encoder.encode(recovered)
                try write(recoveredData, to: file)
                projectsByID[recovered.id] = recovered
                recoveredCount += 1
            } else {
                try quarantine(file)
                quarantinedCount += 1
                if fileManager.fileExists(atPath: backup.path) {
                    try quarantine(backup)
                    quarantinedCount += 1
                }
            }
        }

        return StudioProjectLoadResult(
            projects: projectsByID.values.sorted { $0.updatedAt > $1.updatedAt },
            hadStoredProjects: hadStoredProjects,
            recoveredCount: recoveredCount,
            quarantinedCount: quarantinedCount
        )
    }

    func save(_ project: WidgetProject) throws {
        try createDirectoryIfNeeded()
        let data = try encoder.encode(project)
        let destination = projectURL(for: project.id)
        if fileManager.fileExists(atPath: destination.path) {
            let current = try Data(contentsOf: destination)
            try write(current, to: backupURL(for: destination))
        }
        try write(data, to: destination)
        try markInitialised()
    }

    func markInitialised() throws {
        try createDirectoryIfNeeded()
        let manifest = try JSONSerialization.data(
            withJSONObject: ["version": Self.storeVersion],
            options: [.sortedKeys]
        )
        try write(manifest, to: manifestURL)
    }

    func quarantineLegacyLibrary(_ data: Data) throws {
        try fileManager.createDirectory(at: quarantineDirectory, withIntermediateDirectories: true)
        let destination = quarantineDirectory.appending(
            path: "\(quarantineTimestamp)-legacy-\(UUID().uuidString.lowercased()).json",
            directoryHint: .notDirectory
        )
        try write(data, to: destination)
    }

    func delete(projectID: String) throws {
        let destination = projectURL(for: projectID)
        for candidate in [destination, backupURL(for: destination)]
        where fileManager.fileExists(atPath: candidate.path) {
            try fileManager.removeItem(at: candidate)
        }
        try markInitialised()
    }

    func reset() throws {
        guard fileManager.fileExists(atPath: directory.path) else { return }
        try fileManager.removeItem(at: directory)
    }

    private var manifestURL: URL {
        directory.appending(path: Self.manifestName, directoryHint: .notDirectory)
    }

    private func projectURL(for projectID: String) -> URL {
        let digest = SHA256.hash(data: Data(projectID.utf8))
            .map { String(format: "%02x", $0) }
            .joined()
        return directory.appending(path: "project-\(digest).json", directoryHint: .notDirectory)
    }

    private func backupURL(for projectURL: URL) -> URL {
        projectURL.appendingPathExtension("backup")
    }

    private func decodeProject(at url: URL) -> WidgetProject? {
        guard fileManager.fileExists(atPath: url.path),
              let data = try? Data(contentsOf: url),
              let project = try? decoder.decode(WidgetProject.self, from: data)
        else { return nil }
        return project
    }

    private func createDirectoryIfNeeded() throws {
        try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
    }

    private func write(_ data: Data, to destination: URL) throws {
        try data.write(
            to: destination,
            options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication]
        )
    }

    private func quarantine(_ source: URL) throws {
        guard fileManager.fileExists(atPath: source.path) else { return }
        try fileManager.createDirectory(at: quarantineDirectory, withIntermediateDirectories: true)
        let destination = quarantineDirectory.appending(
            path: "\(quarantineTimestamp)-\(UUID().uuidString.lowercased())-\(source.lastPathComponent)",
            directoryHint: .notDirectory
        )
        try fileManager.moveItem(at: source, to: destination)
    }

    private func purgeExpiredQuarantine() throws {
        guard fileManager.fileExists(atPath: quarantineDirectory.path) else { return }
        let expiry = Date().addingTimeInterval(-30 * 24 * 60 * 60)
        let contents = try fileManager.contentsOfDirectory(
            at: quarantineDirectory,
            includingPropertiesForKeys: nil,
            options: [.skipsHiddenFiles]
        )
        for file in contents {
            let timestamp = file.lastPathComponent.split(separator: "-", maxSplits: 1).first
                .flatMap { TimeInterval($0) }
                .map(Date.init(timeIntervalSince1970:))
            if let timestamp, timestamp < expiry {
                try fileManager.removeItem(at: file)
            }
        }
    }

    private var quarantineTimestamp: Int {
        Int(Date().timeIntervalSince1970)
    }
}
