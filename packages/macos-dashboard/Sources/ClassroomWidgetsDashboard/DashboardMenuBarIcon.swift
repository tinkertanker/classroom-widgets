import AppKit

/// The menu bar mark: the timer ring with the spent time cut away, and the
/// hamster (two circles) standing in that notch. Same geometry as
/// `assets/app-icon/menu-bar-glyph.svg`; `scripts/generateAppIcons.mjs` prints
/// the numbers below when it runs.
enum DashboardMenuBarIcon {
    /// Share of the dial the resting mark shows as still to run.
    static let restingRemaining: CGFloat = 264.0 / 360.0

    // Geometry on a 1024-unit canvas, y pointing down (as in the SVG).
    private static let canvas: CGFloat = 1024
    private static let ringCenter = CGPoint(x: 579.5, y: 550.8)
    private static let outerRadius: CGFloat = 382
    private static let bandWidth: CGFloat = 124.2
    private static let trackWidth: CGFloat = 68.8
    private static let hamsterCircles: [(x: CGFloat, y: CGFloat, radius: CGFloat)] = [(350.1, 257.2, 166), (184.4, 417.2, 122)]
    private static let hamsterGap: CGFloat = 99
    /// Share of the image the 1024 canvas fills.
    private static let artworkScale: CGFloat = 0.85

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
            let scale = size * artworkScale / canvas
            let origin = CGPoint(x: rect.midX - canvas * scale / 2, y: rect.midY - canvas * scale / 2)
            func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
                CGPoint(x: origin.x + x * scale, y: origin.y + (canvas - y) * scale)
            }
            func circle(_ center: CGPoint, _ radius: CGFloat) -> NSBezierPath {
                NSBezierPath(ovalIn: NSRect(x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2))
            }

            NSColor.labelColor.set()
            let center = point(ringCenter.x, ringCenter.y)
            let band = bandWidth * scale
            let track = trackWidth * scale
            let faceRadius = (outerRadius - bandWidth) * scale

            // Thin track: the whole dial, on the band's inner edge.
            let trackPath = NSBezierPath()
            trackPath.appendArc(withCenter: center, radius: faceRadius + track / 2, startAngle: 0, endAngle: 360)
            trackPath.lineWidth = track
            trackPath.stroke()

            // Band: clockwise from 12 o'clock for the remaining share, round caps included.
            let bandRadius = outerRadius * scale - band / 2
            let sweep = 360 * min(max(remaining, 0), 1)
            let capDegrees = (band / 2) / bandRadius * 180 / .pi
            if sweep >= 360 {
                let bandPath = NSBezierPath()
                bandPath.appendArc(withCenter: center, radius: bandRadius, startAngle: 0, endAngle: 360)
                bandPath.lineWidth = band
                bandPath.stroke()
            } else if sweep > capDegrees * 2 {
                let bandPath = NSBezierPath()
                bandPath.appendArc(
                    withCenter: center,
                    radius: bandRadius,
                    startAngle: 90 - capDegrees,
                    endAngle: 90 - (sweep - capDegrees),
                    clockwise: true
                )
                bandPath.lineWidth = band
                bandPath.lineCapStyle = .round
                bandPath.stroke()
            } else if sweep > 0 {
                let angle = (90 - sweep / 2) * .pi / 180
                let dotRadius = band / 2 * max(0.35, sweep / (capDegrees * 2))
                circle(CGPoint(x: center.x + bandRadius * cos(angle), y: center.y + bandRadius * sin(angle)), dotRadius).fill()
            }

            // Hamster: clear a gap around the two circles, then draw them.
            let circles = hamsterCircles.map { (point($0.x, $0.y), $0.radius * scale) }
            NSGraphicsContext.current?.compositingOperation = .clear
            for (circleCenter, radius) in circles {
                circle(circleCenter, radius + hamsterGap * scale).fill()
            }
            NSGraphicsContext.current?.compositingOperation = .sourceOver
            for (circleCenter, radius) in circles {
                circle(circleCenter, radius).fill()
            }

            return true
        }

        image.isTemplate = true
        image.accessibilityDescription = "Classroom Widgets"
        return image
    }
}
