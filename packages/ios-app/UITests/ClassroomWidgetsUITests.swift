import XCTest

final class ClassroomWidgetsUITests: XCTestCase {
    func testFocusHidesControlsAndTapRevealsThemWithoutPausing() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing"]
        app.launch()

        let startButton = app.buttons["start-button"]
        XCTAssertTrue(startButton.waitForExistence(timeout: 5))
        startButton.tap()

        let focusCountdown = app.buttons["focus-countdown"]
        XCTAssertTrue(focusCountdown.waitForExistence(timeout: 7))
        XCTAssertFalse(app.buttons["pause-button"].exists)

        let countdownBeforeReveal = focusCountdown.label
        XCTAssertTrue(countdownBeforeReveal.hasPrefix("Running, "))
        let focusedTime = String(countdownBeforeReveal.dropFirst("Running, ".count))
        XCTAssertTrue(focusedTime.range(of: "^\\d{2}:\\d{2}(?::\\d{2})?$", options: .regularExpression) != nil)
        XCTAssertNotEqual(focusedTime, "01:00")
        focusCountdown.tap()

        let pauseButton = app.buttons["pause-button"]
        XCTAssertTrue(pauseButton.waitForExistence(timeout: 2))
        let countdownAfterReveal = app.staticTexts["timer-countdown"].label
        XCTAssertNotEqual(countdownAfterReveal, "01:00")
        XCTAssertFalse(app.buttons["focus-countdown"].exists)

        sleep(2)
        XCTAssertNotEqual(app.staticTexts["timer-countdown"].label, countdownAfterReveal)

        pauseButton.tap()
        let pausedTime = app.staticTexts["timer-countdown"].label
        sleep(2)
        XCTAssertEqual(app.staticTexts["timer-countdown"].label, pausedTime)
    }

    func testSoundSheetKeepsControlsVisibleAndResetsFocusIdleTimer() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing"]
        app.launch()

        app.buttons["start-button"].tap()
        app.buttons["sound-settings-button"].tap()
        let doneButton = app.buttons["sound-done-button"]
        XCTAssertTrue(doneButton.waitForExistence(timeout: 3))

        sleep(6)
        doneButton.tap()

        let pauseButton = app.buttons["pause-button"]
        XCTAssertTrue(pauseButton.waitForExistence(timeout: 2))
        sleep(2)
        XCTAssertTrue(pauseButton.exists)
    }

    func testControlsReturnWhenCountdownFinishes() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing"]
        app.launch()

        let setTimeButton = app.buttons["set-time-button"]
        XCTAssertTrue(setTimeButton.waitForExistence(timeout: 5))
        setTimeButton.tap()

        let durationWheels = app.pickerWheels
        let hoursWheel = durationWheels.element(boundBy: 0)
        let minutesWheel = durationWheels.element(boundBy: 1)
        let secondsWheel = durationWheels.element(boundBy: 2)
        XCTAssertTrue(secondsWheel.waitForExistence(timeout: 3))
        hoursWheel.adjust(toPickerWheelValue: "00")
        minutesWheel.adjust(toPickerWheelValue: "00")
        secondsWheel.adjust(toPickerWheelValue: "05")
        app.buttons["apply-duration-button"].tap()
        app.buttons["start-button"].tap()

        XCTAssertTrue(app.staticTexts["timer-finished"].waitForExistence(timeout: 8))
        XCTAssertTrue(app.buttons["restart-button"].exists)
        XCTAssertFalse(app.buttons["focus-countdown"].exists)
    }
}
