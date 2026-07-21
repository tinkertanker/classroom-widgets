import SwiftUI

enum TKRobotSticker: String {
    case greetings = "TKRobotGreetings"
    case handraise = "TKRobotHandraise"
    case happy = "TKRobotHappy"
}

struct TKRobotStickerView: View {
    let sticker: TKRobotSticker
    var size: CGFloat
    var rotation = Angle.zero

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var isVisible = false

    var body: some View {
        Image(sticker.rawValue)
            .resizable()
            .scaledToFit()
            .frame(width: size, height: size)
            .rotationEffect(rotation)
            .scaleEffect(isVisible ? 1 : 0.9)
            .opacity(isVisible ? 1 : 0)
            .accessibilityHidden(true)
            .onAppear {
                if reduceMotion {
                    isVisible = true
                } else {
                    withAnimation(.spring(response: 0.45, dampingFraction: 0.76)) {
                        isVisible = true
                    }
                }
            }
    }
}
