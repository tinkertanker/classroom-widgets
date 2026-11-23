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
        XCTAssertNotEqual(countdownBeforeReveal, "01:00")
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

    func testControlsReturnWhenCountdownFinishes() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing"]
        app.launch()

        let setTimeButton = app.buttons["set-time-button"]
        XCTAssertTrue(setTimeButton.waitForExistence(timeout: 5))
        setTimeButton.tap()

        let secondsWheel = app.pickerWheels["duration-seconds"]
        XCTAssertTrue(secondsWheel.waitForExistence(timeout: 3))
        app.pickerWheels["duration-hours"].adjust(toPickerWheelValue: "00")
        app.pickerWheels["duration-minutes"].adjust(toPickerWheelValue: "00")
        secondsWheel.adjust(toPickerWheelValue: "05")
        app.buttons["apply-duration-button"].tap()
        app.buttons["start-button"].tap()

        XCTAssertTrue(app.staticTexts["timer-finished"].waitForExistence(timeout: 8))
        XCTAssertTrue(app.buttons["restart-button"].exists)
        XCTAssertFalse(app.buttons["focus-countdown"].exists)
    }
}
