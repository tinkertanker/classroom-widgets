import SwiftUI

struct GuidedMakeView: View {
    private enum Phase {
        case questions
        case summary
    }

    let store: StudioStore
    @State private var draft = GuidedBriefDraft()
    @State private var questionIndex = 0
    @State private var response = ""
    @State private var phase: Phase = .questions
    @State private var isCreating = false
    @State private var creationError: String?
    @FocusState private var responseIsFocused: Bool

    private var question: BriefQuestion {
        BriefQuestion.all[questionIndex]
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                PageHeader(
                    eyebrow: "Make",
                    title: "What does your next lesson need?",
                    subtitle: "Studio asks one useful question at a time, then lets you approve the brief before anything is made."
                )

                Group {
                    switch phase {
                    case .questions:
                        questionCard
                    case .summary:
                        summaryCard
                    }
                }
                .frame(maxWidth: 760)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(32)
        }
        .navigationTitle("Make")
        .accessibilityIdentifier("make-screen")
    }

    private var questionCard: some View {
        VStack(alignment: .leading, spacing: 24) {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("Question \(questionIndex + 1) of \(BriefQuestion.all.count)")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(StudioTheme.sage)
                    Spacer()
                    if question.isOptional {
                        Text("OPTIONAL")
                            .font(.caption2.weight(.bold))
                            .tracking(0.8)
                            .foregroundStyle(StudioTheme.mutedInk)
                    }
                }
                ProgressView(value: Double(questionIndex + 1), total: Double(BriefQuestion.all.count))
                    .tint(StudioTheme.sage)
            }

            VStack(alignment: .leading, spacing: 9) {
                Text(question.eyebrow.uppercased())
                    .font(.caption.weight(.bold))
                    .tracking(1.1)
                    .foregroundStyle(StudioTheme.terracotta)
                Text(question.prompt)
                    .font(.title.weight(.semibold))
                    .foregroundStyle(StudioTheme.ink)
                Text(question.supportingText)
                    .font(.body)
                    .foregroundStyle(StudioTheme.mutedInk)
            }

            TextEditor(text: $response)
                .font(.body)
                .frame(minHeight: 112)
                .padding(12)
                .scrollContentBackground(.hidden)
                .background(StudioTheme.canvas, in: RoundedRectangle(cornerRadius: 14))
                .overlay(alignment: .topLeading) {
                    if response.isEmpty {
                        Text(question.placeholder)
                            .foregroundStyle(.secondary)
                            .padding(.horizontal, 17)
                            .padding(.vertical, 20)
                            .allowsHitTesting(false)
                    }
                }
                .focused($responseIsFocused)
                .accessibilityIdentifier("guided-answer")

            VStack(alignment: .leading, spacing: 9) {
                Text("Or start here")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(StudioTheme.mutedInk)
                FlowLayout(spacing: 8) {
                    ForEach(question.suggestions, id: \.self) { suggestion in
                        Button(suggestion) {
                            response = suggestion
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
                    .disabled(questionIndex == 0)
                Spacer()
                if question.isOptional && cleanResponse.isEmpty {
                    Button("Skip") { moveForward() }
                        .buttonStyle(.bordered)
                }
                Button(questionIndex == BriefQuestion.all.count - 1 ? "Review brief" : "Continue") {
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
            HStack(alignment: .top, spacing: 16) {
                Image(systemName: "checkmark.seal.fill")
                    .font(.largeTitle)
                    .foregroundStyle(StudioTheme.sage)
                VStack(alignment: .leading, spacing: 6) {
                    Text("Check the brief")
                        .font(.title.weight(.semibold))
                    Text("Studio will make one focused, front-end-only classroom widget from this plan.")
                        .foregroundStyle(StudioTheme.mutedInk)
                }
            }

            VStack(spacing: 0) {
                summaryRow(label: "For", value: draft.learnerContext)
                Divider()
                summaryRow(label: "Learning", value: draft.learningObjective)
                Divider()
                summaryRow(label: "Students will", value: draft.studentAction)
                Divider()
                summaryRow(label: "Include", value: draft.sourceContent.isEmpty ? "No required source content" : draft.sourceContent)
                Divider()
                summaryRow(label: "Feedback", value: draft.feedback)
                Divider()
                summaryRow(label: "Lesson fit", value: draft.classroomFit)
            }
            .background(StudioTheme.canvas, in: RoundedRectangle(cornerRadius: 14))

            Label(
                "This V1 widget will not collect responses, identify students or call external services.",
                systemImage: "hand.raised.fill"
            )
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
                    phase = .questions
                    questionIndex = BriefQuestion.all.count - 1
                    response = draft.answer(at: questionIndex)
                }
                .buttonStyle(.bordered)
                Spacer()
                Button {
                    createDraft()
                } label: {
                    if isCreating {
                        HStack(spacing: 8) {
                            ProgressView().controlSize(.small)
                            Text("Making your widget…")
                        }
                    } else {
                        Label("Create first draft", systemImage: "wand.and.sparkles")
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(isCreating)
                .accessibilityIdentifier("approve-brief")
            }
        }
        .padding(28)
        .studioCard()
    }

    private func summaryRow(label: String, value: String) -> some View {
        HStack(alignment: .top, spacing: 20) {
            Text(label)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(StudioTheme.mutedInk)
                .frame(width: 110, alignment: .leading)
            Text(value)
                .font(.body)
                .foregroundStyle(StudioTheme.ink)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(14)
    }

    private var cleanResponse: String {
        response.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func moveForward() {
        draft.setAnswer(cleanResponse, at: questionIndex)
        if questionIndex == BriefQuestion.all.count - 1 {
            phase = .summary
            responseIsFocused = false
        } else {
            questionIndex += 1
            response = draft.answer(at: questionIndex)
            responseIsFocused = true
        }
    }

    private func moveBack() {
        guard questionIndex > 0 else { return }
        draft.setAnswer(cleanResponse, at: questionIndex)
        questionIndex -= 1
        response = draft.answer(at: questionIndex)
    }

    private func createDraft() {
        isCreating = true
        creationError = nil
        Task {
            do {
                _ = try await store.createApprovedBrief(draft)
            } catch {
                store.handleStudioError(error)
                creationError = error.localizedDescription
            }
            isCreating = false
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
