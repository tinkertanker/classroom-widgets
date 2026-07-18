import SwiftUI

struct PageHeader: View {
    let eyebrow: String
    let title: String
    let subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(eyebrow.uppercased())
                .font(.caption.weight(.bold))
                .tracking(1.2)
                .foregroundStyle(StudioTheme.sage)
            Text(title)
                .font(.largeTitle.weight(.semibold))
                .foregroundStyle(StudioTheme.ink)
            Text(subtitle)
                .font(.title3)
                .foregroundStyle(StudioTheme.mutedInk)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: 720, alignment: .leading)
    }
}
