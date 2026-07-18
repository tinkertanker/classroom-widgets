import CoreGraphics
import CryptoKit
import Foundation
import ImageIO
import UniformTypeIdentifiers
import Vision

struct PreparedWidgetImage: Equatable, Sendable {
    let data: Data
    let mediaType: String
    let width: Int
    let height: Int
    let sha256: String

    var fileExtension: String { "jpg" }
}

struct WidgetImageAssetRecord: Codable, Equatable, Sendable {
    let id: String
    let kind: String
    let mediaType: String
    let width: Int
    let height: Int
    let byteLength: Int
    let sha256: String

    var jsonValue: JSONValue {
        .object([
            "id": .string(id),
            "kind": .string(kind),
            "mediaType": .string(mediaType),
            "width": .integer(width),
            "height": .integer(height),
            "byteLength": .integer(byteLength),
            "sha256": .string(sha256)
        ])
    }

    func validated(_ download: DownloadedWidgetAsset) throws -> DownloadedWidgetAsset {
        let digest = SHA256.hash(data: download.data).map { String(format: "%02x", $0) }.joined()
        guard kind == "image",
              mediaType.lowercased() == download.mediaType.lowercased(),
              byteLength == download.data.count,
              sha256.lowercased() == digest
        else {
            throw WidgetImageError.invalidRestoredAsset
        }
        return download
    }
}

struct UploadedWidgetImage: Codable, Equatable, Sendable {
    struct Accessibility: Codable, Equatable, Sendable {
        let alternativeText: String?
        let decorative: Bool
    }

    let asset: WidgetImageAssetRecord
    let accessibility: Accessibility
}

struct LocalWidgetAssetFile: Codable, Equatable, Identifiable, Sendable {
    let id: String
    let fileName: String
    let mediaType: String
}

struct DownloadedWidgetAsset: Equatable, Sendable {
    let data: Data
    let mediaType: String
}

enum WidgetImageProcessor {
    static let maximumBytes = 2_000_000

    static func prepare(_ input: Data) throws -> PreparedWidgetImage {
        guard !input.isEmpty,
              let source = CGImageSourceCreateWithData(input as CFData, nil),
              CGImageSourceGetCount(source) > 0
        else {
            throw WidgetImageError.invalidImage
        }

        guard let privacyImage = thumbnail(from: source, maximumDimension: 2_048) else {
            throw WidgetImageError.invalidImage
        }
        try WidgetImagePrivacyScanner.validate(privacyImage)

        for maximumDimension in [2_048, 1_600, 1_280, 1_024] {
            guard let image = thumbnail(from: source, maximumDimension: maximumDimension),
                  let flattened = flattenOntoWhite(image)
            else { continue }

            for quality in [0.9, 0.78, 0.66, 0.54, 0.44] {
                guard let data = jpegData(from: flattened, quality: quality) else { continue }
                if data.count <= maximumBytes {
                    return PreparedWidgetImage(
                        data: data,
                        mediaType: "image/jpeg",
                        width: flattened.width,
                        height: flattened.height,
                        sha256: SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
                    )
                }
            }
        }
        throw WidgetImageError.couldNotReduceSize
    }

    private static func thumbnail(from source: CGImageSource, maximumDimension: Int) -> CGImage? {
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: maximumDimension,
            kCGImageSourceShouldCacheImmediately: true
        ]
        return CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
    }

    private static func flattenOntoWhite(_ image: CGImage) -> CGImage? {
        guard let context = CGContext(
            data: nil,
            width: image.width,
            height: image.height,
            bitsPerComponent: 8,
            bytesPerRow: 0,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
        ) else { return nil }
        context.setFillColor(CGColor(gray: 1, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: image.width, height: image.height))
        context.interpolationQuality = .high
        context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
        return context.makeImage()
    }

    private static func jpegData(from image: CGImage, quality: Double) -> Data? {
        let output = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(
            output,
            UTType.jpeg.identifier as CFString,
            1,
            nil
        ) else { return nil }
        CGImageDestinationAddImage(
            destination,
            image,
            [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary
        )
        guard CGImageDestinationFinalize(destination) else { return nil }
        return output as Data
    }
}

