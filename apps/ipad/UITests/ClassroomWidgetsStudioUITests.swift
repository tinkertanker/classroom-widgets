import XCTest

final class ClassroomWidgetsStudioUITests: XCTestCase {
    @MainActor
    func testLaunchesIntoExploreWithoutABlankCanvas() {
        let app = launchApp()
        XCTAssertTrue(app.staticTexts["Start with an example"].waitForExistence(timeout: 8))
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'classroom-ready widget'")).firstMatch.exists)
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label == 'Preview'")).firstMatch.exists)
    }

    @MainActor
    func testExamplePreviewRendersInPortraitAndFullScreen() {
        XCUIDevice.shared.orientation = .portrait
        let app = launchApp()
        let preview = app.buttons.matching(NSPredicate(format: "label == 'Preview'")).firstMatch
        XCTAssertTrue(preview.waitForExistence(timeout: 8))
        preview.tap()

        let playerHeading = app.staticTexts["Ecosystems: can you retrieve it?"]
        XCTAssertTrue(
            playerHeading.waitForExistence(timeout: 12),
            "The bundled student player should render the example, not a blank web view."
        )

        let fullScreen = app.buttons["Open full-screen student preview"]
        XCTAssertTrue(fullScreen.waitForExistence(timeout: 5))
        XCTAssertTrue(waitUntilEnabled(fullScreen, timeout: 5))
        fullScreen.tap()

        XCTAssertTrue(playerHeading.waitForExistence(timeout: 12))
        XCTAssertTrue(app.buttons["Done"].waitForExistence(timeout: 5))
    }

    @MainActor
    func testGuidedMakeReachesApprovalAndCreatesAProject() throws {
        let app = launchApp()
        selectSidebarItem(label: "Make", in: app)
        XCTAssertTrue(app.staticTexts["Who are you teaching?"].waitForExistence(timeout: 5))

        let answers = [
            "Secondary 3 Physics",
            "Explain how angle changes projectile range",
            "Move a slider, predict, then compare",
            "Use metres and Earth gravity",
            "Give an explanation after each prediction",
            "Eight minutes in pairs"
        ]

        for answer in answers {
            let textView = app.textViews["guided-answer"]
            XCTAssertTrue(textView.waitForExistence(timeout: 3))
            textView.tap()
            textView.typeText(answer)
            app.buttons["guided-continue"].tap()
        }

        XCTAssertTrue(app.staticTexts["Check the brief"].waitForExistence(timeout: 5))
        app.buttons["Create first draft"].tap()
        XCTAssertTrue(app.buttons["Publish"].waitForExistence(timeout: 8))
    }

    @MainActor
    func testWorkshopAccessCanBeDeferred() {
        let app = launchApp(extraArguments: ["--ui-testing-registration-required"])
        let notNow = app.buttons["Not now"]
        XCTAssertTrue(notNow.waitForExistence(timeout: 5))
        notNow.tap()
        XCTAssertTrue(app.staticTexts["Start with an example"].waitForExistence(timeout: 5))
    }

    @MainActor
    private func selectSidebarItem(label: String, in app: XCUIApplication) {
        let item = app.staticTexts[label].firstMatch
        if !item.waitForExistence(timeout: 2) {
            let sidebarButton = app.buttons.matching(
                NSPredicate(format: "label CONTAINS[c] 'sidebar'")
            ).firstMatch
            XCTAssertTrue(sidebarButton.waitForExistence(timeout: 5))
            sidebarButton.tap()
        }
        XCTAssertTrue(item.waitForExistence(timeout: 5))
        item.tap()
    }

    @MainActor
    private func waitUntilEnabled(_ element: XCUIElement, timeout: TimeInterval) -> Bool {
        let expectation = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "enabled == true"),
            object: element
        )
        return XCTWaiter.wait(for: [expectation], timeout: timeout) == .completed
    }

    @MainActor
    private func launchApp(extraArguments: [String] = []) -> XCUIApplication {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing-reset"] + extraArguments
        app.launch()
        return app
    }
}
