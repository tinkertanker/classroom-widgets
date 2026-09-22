import CoreGraphics

enum MoveDirection {
    case previous
    case next

    var step: Int { self == .next ? 1 : -1 }
}

/// Pure geometry for the "Move to Previous/Next Display" shortcuts. Work
/// areas are ordered by origin (x, then y) and wrap around; the panel keeps
/// its size and its offset from the source work area's origin, clamped into
/// the target work area.
enum WidgetPanelMoveGeometry {
    static func nextDisplayFrame(frame: CGRect, workAreas: [CGRect], direction: MoveDirection = .next) -> CGRect? {
        guard workAreas.count > 1 else { return nil }
        let sorted = workAreas.sorted { lhs, rhs in
            lhs.minX == rhs.minX ? lhs.minY < rhs.minY : lhs.minX < rhs.minX
        }
        guard let sourceIndex = sorted.indices.max(by: {
            overlapArea(sorted[$0], frame) < overlapArea(sorted[$1], frame)
        }), overlapArea(sorted[sourceIndex], frame) > 0 else { return nil }

        let source = sorted[sourceIndex]
        let target = sorted[(sourceIndex + direction.step + sorted.count) % sorted.count]
        return CGRect(
            x: target.minX + frame.minX - source.minX,
            y: target.minY + frame.minY - source.minY,
            width: frame.width,
            height: frame.height
        ).clamped(to: target)
    }

    private static func overlapArea(_ workArea: CGRect, _ frame: CGRect) -> CGFloat {
        frame.intersection(workArea).area
    }
}
