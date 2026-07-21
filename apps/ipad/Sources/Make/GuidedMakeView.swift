import SwiftUI

struct GuidedMakeView: View {
    let store: StudioStore
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var creationError: StudioErrorPresentation?
    @FocusState private var responseIsFocused: Bool

    private var question: BriefQuestion {
        BriefQuestion.all[store.guidedMakeQuestionIndex]
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                PageHeader(
                    title: "Plan your classroom widget",
                    subtitle: "Answer six quick questions. You can review and change every answer before Studio makes your widget.",
                    sticker: .handraise
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
                        .font(StudioTheme.Typography.eyebrow)
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
                    .tint(StudioTheme.accent)
            }

            VStack(alignment: .leading, spacing: 9) {
                Text(question.prompt)
                    .font(StudioTheme.Typography.question)
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
                .background(StudioTheme.canvas, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
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
                    .font(StudioTheme.Typography.eyebrow)
                    .foregroundStyle(StudioTheme.mutedInk)
                FlowLayout(spacing: 8) {
                    ForEach(question.suggestions, id: \.self) { suggestion in
                        Button(suggestion) {
                            addSuggestion(suggestion)
                        }
                        .buttonStyle(.bordered)
                        .buttonBorderShape(.capsule)
                        .font(.subheadline)
                        .accessibilityHint(
                            cleanResponse.isEmpty
                                ? "Uses this suggestion as your answer."
                                : "Adds this idea after the answer you have already written."
                        )
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
                Button(store.guidedMakeQuestionIndex == BriefQuestion.all.count - 1 ? "Review answers" : "Continue") {
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
                Text(store.isCreatingGuidedDraft ? "Making your widget" : "Check your answers")
                    .font(StudioTheme.Typography.question)
                Text(
                    store.isCreatingGuidedDraft
                        ? "Studio is working from the answers below."
                        : "Tap any answer to change it, then make your widget. You can keep refining it afterwards."
                )
                    .foregroundStyle(StudioTheme.mutedInk)
            }

            if store.isCreatingGuidedDraft {
                generationStatus
            }

            VStack(spacing: 0) {
                summaryRow(label: "Students", value: store.guidedMakeDraft.learnerContext, questionIndex: 0)
                Divider()
                summaryRow(label: "Learning goal", value: store.guidedMakeDraft.learningObjective, questionIndex: 1)
                Divider()
                summaryRow(label: "Students will", value: store.guidedMakeDraft.studentAction, questionIndex: 2)
                Divider()
                summaryRow(
                    label: "Must include",
                    value: store.guidedMakeDraft.sourceContent.isEmpty
                        ? "No required source content"
                        : store.guidedMakeDraft.sourceContent,
                    questionIndex: 3
                )
                Divider()
                summaryRow(label: "How it responds", value: store.guidedMakeDraft.feedback, questionIndex: 4)
                Divider()
                summaryRow(label: "In the lesson", value: store.guidedMakeDraft.classroomFit, questionIndex: 5)
            }
            .background(StudioTheme.canvas, in: RoundedRectangle(cornerRadius: 18, style: .continuous))

            Text("The widget will not collect responses, identify students or call external services.")
                .font(.footnote)
                .foregroundStyle(StudioTheme.mutedInk)

            if let creationError {
                VStack(alignment: .leading, spacing: 4) {
                    Label(creationError.title, systemImage: "exclamationmark.triangle.fill")
                        .font(.callout.weight(.semibold))
                    Text(creationError.message)
                        .font(.callout)
                }
                    .foregroundStyle(StudioTheme.danger)
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(StudioTheme.dangerSoft, in: RoundedRectangle(cornerRadius: 12))
            }

            HStack {
                Button("Change answers") {
                    editAnswer(at: 0)
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
                        Text("Make my widget")
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

    private var generationStatus: some View {
        HStack(alignment: .top, spacing: 14) {
            ProgressView()
                .controlSize(.large)
                .tint(StudioTheme.accent)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 5) {
                Text("This usually takes one to two minutes.")
                    .font(.body.weight(.semibold))
                Text("Your answers are still here and will be used to make your widget. There is nothing else you need to do right now.")
                    .font(.callout)
                    .foregroundStyle(StudioTheme.mutedInk)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(StudioTheme.canvas, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(StudioTheme.border, lineWidth: 1)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Making your widget. This usually takes one to two minutes. Your answers are still here and will be used to make your widget.")
    }

    private func summaryRow(label: String, value: String, questionIndex: Int) -> some View {
        Button {
            editAnswer(at: questionIndex)
        } label: {
            if dynamicTypeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: 6) {
                    Text(label)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(StudioTheme.mutedInk)
                    Text(value)
                        .font(.body)
                        .foregroundStyle(StudioTheme.ink)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Text("Edit answer")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(StudioTheme.accent)
                }
            } else {
                HStack(alignment: .top, spacing: 20) {
                    Text(label)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(StudioTheme.mutedInk)
                        .frame(width: 110, alignment: .leading)
                    Text(value)
                        .font(.body)
                        .foregroundStyle(StudioTheme.ink)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(StudioTheme.mutedInk)
                        .padding(.top, 4)
                        .accessibilityHidden(true)
                }
            }
        }
        .buttonStyle(.plain)
        .contentShape(Rectangle())
        .padding(14)
        .disabled(store.isCreatingGuidedDraft)
        .accessibilityLabel("Edit \(label) answer")
        .accessibilityValue(value)
        .accessibilityHint("Returns to question \(questionIndex + 1).")
        .accessibilityIdentifier("edit-brief-answer-\(questionIndex)")
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
        responseIsFocused = true
    }

    private func addSuggestion(_ suggestion: String) {
        guard !store.isCreatingGuidedDraft else { return }
        guard !cleanResponse.isEmpty else {
            store.guidedMakeResponse = suggestion
            responseIsFocused = true
            return
        }
        guard !store.guidedMakeResponse.contains(suggestion) else { return }
        store.guidedMakeResponse += store.guidedMakeResponse.hasSuffix("\n") ? suggestion : "\n\(suggestion)"
        responseIsFocused = true
    }

    private func editAnswer(at questionIndex: Int) {
        guard !store.isCreatingGuidedDraft else { return }
        creationError = nil
        store.guidedMakeShowsSummary = false
        store.guidedMakeQuestionIndex = questionIndex
        store.guidedMakeResponse = store.guidedMakeDraft.answer(at: questionIndex)
        responseIsFocused = true
    }

    private func createDraft() {
        creationError = nil
        Task {
            do {
                _ = try await store.createApprovedBrief(store.guidedMakeDraft)
                store.resetGuidedMake()
            } catch {
                creationError = store.present(error, during: .generation)
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
