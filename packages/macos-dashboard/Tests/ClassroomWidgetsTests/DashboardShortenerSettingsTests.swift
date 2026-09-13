import XCTest
import JavaScriptCore
@testable import ClassroomWidgets

final class DashboardShortenerSettingsTests: XCTestCase {
    func testPreferencesSurviveNewReaderAndPublishEscapedSettings() throws {
        let suite = "shortener-test-\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        let context = try XCTUnwrap(JSContext())
        context.evaluateScript("var window = this; var events = []; function Event(name) { this.type = name; }; function dispatchEvent(event) { events.push(event.type); }")
        context.evaluateScript(DashboardShortenerSettings.script(defaults: defaults))
        XCTAssertEqual(context.evaluateScript("classroomShortenerSettings.provider")?.toString(), "tinyurl")

        defaults.set("shortio", forKey: DashboardShortenerSettings.providerKey)
        defaults.set("pk_test\"\\\n", forKey: DashboardShortenerSettings.apiKeyKey)
        defaults.set("go.school.edu", forKey: DashboardShortenerSettings.domainKey)
        let reopened = try XCTUnwrap(UserDefaults(suiteName: suite))
        context.evaluateScript(DashboardShortenerSettings.script(defaults: reopened))
        XCTAssertNil(context.exception)
        XCTAssertEqual(context.evaluateScript("classroomShortenerSettings.provider")?.toString(), "shortio")
        XCTAssertEqual(context.evaluateScript("classroomShortenerSettings.shortioApiKey")?.toString(), "pk_test\"\\\n")
        XCTAssertEqual(context.evaluateScript("classroomShortenerSettings.shortioDomain")?.toString(), "go.school.edu")
        XCTAssertEqual(context.evaluateScript("events[1]")?.toString(), "classroom-shortener-settings-changed")
    }
}
