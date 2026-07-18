import Foundation

struct WidgetPublishReadinessCheck: Identifiable, Equatable, Sendable {
    let id: String
    let title: String
    let detail: String
    let isPassing: Bool
}

struct WidgetPublishReadinessReport: Equatable, Sendable {
    let checks: [WidgetPublishReadinessCheck]

    var isReady: Bool { checks.allSatisfy(\.isPassing) }

    var blockerMessage: String {
        checks.filter { !$0.isPassing }.map(\.detail).joined(separator: " ")
    }
}

enum WidgetPublishReadiness {
    static func audit(_ spec: WidgetSpec) -> WidgetPublishReadinessReport {
        let titleIsPresent = !spec.metadata.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let summaryIsPresent = !spec.metadata.summary.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let contentIsPresent = !spec.screens.isEmpty && spec.screens.allSatisfy { !$0.components.isEmpty }
        let imageIssues = accessibilityIssues(in: spec)

        return WidgetPublishReadinessReport(checks: [
            .init(
                id: "title",
                title: "Clear widget title",
                detail: titleIsPresent ? "The widget has a title." : "Add a title before publishing.",
                isPassing: titleIsPresent
            ),
            .init(
                id: "summary",
                title: "Short student introduction",
                detail: summaryIsPresent ? "The widget explains what students will do." : "Add a short summary before publishing.",
                isPassing: summaryIsPresent
            ),
            .init(
                id: "content",
                title: "Activity content",
                detail: contentIsPresent
                    ? "Every screen contains something students can use."
                    : "Add at least one screen, and make sure every screen contains an activity component.",
                isPassing: contentIsPresent
            ),
            .init(
                id: "images",
                title: "Accessible images",
                detail: imageIssues.isEmpty
                    ? "Images have suitable descriptions, while decorative images have none."
                    : imageIssues.joined(separator: " "),
                isPassing: imageIssues.isEmpty
            )
        ])
    }

    private static func accessibilityIssues(in spec: WidgetSpec) -> [String] {
        var images: [[String: JSONValue]] = []
        var pending = spec.screens.flatMap(\.components)

        while let value = pending.popLast() {
            switch value {
            case let .object(object):
                if case let .string(kind)? = object["kind"], kind == "image" {
                    images.append(object)
                }
                pending.append(contentsOf: object.values)
            case let .array(values):
                pending.append(contentsOf: values)
            case .string, .integer, .number, .boolean, .null:
                break
            }
        }

        let missingDescriptions = images.filter { image in
            let decorative = if case let .boolean(value)? = image["decorative"] { value } else { false }
            let altText = if case let .string(value)? = image["altText"] { value } else { "" }
            return !decorative && altText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }.count
        let describedDecorations = images.filter { image in
            let decorative = if case let .boolean(value)? = image["decorative"] { value } else { false }
            let altText = if case let .string(value)? = image["altText"] { value } else { "" }
            return decorative && !altText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }.count

        var issues: [String] = []
        if missingDescriptions > 0 {
            issues.append("Describe every image that students need to understand.")
        }
        if describedDecorations > 0 {
            issues.append("Remove alternative text from images marked as decorative.")
        }
        return issues
    }
}
