import SwiftUI

enum StudioTheme {
    static let canvas = Color(red: 247 / 255, green: 245 / 255, blue: 242 / 255)
    static let surface = Color(red: 253 / 255, green: 252 / 255, blue: 251 / 255)
    static let sage = Color(red: 76 / 255, green: 115 / 255, blue: 91 / 255)
    static let sageSoft = Color(red: 226 / 255, green: 236 / 255, blue: 229 / 255)
    static let terracotta = Color(red: 178 / 255, green: 101 / 255, blue: 76 / 255)
    static let terracottaSoft = Color(red: 247 / 255, green: 231 / 255, blue: 225 / 255)
    static let ink = Color(red: 52 / 255, green: 51 / 255, blue: 48 / 255)
    static let mutedInk = Color(red: 104 / 255, green: 101 / 255, blue: 96 / 255)
    static let border = Color(red: 220 / 255, green: 216 / 255, blue: 210 / 255)
}

struct StudioCardModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(StudioTheme.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(StudioTheme.border.opacity(0.8), lineWidth: 1)
            }
            .shadow(color: .black.opacity(0.04), radius: 10, y: 4)
    }
}

extension View {
    func studioCard() -> some View {
        modifier(StudioCardModifier())
    }
}
