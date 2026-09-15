import CoreGraphics

struct DisplayPreviewFrameGeometry: Equatable {
    let imageRect: CGRect
    let sourceBounds: CGRect
    let sourceID: CGDirectDisplayID
    let topologyRevision: UInt64
}

enum DisplayPreviewGeometry {
    static func aspectFit(contentSize: CGSize, in bounds: CGRect) -> CGRect? {
        guard contentSize.isFinitePositive, bounds.isFinitePositive else { return nil }
        let scale = min(bounds.width / contentSize.width, bounds.height / contentSize.height)
        let size = CGSize(width: contentSize.width * scale, height: contentSize.height * scale)
        return CGRect(
            x: bounds.midX - size.width / 2,
            y: bounds.midY - size.height / 2,
            width: size.width,
            height: size.height
        )
    }

    /// Maps a point expressed from the top-left of the preview view to Quartz
    /// global coordinates. The right and bottom edges are deliberately open.
    static func target(
        topLeftPoint point: CGPoint,
        geometry: DisplayPreviewFrameGeometry,
        currentTopologyRevision: UInt64
    ) -> CGPoint? {
        let image = geometry.imageRect
        let source = geometry.sourceBounds
        guard geometry.topologyRevision == currentTopologyRevision,
              point.isFinite, image.isFinitePositive, source.isFinitePositive
        else { return nil }

        let u = (point.x - image.minX) / image.width
        let v = (point.y - image.minY) / image.height
        guard u.isFinite, v.isFinite, u >= 0, u < 1, v >= 0, v < 1 else { return nil }

        let x = min(source.minX + u * source.width, source.maxX - 1)
        let y = min(source.minY + v * source.height, source.maxY - 1)
        guard x.isFinite, y.isFinite else { return nil }
        return CGPoint(x: x, y: y)
    }

    static func topLeftPoint(appKitPoint: CGPoint, viewBounds: CGRect) -> CGPoint? {
        guard appKitPoint.isFinite, viewBounds.isFinitePositive else { return nil }
        return CGPoint(x: appKitPoint.x, y: viewBounds.minY + viewBounds.maxY - appKitPoint.y)
    }
}

private extension CGPoint {
    var isFinite: Bool { x.isFinite && y.isFinite }
}

private extension CGSize {
    var isFinitePositive: Bool {
        width.isFinite && height.isFinite && width > 0 && height > 0
    }
}

private extension CGRect {
    var isFinitePositive: Bool {
        origin.x.isFinite && origin.y.isFinite && size.isFinitePositive
    }
}
