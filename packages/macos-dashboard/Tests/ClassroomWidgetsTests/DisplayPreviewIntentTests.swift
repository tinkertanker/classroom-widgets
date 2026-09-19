import XCTest
@testable import ClassroomWidgets

final class DisplayPreviewIntentTests: XCTestCase {
    func testLateStartIsRejectedAfterPauseAndReplacementStartIsAccepted() {
        var intent = DisplayPreviewIntent()
        intent.open()
        intent.select(sourceID: 10)
        let first = intent.start()!
        intent.pause()
        let second = intent.start()!
        XCTAssertFalse(intent.accepts(generation: first, sourceID: 10))
        XCTAssertTrue(intent.accepts(generation: second, sourceID: 10))
    }

    func testSourceChangeAndCloseInvalidateOutstandingCompletion() {
        var intent = DisplayPreviewIntent()
        intent.open()
        intent.select(sourceID: 10)
        let first = intent.start()!
        intent.select(sourceID: 11)
        XCTAssertFalse(intent.accepts(generation: first, sourceID: 10))
        let second = intent.start()!
        intent.close()
        intent.close()
        XCTAssertFalse(intent.accepts(generation: second, sourceID: 11))
    }

    func testOpenNeverCapturesAndStartRequiresSource() {
        var intent = DisplayPreviewIntent()
        intent.open()
        XCTAssertFalse(intent.wantsCapture)
        XCTAssertNil(intent.start())
    }
}
