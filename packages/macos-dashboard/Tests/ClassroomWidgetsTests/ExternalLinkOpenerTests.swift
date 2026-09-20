import XCTest
@testable import ClassroomWidgets

final class ExternalLinkOpenerTests: XCTestCase {
    func testAllowsWebAndMailSchemes() {
        for string in ["https://example.com", "http://example.com/a?b=c", "mailto:teacher@example.com", "HTTPS://EXAMPLE.COM"] {
            var opened: URL?
            let result = ExternalLinkOpener.open(URL(string: string)!) { opened = $0 }
            XCTAssertTrue(result, string)
            XCTAssertEqual(opened?.absoluteString, string)
        }
    }

    func testBlocksNonWebSchemes() {
        for string in ["file:///etc/passwd", "smb://server/share", "myapp://run", "javascript:alert(1)", "ftp://example.com", "classroom-widgets://index.html"] {
            var opened: URL?
            let result = ExternalLinkOpener.open(URL(string: string)!) { opened = $0 }
            XCTAssertFalse(result, string)
            XCTAssertNil(opened, string)
        }
    }
}
