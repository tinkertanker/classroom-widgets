import JavaScriptCore
import XCTest
@testable import ClassroomWidgets

final class DashboardAudioSettingsTests: XCTestCase {
    func testScriptPublishesClampedNativeVolumeAndUpdatesLiveBridge() throws {
        let suite = "DashboardAudioSettingsTests-\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        defaults.set(1.4, forKey: DashboardSettingKeys.outputVolume)
        let context = try XCTUnwrap(JSContext())
        context.evaluateScript("window = this; window.classroomAudio = { setVolume: value => window.appliedVolume = value };")

        context.evaluateScript(DashboardAudioSettings.script(defaults: defaults))

        XCTAssertEqual(context.objectForKeyedSubscript("__CLASSROOM_WIDGETS_AUDIO_VOLUME__")?.toDouble(), 1)
        XCTAssertEqual(context.objectForKeyedSubscript("appliedVolume")?.toDouble(), 1)
    }
}
