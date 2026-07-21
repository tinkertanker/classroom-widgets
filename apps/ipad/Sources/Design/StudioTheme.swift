import SwiftUI

enum StudioTheme {
    // Tinkercademy coral is reserved for brand punctuation. Denim carries
    // everyday interaction so the mascot and brand moments stay distinctive.
    static let canvas = Color(red: 248 / 255, green: 246 / 255, blue: 241 / 255)
    static let surface = Color.white
    static let accent = Color(red: 49 / 255, green: 92 / 255, blue: 140 / 255)
    static let accentBright = Color(red: 240 / 255, green: 93 / 255, blue: 87 / 255)
    static let accentSoft = Color(red: 231 / 255, green: 239 / 255, blue: 248 / 255)
    static let danger = Color(red: 154 / 255, green: 44 / 255, blue: 39 / 255)
    static let dangerSoft = Color(red: 251 / 255, green: 231 / 255, blue: 229 / 255)
    static let ink = Color(red: 48 / 255, green: 51 / 255, blue: 58 / 255)
    static let mutedInk = Color(red: 102 / 255, green: 104 / 255, blue: 109 / 255)
    static let border = Color(red: 223 / 255, green: 222 / 255, blue: 218 / 255)

    enum Typography {
        static let display = Font.system(.largeTitle, design: .rounded, weight: .bold)
        static let question = Font.system(.title, design: .rounded, weight: .bold)
        static let section = Font.system(.headline, design: .rounded, weight: .semibold)
        static let cardTitle = Font.system(.title3, design: .rounded, weight: .semibold)
        static let eyebrow = Font.system(.caption, design: .rounded, weight: .semibold)
        static let actionSmall = Font.system(.subheadline, design: .rounded, weight: .semibold)
    }
}

struct StudioCardModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(StudioTheme.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .stroke(StudioTheme.border.opacity(0.72), lineWidth: 1)
            }
            .shadow(color: StudioTheme.ink.opacity(0.055), radius: 18, y: 8)
    }
}

extension View {
    func studioCard() -> some View {
        modifier(StudioCardModifier())
    }
}
