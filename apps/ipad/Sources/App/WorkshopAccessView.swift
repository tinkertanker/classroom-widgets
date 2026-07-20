import SwiftUI

struct WorkshopAccessView: View {
    let store: StudioStore

    @State private var accessCode = ""
    @State private var isRegistering = false
    @State private var registrationError: String?
    @FocusState private var codeIsFocused: Bool

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    if store.workshopAccessState == .ready {
                        Image(systemName: "checkmark.seal.fill")
                            .font(.system(size: 52))
                            .foregroundStyle(StudioTheme.accent)
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Studio is active")
                                .font(.largeTitle.bold())
                            Text("This iPad can make, publish and manage your classroom widgets. Its secure ownership stays unchanged so your existing student links remain under your control.")
                                .foregroundStyle(StudioTheme.mutedInk)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    } else {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Join the workshop")
                                .font(.largeTitle.bold())
                                .fixedSize(horizontal: false, vertical: true)
                            Text("Enter the one-time access code from your facilitator. It activates Studio generation and publishing on this iPad — no account or student details required.")
                                .font(.body)
                                .foregroundStyle(StudioTheme.mutedInk)
                                .fixedSize(horizontal: false, vertical: true)
                        }

                        TextField("Workshop access code", text: $accessCode)
                            .textInputAutocapitalization(.characters)
                            .autocorrectionDisabled()
                            .font(.title3.monospaced().weight(.semibold))
                            .padding(14)
                            .background(StudioTheme.canvas, in: RoundedRectangle(cornerRadius: 12))
                            .focused($codeIsFocused)
                            .accessibilityIdentifier("workshop-access-code")
                            .disabled(isRegistering)

                        if let registrationError {
                            Label(registrationError, systemImage: "exclamationmark.triangle.fill")
                                .font(.callout)
                                .foregroundStyle(StudioTheme.danger)
                        }

                        Button {
                            register()
                        } label: {
                            HStack {
                                Spacer()
                                if isRegistering {
                                    ProgressView().tint(.white)
                                    Text("Activating…")
                                } else {
                                    Text("Activate Studio")
                                }
                                Spacer()
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(isRegistering || accessCode.trimmingCharacters(in: .whitespacesAndNewlines).count < 8)
                        .accessibilityIdentifier("activate-workshop-access")

                        Text("Your access stays securely on this iPad. Use a code only once and keep it private.")
                            .font(.footnote)
                            .foregroundStyle(StudioTheme.mutedInk)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    Spacer(minLength: 0)
                }
                .padding(32)
                .frame(maxWidth: 620, minHeight: 520, alignment: .topLeading)
            }
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle("Workshop access")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(store.workshopAccessState == .ready ? "Done" : "Not now") {
                        store.dismissWorkshopAccess()
                    }
                    .disabled(isRegistering)
                }
            }
            .onAppear { codeIsFocused = store.workshopAccessState != .ready }
        }
        .presentationDetents([.large])
    }

    private func register() {
        guard !isRegistering else { return }
        isRegistering = true
        registrationError = nil
        codeIsFocused = false
        Task { @MainActor in
            defer { isRegistering = false }
            do {
                try await store.registerWorkshopAccess(accessCode)
            } catch {
                registrationError = error.localizedDescription
            }
        }
    }
}
