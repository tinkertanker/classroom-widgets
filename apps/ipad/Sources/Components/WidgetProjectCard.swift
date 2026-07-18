import SwiftUI

struct WidgetProjectCard: View {
    let project: WidgetProject
    var primaryTitle = "Preview"
    let onPrimary: () -> Void
    var secondaryTitle: String?
    var onSecondary: (() -> Void)?
    var onDelete: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top) {
                Image(systemName: project.family.symbolName)
                    .font(.title2)
                    .foregroundStyle(StudioTheme.sage)
                    .frame(width: 48, height: 48)
                    .background(StudioTheme.sageSoft, in: RoundedRectangle(cornerRadius: 13))
                Spacer()
                Text(project.family.title)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(StudioTheme.mutedInk)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 5)
                    .background(StudioTheme.canvas, in: Capsule())
                if let onDelete {
                    Menu {
                        Button("Delete widget", systemImage: "trash", role: .destructive, action: onDelete)
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .font(.title3)
                    }
                    .accessibilityLabel("More actions for \(project.spec.metadata.title)")
                }
            }

            VStack(alignment: .leading, spacing: 6) {
                Text(project.spec.metadata.title)
                    .font(.headline)
                    .foregroundStyle(StudioTheme.ink)
                    .lineLimit(2)
                Text(project.spec.metadata.summary)
                    .font(.subheadline)
                    .foregroundStyle(StudioTheme.mutedInk)
                    .lineLimit(3)
            }

            HStack(spacing: 12) {
                if let level = project.spec.metadata.level {
                    Label(level.replacingOccurrences(of: "-", with: " ").capitalized, systemImage: "graduationcap")
                }
                if let minutes = project.spec.metadata.estimatedMinutes {
                    Label("\(minutes) min", systemImage: "clock")
                }
            }
            .font(.caption)
            .foregroundStyle(StudioTheme.mutedInk)

            Spacer(minLength: 0)

            HStack {
                Button(primaryTitle, action: onPrimary)
                    .buttonStyle(.borderedProminent)
                    .accessibilityIdentifier("project-primary-\(project.id)")
                if let secondaryTitle, let onSecondary {
                    Button(secondaryTitle, action: onSecondary)
                        .buttonStyle(.bordered)
                }
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, minHeight: 260, alignment: .leading)
        .studioCard()
    }
}
