import AppKit
import AVFoundation
import CoreMedia

@MainActor
final class DisplayPreviewView: NSView {
    private enum PendingClick {
        case idle(CGPoint)
        case live(CGPoint, UInt64)
    }

    var onIdlePrimaryClick: (() -> Void)?
    var onCompletedPrimaryClick: ((CGPoint, UInt64) -> Void)?
    var onGeometryInvalidated: (() -> Void)?
    private let videoLayer = AVSampleBufferDisplayLayer()
    private var sourceSize: CGSize?
    private var pendingClick: PendingClick?
    private var idleStartEnabled = false
    private(set) var geometryToken: UInt64 = 0

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        wantsLayer = true
        layer?.backgroundColor = NSColor.black.cgColor
        videoLayer.videoGravity = .resizeAspect
        layer?.addSublayer(videoLayer)
        setAccessibilityRole(.image)
        setAccessibilityLabel("Live image of the selected display")
        addCursorRect(bounds, cursor: .crosshair)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func layout() {
        super.layout()
        videoLayer.frame = bounds
        geometryToken &+= 1
        discardPendingClick()
        onGeometryInvalidated?()
    }

    override func resetCursorRects() { addCursorRect(bounds, cursor: .crosshair) }
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }

    @discardableResult
    func display(_ sampleBuffer: CMSampleBuffer, sourceSize: CGSize) -> Bool {
        prepareForLiveInteraction(sourceSize: sourceSize)
        videoLayer.enqueue(sampleBuffer)
        guard videoLayer.status != .failed else {
            clear()
            return false
        }
        return true
    }

    func prepareForLiveInteraction(sourceSize: CGSize) {
        if self.sourceSize != sourceSize {
            geometryToken &+= 1
            discardPendingClick()
            onGeometryInvalidated?()
        }
        self.sourceSize = sourceSize
    }

    func setIdleStartEnabled(_ enabled: Bool) {
        if idleStartEnabled != enabled { discardPendingClick() }
        idleStartEnabled = enabled
    }

    func clear() {
        sourceSize = nil
        geometryToken &+= 1
        discardPendingClick()
        videoLayer.flushAndRemoveImage()
    }

    func fittedImageRectTopLeft() -> CGRect? {
        guard let sourceSize,
              let appKitRect = DisplayPreviewGeometry.aspectFit(contentSize: sourceSize, in: bounds)
        else { return nil }
        return CGRect(
            x: appKitRect.minX,
            y: bounds.minY + bounds.maxY - appKitRect.maxY,
            width: appKitRect.width,
            height: appKitRect.height
        )
    }

    override func mouseDown(with event: NSEvent) {
        let point = convert(event.locationInWindow, from: nil)
        guard event.buttonNumber == 0,
              event.modifierFlags.intersection(.deviceIndependentFlagsMask).isEmpty
        else { return }
        if let topLeft = DisplayPreviewGeometry.topLeftPoint(appKitPoint: point, viewBounds: bounds),
           fittedImageRectTopLeft()?.contains(topLeft) == true {
            pendingClick = .live(point, geometryToken)
        } else if sourceSize == nil, idleStartEnabled {
            pendingClick = .idle(point)
        }
    }

    override func mouseDragged(with event: NSEvent) { discardPendingClick() }

    override func mouseUp(with event: NSEvent) {
        guard event.buttonNumber == 0,
              event.modifierFlags.intersection(.deviceIndependentFlagsMask).isEmpty,
              let pendingClick
        else { discardPendingClick(); return }
        let up = convert(event.locationInWindow, from: nil)
        discardPendingClick()
        switch pendingClick {
        case .idle(let down):
            guard idleStartEnabled, sourceSize == nil, hypot(up.x - down.x, up.y - down.y) < 4 else { return }
            onIdlePrimaryClick?()
        case .live(let down, let token):
            guard token == geometryToken, sourceSize != nil,
                  hypot(up.x - down.x, up.y - down.y) < 4,
                  let topLeft = DisplayPreviewGeometry.topLeftPoint(appKitPoint: up, viewBounds: bounds),
                  fittedImageRectTopLeft()?.contains(topLeft) == true
            else { return }
            onCompletedPrimaryClick?(topLeft, token)
        }
    }

    func discardPendingClick() {
        pendingClick = nil
    }

    override func accessibilityPerformPress() -> Bool {
        guard idleStartEnabled, sourceSize == nil else { return false }
        onIdlePrimaryClick?()
        return true
    }
}
