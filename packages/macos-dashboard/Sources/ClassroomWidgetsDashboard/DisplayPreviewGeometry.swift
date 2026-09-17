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

    /// Window frame size whose preview viewport matches the source display aspect,
    /// fitted on whichever side of the proposal is smaller.
    ///
    /// `proposedPreviewSize` is the preview viewport only: the content area minus
    /// the shared 10 pt titlebar gap. `chromeHeight` carries the native titlebar
    /// plus that gap, so callers never mix viewport and window coordinates. The
    /// returned viewport is the largest aspect-correct viewport that fits inside
    /// the proposal, so neither proposed dimension is exceeded unless the native
    /// minimum has to win. Below the minimum the viewport expands uniformly, which
    /// may exceed an undersized proposal but keeps the ratio. The native preview
    /// minimum wins over the physical screen only when an exact ratio cannot
    /// satisfy both, in which case the frame keeps the minimum and fits the screen,
    /// leaving residual letterbox bars to the video layer.
    static func aspectNormalizedWindowSize(
        matchingAspect aspect: CGFloat,
        proposedPreviewSize previewSize: CGSize,
        chromeHeight: CGFloat,
        minimumPreviewSize: CGSize,
        maximumSize: CGSize
    ) -> CGSize {
        let chrome = chromeHeight.isFinite ? max(chromeHeight, 0) : 0
        let fallback = CGSize(width: previewSize.width, height: previewSize.height + chrome)
        guard aspect.isFinite, aspect > 0, previewSize.isFinitePositive else { return fallback }

        let minimum = CGSize(
            width: max(minimumPreviewSize.width, 1),
            height: max(minimumPreviewSize.height, 1)
        )
        let scale = min(previewSize.width / aspect, previewSize.height)
        var width = aspect * scale
        var height = scale
        if width < minimum.width || height < minimum.height {
            let minimumScale = max(minimum.width / aspect, minimum.height)
            width = aspect * minimumScale
            height = minimumScale
        }
        if maximumSize.isFinitePositive {
            let maximumPreviewHeight = max(maximumSize.height - chrome, 1)
            let screenScale = min(1, min(maximumSize.width / width, maximumPreviewHeight / height))
            if screenScale < 1 {
                let scaledWidth = width * screenScale
                let scaledHeight = height * screenScale
                if scaledWidth >= minimum.width, scaledHeight >= minimum.height {
                    width = scaledWidth
                    height = scaledHeight
                } else {
                    // The exact ratio cannot satisfy both the native minimum and the
                    // screen. Honour the minimum, fit the screen where possible, and
                    // let the video layer supply the residual bars.
                    width = max(minimum.width, min(width, maximumSize.width))
                    height = max(minimum.height, min(height, maximumPreviewHeight))
                }
            }
        }
        return CGSize(width: width, height: height + chrome)
    }
}

extension CGRect {
    var area: CGFloat { isNull ? 0 : width * height }

    func clamped(to bounds: CGRect) -> CGRect {
        guard !bounds.isEmpty else { return self }
        let size = CGSize(width: min(width, bounds.width), height: min(height, bounds.height))
        return CGRect(
            x: min(max(minX, bounds.minX), bounds.maxX - size.width),
            y: min(max(minY, bounds.minY), bounds.maxY - size.height),
            width: size.width,
            height: size.height
        )
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
