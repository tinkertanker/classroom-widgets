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
                Text(project.family.title)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(StudioTheme.mutedInk)
                Spacer()
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
                    .fixedSize(horizontal: false, vertical: true)
                Text(project.spec.metadata.summary)
                    .font(.subheadline)
                    .foregroundStyle(StudioTheme.mutedInk)
                    .lineLimit(4)
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

            if !project.isExample {
                HStack(spacing: 8) {
                    Label(projectStateTitle, systemImage: projectStateSymbol)
                    Spacer()
                    Text(project.updatedAt, style: .relative)
                }
                .font(.caption)
                .foregroundStyle(project.publicationNeedsUpdate ? StudioTheme.terracotta : StudioTheme.mutedInk)
            }

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
        .frame(maxWidth: .infinity, alignment: .leading)
        .studioCard()
    }

    private var projectStateTitle: String {
        if project.publicationNeedsUpdate { return "Link needs updating" }
        if project.publication != nil { return "Student link live" }
        if project.needsRemoteSave { return "Waiting to back up" }
        if project.remoteDraft != nil { return "Backed up" }
        return "On this iPad"
    }

    private var projectStateSymbol: String {
        if project.publicationNeedsUpdate { return "arrow.triangle.2.circlepath" }
        if project.publication != nil { return "link" }
        if project.needsRemoteSave { return "icloud.slash" }
        if project.remoteDraft != nil { return "checkmark.icloud" }
        return "ipad"
    }
}
