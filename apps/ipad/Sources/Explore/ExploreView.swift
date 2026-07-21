import SwiftUI

struct ExploreView: View {
    let store: StudioStore
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var filters = ExampleFilters()
    @State private var exampleToTry: WidgetProject?

    private var visibleExamples: [WidgetProject] {
        store.examples.filter(filters.matches)
    }

    private var availableFamilies: [WidgetFamily] {
        let present = Set(store.examples.map(\.family))
        return WidgetFamily.allCases.filter(present.contains)
    }

    private var availableSubjects: [String] {
        let present = Set(store.examples.compactMap(\.spec.metadata.subject))
        return ExampleFilters.subjectOrder.filter(present.contains)
    }

    private var availableLevels: [String] {
        let present = Set(store.examples.compactMap(\.spec.metadata.level))
        return ExampleFilters.levelOrder.filter(present.contains)
    }

    private var columns: [GridItem] {
        dynamicTypeSize.isAccessibilitySize
            ? [GridItem(.flexible())]
            : [GridItem(.adaptive(minimum: 270), spacing: 18)]
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                PageHeader(
                    title: "Start with an example",
                    subtitle: "Choose a subject and learner level, try the activity as a student, then make a copy for your class.",
                    sticker: .greetings
                )

                VStack(alignment: .leading, spacing: 18) {
                    metadataFilterRow(
                        title: "Subject",
                        values: availableSubjects,
                        selection: $filters.subject,
                        label: ExampleFilters.subjectTitle
                    )

                    metadataFilterRow(
                        title: "Level",
                        values: availableLevels,
                        selection: $filters.level,
                        label: ExampleFilters.levelTitle
                    )

                    HStack(spacing: 12) {
                        Menu {
                            filterMenuButton(title: "All activity types", family: nil)
                            ForEach(availableFamilies, id: \.self) { family in
                                filterMenuButton(title: family.title, family: family)
                            }
                        } label: {
                            Label(
                                filters.family?.title ?? "All activity types",
                                systemImage: "square.grid.2x2"
                            )
                            .frame(minHeight: 44)
                        }
                        .buttonStyle(.bordered)
                        .accessibilityIdentifier("example-filter-family")

                        Spacer()

                        Text(exampleCountLabel)
                            .font(.subheadline)
                            .foregroundStyle(StudioTheme.mutedInk)

                        if filters.isActive {
                            Button("Clear filters") {
                                withAnimation(.snappy(duration: 0.24)) {
                                    filters.clear()
                                }
                            }
                            .font(.subheadline.weight(.medium))
                            .frame(minHeight: 44)
                            .accessibilityIdentifier("example-filter-clear")
                        }
                    }
                }
                .padding(20)
                .studioCard()

                if visibleExamples.isEmpty {
                    ContentUnavailableView(
                        "No examples match these filters",
                        systemImage: "tray",
                        description: Text("Clear a filter to see more classroom-ready activities.")
                    )
                    .frame(maxWidth: .infinity, minHeight: 360)
                } else {
                    LazyVGrid(columns: columns, alignment: .leading, spacing: 18) {
                        ForEach(visibleExamples) { project in
                            WidgetProjectCard(
                                project: project,
                                primaryTitle: "Try as student",
                                onPrimary: { exampleToTry = project },
                                secondaryTitle: "Make a copy",
                                onSecondary: { store.remix(project) }
                            )
                        }
                    }
                }
            }
            .padding(32)
        }
        .accessibilityIdentifier("explore-screen")
        .fullScreenCover(item: $exampleToTry) { project in
            StudentPreviewView(project: project)
        }
    }

    @ViewBuilder
    private func metadataFilterRow(
        title: String,
        values: [String],
        selection: Binding<String?>,
        label: @escaping (String) -> String
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(StudioTheme.Typography.eyebrow)
                .foregroundStyle(StudioTheme.mutedInk)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    metadataFilterButton(
                        title: "All",
                        value: nil,
                        selection: selection,
                        identifier: "example-filter-\(title.lowercased())-all"
                    )
                    ForEach(values, id: \.self) { value in
                        metadataFilterButton(
                            title: label(value),
                            value: value,
                            selection: selection,
                            identifier: "example-filter-\(title.lowercased())-\(value)"
                        )
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func metadataFilterButton(
        title: String,
        value: String?,
        selection: Binding<String?>,
        identifier: String
    ) -> some View {
        if value == selection.wrappedValue {
            Button {
                withAnimation(.snappy(duration: 0.24)) {
                    selection.wrappedValue = value
                }
            } label: {
                Text(title)
                    .frame(minHeight: 44)
            }
            .font(.subheadline.weight(.medium))
            .buttonStyle(.borderedProminent)
            .buttonBorderShape(.capsule)
            .accessibilityAddTraits(.isSelected)
            .accessibilityIdentifier(identifier)
            .contentTransition(.interpolate)
        } else {
            Button {
                withAnimation(.snappy(duration: 0.24)) {
                    selection.wrappedValue = value
                }
            } label: {
                Text(title)
                    .frame(minHeight: 44)
            }
            .font(.subheadline.weight(.medium))
            .buttonStyle(.bordered)
            .buttonBorderShape(.capsule)
            .accessibilityIdentifier(identifier)
        }
    }

    @ViewBuilder
    private func filterMenuButton(title: String, family: WidgetFamily?) -> some View {
        Button {
            withAnimation(.snappy(duration: 0.24)) {
                filters.family = family
            }
        } label: {
            if filters.family == family {
                Label(title, systemImage: "checkmark")
            } else {
                Text(title)
            }
        }
    }

    private var exampleCountLabel: String {
        "\(visibleExamples.count) \(visibleExamples.count == 1 ? "example" : "examples")"
    }
}

struct ExampleFilters: Equatable {
    static let subjectOrder = ["science", "mathematics", "english", "humanities", "languages", "other"]
    static let levelOrder = ["upper-primary", "secondary", "other"]

    var subject: String? = nil
    var level: String? = nil
    var family: WidgetFamily? = nil

    var isActive: Bool {
        subject != nil || level != nil || family != nil
    }

    func matches(_ project: WidgetProject) -> Bool {
        (subject == nil || project.spec.metadata.subject == subject)
            && (level == nil || project.spec.metadata.level == level)
            && (family == nil || project.family == family)
    }

    mutating func clear() {
        subject = nil
        level = nil
        family = nil
    }

    static func subjectTitle(_ subject: String) -> String {
        switch subject {
        case "science": "Science"
        case "mathematics": "Mathematics"
        case "english": "English"
        case "humanities": "Humanities"
        case "languages": "Languages"
        case "other": "Other"
        default: subject.replacingOccurrences(of: "-", with: " ").capitalized
        }
    }

    static func levelTitle(_ level: String) -> String {
        switch level {
        case "upper-primary": "Upper primary"
        case "secondary": "Secondary"
        case "other": "Other"
        default: level.replacingOccurrences(of: "-", with: " ").capitalized
        }
    }
}
