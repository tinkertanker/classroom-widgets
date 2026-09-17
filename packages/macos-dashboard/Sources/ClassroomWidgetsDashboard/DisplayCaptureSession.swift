import CoreMedia
import CoreVideo
import Foundation
import ScreenCaptureKit

enum DisplayCaptureSessionError: LocalizedError {
    case sourceUnavailable
    case previewWindowUnavailable

    var errorDescription: String? {
        switch self {
        case .sourceUnavailable: return "The selected display is no longer available."
        case .previewWindowUnavailable: return "The preview window could not be excluded from capture."
        }
    }
}

enum DisplayCaptureFrameDisposition: Equatable {
    case ignore
    case deliver
    case hold
    case stopped
    case unavailable
}

/// Privacy-safe reason for a frame gap, suitable for structured logging.
enum DisplayCaptureGapReason: String, Equatable {
    case blank
    case suspended
    case missingImageBuffer
    case stopped
}

final class DisplayCaptureSession: NSObject, SCStreamOutput, SCStreamDelegate {
    typealias ContentDiscovery = () async throws -> SCShareableContent

    let sourceID: CGDirectDisplayID
    private let outputQueue = DispatchQueue(label: "sg.tk.classroomwidgets.display-preview.frames")
    private let delivery: FrameDelivery
    private let contentDiscovery: ContentDiscovery
    private let stateLock = NSLock()
    private var stream: SCStream?
    private var startInProgress = false
    private var cancelled = false
    var onFrame: (@MainActor (CMSampleBuffer, CGSize) -> Void)?
    var onUnavailable: (@MainActor () -> Void)?
    var onStop: (@MainActor (Error) -> Void)?

    init(
        sourceID: CGDirectDisplayID,
        contentDiscovery: @escaping ContentDiscovery = {
            try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
        }
    ) {
        self.sourceID = sourceID
        self.contentDiscovery = contentDiscovery
        delivery = FrameDelivery()
        super.init()
        delivery.owner = self
    }

    func start(excludingWindowID: CGWindowID, outputSize: CGSize) async throws {
        let wasAlreadyCancelled = stateLock.withLock {
            startInProgress = true
            return cancelled
        }
        defer { stateLock.withLock { startInProgress = false } }
        if wasAlreadyCancelled { throw CancellationError() }
        let content = try await contentDiscovery()
        try checkCancellation()
        guard let display = content.displays.first(where: { $0.displayID == sourceID }) else {
            throw DisplayCaptureSessionError.sourceUnavailable
        }
        guard let window = content.windows.first(where: { $0.windowID == excludingWindowID }) else {
            throw DisplayCaptureSessionError.previewWindowUnavailable
        }
        let filter = SCContentFilter(display: display, excludingWindows: [window])
        let configuration = SCStreamConfiguration()
        configuration.width = max(2, Int(outputSize.width.rounded(.down)))
        configuration.height = max(2, Int(outputSize.height.rounded(.down)))
        configuration.minimumFrameInterval = CMTime(value: 1, timescale: 30)
        configuration.queueDepth = 3
        configuration.pixelFormat = kCVPixelFormatType_32BGRA
        configuration.showsCursor = true
        configuration.capturesAudio = false

        let stream = SCStream(filter: filter, configuration: configuration, delegate: self)
        try stream.addStreamOutput(self, type: .screen, sampleHandlerQueue: outputQueue)
        let wasCancelled = stateLock.withLock {
            guard !cancelled else { return true }
            self.stream = stream
            return false
        }
        if wasCancelled { throw CancellationError() }
        try await stream.startCapture()
        try checkCancellation()
    }

    func stop() async throws {
        stateLock.withLock { cancelled = true }
        while isStartInProgress { try await Task.sleep(nanoseconds: 10_000_000) }
        let stream = stateLock.withLock { self.stream }
        guard let stream else { delivery.clear(); return }
        try await stream.stopCapture()
        stateLock.withLock { self.stream = nil }
        delivery.clear()
    }

    func stream(_ stream: SCStream, didStopWithError error: Error) {
        Task { @MainActor [weak self] in self?.onStop?(error) }
    }

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .screen, sampleBuffer.isValid,
              let attachments = CMSampleBufferGetSampleAttachmentsArray(sampleBuffer, createIfNecessary: false) as? [[SCStreamFrameInfo: Any]],
              let statusNumber = attachments.first?[.status] as? NSNumber,
              let status = SCFrameStatus(rawValue: statusNumber.intValue)
        else { return }
        switch Self.disposition(for: status, hasImageBuffer: sampleBuffer.imageBuffer != nil) {
        case .ignore:
            return
        case .unavailable:
            Task { @MainActor [weak self] in self?.onUnavailable?() }
            return
        case .deliver:
            break
        }
        guard let imageBuffer = sampleBuffer.imageBuffer else { return }
        delivery.offer(sampleBuffer, size: CGSize(width: CVPixelBufferGetWidth(imageBuffer), height: CVPixelBufferGetHeight(imageBuffer)))
    }

    static func disposition(
        for status: SCFrameStatus,
        hasImageBuffer: Bool = true
    ) -> DisplayCaptureFrameDisposition {
        if status == .idle || status == .started { return .ignore }
        return status == .complete && hasImageBuffer ? .deliver : .unavailable
    }

    static func gapReason(
        for status: SCFrameStatus,
        hasImageBuffer: Bool
    ) -> DisplayCaptureGapReason {
        if status == .stopped { return .stopped }
        if status == .suspended { return .suspended }
        if status == .blank { return .blank }
        return hasImageBuffer ? .blank : .missingImageBuffer
    }

    private var isStartInProgress: Bool {
        stateLock.withLock { startInProgress }
    }

    private func checkCancellation() throws {
        if stateLock.withLock({ cancelled }) { throw CancellationError() }
    }
}

private final class FrameDelivery {
    weak var owner: DisplayCaptureSession?
    private let lock = NSLock()
    private var latest: (CMSampleBuffer, CGSize)?
    private var scheduled = false

    func offer(_ frame: CMSampleBuffer, size: CGSize) {
        lock.lock()
        latest = (frame, size)
        let shouldSchedule = !scheduled
        scheduled = true
        lock.unlock()
        guard shouldSchedule else { return }
        DispatchQueue.main.async { [weak self] in self?.drain() }
    }

    func clear() {
        lock.lock(); latest = nil; lock.unlock()
    }

    private func drain() {
        lock.lock()
        let frame = latest
        latest = nil
        scheduled = false
        lock.unlock()
        guard let frame, let owner else { return }
        MainActor.assumeIsolated { owner.onFrame?(frame.0, frame.1) }
    }
}
