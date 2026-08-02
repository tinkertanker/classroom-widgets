import XCTest

final class ClassroomWidgetsStudioUITests: XCTestCase {
    @MainActor
    func testLaunchesIntoExploreWithoutABlankCanvas() {
        let app = launchApp()
        XCTAssertTrue(app.staticTexts["Start with an example"].waitForExistence(timeout: 8))
        XCTAssertTrue(app.staticTexts["Catchment Under Pressure — Runoff Lab"].exists)
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label == 'Try as student'")).firstMatch.exists)
    }

    @MainActor
    func testExploreOffersBundledHTMLSeedForRemixing() {
        let app = launchApp()
        XCTAssertTrue(app.staticTexts["Catchment Under Pressure — Runoff Lab"].waitForExistence(timeout: 8))
        XCTAssertTrue(app.buttons["Make a copy"].exists)
    }

    @MainActor
    func testExamplePreviewRendersInPortraitAndFullScreen() {
        XCUIDevice.shared.orientation = .portrait
        let app = launchApp()
        let preview = app.buttons.matching(NSPredicate(format: "label == 'Try as student'")).firstMatch
        XCTAssertTrue(preview.waitForExistence(timeout: 8))
        preview.tap()

        let playerHeading = app.staticTexts["Catchment Under Pressure"]
        XCTAssertTrue(
            playerHeading.waitForExistence(timeout: 25),
            "The bundled HTML artifact should render, not a blank web view."
        )

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

        XCTAssertTrue(app.staticTexts["Check your answers"].waitForExistence(timeout: 5))
        app.buttons["Make my widget"].tap()
        XCTAssertTrue(app.buttons["Share"].waitForExistence(timeout: 8))
    }

    @MainActor
    func testWorkshopAccessCanBeDeferred() {
        let app = launchApp(extraArguments: ["--ui-testing-registration-required"])
        XCTAssertTrue(app.staticTexts["Set up Studio on this iPad"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Enter four numbers followed by four letters, for example 1234ABCD. A hyphen is optional."].exists)
        let notNow = app.buttons["Explore examples"]
        XCTAssertTrue(notNow.waitForExistence(timeout: 5))
        notNow.tap()
        XCTAssertTrue(app.staticTexts["Start with an example"].waitForExistence(timeout: 5))
        let showSidebar = app.buttons["Show Sidebar"]
        if showSidebar.waitForExistence(timeout: 2) { showSidebar.tap() }
        XCTAssertTrue(app.staticTexts["Studio access"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Code needed"].waitForExistence(timeout: 5))
    }

    @MainActor
    func testWorkshopAccessExplainsAndValidatesAShortCodeWithoutClearingIt() {
        let app = launchApp(extraArguments: ["--ui-testing-registration-required"])
        let code = app.textFields["workshop-access-code"]
        XCTAssertTrue(code.waitForExistence(timeout: 5))
        code.tap()
        code.typeText("SHORT")

        let activate = app.buttons["activate-workshop-access"]
        XCTAssertTrue(activate.isEnabled)
        activate.tap()

        XCTAssertTrue(app.staticTexts["Complete the class code"].waitForExistence(timeout: 3))
        XCTAssertEqual(code.value as? String, "SHORT")
    }

    @MainActor
    func testGuidedSuggestionAddsToWrittenAnswerAndSummaryRowsReturnToTheirQuestion() {
        let app = launchApp()
        selectSidebarItem(label: "Make", in: app)

        let answer = app.textViews["guided-answer"]
        XCTAssertTrue(answer.waitForExistence(timeout: 5))
        answer.tap()
        answer.typeText("Secondary 3 Physics")
        app.buttons["Primary 5 Science"].tap()
        XCTAssertEqual(answer.value as? String, "Secondary 3 Physics\nPrimary 5 Science")

        app.buttons["guided-continue"].tap()
        let answers = [
            "Explain projectile range",
            "Predict then compare",
            "Use metres",
            "Explain each answer",
            "Eight minutes in pairs"
        ]
        for response in answers {
            let currentAnswer = app.textViews["guided-answer"]
            XCTAssertTrue(currentAnswer.waitForExistence(timeout: 3))
            currentAnswer.tap()
            currentAnswer.typeText(response)
            app.buttons["guided-continue"].tap()
        }

        XCTAssertTrue(app.staticTexts["Check your answers"].waitForExistence(timeout: 5))
        app.buttons["edit-brief-answer-1"].tap()
        XCTAssertTrue(app.staticTexts["What should they understand or be able to do?"].waitForExistence(timeout: 3))
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
    private func launchApp(extraArguments: [String] = []) -> XCUIApplication {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing-reset"] + extraArguments
        app.launch()
        return app
    }
}
