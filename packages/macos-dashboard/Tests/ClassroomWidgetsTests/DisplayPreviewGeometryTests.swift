import CoreGraphics
import XCTest
@testable import ClassroomWidgets

final class DisplayPreviewGeometryTests: XCTestCase {
    private let landscape = DisplayPreviewFrameGeometry(
        imageRect: CGRect(x: 20, y: 90, width: 640, height: 360),
        sourceBounds: CGRect(x: -1920, y: -240, width: 1920, height: 1080),
        sourceID: 7,
        topologyRevision: 4
    )

    func testMapsAsymmetricNegativeOriginFixtureIndependentOfBufferScale() {
        XCTAssertEqual(
            DisplayPreviewGeometry.target(
                topLeftPoint: CGPoint(x: 180, y: 360), geometry: landscape, currentTopologyRevision: 4
            ),
            CGPoint(x: -1440, y: 570)
        )
    }

    func testMapsPortraitWithoutTranspositionOrSecondRotation() {
        let geometry = DisplayPreviewFrameGeometry(
            imageRect: CGRect(x: 100, y: 20, width: 225, height: 400),
            sourceBounds: CGRect(x: 1512, y: -800, width: 900, height: 1600),
            sourceID: 8,
            topologyRevision: 9
        )
        XCTAssertEqual(
            DisplayPreviewGeometry.target(
                topLeftPoint: CGPoint(x: 280, y: 120), geometry: geometry, currentTopologyRevision: 9
            ),
            CGPoint(x: 2232, y: -400)
        )
    }

    func testLetterboxAndHalfOpenEdges() {
        XCTAssertNil(target(180, 89.999))
        XCTAssertNotNil(target(180, 90))
        XCTAssertNil(target(180, 450))
        XCTAssertNil(target(19.999, 200))
        XCTAssertNotNil(target(20, 200))
        XCTAssertNil(target(660, 200))
        XCTAssertEqual(target(659.9999, 449.9999), CGPoint(x: -1, y: 839))
    }

    func testFractionalPositionsAreMonotonicAndDoNotUseBackingPixels() {
        let first = target(100.25, 180.5)!
        let second = target(300.75, 280.25)!
        XCTAssertLessThan(first.x, second.x)
        XCTAssertLessThan(first.y, second.y)
        XCTAssertEqual(first.x, -1679.25, accuracy: 0.001)
        XCTAssertEqual(first.y, 31.5, accuracy: 0.001)
    }

    func testRejectsStaleTopologyAndInvalidGeometry() {
        XCTAssertNil(DisplayPreviewGeometry.target(
            topLeftPoint: CGPoint(x: 180, y: 360), geometry: landscape, currentTopologyRevision: 5
        ))
        for invalid in [CGFloat.nan, .infinity, 0, -1] {
            let geometry = DisplayPreviewFrameGeometry(
                imageRect: CGRect(x: 0, y: 0, width: invalid, height: 20),
                sourceBounds: landscape.sourceBounds, sourceID: 7, topologyRevision: 4
            )
            XCTAssertNil(DisplayPreviewGeometry.target(
                topLeftPoint: .zero, geometry: geometry, currentTopologyRevision: 4
            ))
        }
    }

    func testAppKitConversionHandlesNonzeroBoundsExactlyOnce() {
        XCTAssertEqual(
            DisplayPreviewGeometry.topLeftPoint(
                appKitPoint: CGPoint(x: 35, y: 120),
                viewBounds: CGRect(x: 10, y: 20, width: 300, height: 200)
            ),
            CGPoint(x: 35, y: 120)
        )
        XCTAssertEqual(
            DisplayPreviewGeometry.topLeftPoint(
                appKitPoint: CGPoint(x: 35, y: 30),
                viewBounds: CGRect(x: 10, y: 20, width: 300, height: 200)
            ),
            CGPoint(x: 35, y: 210)
        )
    }

    func testAspectFitUsesActualContentBounds() {
        XCTAssertEqual(
            DisplayPreviewGeometry.aspectFit(
                contentSize: CGSize(width: 16, height: 9),
                in: CGRect(x: 20, y: 30, width: 640, height: 480)
            ),
            CGRect(x: 20, y: 90, width: 640, height: 360)
        )
    }

