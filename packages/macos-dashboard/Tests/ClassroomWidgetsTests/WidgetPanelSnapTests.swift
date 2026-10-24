import AppKit
import XCTest
@testable import ClassroomWidgets

// Real panels, real AppKit frames. Ways this goes wrong: the title bar or the
// 10 pt gap is left out so the web view loses its aspect ratio, a widget's
// maximum size is ignored, a fixed-size widget is resized, the panel leaves its
// screen, or the new frame is not saved.
final class WidgetPanelSnapTests: XCTestCase {
    @MainActor
    func testPresetsPlaceRealPanelsOnTheirScreenWithinTheirLimits() throws {
        _ = NSApplication.shared
        let panels = WidgetPanelCoordinator()
        let resizable = UUID().uuidString
        let capped = UUID().uuidString
        let fixed = UUID().uuidString
        defer {
            panels.deactivate()
            panels.flushPersistedFrames()
            for id in [resizable, capped, fixed] { UserDefaults.standard.removeObject(forKey: "widgetPanelFrameV1.\(id)") }
        }
        panels.reconcile(snapshot: WidgetPanelSnapshot(hostInstanceID: "fixture", revision: 1, widgets: [
            WidgetPanelDescriptor(id: resizable, title: "Snap Timer", preferredContentSize: .init(width: 350, height: 415),
                                  minimumContentSize: .init(width: 250, height: 296), aspectRatio: 350.0 / 415.0, snapshotPayload: [:]),
            WidgetPanelDescriptor(id: capped, title: "Snap Banner", preferredContentSize: .init(width: 400, height: 200),
                                  maximumContentSize: .init(width: 500, height: 300), snapshotPayload: [:]),
            WidgetPanelDescriptor(id: fixed, title: "Snap Light", preferredContentSize: .init(width: 300, height: 180),
                                  isResizable: false, snapshotPayload: [:])
        ]))
        let window = { (title: String) in try XCTUnwrap(NSApp.windows.first { $0.title == title }) }
        let timer = try window("Snap Timer")
        let banner = try window("Snap Banner")
        let light = try window("Snap Light")
        let fixedSize = light.frame.size

        for preset in WindowSnapPreset.allCases {
            for (id, panel) in [(resizable, timer), (capped, banner), (fixed, light)] {
                panels.snapPanel(widgetID: id, to: preset, animate: false)
                let area = (panel.screen ?? NSScreen.main)!.visibleFrame.insetBy(dx: 12, dy: 12)
                let frame = panel.frame
                let label = "\(panel.title) \(preset.rawValue) \(frame) in \(area)"
                XCTAssertTrue(frame.minX >= area.minX - 0.5 && frame.maxX <= area.maxX + 0.5
                    && frame.minY >= area.minY - 0.5 && frame.maxY <= area.maxY + 0.5, label)
                switch preset {
                case .leftHalf, .topLeft, .bottomLeft: XCTAssertEqual(frame.minX, area.minX, accuracy: 0.5, label)
                case .rightHalf, .topRight, .bottomRight: XCTAssertEqual(frame.maxX, area.maxX, accuracy: 0.5, label)
                default: XCTAssertEqual(frame.midX, area.midX, accuracy: 0.5, label)
                }
                switch preset {
                case .topHalf, .topLeft, .topRight: XCTAssertEqual(frame.maxY, area.maxY, accuracy: 0.5, label)
                case .bottomHalf, .bottomLeft, .bottomRight: XCTAssertEqual(frame.minY, area.minY, accuracy: 0.5, label)
                default: XCTAssertEqual(frame.midY, area.midY, accuracy: 0.5, label)
                }
                panels.flushPersistedFrames()
                let saved = NSRectFromString(UserDefaults.standard.string(forKey: "widgetPanelFrameV1.\(id)") ?? "")
                XCTAssertEqual(saved.minX, frame.minX, accuracy: 0.5, "\(label) is saved")
                XCTAssertEqual(saved.maxY, frame.maxY, accuracy: 0.5, "\(label) is saved")
                XCTAssertEqual(saved.width, frame.width, accuracy: 0.5, "\(label) is saved")
            }
            let web = timer.contentRect(forFrameRect: timer.frame).size
            XCTAssertEqual(web.width / (web.height - WidgetPanelContentLayout.topGap), 350.0 / 415.0, accuracy: 0.005,
                           "Snap Timer \(preset.rawValue) keeps its web aspect ratio")
            let bannerContent = banner.contentRect(forFrameRect: banner.frame).size
            XCTAssertLessThanOrEqual(bannerContent.width, 500.5)
            XCTAssertLessThanOrEqual(bannerContent.height - WidgetPanelContentLayout.topGap, 300.5)
            XCTAssertEqual(light.frame.size, fixedSize, "a fixed-size widget is only moved")
        }
    }
}
