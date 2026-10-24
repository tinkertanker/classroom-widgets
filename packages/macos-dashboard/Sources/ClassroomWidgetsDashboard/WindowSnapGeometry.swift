import CoreGraphics

/// Where a window's position menu can put it on its current screen (Display and widget panels).
enum WindowSnapPreset: String, CaseIterable {
    case leftHalf, rightHalf, topHalf, bottomHalf
    case topLeft, topRight, bottomLeft, bottomRight
    case centre, fill

    var title: String {
        switch self {
        case .leftHalf: return "Left Half"
        case .rightHalf: return "Right Half"
        case .topHalf: return "Top Half"
        case .bottomHalf: return "Bottom Half"
        case .topLeft: return "Top Left"
        case .topRight: return "Top Right"
        case .bottomLeft: return "Bottom Left"
        case .bottomRight: return "Bottom Right"
        case .centre: return "Centre"
        case .fill: return "Fill Screen"
        }
    }

    /// Menu groups, separated in the layout menu.
    static let groups: [[WindowSnapPreset]] = [
        [.leftHalf, .rightHalf, .topHalf, .bottomHalf],
        [.topLeft, .topRight, .bottomLeft, .bottomRight],
        [.centre, .fill]
    ]
}

enum WindowSnapGeometry {
    private enum Span { case low, high, full }

    /// [horizontal, vertical] spans in AppKit coordinates: `.high` vertical is the top.
    private static func spans(for preset: WindowSnapPreset) -> (Span, Span) {
        switch preset {
        case .leftHalf: return (.low, .full)
        case .rightHalf: return (.high, .full)
        case .topHalf: return (.full, .high)
        case .bottomHalf: return (.full, .low)
        case .topLeft: return (.low, .high)
        case .topRight: return (.high, .high)
        case .bottomLeft: return (.low, .low)
        case .bottomRight: return (.high, .low)
        case .centre, .fill: return (.full, .full)
        }
    }

    private static func region(_ span: Span, start: CGFloat, length: CGFloat, gap: CGFloat) -> (CGFloat, CGFloat) {
        guard span != .full else { return (start, length) }
        let half = max((length - gap) / 2, 1)
        return span == .low ? (start, half) : (start + length - half, half)
    }

    private static func place(_ span: Span, start: CGFloat, length: CGFloat, size: CGFloat) -> CGFloat {
        switch span {
        case .low: return start
        case .high: return start + length - size
        case .full: return start + (length - size) / 2
        }
    }

    /// Window frame (AppKit screen coordinates) for `preset` on `visibleFrame`.
    /// The preview keeps the source aspect when one is given, so a half is the
    /// largest preview that fits the half, pushed to its edge. Nil when the
    /// input cannot produce a usable frame.
    static func frame(
        for preset: WindowSnapPreset,
        visibleFrame: CGRect,
        aspect: CGFloat?,
        chrome: CGSize,
        minimumFrame: CGSize,
        maximumFrame: CGSize? = nil,
        currentFrame: CGRect,
        margin: CGFloat
    ) -> CGRect? {
        guard visibleFrame.origin.x.isFinite, visibleFrame.origin.y.isFinite,
              visibleFrame.width.isFinite, visibleFrame.height.isFinite,
              visibleFrame.width > 0, visibleFrame.height > 0
        else { return nil }
        let gap = margin.isFinite ? max(margin, 0) : 0
        let area = visibleFrame.width > gap * 2 && visibleFrame.height > gap * 2
            ? visibleFrame.insetBy(dx: gap, dy: gap)
            : visibleFrame
        let (hSpan, vSpan) = spans(for: preset)
        let (rx, rw) = region(hSpan, start: area.minX, length: area.width, gap: gap)
        let (ry, rh) = region(vSpan, start: area.minY, length: area.height, gap: gap)
        let chromeWidth = chrome.width.isFinite ? max(chrome.width, 0) : 0
        let chromeHeight = chrome.height.isFinite ? max(chrome.height, 0) : 0
        let minWidth = minimumFrame.width.isFinite ? max(minimumFrame.width, 1) : 1
        let minHeight = minimumFrame.height.isFinite ? max(minimumFrame.height, 1) : 1
        // The minimum wins if the two conflict.
        let maxWidth = maximumFrame.flatMap { $0.width.isFinite && $0.width > 0 ? $0.width : nil } ?? .greatestFiniteMagnitude
        let maxHeight = maximumFrame.flatMap { $0.height.isFinite && $0.height > 0 ? $0.height : nil } ?? .greatestFiniteMagnitude
        let validAspect = aspect.flatMap { $0.isFinite && $0 > 0 ? $0 : nil }

        var width: CGFloat
        var height: CGFloat
        if preset == .centre {
            guard currentFrame.width.isFinite, currentFrame.height.isFinite,
                  currentFrame.width > 0, currentFrame.height > 0
            else { return nil }
            width = max(min(currentFrame.width, maxWidth), minWidth)
            height = max(min(currentFrame.height, maxHeight), minHeight)
        } else if let aspect = validAspect {
            var scale = min(max(rw - chromeWidth, 1) / aspect, max(rh - chromeHeight, 1))
            scale = min(scale, (maxWidth - chromeWidth) / aspect, maxHeight - chromeHeight)
            // Grow, keeping the aspect, until the window meets its minimum size.
            scale = max(scale, (minWidth - chromeWidth) / aspect, minHeight - chromeHeight)
            width = aspect * scale + chromeWidth
            height = scale + chromeHeight
        } else {
            width = max(min(rw, maxWidth), minWidth)
            height = max(min(rh, maxHeight), minHeight)
        }
        // Never larger than the screen, even if that breaks the aspect on a tiny screen.
        width = min(width, area.width)
        height = min(height, area.height)
        let x = place(hSpan, start: rx, length: rw, size: width)
        let y = place(vSpan, start: ry, length: rh, size: height)
        return CGRect(
            x: max(min(x, area.maxX - width), area.minX),
            y: max(min(y, area.maxY - height), area.minY),
            width: width,
            height: height
        )
    }
}
