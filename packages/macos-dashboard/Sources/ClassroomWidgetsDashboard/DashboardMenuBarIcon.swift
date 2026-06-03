import AppKit

enum DashboardMenuBarIcon {
    static func make(size: CGFloat = 18) -> NSImage {
        let image = NSImage(size: NSSize(width: size, height: size), flipped: false) { rect in
            NSColor.labelColor.setFill()
            let symbolScale = 0.8
            let cellSize = size * symbolScale * (5.0 / 24.0)
            let gap = size * symbolScale * (2.0 / 24.0)
            let gridSize = cellSize * 3 + gap * 2
            let origin = CGPoint(
                x: rect.midX - gridSize / 2,
                y: rect.midY - gridSize / 2
            )
            let radius = max(1, size * symbolScale * (1.0 / 24.0))

            for row in 0..<3 {
                for column in 0..<3 {
                    let cellRect = NSRect(
                        x: origin.x + CGFloat(column) * (cellSize + gap),
                        y: origin.y + CGFloat(2 - row) * (cellSize + gap),
                        width: cellSize,
                        height: cellSize
                    )
                    NSBezierPath(roundedRect: cellRect, xRadius: radius, yRadius: radius).fill()
                }
            }

            return true
        }

        image.isTemplate = true
        image.accessibilityDescription = "Classroom Widgets"
        return image
    }
}
