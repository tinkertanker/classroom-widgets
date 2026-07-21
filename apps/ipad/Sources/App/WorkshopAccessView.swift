import SwiftUI

struct WorkshopAccessView: View {
    let store: StudioStore

    @State private var accessCode = ""
    @State private var isRegistering = false
    @State private var registrationError: StudioErrorPresentation?
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
                            Text("This iPad is ready")
                                .font(.largeTitle.bold())
                            Text("You can make, share and manage classroom widgets here. Existing student links stay connected to this Studio access.")
                                .foregroundStyle(StudioTheme.mutedInk)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    } else {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Set up Studio on this iPad")
                                .font(.largeTitle.bold())
                                .fixedSize(horizontal: false, vertical: true)
                            Text("Enter the one-time code from your workshop facilitator to make and share classroom widgets. It does not create an account, and students never need a code or account.")
                                .font(.body)
                                .foregroundStyle(StudioTheme.mutedInk)
                                .fixedSize(horizontal: false, vertical: true)
                        }

                        TextField("Workshop code", text: $accessCode)
                            .textInputAutocapitalization(.characters)
                            .autocorrectionDisabled()
                            .font(.title3.monospaced().weight(.semibold))
                            .padding(14)
                            .background(StudioTheme.canvas, in: RoundedRectangle(cornerRadius: 12))
                            .focused($codeIsFocused)
                            .accessibilityIdentifier("workshop-access-code")
                            .disabled(isRegistering)

                        Label("Use at least 8 letters, numbers or hyphens.", systemImage: "info.circle")
                            .font(.footnote)
                            .foregroundStyle(accessCodeIsTooShort ? StudioTheme.danger : StudioTheme.mutedInk)

                        if let registrationError {
                            VStack(alignment: .leading, spacing: 4) {
                                Label(registrationError.title, systemImage: "exclamationmark.triangle.fill")
                                    .font(.callout.weight(.semibold))
                                Text(registrationError.message)
                                    .font(.callout)
                            }
                            .foregroundStyle(StudioTheme.danger)
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(StudioTheme.dangerSoft, in: RoundedRectangle(cornerRadius: 12))
                            .accessibilityIdentifier("workshop-access-error")
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
                        .controlSize(.large)
                        .disabled(isRegistering)
                        .accessibilityIdentifier("activate-workshop-access")

                        Text("Your Studio access stays securely on this iPad. You can explore examples without a code and activate Studio from the sidebar whenever you are ready.")
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
            .navigationTitle("Studio access")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(accessDismissalTitle) {
                        if store.workshopAccessState != .ready, store.selectedProjectID == nil {
                            store.selectedSection = .explore
                        }
                        store.dismissWorkshopAccess()
                    }
                    .disabled(isRegistering)
                }
            }
            .onAppear { codeIsFocused = store.workshopAccessState != .ready }
            .onChange(of: accessCode) { _, _ in
                registrationError = nil
            }
        }
        .presentationDetents([.large])
    }

    private var cleanedAccessCode: String {
        accessCode.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var accessDismissalTitle: String {
        if store.workshopAccessState == .ready { return "Done" }
        return store.selectedProjectID == nil ? "Explore examples" : "Not now"
    }

    private var accessCodeIsTooShort: Bool {
        !cleanedAccessCode.isEmpty && cleanedAccessCode.count < 8
    }

    private func register() {
        guard !isRegistering else { return }
        guard !cleanedAccessCode.isEmpty else {
            registrationError = StudioErrorPresentation(
                title: "Enter your facilitator code",
                message: "Ask your workshop facilitator for the code that activates Studio on this iPad.",
                requestsWorkshopAccess: false
            )
            codeIsFocused = true
            return
        }
        guard !accessCodeIsTooShort else {
            registrationError = StudioErrorPresentation(
                title: "Add a few more characters",
                message: "Facilitator codes are at least 8 characters. Your code is still in the field above.",
                requestsWorkshopAccess: false
            )
            codeIsFocused = true
            return
        }
        isRegistering = true
        registrationError = nil
        codeIsFocused = false
        Task { @MainActor in
            defer { isRegistering = false }
            do {
                try await store.registerWorkshopAccess(accessCode)
            } catch {
                registrationError = store.present(error, during: .activation)
                codeIsFocused = true
            }
        }
    }
}
