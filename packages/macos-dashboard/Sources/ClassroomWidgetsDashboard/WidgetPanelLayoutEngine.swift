import AppKit

/// Descriptor sizes refer to the web viewport, not the transparent space below the titlebar.
enum WidgetPanelContentLayout {
    static let topGap: CGFloat = 10

    static func panelSize(for webSize: NSSize) -> NSSize {
        NSSize(width: webSize.width, height: webSize.height + topGap)
    }

    static func constrainedSize(
        _ proposed: NSSize,
        current: NSSize,
        descriptor: WidgetPanelDescriptor
    ) -> NSSize {
        guard descriptor.isResizable,
              let ratio = descriptor.aspectRatio, ratio > 0 else { return proposed }
        let minimum = descriptor.minimumContentSize.cgSize
        let maximum = descriptor.maximumContentSize?.cgSize
        let minimumWidth = max(minimum.width, minimum.height * ratio)
        let maximumWidth = min(maximum?.width ?? .greatestFiniteMagnitude,
                               (maximum?.height ?? .greatestFiniteMagnitude) * ratio)
        let width = abs(proposed.width - current.width) >= abs(proposed.height - current.height) * ratio
            ? proposed.width
            : (proposed.height - topGap) * ratio
        let constrainedWidth = max(minimumWidth, min(width, maximumWidth))
        return panelSize(for: NSSize(width: constrainedWidth, height: constrainedWidth / ratio))
    }
}

enum WidgetPanelLayoutEngine {
    static func frames(
        for panels: [(id: String, size: NSSize)],
        layout: WidgetPanelLayout,
        usableFrame: NSRect,
        gap: CGFloat = 12
    ) -> [String: NSRect] {
        var frames: [String: NSRect] = [:]
        switch layout {
        case .freeform:
            return frames
        case .row:
            var x = usableFrame.minX
            var y = usableFrame.maxY
            var rowHeight: CGFloat = 0
            for (index, panel) in panels.enumerated() {
                let size = constrained(panel.size, to: usableFrame.size)
                if x + size.width > usableFrame.maxX, x > usableFrame.minX {
                    x = usableFrame.minX
                    y -= rowHeight + gap
                    rowHeight = 0
                }
                if y - size.height < usableFrame.minY {
                    addCascadedFrames(for: panels[index...], to: &frames, usableFrame: usableFrame, gap: gap)
                    return frames
                }
                frames[panel.id] = NSRect(x: x, y: y - size.height, width: size.width, height: size.height)
                x += size.width + gap
                rowHeight = max(rowHeight, size.height)
            }
        case .column:
            var y = usableFrame.maxY
            var x = usableFrame.minX
            var columnWidth: CGFloat = 0
            for (index, panel) in panels.enumerated() {
                let size = constrained(panel.size, to: usableFrame.size)
                if y - size.height < usableFrame.minY, y < usableFrame.maxY {
                    x += columnWidth + gap
                    y = usableFrame.maxY
                    columnWidth = 0
                }
                if x + size.width > usableFrame.maxX {
                    addCascadedFrames(for: panels[index...], to: &frames, usableFrame: usableFrame, gap: gap)
                    return frames
                }
                y -= size.height
                frames[panel.id] = NSRect(x: x, y: y, width: size.width, height: size.height)
                y -= gap
                columnWidth = max(columnWidth, size.width)
            }
        }
        return frames
    }

    private static func addCascadedFrames(
        for panels: ArraySlice<(id: String, size: NSSize)>,
        to frames: inout [String: NSRect],
        usableFrame: NSRect,
        gap: CGFloat
    ) {
        let panelCount = CGFloat(panels.count)
        for (index, panel) in panels.enumerated() {
            let size = constrained(panel.size, to: usableFrame.size)
            let availableOffset = min(usableFrame.width - size.width, usableFrame.height - size.height)
            let step = min(gap, max(0, availableOffset) / panelCount)
            let offset = CGFloat(index + 1) * step
            frames[panel.id] = NSRect(
                x: usableFrame.minX + offset,
                y: usableFrame.maxY - size.height - offset,
                width: size.width,
                height: size.height
            )
        }
    }

    private static func constrained(_ size: NSSize, to maximumSize: NSSize) -> NSSize {
        NSSize(width: min(size.width, maximumSize.width), height: min(size.height, maximumSize.height))
    }
}
