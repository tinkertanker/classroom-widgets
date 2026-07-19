import SwiftUI

struct ExploreView: View {
    let store: StudioStore
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var selectedFamily: WidgetFamily?

    private var visibleExamples: [WidgetProject] {
        guard let selectedFamily else { return store.examples }
        return store.examples.filter { $0.family == selectedFamily }
    }

    private var availableFamilies: [WidgetFamily] {
        let present = Set(store.examples.map(\.family))
        return WidgetFamily.allCases.filter(present.contains)
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
                    subtitle: "Preview a classroom-ready widget, or remix it for your learners."
                )

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        filterButton(title: "All", family: nil)
                        ForEach(availableFamilies, id: \.self) { family in
                            filterButton(title: family.title, family: family)
                        }
                    }
                }

                if visibleExamples.isEmpty {
                    ContentUnavailableView(
                        "No examples in this category yet",
                        systemImage: "tray",
                        description: Text("Choose All to see the current set.")
                    )
                    .frame(maxWidth: .infinity, minHeight: 360)
                } else {
                    LazyVGrid(columns: columns, alignment: .leading, spacing: 18) {
                        ForEach(visibleExamples) { project in
                            WidgetProjectCard(
                                project: project,
                                onPrimary: { store.open(project) },
                                secondaryTitle: "Remix",
                                onSecondary: { store.remix(project) }
                            )
                        }
                    }
                }
            }
            .padding(32)
        }
        .accessibilityIdentifier("explore-screen")
    }

    @ViewBuilder
    private func filterButton(title: String, family: WidgetFamily?) -> some View {
        if family == selectedFamily {
            Button(title) {
                selectedFamily = family
            }
            .font(.subheadline.weight(.medium))
            .buttonStyle(.borderedProminent)
            .buttonBorderShape(.capsule)
            .accessibilityAddTraits(.isSelected)
        } else {
            Button(title) {
                selectedFamily = family
            }
            .font(.subheadline.weight(.medium))
            .buttonStyle(.bordered)
            .buttonBorderShape(.capsule)
        }
    }
}
