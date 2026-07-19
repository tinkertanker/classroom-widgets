import SwiftUI

struct PageHeader: View {
    let title: String
    let subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.largeTitle.weight(.semibold))
                .foregroundStyle(StudioTheme.ink)
            Text(subtitle)
                .font(.body)
                .foregroundStyle(StudioTheme.mutedInk)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: 720, alignment: .leading)
    }
}
