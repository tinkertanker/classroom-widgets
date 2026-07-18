import SwiftUI

struct ExploreView: View {
    let store: StudioStore
    @State private var selectedFamily: WidgetFamily?

    private var visibleExamples: [WidgetProject] {
        guard let selectedFamily else { return store.examples }
        return store.examples.filter { $0.family == selectedFamily }
    }

    private var availableFamilies: [WidgetFamily] {
        let present = Set(store.examples.map(\.family))
        return WidgetFamily.allCases.filter(present.contains)
    }

    private let columns = [GridItem(.adaptive(minimum: 270), spacing: 18)]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                PageHeader(
                    eyebrow: "Explore",
                    title: "Start with something proven",
                    subtitle: "Preview a classroom-ready widget, or remix it for your learners. No blank canvas required."
                )

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        filterButton(title: "All", symbol: "square.grid.2x2", family: nil)
                        ForEach(availableFamilies, id: \.self) { family in
                            filterButton(title: family.title, symbol: family.symbolName, family: family)
                        }
                    }
                }

                if visibleExamples.isEmpty {
                    ContentUnavailableView(
                        "More examples are coming",
                        systemImage: "sparkles",
                        description: Text("Choose All to see the current classroom-ready set.")
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
        .navigationTitle("Explore")
        .accessibilityIdentifier("explore-screen")
    }

    @ViewBuilder
    private func filterButton(title: String, symbol: String, family: WidgetFamily?) -> some View {
        if family == selectedFamily {
            Button {
                selectedFamily = family
            } label: {
                Label(title, systemImage: symbol)
                    .font(.subheadline.weight(.medium))
                    .padding(.horizontal, 4)
            }
            .buttonStyle(.borderedProminent)
            .buttonBorderShape(.capsule)
        } else {
            Button {
                selectedFamily = family
            } label: {
                Label(title, systemImage: symbol)
                    .font(.subheadline.weight(.medium))
                    .padding(.horizontal, 4)
            }
            .buttonStyle(.bordered)
            .buttonBorderShape(.capsule)
        }
    }
}
