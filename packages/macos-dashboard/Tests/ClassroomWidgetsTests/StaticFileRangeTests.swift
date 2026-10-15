import XCTest
@testable import ClassroomWidgets

/// Media elements read bundled audio with HTTP Range requests. Each way the
/// handler could answer one wrongly, against a 10-byte body.
final class StaticFileRangeTests: XCTestCase {
    private func range(_ header: String?, length: Int = 10) -> StaticFileRange {
        StaticFileRange(header: header, length: length)
    }

    func testRequestWithoutRangeGetsWholeBody() {
        XCTAssertEqual(range(nil), .whole)
        XCTAssertEqual(range(""), .whole)
    }

    func testClosedRangeGetsExactlyThoseBytes() {
        XCTAssertEqual(range("bytes=0-1"), .partial(0..<2))
        XCTAssertEqual(range("bytes=3-3"), .partial(3..<4))
        XCTAssertEqual(range("bytes=0-9"), .partial(0..<10))
    }

    func testOpenEndedRangeRunsToTheEnd() {
        XCTAssertEqual(range("bytes=4-"), .partial(4..<10))
    }

    func testSuffixRangeGetsTheLastBytes() {
        XCTAssertEqual(range("bytes=-3"), .partial(7..<10))
        XCTAssertEqual(range("bytes=-30"), .partial(0..<10), "A suffix longer than the body is the whole body")
    }

    func testEndPastTheBodyIsClamped() {
        XCTAssertEqual(range("bytes=5-99"), .partial(5..<10))
    }

    func testRangeStartingAtOrPastTheEndIsUnsatisfiable() {
        XCTAssertEqual(range("bytes=10-"), .unsatisfiable)
        XCTAssertEqual(range("bytes=10-20"), .unsatisfiable)
        XCTAssertEqual(range("bytes=-0"), .unsatisfiable)
    }

    func testMalformedOrReversedRangeIsIgnored() {
        for header in ["bytes=abc", "bytes=5-2", "items=0-1", "bytes=", "bytes=-", "bytes=1-2-3",
                       "bytes=+1-2", "bytes=0x1-2", "bytes=-1-2", "0-1"] {
            XCTAssertEqual(range(header), .whole, header)
        }
    }

    func testUnitAndWhitespaceFollowTheHTTPGrammar() {
        XCTAssertEqual(range("Bytes=0-1"), .partial(0..<2), "Range units are case-insensitive")
        XCTAssertEqual(range("bytes= 0-1 "), .partial(0..<2))
    }

    func testMultipleRangesGetWholeBody() {
        XCTAssertEqual(range("bytes=0-1,4-5"), .whole)
        XCTAssertEqual(range("bytes=0-1, 4-5"), .whole)
    }

    func testOverflowingPositionIsIgnored() {
        XCTAssertEqual(range("bytes=0-99999999999999999999999"), .whole)
        XCTAssertEqual(range("bytes=99999999999999999999999-"), .whole)
    }

    func testEmptyBodyIgnoresRange() {
        XCTAssertEqual(range("bytes=0-1", length: 0), .whole)
        XCTAssertEqual(range("bytes=-1", length: 0), .whole)
    }
}
