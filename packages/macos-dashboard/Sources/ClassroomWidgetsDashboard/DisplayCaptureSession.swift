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
    private var gapReported = false
    private var terminalReported = false
    private var activityReported = false
    private var nextEventSequence: UInt64 = 0
    var onFrame: (@MainActor (CMSampleBuffer, CGSize, UInt64) -> Void)?
    /// Any recognized frame status, including static `.idle`/`.started`, proves the
    /// stream is alive. Reported once per session so a static display cannot churn.
    var onFrameActivity: (@MainActor () -> Void)?
    /// Temporary frame gap on an otherwise live stream: hold the last image.
    var onTransientGap: (@MainActor (DisplayCaptureGapReason, UInt64) -> Void)?
    /// Terminal stream status: the display stopped sending frames.
    var onUnavailable: (@MainActor (DisplayCaptureGapReason, UInt64) -> Void)?
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
        resetEventReporting()
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
        handleFrameStatus(status, sampleBuffer: sampleBuffer)
    }

    /// Ordered funnel for one decoded frame status. Production reaches this from
    /// `stream(_:didOutputSampleBuffer:of:)`; a missing buffer is the real
    /// "complete status without pixels" case. Every event carries a sequence
    /// assigned in capture order so a coalesced delivery cannot reorder effects.
    func handleFrameStatus(_ status: SCFrameStatus, sampleBuffer: CMSampleBuffer?) {
        let sequence = nextSequence()
        let hasImageBuffer = sampleBuffer?.imageBuffer != nil
        noteFrameActivity()
        switch Self.disposition(for: status, hasImageBuffer: hasImageBuffer) {
        case .ignore:
            return
        case .hold:
            let reason = Self.gapReason(for: status, hasImageBuffer: hasImageBuffer)
            guard beginGapReport() else { return }
            notifyMainActor { [weak self] in self?.onTransientGap?(reason, sequence) }
            return
        case .stopped:
            let reason = Self.gapReason(for: status, hasImageBuffer: hasImageBuffer)
            // A terminal status must win even while a gap is already reported.
            guard beginTerminalReport() else { return }
            notifyMainActor { [weak self] in self?.onUnavailable?(reason, sequence) }
            return
        case .deliver:
            break
        }
        guard let sampleBuffer, let imageBuffer = sampleBuffer.imageBuffer else { return }
        endGapReport()
        delivery.offer(
            sampleBuffer,
            size: CGSize(width: CVPixelBufferGetWidth(imageBuffer), height: CVPixelBufferGetHeight(imageBuffer)),
            sequence: sequence
        )
    }

    static func disposition(
        for status: SCFrameStatus,
        hasImageBuffer: Bool = true
    ) -> DisplayCaptureFrameDisposition {
        // Deliberately if-based rather than an exhaustive switch so an SDK that
        // adds status values cannot break the macOS 13 build.
        if status == .idle || status == .started { return .ignore }
        if status == .complete { return hasImageBuffer ? .deliver : .hold }
        if status == .blank || status == .suspended { return .hold }
        return .stopped
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

    private func nextSequence() -> UInt64 {
        stateLock.withLock {
            nextEventSequence &+= 1
            return nextEventSequence
        }
    }

    /// All session events reach the main actor through one FIFO channel so a gap
    /// notification cannot overtake an earlier delivered frame.
    private func notifyMainActor(_ action: @escaping @MainActor () -> Void) {
        DispatchQueue.main.async {
            MainActor.assumeIsolated { action() }
        }
    }

    private func noteFrameActivity() {
        let shouldReport = stateLock.withLock { () -> Bool in
            guard !activityReported else { return false }
            activityReported = true
            return true
        }
        guard shouldReport else { return }
        notifyMainActor { [weak self] in self?.onFrameActivity?() }
    }

    /// Coalesces a run of gap frames into one transition so a blank or suspended
    /// display cannot churn the coordinator at frame rate.
    private func beginGapReport() -> Bool {
        stateLock.withLock {
            guard !gapReported, !terminalReported else { return false }
            gapReported = true
            return true
        }
    }

    /// Terminal reporting has its own latch so a suspended -> stopped sequence is
    /// never suppressed by the gap latch, while duplicate terminals stay coalesced.
    private func beginTerminalReport() -> Bool {
        stateLock.withLock {
            guard !terminalReported else { return false }
            terminalReported = true
            gapReported = true
            return true
        }
    }

    private func endGapReport() {
        stateLock.withLock { gapReported = false }
    }

    private func resetEventReporting() {
        stateLock.withLock {
            gapReported = false
            terminalReported = false
            activityReported = false
        }
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
    private var latest: (CMSampleBuffer, CGSize, UInt64)?
    private var scheduled = false

    func offer(_ frame: CMSampleBuffer, size: CGSize, sequence: UInt64) {
        lock.lock()
        latest = (frame, size, sequence)
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
        MainActor.assumeIsolated { owner.onFrame?(frame.0, frame.1, frame.2) }
    }
}