    func testAspectNormalizedWindowSizeMatchesLandscapePreviewViewport() {
        let size = DisplayPreviewGeometry.aspectNormalizedWindowSize(
            matchingAspect: 16.0 / 9.0,
            preservingPreviewSize: CGSize(width: 480, height: 322),
            chromeHeight: 38,
            minimumPreviewSize: CGSize(width: 320, height: 230),
            maximumSize: CGSize(width: 2000, height: 2000)
        )
        XCTAssertEqual(size.width, 480, accuracy: 0.001, "Approximate current preview width is preserved")
        XCTAssertEqual(size.height - 38, 270, accuracy: 0.001)
        XCTAssertEqual(size.width / (size.height - 38), 16.0 / 9.0, accuracy: 0.001)
    }

    func testAspectNormalizedWindowSizeFitsPortraitSourceWithinScreen() {
        let size = DisplayPreviewGeometry.aspectNormalizedWindowSize(
            matchingAspect: 1080.0 / 1920.0,
            preservingPreviewSize: CGSize(width: 480, height: 322),
            chromeHeight: 38,
            minimumPreviewSize: CGSize(width: 320, height: 230),
            maximumSize: CGSize(width: 1000, height: 800)
        )
        XCTAssertEqual(size.width / (size.height - 38), 1080.0 / 1920.0, accuracy: 0.001)
        XCTAssertLessThanOrEqual(size.height, 800)
        XCTAssertLessThanOrEqual(size.width, 1000)
        XCTAssertGreaterThanOrEqual(size.width, 320 - 0.001)
    }

    func testAspectNormalizedWindowSizeHonoursPreviewMinimum() {
        let size = DisplayPreviewGeometry.aspectNormalizedWindowSize(
            matchingAspect: 21.0 / 9.0,
            preservingPreviewSize: CGSize(width: 100, height: 60),
            chromeHeight: 38,
            minimumPreviewSize: CGSize(width: 320, height: 230),
            maximumSize: CGSize(width: 2000, height: 2000)
        )
        XCTAssertGreaterThanOrEqual(size.width, 320 - 0.001)
        XCTAssertGreaterThanOrEqual(size.height - 38, 230 - 0.001)
        XCTAssertEqual(size.width / (size.height - 38), 21.0 / 9.0, accuracy: 0.001)
    }

    func testAspectNormalizedWindowSizeKeepsChromeOutOfTheViewport() {
        let size = DisplayPreviewGeometry.aspectNormalizedWindowSize(
            matchingAspect: 16.0 / 10.0,
            preservingPreviewSize: CGSize(width: 640, height: 400),
            chromeHeight: 38,
            minimumPreviewSize: CGSize(width: 320, height: 230),
            maximumSize: CGSize(width: 4000, height: 4000)
        )
        XCTAssertEqual(size.height - (size.width / (16.0 / 10.0)), 38, accuracy: 0.001)
    }

    func testAspectNormalizedWindowSizeRejectsInvalidAspect() {
        XCTAssertEqual(
            DisplayPreviewGeometry.aspectNormalizedWindowSize(
                matchingAspect: 0,
                preservingPreviewSize: CGSize(width: 480, height: 322),
                chromeHeight: 38,
                minimumPreviewSize: CGSize(width: 320, height: 230),
                maximumSize: CGSize(width: 2000, height: 2000)
            ),
            CGSize(width: 480, height: 360)
        )
        XCTAssertEqual(
            DisplayPreviewGeometry.aspectNormalizedWindowSize(
                matchingAspect: .nan,
                preservingPreviewSize: CGSize(width: 480, height: 322),
                chromeHeight: 38,
                minimumPreviewSize: CGSize(width: 320, height: 230),
                maximumSize: CGSize(width: 2000, height: 2000)
            ),
            CGSize(width: 480, height: 360)
        )
    }

    private func target(_ x: CGFloat, _ y: CGFloat) -> CGPoint? {
        DisplayPreviewGeometry.target(
            topLeftPoint: CGPoint(x: x, y: y), geometry: landscape, currentTopologyRevision: 4
        )
    }
}