enum WidgetImagePrivacyScanner {
    static func validate(_ image: CGImage) throws {
        let faces = VNDetectFaceRectanglesRequest()
        let text = VNRecognizeTextRequest()
        text.recognitionLevel = .accurate
        text.usesLanguageCorrection = false

        do {
            try VNImageRequestHandler(cgImage: image).perform([faces, text])
        } catch {
            throw WidgetImageError.privacyCheckFailed
        }

        if !(faces.results?.isEmpty ?? true) {
            throw WidgetImageError.identifiablePersonDetected
        }

        let recognisedText = (text.results ?? [])
            .compactMap { $0.topCandidates(1).first?.string }
            .joined(separator: "\n")
        if containsObviousPersonalData(in: recognisedText) {
            throw WidgetImageError.personalDataDetected
        }
    }

    static func containsObviousPersonalData(in text: String) -> Bool {
        let patterns = [
            #"(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b"#,
            #"(?i)\b[STFGM]\d{7}[A-Z]\b"#,
            #"(?<!\d)(?:\+?65[\s-]?)?[689]\d{3}[\s-]?\d{4}(?!\d)"#
        ]
        return patterns.contains { pattern in
            text.range(of: pattern, options: .regularExpression) != nil
        }
    }
}

enum LocalWidgetAssetStorage {
    static func store(_ image: PreparedWidgetImage, id: String) throws -> LocalWidgetAssetFile {
        try store(data: image.data, id: id, mediaType: image.mediaType)
    }

    static func store(_ asset: DownloadedWidgetAsset, id: String) throws -> LocalWidgetAssetFile {
        try store(data: asset.data, id: id, mediaType: asset.mediaType)
    }

    static func url(for asset: LocalWidgetAssetFile) -> URL? {
        guard let directory = try? imageDirectory() else { return nil }
        let candidate = directory.appending(path: asset.fileName, directoryHint: .notDirectory)
        guard candidate.deletingLastPathComponent().standardizedFileURL == directory.standardizedFileURL,
              FileManager.default.fileExists(atPath: candidate.path)
        else { return nil }
        return candidate
    }

    static func remove(_ asset: LocalWidgetAssetFile) {
        guard let url = url(for: asset) else { return }
        try? FileManager.default.removeItem(at: url)
    }

    private static func imageDirectory() throws -> URL {
        let root = try FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        let directory = root
            .appending(path: "Classroom Widgets Studio", directoryHint: .isDirectory)
            .appending(path: "Images", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }

    private static func store(data: Data, id: String, mediaType: String) throws -> LocalWidgetAssetFile {
        guard !data.isEmpty, data.count <= WidgetImageProcessor.maximumBytes,
              id.range(of: #"^[A-Za-z0-9][A-Za-z0-9._-]*$"#, options: .regularExpression) != nil,
              !id.contains(".."),
              let fileExtension = fileExtension(for: mediaType)
        else {
            throw WidgetImageError.invalidRestoredAsset
        }
        let directory = try imageDirectory()
        let fileName = "\(id).\(fileExtension)"
        let destination = directory.appending(path: fileName, directoryHint: .notDirectory)
        guard destination.deletingLastPathComponent().standardizedFileURL == directory.standardizedFileURL else {
            throw WidgetImageError.invalidRestoredAsset
        }
        try data.write(to: destination, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        return LocalWidgetAssetFile(id: id, fileName: fileName, mediaType: mediaType)
    }

    private static func fileExtension(for mediaType: String) -> String? {
        switch mediaType.lowercased() {
        case "image/jpeg", "image/jpg": "jpg"
        case "image/png": "png"
        case "image/heic", "image/heif": "heic"
        case "image/webp": "webp"
        case "image/avif": "avif"
        default: nil
        }
    }
}

enum WidgetImageError: LocalizedError, Equatable {
    case invalidImage
    case couldNotReduceSize
    case limitReached
    case descriptionRequired
    case identifiablePersonDetected
    case personalDataDetected
    case privacyCheckFailed
    case invalidRestoredAsset

    var errorDescription: String? {
        switch self {
        case .invalidImage:
            "Choose a valid JPEG, PNG or HEIC image."
        case .couldNotReduceSize:
            "This image could not be prepared under the 2 MB classroom limit."
        case .limitReached:
            "A widget can contain up to three uploaded images."
        case .descriptionRequired:
            "Describe the image for students, or mark it as decorative."
        case .identifiablePersonDetected:
            "Choose an image without recognisable people. Studio does not upload pupil or staff photos."
        case .personalDataDetected:
            "This image appears to contain an email address, Singapore phone number or identity number. Remove personal information before uploading it."
        case .privacyCheckFailed:
            "Studio could not complete the on-device privacy check for this image. Choose a different image and try again."
        case .invalidRestoredAsset:
            "Studio could not safely restore one of this widget’s images. The local widget was left unchanged."
        }
    }
}
