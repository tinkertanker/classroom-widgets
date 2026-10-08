import AppKit
import Carbon
import XCTest
@testable import ClassroomWidgets

final class DashboardShortcutFormatterTests: XCTestCase {
    func testInstalledGermanLayoutLabelsPhysicalKeysWithoutSelectingIt() throws {
        let current = TISCopyCurrentKeyboardInputSource().takeRetainedValue()
        let sources = TISCreateInputSourceList(
            [kTISPropertyInputSourceID: "com.apple.keylayout.German"] as CFDictionary, true
        ).takeRetainedValue() as! [TISInputSource]
        let german = try XCTUnwrap(sources.first, "The native German keyboard layout must be installed")
        let pointer = try XCTUnwrap(TISGetInputSourceProperty(german, kTISPropertyUnicodeKeyLayoutData))
        let data = Unmanaged<CFData>.fromOpaque(pointer).takeUnretainedValue()

        XCTAssertEqual(DashboardShortcutFormatter.keyTitle(for: kVK_ANSI_Z, layoutData: data), "Y")
        XCTAssertEqual(DashboardShortcutFormatter.keyTitle(for: kVK_ANSI_Y, layoutData: data), "Z")
        XCTAssertEqual(DashboardShortcutFormatter.keyEquivalent(for: kVK_ANSI_Z, layoutData: data), "y")
        XCTAssertEqual(DashboardShortcutFormatter.keyTitle(for: kVK_ANSI_Equal, layoutData: data), "´",
                       "A dead key needs a visible standalone character")
        XCTAssertEqual(DashboardShortcutFormatter.keyTitle(for: kVK_LeftArrow, layoutData: data), "←")
        XCTAssertEqual(DashboardShortcutFormatter.keyEquivalent(for: kVK_F2, layoutData: data), String(UnicodeScalar(NSF2FunctionKey)!))
        XCTAssertEqual(TISCopyCurrentKeyboardInputSource().takeRetainedValue(), current,
                       "Translation must not change the user's input source")
    }

    func testMissingLayoutFallsBackAndUnassignedRemainsAbsent() {
        XCTAssertEqual(DashboardShortcutFormatter.keyTitle(for: kVK_ANSI_Z, layoutData: nil), "Z")
        XCTAssertEqual(DashboardShortcutFormatter.keyEquivalent(for: kVK_ANSI_Z, layoutData: nil), "z")
        XCTAssertNil(DashboardShortcutFormatter.keyEquivalent(for: -1, layoutData: nil))
        XCTAssertEqual(DashboardShortcutFormatter.keyTitle(for: Int.max, layoutData: nil), "?")
    }
}
