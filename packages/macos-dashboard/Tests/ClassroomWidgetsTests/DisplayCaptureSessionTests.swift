import CoreMedia
import CoreVideo
import ScreenCaptureKit
import XCTest
@testable import ClassroomWidgets

final class DisplayCaptureSessionTests: XCTestCase {
    private enum TestError: Error { case unexpectedDiscovery }

    func testFrameDispositionWaitsForStartedThenAcceptsCompleteStatus() {
        XCTAssertEqual(
            [SCFrameStatus.started, .complete].map { DisplayCaptureSession.disposition(for: $0) },
            [.ignore, .deliver]
        )
    }

    func testTransientFrameStatusesHoldWhileIdleRetainsCurrentFrame() {
        XCTAssertEqual(DisplayCaptureSession.disposition(for: .idle), .ignore)
        XCTAssertEqual(DisplayCaptureSession.disposition(for: .started), .ignore)
        XCTAssertEqual(DisplayCaptureSession.disposition(for: .blank), .hold)
        XCTAssertEqual(DisplayCaptureSession.disposition(for: .suspended), .hold)
        XCTAssertEqual(DisplayCaptureSession.disposition(for: .stopped), .stopped)
        XCTAssertEqual(DisplayCaptureSession.disposition(for: .complete), .deliver)
        XCTAssertEqual(
            DisplayCaptureSession.disposition(for: .complete, hasImageBuffer: false),
            .hold,
            "A complete frame without pixels is a temporary gap, not a terminal stop"
        )
    }

    func testGapReasonsAreStableAndPrivacySafeForLogging() {
        XCTAssertEqual(DisplayCaptureSession.gapReason(for: .blank, hasImageBuffer: true), .blank)
        XCTAssertEqual(DisplayCaptureSession.gapReason(for: .suspended, hasImageBuffer: true), .suspended)
        XCTAssertEqual(
            DisplayCaptureSession.gapReason(for: .complete, hasImageBuffer: false),
            .missingImageBuffer
        )
        XCTAssertEqual(DisplayCaptureSession.gapReason(for: .stopped, hasImageBuffer: false), .stopped)
        XCTAssertEqual(DisplayCaptureGapReason.blank.rawValue, "blank")
    }

    func testStopBeforeStartKeepsCancellationStickyAndSkipsContentDiscovery() async throws {
        let discoveryCalled = NSLock()
        var didCallDiscovery = false
        let session = DisplayCaptureSession(sourceID: 1) {
            discoveryCalled.withLock { didCallDiscovery = true }
            throw TestError.unexpectedDiscovery
        }

        try await session.stop()

        do {
            try await session.start(excludingWindowID: 1, outputSize: CGSize(width: 640, height: 480))
            XCTFail("A pre-stopped capture session must not start")
        } catch is CancellationError {
            // Expected: cancellation is permanent for this one-shot session.
        } catch {
            XCTFail("Expected CancellationError, got \(error)")
        }
        XCTAssertFalse(discoveryCalled.withLock { didCallDiscovery })
    }

    @MainActor
    func testIdleAndStartedStatusesReportActivityWithoutBeginningAHold() async {
        let session = DisplayCaptureSession(sourceID: 2)
        var activity = 0
        var gaps: [DisplayCaptureGapReason] = []
        session.onFrameActivity = { activity += 1 }
        session.onTransientGap = { reason, _ in gaps.append(reason) }

        session.handleFrameStatus(.started, sampleBuffer: nil)
        session.handleFrameStatus(.idle, sampleBuffer: nil)
        session.handleFrameStatus(.idle, sampleBuffer: nil)
        await drainMainQueue()

        XCTAssertEqual(activity, 1, "Static .idle must prove the stream is alive")
        XCTAssertEqual(gaps, [], "Static .idle must never begin a hold")
    }

    @MainActor
    func testTerminalStatusWinsDuringAReportedGapAndDuplicatesStayCoalesced() async {
        let session = DisplayCaptureSession(sourceID: 2)
        var events: [String] = []
        session.onTransientGap = { reason, _ in events.append("gap:\(reason.rawValue)") }
        session.onUnavailable = { reason, _ in events.append("terminal:\(reason.rawValue)") }

        session.handleFrameStatus(.suspended, sampleBuffer: nil)
        session.handleFrameStatus(.stopped, sampleBuffer: nil)
        session.handleFrameStatus(.stopped, sampleBuffer: nil)
        session.handleFrameStatus(.blank, sampleBuffer: nil)
        await drainMainQueue()

        XCTAssertEqual(
            events,
            ["gap:suspended", "terminal:stopped"],
            "A terminal status must win during a reported gap, duplicates stay coalesced, and later gaps stay suppressed"
        )
    }

    @MainActor
    func testInterleavedFrameGapAndTerminalEventsCarryCaptureOrderSequences() async throws {
        let session = DisplayCaptureSession(sourceID: 2)
        var events: [(String, UInt64)] = []
        session.onFrame = { _, _, sequence in events.append(("frame", sequence)) }
        session.onTransientGap = { _, sequence in events.append(("gap", sequence)) }
        session.onUnavailable = { _, sequence in events.append(("terminal", sequence)) }
        let frame = try XCTUnwrap(makeFrameSampleBuffer(), "Fixture: expected a synthetic frame sample buffer")

        session.handleFrameStatus(.complete, sampleBuffer: frame)
        await drainMainQueue()
        session.handleFrameStatus(.blank, sampleBuffer: nil)
        await drainMainQueue()
        session.handleFrameStatus(.complete, sampleBuffer: frame)
        await drainMainQueue()

        XCTAssertEqual(events.map { $0.0 }, ["frame", "gap", "frame"])
        XCTAssertEqual(
            events.map { $0.1 },
            [1, 2, 3],
            "Sequences must follow capture order, not delivery order"
        )
    }

