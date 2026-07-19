import SwiftUI
import UIKit

struct InspectEditorPanel: View {
    let project: WidgetProject
    @State private var copied = false

    var body: some View {
        let formattedJSON = project.spec.prettyPrintedJSON()
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 8) {
                    inspectionRow(label: "Schema", value: project.spec.schemaVersion)
                    inspectionRow(label: "Screens", value: "\(project.spec.screens.count)")
                    inspectionRow(label: "Components", value: "\(project.spec.componentCount)")
                }
                .padding(14)
                .background(StudioTheme.canvas, in: RoundedRectangle(cornerRadius: 12))

                HStack {
                    Text("Widget structure")
                        .font(.headline)
                    Spacer()
                    Button(copied ? "Copied" : "Copy JSON") {
                        UIPasteboard.general.string = formattedJSON
                        copied = true
                        Task { @MainActor in
                            try? await Task.sleep(for: .seconds(2))
                            copied = false
                        }
                    }
                    .font(.caption)
                }

                Text(formattedJSON)
                    .font(.system(.caption, design: .monospaced))
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(14)
                    .background(StudioTheme.canvas, in: RoundedRectangle(cornerRadius: 12))
                    .foregroundStyle(StudioTheme.ink)
            }
            .padding(18)
        }
    }

    private func inspectionRow(label: String, value: String) -> some View {
        HStack {
            Text(label)
                .foregroundStyle(StudioTheme.mutedInk)
            Spacer()
            Text(value)
                .fontWeight(.semibold)
                .foregroundStyle(StudioTheme.ink)
        }
        .font(.subheadline)
    }
}
