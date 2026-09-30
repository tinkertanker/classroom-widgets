import CoreGraphics
import XCTest
@testable import ClassroomWidgets

// Each test is one way hide-on-disconnect / show-on-reconnect could go wrong.
// Mirrors the Linux and Windows policy tests.
final class DisplayPreviewReconnectPolicyTests: XCTestCase {
    private func autoHidden() -> DisplayPreviewReconnectPolicy {
        var policy = DisplayPreviewReconnectPolicy(externalDisplayAvailable: true)
        XCTAssertEqual(policy.displaysChanged(externalDisplayAvailable: false, isOpen: true, showOnReconnect: true), .hide)
        policy.windowClosed()
        return policy
    }

    func testLosingTheExternalDisplayHidesAnOpenWidgetAndRemembersWhy() {
        XCTAssertTrue(autoHidden().hiddenByDisconnect)
    }

    func testTheWidgetComesBackOnceWhenTheDisplayReconnects() {
        var policy = autoHidden()
        XCTAssertEqual(policy.displaysChanged(externalDisplayAvailable: true, isOpen: false, showOnReconnect: true), .show)
        policy.windowOpened()
        XCTAssertEqual(policy.displaysChanged(externalDisplayAvailable: true, isOpen: true, showOnReconnect: true), .none)
        XCTAssertFalse(policy.hiddenByDisconnect)
    }

    func testWithTheSettingOffTheWidgetStaysHiddenEvenAfterLaterNotices() {
        var policy = autoHidden()
        XCTAssertEqual(policy.displaysChanged(externalDisplayAvailable: true, isOpen: false, showOnReconnect: false), .none)
        XCTAssertEqual(policy.displaysChanged(externalDisplayAvailable: true, isOpen: false, showOnReconnect: true), .none)
    }

    func testAWidgetTheUserClosedIsNeverBroughtBack() {
        var policy = DisplayPreviewReconnectPolicy(externalDisplayAvailable: true)
        policy.windowOpened()
        policy.windowClosed()
        XCTAssertEqual(policy.displaysChanged(externalDisplayAvailable: false, isOpen: false, showOnReconnect: true), .none)
        XCTAssertEqual(policy.displaysChanged(externalDisplayAvailable: true, isOpen: false, showOnReconnect: true), .none)
    }

    func testOpeningThenClosingWhileDisconnectedCancelsThePendingReconnect() {
        var policy = autoHidden()
        policy.windowOpened()
        policy.windowClosed()
        XCTAssertEqual(policy.displaysChanged(externalDisplayAvailable: true, isOpen: false, showOnReconnect: true), .none)
    }

    func testAWidgetOpenedOnASingleDisplayIsNotHiddenByUnrelatedNotices() {
        var policy = DisplayPreviewReconnectPolicy(externalDisplayAvailable: false)
        policy.windowOpened()
        XCTAssertEqual(policy.displaysChanged(externalDisplayAvailable: false, isOpen: true, showOnReconnect: true), .none)
        XCTAssertEqual(policy.displaysChanged(externalDisplayAvailable: false, isOpen: true, showOnReconnect: true), .none)
    }

    func testRepeatedNoticesWhileDisconnectedNeitherReHideNorForgetTheAutoHide() {
        var policy = autoHidden()
        XCTAssertEqual(policy.displaysChanged(externalDisplayAvailable: false, isOpen: false, showOnReconnect: true), .none)
        XCTAssertTrue(policy.hiddenByDisconnect)
        XCTAssertEqual(policy.displaysChanged(externalDisplayAvailable: true, isOpen: false, showOnReconnect: true), .show)
    }

    func testKeepingAnExternalDisplayDoesNotHideTheWidget() {
        var policy = DisplayPreviewReconnectPolicy(externalDisplayAvailable: true)
        XCTAssertEqual(policy.displaysChanged(externalDisplayAvailable: true, isOpen: true, showOnReconnect: true), .none)
    }

    func testAHideThatHasNotClosedYetDoesNotCountAsTheUserClosingIt() {
        var policy = DisplayPreviewReconnectPolicy(externalDisplayAvailable: true)
        XCTAssertEqual(policy.displaysChanged(externalDisplayAvailable: false, isOpen: true, showOnReconnect: true), .hide)
        XCTAssertFalse(policy.hiddenByDisconnect)
        policy.windowClosed()
        XCTAssertTrue(policy.hiddenByDisconnect)
    }

    func testMirroredAndInactiveDisplaysDoNotCountAsAnExternalDisplay() {
        let main = display(id: 1, uuid: "main")
        XCTAssertFalse(DisplayPreviewReconnectPolicy.hasExternalDisplay(in: [main]))
        XCTAssertFalse(DisplayPreviewReconnectPolicy.hasExternalDisplay(in: [main, display(id: 2, uuid: "mirror", mirrorMasterID: 1)]))
        XCTAssertFalse(DisplayPreviewReconnectPolicy.hasExternalDisplay(in: [main, display(id: 2, uuid: "asleep", isActive: false)]))
        // A mirror-set master reports kCGNullDirectDisplay (0) as its master.
        XCTAssertTrue(DisplayPreviewReconnectPolicy.hasExternalDisplay(in: [display(id: 1, uuid: "main", mirrorMasterID: 0), display(id: 3, uuid: "new-id")]))
    }

    private func display(id: CGDirectDisplayID, uuid: String, isActive: Bool = true, mirrorMasterID: CGDirectDisplayID? = nil) -> DisplayDescriptor {
        DisplayDescriptor(
            id: id, uuid: uuid, name: uuid,
            bounds: CGRect(x: CGFloat(id) * 1000, y: 0, width: 1000, height: 600),
            isActive: isActive, mirrorMasterID: mirrorMasterID
        )
    }
}
