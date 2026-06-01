import AppKit

enum DashboardMenuBarIcon {
    static func make(size: CGFloat = 18) -> NSImage {
        let image = NSImage(size: NSSize(width: size, height: size), flipped: false) { rect in
            let symbolRect = rect.insetBy(dx: size * 0.10, dy: size * 0.11)
            let circleRect = NSRect(
                x: symbolRect.minX,
                y: symbolRect.minY + symbolRect.height * 0.60,
                width: symbolRect.width * 0.34,
                height: symbolRect.width * 0.34
            )
            let topRect = NSRect(
                x: symbolRect.minX + symbolRect.width * 0.48,
                y: symbolRect.minY + symbolRect.height * 0.59,
                width: symbolRect.width * 0.48,
                height: symbolRect.height * 0.25
            )
            let bottomRect = NSRect(
                x: symbolRect.minX,
                y: symbolRect.minY + symbolRect.height * 0.125,
                width: symbolRect.width * 0.50,
                height: symbolRect.height * 0.21
            )
            let squareRect = NSRect(
                x: symbolRect.minX + symbolRect.width * 0.66,
                y: symbolRect.minY + symbolRect.height * 0.08,
                width: symbolRect.width * 0.30,
                height: symbolRect.width * 0.30
            )

            NSColor.labelColor.setFill()
            NSBezierPath(ovalIn: circleRect).fill()
            NSBezierPath(roundedRect: squareRect, xRadius: size * 0.08, yRadius: size * 0.08).fill()

            for pill in [topRect, bottomRect] {
                NSBezierPath(
                    roundedRect: pill,
                    xRadius: pill.height / 2,
                    yRadius: pill.height / 2
                ).fill()
            }

            return true
        }

        image.isTemplate = true
        image.accessibilityDescription = "Classroom Widgets"
        return image
    }
}
