import SwiftUI

struct GuidedMakeView: View {
    let store: StudioStore
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var creationError: String?
    @FocusState private var responseIsFocused: Bool

    private var question: BriefQuestion {
        BriefQuestion.all[store.guidedMakeQuestionIndex]
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                PageHeader(
                    title: "What does your next lesson need?",
                    subtitle: "Answer a few questions, then approve the brief before anything is made."
                )

                Group {
                    if store.guidedMakeShowsSummary {
                        summaryCard
                    } else {
                        questionCard
                    }
                }
                .frame(maxWidth: 760)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(32)
        }
        .accessibilityIdentifier("make-screen")
    }

    private var questionCard: some View {
        VStack(alignment: .leading, spacing: 24) {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("Question \(store.guidedMakeQuestionIndex + 1) of \(BriefQuestion.all.count)")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(StudioTheme.mutedInk)
                    Spacer()
                    if question.isOptional {
                        Text("Optional")
                            .font(.caption)
                            .foregroundStyle(StudioTheme.mutedInk)
                    }
                }
                ProgressView(
                    value: Double(store.guidedMakeQuestionIndex + 1),
                    total: Double(BriefQuestion.all.count)
                )
                    .tint(StudioTheme.sage)
            }

            VStack(alignment: .leading, spacing: 9) {
                Text(question.prompt)
                    .font(.title.weight(.semibold))
                    .foregroundStyle(StudioTheme.ink)
                Text(question.supportingText)
                    .font(.body)
                    .foregroundStyle(StudioTheme.mutedInk)
            }

            TextEditor(
                text: Binding(
                    get: { store.guidedMakeResponse },
                    set: { store.guidedMakeResponse = $0 }
                )
            )
                .font(.body)
                .frame(minHeight: 112)
                .padding(12)
                .scrollContentBackground(.hidden)
                .background(StudioTheme.canvas, in: RoundedRectangle(cornerRadius: 14))
                .overlay(alignment: .topLeading) {
                    if store.guidedMakeResponse.isEmpty {
                        Text(question.placeholder)
                            .foregroundStyle(.secondary)
                            .padding(.horizontal, 17)
                            .padding(.vertical, 20)
                            .allowsHitTesting(false)
                            .accessibilityHidden(true)
                    }
                }
                .focused($responseIsFocused)
                .accessibilityLabel(question.prompt)
                .accessibilityHint(question.supportingText)
                .accessibilityIdentifier("guided-answer")

            VStack(alignment: .leading, spacing: 9) {
                Text("Or start here")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(StudioTheme.mutedInk)
                FlowLayout(spacing: 8) {
                    ForEach(question.suggestions, id: \.self) { suggestion in
                        Button(suggestion) {
                            store.guidedMakeResponse = suggestion
                        }
                        .buttonStyle(.bordered)
                        .buttonBorderShape(.capsule)
                        .font(.subheadline)
                    }
                }
            }

            Divider()

            HStack {
                Button("Back") { moveBack() }
                    .buttonStyle(.bordered)
                    .disabled(store.guidedMakeQuestionIndex == 0)
                Spacer()
                if question.isOptional && cleanResponse.isEmpty {
                    Button("Skip") { moveForward() }
                        .buttonStyle(.bordered)
                }
                Button(store.guidedMakeQuestionIndex == BriefQuestion.all.count - 1 ? "Review brief" : "Continue") {
                    moveForward()
                }
                .buttonStyle(.borderedProminent)
                .disabled(!question.isOptional && cleanResponse.isEmpty)
                .accessibilityIdentifier("guided-continue")
            }
        }
        .padding(28)
        .studioCard()
    }

    private var summaryCard: some View {
        VStack(alignment: .leading, spacing: 24) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Check the brief")
                    .font(.title.weight(.semibold))
                Text("Studio will make one focused widget from this plan. You can keep refining it afterwards.")
                    .foregroundStyle(StudioTheme.mutedInk)
            }

            VStack(spacing: 0) {
                summaryRow(label: "For", value: store.guidedMakeDraft.learnerContext)
                Divider()
                summaryRow(label: "Learning", value: store.guidedMakeDraft.learningObjective)
                Divider()
                summaryRow(label: "Students will", value: store.guidedMakeDraft.studentAction)
                Divider()
                summaryRow(
                    label: "Include",
                    value: store.guidedMakeDraft.sourceContent.isEmpty
                        ? "No required source content"
                        : store.guidedMakeDraft.sourceContent
                )
                Divider()
                summaryRow(label: "Feedback", value: store.guidedMakeDraft.feedback)
                Divider()
                summaryRow(label: "Lesson fit", value: store.guidedMakeDraft.classroomFit)
            }
            .background(StudioTheme.canvas, in: RoundedRectangle(cornerRadius: 14))

            Text("The widget will not collect responses, identify students or call external services.")
                .font(.footnote)
                .foregroundStyle(StudioTheme.mutedInk)

            if let creationError {
                Label(creationError, systemImage: "exclamationmark.triangle.fill")
                    .font(.callout)
                    .foregroundStyle(StudioTheme.terracotta)
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(StudioTheme.terracottaSoft, in: RoundedRectangle(cornerRadius: 12))
            }

            HStack {
                Button("Edit answers") {
                    store.guidedMakeShowsSummary = false
                    store.guidedMakeQuestionIndex = BriefQuestion.all.count - 1
                    store.guidedMakeResponse = store.guidedMakeDraft.answer(
                        at: store.guidedMakeQuestionIndex
                    )
                }
                .buttonStyle(.bordered)
                .disabled(store.isCreatingGuidedDraft)
                Spacer()
                Button {
                    createDraft()
                } label: {
                    if store.isCreatingGuidedDraft {
                        HStack(spacing: 8) {
                            ProgressView().controlSize(.small)
                            Text("Making your widget…")
                        }
                    } else {
                        Text("Create first draft")
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(store.isCreatingGuidedDraft)
                .accessibilityIdentifier("approve-brief")
            }
        }
        .padding(28)
        .studioCard()
    }

    private func summaryRow(label: String, value: String) -> some View {
        Group {
            if dynamicTypeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: 6) {
                    summaryLabel(label)
                    summaryValue(value)
                }
            } else {
                HStack(alignment: .top, spacing: 20) {
                    summaryLabel(label)
                        .frame(width: 110, alignment: .leading)
                    summaryValue(value)
                }
            }
        }
        .padding(14)
    }

    private func summaryLabel(_ label: String) -> some View {
            Text(label)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(StudioTheme.mutedInk)
    }

    private func summaryValue(_ value: String) -> some View {
            Text(value)
                .font(.body)
                .foregroundStyle(StudioTheme.ink)
                .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var cleanResponse: String {
        store.guidedMakeResponse.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func moveForward() {
        guard !store.isCreatingGuidedDraft else { return }
        store.guidedMakeDraft.setAnswer(cleanResponse, at: store.guidedMakeQuestionIndex)
        if store.guidedMakeQuestionIndex == BriefQuestion.all.count - 1 {
            store.guidedMakeShowsSummary = true
            responseIsFocused = false
        } else {
            store.guidedMakeQuestionIndex += 1
            store.guidedMakeResponse = store.guidedMakeDraft.answer(
                at: store.guidedMakeQuestionIndex
            )
            responseIsFocused = true
        }
    }

    private func moveBack() {
        guard !store.isCreatingGuidedDraft else { return }
        guard store.guidedMakeQuestionIndex > 0 else { return }
        store.guidedMakeDraft.setAnswer(cleanResponse, at: store.guidedMakeQuestionIndex)
        store.guidedMakeQuestionIndex -= 1
        store.guidedMakeResponse = store.guidedMakeDraft.answer(
            at: store.guidedMakeQuestionIndex
        )
    }

    private func createDraft() {
        creationError = nil
        Task {
            do {
                _ = try await store.createApprovedBrief(store.guidedMakeDraft)
                store.resetGuidedMake()
            } catch {
                store.handleStudioError(error)
                creationError = error.localizedDescription
            }
        }
    }
}

private struct FlowLayout: Layout {
    var spacing: CGFloat

    func sizeThatFits(
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout ()
    ) -> CGSize {
        let result = layout(proposal: proposal, subviews: subviews)
        return result.size
    }

    func placeSubviews(
        in bounds: CGRect,
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout ()
    ) {
        let result = layout(proposal: proposal, subviews: subviews)
        for (index, point) in result.points.enumerated() {
            subviews[index].place(at: CGPoint(x: bounds.minX + point.x, y: bounds.minY + point.y), proposal: .unspecified)
        }
    }

    private func layout(proposal: ProposedViewSize, subviews: Subviews) -> (size: CGSize, points: [CGPoint]) {
        let maxWidth = proposal.width ?? .infinity
        var points: [CGPoint] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > maxWidth, x > 0 {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            points.append(CGPoint(x: x, y: y))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }

        return (CGSize(width: maxWidth.isFinite ? maxWidth : x, height: y + rowHeight), points)
    }
}
