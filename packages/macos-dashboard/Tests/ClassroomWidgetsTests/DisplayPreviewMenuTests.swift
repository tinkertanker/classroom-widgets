import AppKit
import XCTest
@testable import ClassroomWidgets

final class DisplayPreviewMenuTests: XCTestCase {
    func testDisplayEntryHasRequestedLabelAndNoPrecedingSeparator() async {
        await MainActor.run {
            _ = NSApplication.shared
            let delegate = AppDelegate()
            let menu = delegate.makeNewWidgetMenu(options: [
                CompactWidgetOption(widgetType: 1, title: "Timer")
            ])
            XCTAssertEqual(menu.items.map(\.title), ["Timer", "Display"])
            guard let displayIndex = menu.items.firstIndex(where: { $0.title == "Display" }) else { return }

            XCTAssertGreaterThan(displayIndex, 0)
            XCTAssertFalse(menu.items[displayIndex - 1].isSeparatorItem)
            XCTAssertEqual(DisplayPreviewMenu.title, "Display")
        }
    }

    func testPanelMenuUsesDisplayLabelAndPreservesDisplayFirstOrdering() async {
        await MainActor.run {
            _ = NSApplication.shared
            let menu = DisplayPreviewMenu.makePanelMenu(
                options: [CompactWidgetOption(widgetType: 1, title: "Timer")],
                target: nil,
                displayAction: nil,
                widgetAction: nil
            )

            XCTAssertEqual(menu.items.map(\.title), ["Display", "", "Timer"])
            XCTAssertFalse(menu.items[0].isSeparatorItem)
            XCTAssertTrue(menu.items[1].isSeparatorItem)
        }
    }
}
