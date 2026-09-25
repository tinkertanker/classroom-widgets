import AppKit

/// The menu bar mark: the timer ring with the spent time cut away and the
/// hamster (two circles) in its face. Same geometry as
/// `assets/app-icon/menu-bar-glyph.svg`, which `scripts/generateAppIcons.mjs` draws.
enum DashboardMenuBarIcon {
    /// Share of the dial the resting mark shows as still to run.
    static let restingRemaining: CGFloat = 250.0 / 360.0

    private static let statusItemIcon = makeImage(size: 21, remaining: restingRemaining)

    /// - Parameter remaining: share of the dial still to run, from 0 (time's up)
    ///   to 1 (full ring). The band shortens anticlockwise towards 12 o'clock.
    static func make(size: CGFloat = 18, remaining: CGFloat = restingRemaining) -> NSImage {
        if size == 21 && remaining == restingRemaining {
            return statusItemIcon
        }
        return makeImage(size: size, remaining: remaining)
    }

    private static func makeImage(size: CGFloat, remaining: CGFloat) -> NSImage {
        let image = NSImage(size: NSSize(width: size, height: size), flipped: false) { rect in
            NSColor.labelColor.set()

            let center = CGPoint(x: rect.midX, y: rect.midY)
            let outerRadius = size * 0.38
            let bandWidth = outerRadius * 0.365
            let trackWidth = outerRadius * 0.115
            let faceRadius = outerRadius - bandWidth

            // Thin track: the whole dial, on the band's inner edge.
            let track = NSBezierPath()
            track.appendArc(withCenter: center, radius: faceRadius + trackWidth / 2, startAngle: 0, endAngle: 360)
            track.lineWidth = trackWidth
            track.stroke()

            // Band: clockwise from 12 o'clock for the remaining share, round caps included.
            let bandRadius = outerRadius - bandWidth / 2
            let sweep = 360 * min(max(remaining, 0), 1)
            let capDegrees = (bandWidth / 2) / bandRadius * 180 / .pi
            if sweep >= 360 {
                let band = NSBezierPath()
                band.appendArc(withCenter: center, radius: bandRadius, startAngle: 0, endAngle: 360)
                band.lineWidth = bandWidth
                band.stroke()
            } else if sweep > capDegrees * 2 {
                let band = NSBezierPath()
                band.appendArc(
                    withCenter: center,
                    radius: bandRadius,
                    startAngle: 90 - capDegrees,
                    endAngle: 90 - (sweep - capDegrees),
                    clockwise: true
                )
                band.lineWidth = bandWidth
                band.lineCapStyle = .round
                band.stroke()
            } else if sweep > 0 {
                let angle = (90 - sweep / 2) * .pi / 180
                let dotRadius = bandWidth / 2 * max(0.35, sweep / (capDegrees * 2))
                let dotCenter = CGPoint(x: center.x + bandRadius * cos(angle), y: center.y + bandRadius * sin(angle))
                NSBezierPath(ovalIn: NSRect(x: dotCenter.x - dotRadius, y: dotCenter.y - dotRadius, width: dotRadius * 2, height: dotRadius * 2)).fill()
            }

            // Hamster: body and a slightly higher head, facing right.
            for (x, y, radius) in [(-0.17, -0.07, 0.44), (0.37, 0.05, 0.29)] as [(CGFloat, CGFloat, CGFloat)] {
                let r = faceRadius * radius
                let circleCenter = CGPoint(x: center.x + faceRadius * x, y: center.y + faceRadius * y)
                NSBezierPath(ovalIn: NSRect(x: circleCenter.x - r, y: circleCenter.y - r, width: r * 2, height: r * 2)).fill()
            }

            return true
        }

        image.isTemplate = true
        image.accessibilityDescription = "Classroom Widgets"
        return image
    }
}
