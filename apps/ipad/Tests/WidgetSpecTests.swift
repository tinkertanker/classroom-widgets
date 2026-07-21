import XCTest
@testable import ClassroomWidgetsStudio

final class WidgetSpecTests: XCTestCase {
    func testBundledExamplesDecodeAndUseVersionOne() {
        let examples = FixtureRepository().loadExamples(from: Bundle(for: StudioStore.self))

        XCTAssertGreaterThanOrEqual(examples.count, 15)
        XCTAssertTrue(examples.allSatisfy { $0.spec.schemaVersion == "1.0" })
        XCTAssertTrue(examples.allSatisfy { !$0.spec.screens.isEmpty })
        XCTAssertGreaterThanOrEqual(Set(examples.map(\.family)).count, 3)

        let curricularSubjects = ["science", "mathematics", "english", "humanities", "languages"]
        for subject in curricularSubjects {
            let subjectExamples = examples.filter { $0.spec.metadata.subject == subject }
            XCTAssertGreaterThanOrEqual(subjectExamples.count, 2, "Expected two examples for \(subject)")
            XCTAssertEqual(
                Set(subjectExamples.compactMap(\.spec.metadata.level)),
                Set(["upper-primary", "secondary"]),
                "Expected upper-primary and secondary examples for \(subject)"
            )
        }
    }

    func testExampleFiltersCombineSubjectLevelAndFamily() throws {
        let examples = FixtureRepository().loadExamples(from: Bundle(for: StudioStore.self))
        let project = try XCTUnwrap(
            examples.first {
                $0.spec.metadata.subject == "science"
                    && $0.spec.metadata.level == "upper-primary"
                    && $0.family == .matching
            }
        )

        var filters = ExampleFilters(subject: "science", level: "upper-primary", family: .matching)
        XCTAssertTrue(filters.matches(project))

        filters.level = "secondary"
        XCTAssertFalse(filters.matches(project))

        filters.clear()
        XCTAssertFalse(filters.isActive)
        XCTAssertTrue(filters.matches(project))
    }

    func testExampleFilterOrderingKeepsUnexpectedMetadataAvailable() {
        XCTAssertEqual(
            ExampleFilters.orderedValues(
                Set(["computing", "science", "art-and-design"]),
                preferred: ExampleFilters.subjectOrder
            ),
            ["science", "art-and-design", "computing"]
        )
        XCTAssertEqual(ExampleFilters.subjectTitle("art-and-design"), "Art And Design")
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
