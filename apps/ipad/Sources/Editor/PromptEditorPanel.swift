import SwiftUI

struct PromptEditorPanel: View {
    let store: StudioStore
    let project: WidgetProject

    @Binding var prompt: String
    @Binding var isSubmitting: Bool
    @State private var submissionError: String?
    @FocusState private var promptIsFocused: Bool

    private let quickPrompts = [
        "Make it simpler",
        "Increase the challenge",
        "Improve accessibility",
        "Make it work on phones"
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Describe a change")
                        .font(.headline)
                    Text("Studio keeps the working parts wherever possible while it makes your change.")
                        .font(.subheadline)
                        .foregroundStyle(StudioTheme.mutedInk)
                }

                VStack(spacing: 10) {
                    TextEditor(text: $prompt)
                        .frame(minHeight: 100)
                        .padding(10)
                        .scrollContentBackground(.hidden)
                        .background(StudioTheme.canvas, in: RoundedRectangle(cornerRadius: 12))
                        .overlay(alignment: .topLeading) {
                            if prompt.isEmpty {
                                Text("For example, use a familiar local context")
                                    .foregroundStyle(.secondary)
                                    .padding(.horizontal, 15)
                                    .padding(.vertical, 18)
                                    .allowsHitTesting(false)
                                    .accessibilityHidden(true)
                            }
                        }
                        .focused($promptIsFocused)
                        .accessibilityLabel("Describe a change")
                        .accessibilityHint("Ask Studio to change one part of the widget.")
                        .disabled(project.isExample || isSubmitting)

                    Button {
                        submit()
                    } label: {
                        Group {
                            if isSubmitting {
                                HStack(spacing: 8) {
                                    ProgressView().controlSize(.small)
                                    Text("Updating…")
                                }
                            } else {
                                Text("Update preview")
                            }
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(
                        project.isExample ||
                        isSubmitting ||
                        prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                    )
                    .accessibilityIdentifier("submit-refinement")
                }

                if let submissionError {
                    Label(submissionError, systemImage: "exclamationmark.triangle.fill")
                        .font(.callout)
                        .foregroundStyle(StudioTheme.terracotta)
                }

                if project.previousSpec != nil {
                    Button {
                        undoLastChange()
                    } label: {
                        Label("Undo last generated change", systemImage: "arrow.uturn.backward")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .disabled(project.isExample || isSubmitting)
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("Suggestions")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(StudioTheme.mutedInk)
                    ForEach(quickPrompts, id: \.self) { suggestion in
                        Button {
                            prompt = suggestion
                            submit()
                        } label: {
                            HStack {
                                Text(suggestion)
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.caption)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .buttonStyle(.bordered)
                        .disabled(project.isExample || isSubmitting)
                    }
                }

                if !project.revisionNotes.isEmpty {
                    Divider()
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Recent changes")
                            .font(.headline)
                        ForEach(project.revisionNotes.prefix(4)) { note in
                            VStack(alignment: .leading, spacing: 4) {
                                Text(note.prompt)
                                    .font(.subheadline)
                                Text(note.createdAt, style: .relative)
                                    .font(.caption)
                                    .foregroundStyle(StudioTheme.mutedInk)
                            }
                        }
                    }
                }
            }
            .padding(18)
        }
    }

    private func submit() {
        let instruction = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !instruction.isEmpty, !isSubmitting else { return }
        isSubmitting = true
        submissionError = nil
        promptIsFocused = false
        Task {
            do {
                try await store.refine(instruction, projectID: project.id)
                if prompt.trimmingCharacters(in: .whitespacesAndNewlines) == instruction {
                    prompt = ""
                }
            } catch {
                store.handleStudioError(error)
                submissionError = error.localizedDescription
            }
            isSubmitting = false
        }
    }

    private func undoLastChange() {
        guard !isSubmitting else { return }
        isSubmitting = true
        submissionError = nil
        Task {
            do {
                try await store.undoLastGeneratedChange(projectID: project.id)
            } catch {
                store.handleStudioError(error)
                submissionError = error.localizedDescription
            }
            isSubmitting = false
        }
    }
}
