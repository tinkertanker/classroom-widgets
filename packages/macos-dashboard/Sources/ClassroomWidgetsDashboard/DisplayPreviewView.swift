import AppKit
import AVFoundation
import CoreMedia

@MainActor
final class DisplayPreviewView: NSView {
    private enum PendingClick {
        case idle(CGPoint)
        case live(CGPoint, UInt64)
    }

    // Caps Lock is a typing state, not a modified mouse gesture.
    private static let clickModifierMask = NSEvent.ModifierFlags.deviceIndependentFlagsMask.subtracting(.capsLock)

    var onIdlePrimaryClick: (() -> Void)?
    var onCompletedPrimaryClick: ((CGPoint, UInt64) -> Void)?
    var onGeometryInvalidated: (() -> Void)?
    var onLayoutChanged: (() -> Void)?
    private let videoLayer = AVSampleBufferDisplayLayer()
    private var sourceSize: CGSize?
    private var pendingClick: PendingClick?
    private var idleStartEnabled = false
    private var isStale = false
    private(set) var geometryToken: UInt64 = 0

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        wantsLayer = true
        layer?.backgroundColor = NSColor.black.cgColor
        videoLayer.videoGravity = .resizeAspect
        layer?.addSublayer(videoLayer)
        setAccessibilityElement(true)
        updateAccessibility()
        addCursorRect(bounds, cursor: .crosshair)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func layout() {
        super.layout()
        videoLayer.frame = bounds
        geometryToken &+= 1
        discardPendingClick()
        onLayoutChanged?()
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
        isStale = false
        setIdleStartEnabled(false)
        updateAccessibility()
    }

    /// Marks the retained image as stale while a frame gap is being held. The
    /// image stays visible, but it no longer advertises a live preview and stale
    /// pointer actions are refused until a usable new frame arrives.
    func setImageStale(_ stale: Bool) {
        guard isStale != stale else { return }
        isStale = stale
        if stale {
            discardPendingClick()
            onGeometryInvalidated?()
        }
        updateAccessibility()
    }

    func setIdleStartEnabled(_ enabled: Bool) {
        if idleStartEnabled != enabled { discardPendingClick() }
        idleStartEnabled = enabled
        updateAccessibility()
    }

    func clear() {
        sourceSize = nil
        isStale = false
        geometryToken &+= 1
        discardPendingClick()
        onGeometryInvalidated?()
        videoLayer.flushAndRemoveImage()
        updateAccessibility()
    }

    func fittedImageRectTopLeft() -> CGRect? {
        guard !isStale, let sourceSize,
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
              event.modifierFlags.intersection(Self.clickModifierMask).isEmpty
        else { return }
        if !isStale,
           let topLeft = DisplayPreviewGeometry.topLeftPoint(appKitPoint: point, viewBounds: bounds),
           fittedImageRectTopLeft()?.contains(topLeft) == true {
            pendingClick = .live(point, geometryToken)
        } else if sourceSize == nil, idleStartEnabled, bounds.contains(point) {
            pendingClick = .idle(point)
        }
    }

    override func mouseDragged(with event: NSEvent) { discardPendingClick() }

    override func mouseUp(with event: NSEvent) {
        guard event.buttonNumber == 0,
              event.modifierFlags.intersection(Self.clickModifierMask).isEmpty,
              let pendingClick
        else { discardPendingClick(); return }
        let up = convert(event.locationInWindow, from: nil)
        discardPendingClick()
        switch pendingClick {
        case .idle(let down):
            guard idleStartEnabled, sourceSize == nil, bounds.contains(up),
                  hypot(up.x - down.x, up.y - down.y) < 4
            else { return }
            onIdlePrimaryClick?()
        case .live(let down, let token):
            guard !isStale, token == geometryToken, sourceSize != nil,
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

    override func isAccessibilitySelectorAllowed(_ selector: Selector) -> Bool {
        if selector == NSSelectorFromString("accessibilityPerformPress") {
            return idleStartEnabled && sourceSize == nil
        }
        return super.isAccessibilitySelectorAllowed(selector)
    }

    private func updateAccessibility() {
        if isStale, sourceSize != nil {
            setAccessibilityRole(.image)
            setAccessibilityLabel("Display preview reconnecting")
            setAccessibilityHelp("Holding the last image until a usable frame arrives")
        } else if idleStartEnabled, sourceSize == nil {
            setAccessibilityRole(.button)
            setAccessibilityLabel("Click to see display")
            setAccessibilityHelp("Starts the selected display preview")
        } else {
            setAccessibilityRole(.image)
            setAccessibilityLabel(sourceSize == nil ? "Display preview" : "Live image of the selected display")
            setAccessibilityHelp("Display preview image")
        }
    }
}