    @MainActor
    func testCoalescedDrainCanDeliverAPostGapFrameBeforeTheGapNotification() async throws {
        let session = DisplayCaptureSession(sourceID: 2)
        var events: [(String, UInt64)] = []
        session.onFrame = { _, _, sequence in events.append(("frame", sequence)) }
        session.onTransientGap = { _, sequence in events.append(("gap", sequence)) }
        let frame = try XCTUnwrap(makeFrameSampleBuffer(), "Fixture: expected a synthetic frame sample buffer")

        // The main queue is held for the whole burst, so the pending drain coalesces
        // the two complete statuses and runs before the queued gap notification.
        session.handleFrameStatus(.complete, sampleBuffer: frame)
        session.handleFrameStatus(.blank, sampleBuffer: nil)
        session.handleFrameStatus(.complete, sampleBuffer: frame)
        await drainMainQueue()

        XCTAssertEqual(events.map { $0.0 }, ["frame", "gap"])
        XCTAssertGreaterThan(
            events[0].1,
            events[1].1,
            "The delivered frame is newer than the gap, so the coordinator must keep the frame"
        )
    }

    @MainActor
    func testQueuedBurstKeepsTerminalDominanceOverPostTerminalFrames() async throws {
        let session = DisplayCaptureSession(sourceID: 2)
        var events: [(String, UInt64)] = []
        session.onFrame = { _, _, sequence in events.append(("frame", sequence)) }
        session.onTransientGap = { _, sequence in events.append(("gap", sequence)) }
        session.onUnavailable = { _, sequence in events.append(("terminal", sequence)) }
        let frame = try XCTUnwrap(makeFrameSampleBuffer(), "Fixture: expected a synthetic frame sample buffer")

        // Main queue held for the whole burst: complete(1) -> stopped(2) -> complete(3),
        // then a duplicate terminal and a later gap.
        session.handleFrameStatus(.complete, sampleBuffer: frame)
        session.handleFrameStatus(.stopped, sampleBuffer: nil)
        session.handleFrameStatus(.complete, sampleBuffer: frame)
        session.handleFrameStatus(.stopped, sampleBuffer: nil)
        session.handleFrameStatus(.blank, sampleBuffer: nil)
        await drainMainQueue()

        XCTAssertEqual(
            events.map { $0.0 },
            ["frame", "terminal"],
            "A post-terminal complete buffer must never be delivered"
        )
        XCTAssertEqual(
            events.map { $0.1 },
            [1, 2],
            "The surviving terminal is the one that stops capture"
        )
    }

    @MainActor
    func testStatusesAfterAnOwnedStopAreIgnored() async throws {
        let session = DisplayCaptureSession(sourceID: 2)
        var events: [String] = []
        session.onFrame = { _, _, _ in events.append("frame") }
        session.onTransientGap = { _, _ in events.append("gap") }
        session.onUnavailable = { _, _ in events.append("terminal") }
        session.onFrameActivity = { events.append("activity") }
        let frame = try XCTUnwrap(makeFrameSampleBuffer(), "Fixture: expected a synthetic frame sample buffer")

        try await session.stop()
        session.handleFrameStatus(.complete, sampleBuffer: frame)
        session.handleFrameStatus(.stopped, sampleBuffer: nil)
        await drainMainQueue()

        XCTAssertEqual(events, [], "An intentionally stopped session must not report further statuses")
    }

    @MainActor
    private func drainMainQueue() async {
        for _ in 0..<5 {
            await Task.yield()
            try? await Task.sleep(nanoseconds: 1_000_000)
        }
    }

    private func makeFrameSampleBuffer(width: Int = 4, height: Int = 4) -> CMSampleBuffer? {
        var pixelBuffer: CVPixelBuffer?
        guard CVPixelBufferCreate(
            kCFAllocatorDefault,
            width,
            height,
            kCVPixelFormatType_32BGRA,
            nil,
            &pixelBuffer
        ) == kCVReturnSuccess, let pixelBuffer else { return nil }

        var formatDescription: CMVideoFormatDescription?
        guard CMVideoFormatDescriptionCreateForImageBuffer(
            allocator: kCFAllocatorDefault,
            imageBuffer: pixelBuffer,
            formatDescriptionOut: &formatDescription
        ) == noErr, let formatDescription else { return nil }

        var timing = CMSampleTimingInfo(
            duration: CMTime(value: 1, timescale: 30),
            presentationTimeStamp: .zero,
            decodeTimeStamp: .invalid
        )
        var sampleBuffer: CMSampleBuffer?
        guard CMSampleBufferCreateReadyWithImageBuffer(
            allocator: kCFAllocatorDefault,
            imageBuffer: pixelBuffer,
            formatDescription: formatDescription,
            sampleTiming: &timing,
            sampleBufferOut: &sampleBuffer
        ) == noErr, let sampleBuffer else { return nil }
        return sampleBuffer
    }
}
