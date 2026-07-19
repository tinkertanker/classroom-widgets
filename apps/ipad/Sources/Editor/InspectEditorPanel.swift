import SwiftUI
import UIKit

struct InspectEditorPanel: View {
    let project: WidgetProject
    @State private var copied = false

    var body: some View {
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
                        UIPasteboard.general.string = project.spec.prettyPrintedJSON()
                        copied = true
                    }
                    .font(.caption)
                }

                Text(project.spec.prettyPrintedJSON())
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
