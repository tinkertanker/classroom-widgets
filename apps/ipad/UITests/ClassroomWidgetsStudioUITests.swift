import XCTest

final class ClassroomWidgetsStudioUITests: XCTestCase {
    @MainActor
    func testLaunchesIntoExploreWithoutABlankCanvas() {
        let app = launchApp()
        XCTAssertTrue(app.staticTexts["Start with something proven"].waitForExistence(timeout: 8))
        XCTAssertTrue(app.staticTexts["No blank canvas required."].exists || app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'No blank canvas'")).firstMatch.exists)
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label == 'Preview'")).firstMatch.exists)
    }

    @MainActor
    func testGuidedMakeReachesApprovalAndCreatesAProject() throws {
        let app = launchApp()
        let makeItem = app.descendants(matching: .any)["sidebar-make"]
        XCTAssertTrue(makeItem.waitForExistence(timeout: 5))
        makeItem.tap()
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
    private func launchApp() -> XCUIApplication {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing-reset"]
        app.launch()
        return app
    }
}
