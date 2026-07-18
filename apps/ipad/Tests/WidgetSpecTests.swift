import XCTest
@testable import ClassroomWidgetsStudio

final class WidgetSpecTests: XCTestCase {
    func testBundledExamplesDecodeAndUseVersionOne() {
        let examples = FixtureRepository().loadExamples(from: Bundle(for: StudioStore.self))

        XCTAssertGreaterThanOrEqual(examples.count, 10)
        XCTAssertTrue(examples.allSatisfy { $0.spec.schemaVersion == "1.0" })
        XCTAssertTrue(examples.allSatisfy { !$0.spec.screens.isEmpty })
        XCTAssertGreaterThanOrEqual(Set(examples.map(\.family)).count, 3)
    }

    func testWidgetSpecRoundTripsUnknownDeclarativeComponents() throws {
        let original = try XCTUnwrap(FixtureRepository.builtInExamples.first?.spec)
        let data = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(WidgetSpec.self, from: data)

        XCTAssertEqual(decoded, original)
        XCTAssertEqual(decoded.componentCount, 2)
        XCTAssertTrue(decoded.prettyPrintedJSON().contains("choiceQuestion"))
    }
}
