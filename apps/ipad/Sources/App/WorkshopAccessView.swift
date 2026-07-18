import SwiftUI

struct WorkshopAccessView: View {
    let store: StudioStore

    @State private var accessCode = ""
    @State private var isRegistering = false
    @State private var registrationError: String?
    @FocusState private var codeIsFocused: Bool

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 24) {
                Image(systemName: "key.viewfinder")
                    .font(.system(size: 48, weight: .semibold))
                    .foregroundStyle(StudioTheme.sage)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Join the workshop")
                        .font(.largeTitle.bold())
                    Text("Enter the one-time access code from your facilitator. It activates private Studio generation and publishing on this iPad — no account or student details required.")
                        .font(.body)
                        .foregroundStyle(StudioTheme.mutedInk)
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
                        .foregroundStyle(StudioTheme.terracotta)
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
                            Label("Activate Studio", systemImage: "arrow.right.circle.fill")
                        }
                        Spacer()
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(isRegistering || accessCode.trimmingCharacters(in: .whitespacesAndNewlines).count < 8)
                .accessibilityIdentifier("activate-workshop-access")

                Text("The code is exchanged once for an encrypted ownership credential kept in this iPad’s Keychain. Do not share the code after using it.")
                    .font(.footnote)
                    .foregroundStyle(StudioTheme.mutedInk)

                Spacer()
            }
            .padding(32)
            .frame(maxWidth: 620, maxHeight: .infinity, alignment: .topLeading)
            .navigationTitle("Workshop access")
            .toolbar {
                if store.workshopAccessState == .ready {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Done") { store.dismissWorkshopAccess() }
                            .disabled(isRegistering)
                    }
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
