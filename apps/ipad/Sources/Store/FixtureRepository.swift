import Foundation

struct FixtureRepository: Sendable {
    func loadExamples(from bundle: Bundle = .main) -> [WidgetProject] {
        let candidateURLs = [
            bundle.url(forResource: "sample-widgets", withExtension: "json", subdirectory: "Fixtures"),
            bundle.url(forResource: "sample-widgets", withExtension: "json")
        ]

        for case let url? in candidateURLs {
            guard let data = try? Data(contentsOf: url),
                  let records = try? JSONDecoder().decode([SampleWidgetRecord].self, from: data)
            else { continue }

            return records.map {
                WidgetProject(
                    spec: $0.spec,
                    family: $0.family,
                    updatedAt: .distantPast,
                    isExample: true,
                    revisionNotes: []
                )
            }
        }

        return Self.builtInExamples
    }

    static let builtInExamples: [WidgetProject] = {
        let instruction: JSONValue = .object([
            "id": .string("instructions"),
            "kind": .string("text"),
            "role": .string("instruction"),
            "text": .string("Choose an answer, then use the feedback to explain your thinking.")
        ])
        let question: JSONValue = .object([
            "id": .string("question-one"),
            "kind": .string("choiceQuestion"),
            "prompt": .string("Which statement best describes a fair test?"),
            "selectionMode": .string("single"),
            "options": .array([
                .object(["id": .string("a"), "content": .object(["kind": .string("text"), "text": .string("Change one variable at a time")])]),
                .object(["id": .string("b"), "content": .object(["kind": .string("text"), "text": .string("Change every variable together")])]),
                .object(["id": .string("c"), "content": .object(["kind": .string("text"), "text": .string("Record only the result you expect")])])
            ]),
            "correctOptionIds": .array([.string("a")]),
            "shuffleOptions": .boolean(false),
            "feedback": .object([
                "correct": .string("Yes — that isolates the effect being tested."),
                "incorrect": .string("Try again. Think about what must stay controlled."),
                "explanation": .string("A fair test changes one independent variable while controlling the others.")
            ])
        ])
        let spec = WidgetSpec(
            schemaVersion: "1.0",
            id: "fair-test-check",
            metadata: WidgetMetadata(
                title: "Fair Test Check",
                summary: "A short retrieval check about variables and fair tests.",
                subject: "science",
                level: "upper-primary",
                learningObjective: "Identify how to conduct a fair test.",
                estimatedMinutes: 4,
                tags: ["retrieval", "science"]
            ),
            theme: WidgetTheme(accent: "sage", colourScheme: "light", density: "comfortable"),
            assets: [],
            variables: [],
            screens: [WidgetScreen(id: "main", title: nil, components: [instruction, question])]
        )

        return [
            WidgetProject(spec: spec, family: .quiz, updatedAt: .distantPast, isExample: true, revisionNotes: [])
        ]
    }()
}
