import CoreGraphics
import XCTest
@testable import ClassroomWidgets

// Failure modes this guards (AppKit coordinates, y up):
// - "top" placed at minY, so Top Left lands at the bottom of the screen
// - a half or quarter leaves its edge, or overlaps its neighbour
// - the title bar is left out, so the frame spills past the region
// - the preview loses the source aspect ratio
// - a visible frame with a non-zero origin (menu bar, Dock, second screen) is ignored
// - the minimum size pushes the frame off the visible frame
// - bad aspect or screen values produce NaN frames
final class DisplaySnapGeometryTests: XCTestCase {
    private let visible = CGRect(x: 0, y: 0, width: 1920, height: 1080)
    private let area = CGRect(x: 12, y: 12, width: 1896, height: 1056)
    private let chrome = CGSize(width: 0, height: 38)
    private let minimum = CGSize(width: 320, height: 278)
    private let current = CGRect(x: 100, y: 100, width: 480, height: 360)

    private func frame(_ preset: DisplaySnapPreset, aspect: CGFloat? = 16 / 9, in visible: CGRect? = nil, current: CGRect? = nil) -> CGRect? {
        DisplaySnapGeometry.frame(
            for: preset,
            visibleFrame: visible ?? self.visible,
            aspect: aspect,
            chrome: chrome,
            minimumFrame: minimum,
            currentFrame: current ?? self.current,
            margin: 12
        )
    }

    private func assertInside(_ rect: CGRect, _ outer: CGRect, _ message: String, file: StaticString = #filePath, line: UInt = #line) {
        let epsilon: CGFloat = 0.001
        XCTAssertTrue(rect.minX >= outer.minX - epsilon && rect.minY >= outer.minY - epsilon
            && rect.maxX <= outer.maxX + epsilon && rect.maxY <= outer.maxY + epsilon, "\(message) \(rect)", file: file, line: line)
    }

    private func overlaps(_ a: CGRect, _ b: CGRect) -> Bool {
        min(a.maxX, b.maxX) - max(a.minX, b.minX) > 0.001 && min(a.maxY, b.maxY) - max(a.minY, b.minY) > 0.001
    }

    func testEveryPresetStaysInsideTheInsetVisibleFrame() {
        for preset in DisplaySnapPreset.allCases {
            let result = frame(preset)
            XCTAssertNotNil(result, preset.rawValue)
            if let result { assertInside(result, area, preset.rawValue) }
        }
    }

    func testTopMeansTheHighEdgeInAppKitCoordinates() {
        let topLeft = frame(.topLeft)!
        XCTAssertEqual(topLeft.minX, area.minX, accuracy: 0.001)
        XCTAssertEqual(topLeft.maxY, area.maxY, accuracy: 0.001)
        let bottomRight = frame(.bottomRight)!
        XCTAssertEqual(bottomRight.maxX, area.maxX, accuracy: 0.001)
        XCTAssertEqual(bottomRight.minY, area.minY, accuracy: 0.001)
        XCTAssertEqual(frame(.topHalf)!.maxY, area.maxY, accuracy: 0.001)
        XCTAssertEqual(frame(.bottomHalf)!.minY, area.minY, accuracy: 0.001)
    }

    func testHalvesTouchTheirEdgeCentreOnTheOtherAxisAndDoNotOverlap() {
        let left = frame(.leftHalf)!
        let right = frame(.rightHalf)!
        XCTAssertEqual(left.minX, area.minX, accuracy: 0.001)
        XCTAssertEqual(right.maxX, area.maxX, accuracy: 0.001)
        XCTAssertEqual(left.midY, area.midY, accuracy: 0.001)
        XCTAssertEqual(left.width, 942, accuracy: 0.001)
        XCTAssertFalse(overlaps(left, right))
        XCTAssertFalse(overlaps(frame(.topHalf)!, frame(.bottomHalf)!))
    }

    func testQuartersDoNotOverlap() {
        let corners = [DisplaySnapPreset.topLeft, .topRight, .bottomLeft, .bottomRight].map { frame($0)! }
        for i in corners.indices {
            for j in corners.indices where j > i {
                XCTAssertFalse(overlaps(corners[i], corners[j]), "\(i) \(j)")
            }
        }
    }

    func testPreviewKeepsTheSourceAspectWithChromeAdded() {
        for aspect: CGFloat in [16 / 9, 4 / 3, 16 / 10, 21 / 9, 9 / 16] {
            for preset in DisplaySnapPreset.allCases where preset != .centre {
                let result = frame(preset, aspect: aspect)!
                let preview = result.width / (result.height - chrome.height)
                XCTAssertEqual(preview, aspect, accuracy: aspect * 0.001, "\(preset.rawValue) \(aspect)")
            }
        }
    }

    func testWithoutAnAspectTheFrameFillsItsRegion() {
        XCTAssertEqual(frame(.leftHalf, aspect: nil), CGRect(x: 12, y: 12, width: 942, height: 1056))
        XCTAssertEqual(frame(.topRight, aspect: nil), CGRect(x: 966, y: 546, width: 942, height: 522))
        XCTAssertEqual(frame(.fill, aspect: nil), area)
        for invalid: CGFloat in [0, -1, .nan, .infinity] {
            XCTAssertEqual(frame(.leftHalf, aspect: invalid), CGRect(x: 12, y: 12, width: 942, height: 1056))
        }
    }

    func testCentreKeepsTheSizeAndIsClampedToTheScreen() {
        XCTAssertEqual(frame(.centre), CGRect(x: 720, y: 360, width: 480, height: 360))
        XCTAssertEqual(frame(.centre, current: CGRect(x: 0, y: 0, width: 4000, height: 3000)), area)
    }

    func testVisibleFrameWithANonZeroOriginIsRespected() {
        // A left-hand second screen whose visible frame sits above a Dock.
        let second = CGRect(x: -1440, y: 70, width: 1440, height: 805)
        let secondArea = second.insetBy(dx: 12, dy: 12)
        for preset in DisplaySnapPreset.allCases {
            assertInside(frame(preset, in: second)!, secondArea, preset.rawValue)
        }
        XCTAssertEqual(frame(.topLeft, in: second)!.maxY, secondArea.maxY, accuracy: 0.001)
    }

    func testMinimumSizeWinsOverASmallRegionButStaysOnScreen() {
        let small = CGRect(x: 100, y: 50, width: 700, height: 500)
        let smallArea = small.insetBy(dx: 12, dy: 12)
        for preset in DisplaySnapPreset.allCases {
            let result = frame(preset, in: small)!
            XCTAssertGreaterThanOrEqual(result.width, minimum.width - 0.001, preset.rawValue)
            XCTAssertGreaterThanOrEqual(result.height, minimum.height - 0.001, preset.rawValue)
            assertInside(result, smallArea, preset.rawValue)
        }
        XCTAssertEqual(frame(.bottomRight, in: small)!.maxX, smallArea.maxX, accuracy: 0.001)
    }

    func testScreenSmallerThanTheMinimumIsUsedWhole() {
        let tiny = CGRect(x: 0, y: 0, width: 300, height: 200)
        assertInside(frame(.leftHalf, in: tiny)!, tiny, "tiny")
    }

    func testUnusableInputReturnsNil() {
        XCTAssertNil(frame(.leftHalf, in: CGRect(x: 0, y: 0, width: 0, height: 1080)))
        XCTAssertNil(frame(.leftHalf, in: CGRect(x: CGFloat.nan, y: 0, width: 1920, height: 1080)))
        XCTAssertNil(frame(.centre, current: CGRect(x: 0, y: 0, width: CGFloat.nan, height: 10)))
    }
}
