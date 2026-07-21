import SwiftUI

struct WidgetProjectCard: View {
    let project: WidgetProject
    var primaryTitle = "Preview"
    let onPrimary: () -> Void
    var secondaryTitle: String?
    var onSecondary: (() -> Void)?
    var onDelete: (() -> Void)?
    @State private var expiryEvaluationDate = Date.now
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top) {
                Text(project.family.title)
                    .font(StudioTheme.Typography.eyebrow)
                    .foregroundStyle(StudioTheme.accent)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(StudioTheme.accentSoft, in: Capsule())
                Spacer()
                if let onDelete {
                    Menu {
                        Button("Delete widget", systemImage: "trash", role: .destructive, action: onDelete)
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .font(.title3)
                            .frame(width: 44, height: 44)
                    }
                    .accessibilityLabel("More actions for \(project.spec.metadata.title)")
                }
            }

            VStack(alignment: .leading, spacing: 6) {
                Text(project.spec.metadata.title)
                    .font(StudioTheme.Typography.cardTitle)
                    .foregroundStyle(StudioTheme.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Text(project.spec.metadata.summary)
                    .font(.subheadline)
                    .foregroundStyle(StudioTheme.mutedInk)
                    .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 4)
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
                .foregroundStyle(projectStateNeedsAttention ? StudioTheme.danger : StudioTheme.mutedInk)

                if let publication = project.publication,
                   !publication.isExpired(at: expiryEvaluationDate) {
                    Text("Students can open this until \(publication.formattedExpirationDate()).")
                        .font(.caption)
                        .foregroundStyle(StudioTheme.mutedInk)
                }
            }

            Spacer(minLength: 0)

            HStack {
                Button(action: onPrimary) {
                    Text(primaryTitle)
                        .frame(minHeight: 44)
                }
                    .buttonStyle(.borderedProminent)
                    .accessibilityIdentifier("project-primary-\(project.id)")
                if let secondaryTitle, let onSecondary {
                    Button(action: onSecondary) {
                        Text(secondaryTitle)
                            .frame(minHeight: 44)
                    }
                        .buttonStyle(.bordered)
                }
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .studioCard()
        .task(id: project.publication?.expiresAt) {
            await refreshAtPublicationExpiration(project.publication)
        }
    }

    private var projectStateTitle: String {
        if project.publication?.isExpired(at: expiryEvaluationDate) == true {
            return project.publicationNeedsUpdate
                ? "Link expired — update to share"
                : "Link expired — reactivate to share"
        }
        if project.publicationNeedsUpdate { return "Changes not shared" }
        if project.publication != nil { return "Shared with students" }
        if project.needsRemoteSave { return "Waiting to save a recovery copy" }
        if project.remoteDraft != nil { return "Not shared" }
        return "Saved on this iPad"
    }

    private var projectStateSymbol: String {
        if project.publication?.isExpired(at: expiryEvaluationDate) == true {
            return "clock.badge.exclamationmark"
        }
        if project.publicationNeedsUpdate { return "arrow.triangle.2.circlepath" }
        if project.publication != nil { return "link" }
        if project.needsRemoteSave { return "icloud.slash" }
        if project.remoteDraft != nil { return "checkmark.icloud" }
        return "ipad"
    }

    private var projectStateNeedsAttention: Bool {
        project.publication?.isExpired(at: expiryEvaluationDate) == true || project.publicationNeedsUpdate
    }

    @MainActor
    private func refreshAtPublicationExpiration(_ publication: WidgetPublication?) async {
        let now = Date.now
        expiryEvaluationDate = now
        guard let expiration = publication?.expirationRefreshDate(after: now) else { return }
        do {
            try await Task.sleep(for: .seconds(expiration.timeIntervalSince(now)))
        } catch {
            return
        }
        expiryEvaluationDate = expiration
    }
}
