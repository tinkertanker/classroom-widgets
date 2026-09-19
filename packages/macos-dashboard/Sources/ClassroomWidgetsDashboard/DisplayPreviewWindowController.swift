import AppKit
import CoreMedia

@MainActor
final class DisplayPreviewWindowController: NSWindowController, NSWindowDelegate, NSMenuItemValidation {
    static let powerToggleIdentifier = NSUserInterfaceItemIdentifier("displayPreviewPowerToggle")

    let previewView = DisplayPreviewView(frame: .zero)
    var presentedGeometry: DisplayPreviewFrameGeometry?
    var onSourceSelected: ((CGDirectDisplayID?) -> Void)?
    var onToggleCapture: (() -> Void)?
    var onMoveToCenter: (() -> Void)?
    var onClose: (() -> Void)?
    var onFrameChanged: ((NSRect) -> Void)?
    var onVisibilityChanged: ((Bool) -> Void)?

    private let captureButton = NSButton()
    private let menuButton = NSButton()
    private let statusLabel = NonInteractiveStatusLabel(labelWithString: "Choose a display to preview.")
    private let statusBackdrop = DisplayStatusEffectView()
    private let chromeBackground = DisplayStatusEffectView()
    private var compactControls: NSView?
    private var compactAccessoryController: NSTitlebarAccessoryViewController?
    private weak var chromeTrackingView: NSView?
    private var chromeTrackingArea: NSTrackingArea?
    private var chromeHideGeneration = 0
    private var chromeVisible = false
    private var sources: [DisplayDescriptor] = []
    private var selectedSourceID: CGDirectDisplayID?
    private var lastNormalizedSourceAspect: CGFloat?
    private var isNormalizingAspect = false
    private var statusText = "Choose a display to preview."
    private var centerEnabled = false

    init(frame: NSRect, backgroundOpacity: Double, keepOnAllSpaces: Bool) {
        let minimumContentSize = NSSize(width: 320, height: 240)
        let panel = NSPanel(
            contentRect: NSRect(
                origin: .zero,
                size: NSSize(
                    width: max(frame.width, minimumContentSize.width),
                    height: max(frame.height, minimumContentSize.height)
                )
            ),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        panel.title = "Display"
        panel.isFloatingPanel = true
        panel.level = .floating
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.titlebarAppearsTransparent = true
        panel.hidesOnDeactivate = false
        panel.acceptsMouseMovedEvents = true
        panel.isReleasedWhenClosed = false
        panel.contentMinSize = minimumContentSize
        super.init(window: panel)
        panel.delegate = self
        configureContent(in: panel)
        // `frame` is a window frame, matching the value persisted from `window.frame`.
        panel.setFrame(frame, display: false)
        previewView.onIdlePrimaryClick = { [weak self] in self?.toggleCapture() }
        previewView.onGeometryInvalidated = { [weak self] in self?.presentedGeometry = nil }
        previewView.onLayoutChanged = { [weak self] in self?.refreshPresentedGeometry() }
        addCompactAccessories(to: panel)
        installChromeTracking(on: panel)
        applyPresentationSettings(backgroundOpacity: backgroundOpacity, keepOnAllSpaces: keepOnAllSpaces)
        revealChrome()
        scheduleChromeHide()
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func applyPresentationSettings(backgroundOpacity: Double, keepOnAllSpaces: Bool) {
        guard let window else { return }
        window.backgroundColor = .clear
        window.isOpaque = false
        statusBackdrop.alphaValue = min(max(backgroundOpacity, 0), 1)
        var behavior: NSWindow.CollectionBehavior = [.fullScreenAuxiliary]
        if keepOnAllSpaces { behavior.insert(.canJoinAllSpaces) }
        window.collectionBehavior = behavior
    }

    func setSources(_ sources: [DisplayDescriptor], selectedID: CGDirectDisplayID?) {
        self.sources = sources
        selectedSourceID = sources.contains(where: { $0.id == selectedID }) ? selectedID : nil
        menuButton.isEnabled = !sources.isEmpty
        updateMenuAccessibility()
        normalizeSelectedSourceAspectIfNeeded()
    }

    /// Preview viewport size: the content layout area minus the shared titlebar gap.
    var previewSize: NSSize {
        guard let window else { return .zero }
        let layout = window.contentLayoutRect
        return NSSize(width: layout.width, height: max(layout.height - WidgetPanelContentLayout.topGap, 1))
    }

    /// Native titlebar plus the shared 10 pt gap. Measured from the live window so
    /// callers never have to hard-code chrome height.
    var previewChromeHeight: CGFloat {
        guard let window else { return 0 }
        let contentHeight = window.contentLayoutRect.height
        guard contentHeight > 0 else { return 0 }
        return max(window.frame.height - contentHeight, 0) + WidgetPanelContentLayout.topGap
    }

    var currentSourceAspect: CGFloat? {
        guard let selectedSourceID,
              let source = sources.first(where: { $0.id == selectedSourceID }),
              source.bounds.width > 0, source.bounds.height > 0
        else { return nil }
        return source.bounds.width / source.bounds.height
    }

    /// One-shot snap of the preview viewport to the source display aspect, keeping
    /// the current location. Ongoing resizing keeps the same smaller-side fit, so
    /// this menu action only re-snaps on demand.
    @discardableResult
    func matchSourceAspect(_ aspect: CGFloat, animated: Bool) -> Bool {
        guard let window, aspect.isFinite, aspect > 0 else { return false }
        let visibleFrame = Self.aspectConstrainingFrame(for: window)
        guard !visibleFrame.isEmpty else { return false }
        let size = DisplayPreviewGeometry.aspectNormalizedWindowSize(
            matchingAspect: aspect,
            proposedPreviewSize: previewSize,
            chromeHeight: previewChromeHeight,
            minimumPreviewSize: minimumPreviewSize,
            maximumSize: visibleFrame.size
        )
        let target = NSRect(origin: window.frame.origin, size: size).clamped(to: visibleFrame)
        guard !target.isEmpty else { return false }
        // A valid source reports success even when the viewport already matches, so a
        // repeated snap is a no-op instead of another frame change. A clamped origin
        // still moves, which keeps the bounded placement behavior for a frame that is
        // off screen even though its size is already correct.
        guard frameDiffers(target.size, from: window.frame.size, in: window)
            || target.origin != window.frame.origin
        else { return true }
        window.setFrame(target, display: true, animate: animated)
        return true
    }

    @discardableResult
    func matchCurrentSourceAspect(animated: Bool = true) -> Bool {
        guard let aspect = currentSourceAspect else { return false }
        return matchSourceAspect(aspect, animated: animated)
    }

    /// Re-fits the viewport when the selected source aspect changed, so a source or
    /// resolution change never leaves the old ratio behind until the next manual
    /// resize. An unchanged source is a no-op and emits no frame callback.
    private func normalizeSelectedSourceAspectIfNeeded() {
        guard let aspect = currentSourceAspect else {
            lastNormalizedSourceAspect = nil
            return
        }
        guard aspect != lastNormalizedSourceAspect else { return }
        lastNormalizedSourceAspect = aspect
        matchSourceAspect(aspect, animated: false)
    }

    /// Native minimum preview viewport: the content minimum minus the shared gap.
    private var minimumPreviewSize: NSSize {
        guard let window else { return NSSize(width: 1, height: 1) }
        return NSSize(
            width: max(window.contentMinSize.width, 1),
            height: max(window.contentMinSize.height - WidgetPanelContentLayout.topGap, 1)
        )
    }

    /// Frame size whose preview viewport matches `aspect`, fitted on the smaller
    /// proposed side. The proposal is returned unchanged when there is no valid
    /// source or no usable proposal.
    private func aspectMatchedFrameSize(
        proposingFrame frameSize: NSSize,
        aspect: CGFloat,
        in window: NSWindow
    ) -> NSSize {
        let content = window.contentRect(forFrameRect: NSRect(origin: .zero, size: frameSize)).size
        guard content.width > 0, content.height > 0 else { return frameSize }
        let viewport = NSSize(
            width: content.width,
            height: max(content.height - WidgetPanelContentLayout.topGap, 1)
        )
        let visibleFrame = Self.aspectConstrainingFrame(for: window)
        // The geometry returns a window frame size: the fitted viewport plus the
        // measured native titlebar and the shared gap, so it is already the frame the
        // caller must return.
        return DisplayPreviewGeometry.aspectNormalizedWindowSize(
            matchingAspect: aspect,
            proposedPreviewSize: viewport,
            chromeHeight: previewChromeHeight,
            minimumPreviewSize: minimumPreviewSize,
            maximumSize: visibleFrame.isEmpty ? window.frame.size : visibleFrame.size
        )
    }

    /// Available screen area for aspect sizing, inset from the visible frame.
    private static func aspectConstrainingFrame(for window: NSWindow) -> NSRect {
        let screen = window.screen ?? Self.screen(containingMostOf: window.frame) ?? NSScreen.main
        return (screen?.visibleFrame ?? window.frame).insetBy(dx: 12, dy: 12)
    }

    /// Programmatic frames (`setFrame`) bypass `windowWillResize`, so the viewport is
    /// re-fitted here too. The correction is skipped once the viewport is within the
    /// point quantization the window server applies, which keeps a settled window
    /// from shrinking or jittering and keeps the correction from recursing.
    private func normalizeViewportAspectIfNeeded(in window: NSWindow) {
        guard let aspect = currentSourceAspect else { return }
        let target = aspectMatchedFrameSize(proposingFrame: window.frame.size, aspect: aspect, in: window)
        guard frameDiffers(target, from: window.frame.size, in: window) else { return }
        isNormalizingAspect = true
        window.setFrame(NSRect(origin: window.frame.origin, size: target), display: true)
        isNormalizingAspect = false
    }

    /// Allowed residual between a requested frame and the settled frame: one backing
    /// pixel plus a numeric epsilon. This is the measured error from the earlier
    /// geometry probe, not a documented AppKit guarantee, and it exists only so a
    /// quantized settled window is never re-corrected into a shrinking or jittering
    /// loop.
    private func frameDiffers(_ size: NSSize, from current: NSSize, in window: NSWindow) -> Bool {
        let tolerance = 1 / max(window.backingScaleFactor, 1) + 0.01
        return abs(size.width - current.width) > tolerance || abs(size.height - current.height) > tolerance
    }

    func showStatus(
        _ text: String,
        powerState: DisplayPreviewPowerState,
        powerEnabled: Bool,
        centerEnabled: Bool,
        idleStartEnabled: Bool = false
    ) {
        previewView.setIdleStartEnabled(idleStartEnabled)
        if statusText != text {
            statusText = text
            statusLabel.stringValue = text
            statusLabel.setAccessibilityLabel("Display Preview status: \(text)")
        }
        captureButton.state = powerState == .on ? .on : .off
        captureButton.contentTintColor = powerState == .on ? .controlAccentColor : .secondaryLabelColor
        captureButton.toolTip = powerState.actionLabel
        captureButton.setAccessibilityLabel(powerState.actionLabel)
        captureButton.setAccessibilityValue(powerState.accessibilityValue)
        captureButton.isEnabled = powerEnabled
        self.centerEnabled = centerEnabled
        statusBackdrop.isHidden = text.hasPrefix("Live:")
        updateMenuAccessibility()
    }

    func showStatus(_ presentation: DisplayPreviewPresentation) {
        showStatus(
            presentation.message,
            powerState: presentation.powerState,
            powerEnabled: presentation.powerEnabled,
            centerEnabled: false,
            idleStartEnabled: presentation.idleStartEnabled
        )
    }

    @discardableResult
    func showFrame(_ sampleBuffer: CMSampleBuffer, size: CGSize) -> Bool {
        previewView.display(sampleBuffer, sourceSize: size)
    }

    func clearFrame() { previewView.clear() }

    private func refreshPresentedGeometry() {
        guard let geometry = presentedGeometry else { return }
        guard let imageRect = previewView.fittedImageRectTopLeft() else {
            presentedGeometry = nil
            return
        }
        // A static display may not send another frame after layout. Refit the
        // accepted image without granting authority to a new source or topology.
        presentedGeometry = DisplayPreviewFrameGeometry(
            imageRect: imageRect,
            sourceBounds: geometry.sourceBounds,
            sourceID: geometry.sourceID,
            topologyRevision: geometry.topologyRevision
        )
    }

    private func configureContent(in panel: NSPanel) {
        previewView.translatesAutoresizingMaskIntoConstraints = false
        statusBackdrop.translatesAutoresizingMaskIntoConstraints = false
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        statusLabel.alignment = .center
        statusLabel.maximumNumberOfLines = 3
        statusLabel.lineBreakMode = .byWordWrapping
        statusLabel.usesSingleLineMode = false
        statusLabel.cell?.wraps = true
        statusLabel.cell?.isScrollable = false
        statusLabel.setContentCompressionResistancePriority(.fittingSizeCompression, for: .horizontal)
        statusBackdrop.material = .hudWindow
        statusBackdrop.blendingMode = .withinWindow
        statusBackdrop.state = .active
        statusBackdrop.wantsLayer = true
        statusBackdrop.layer?.cornerRadius = 10
        statusBackdrop.layer?.cornerCurve = .continuous
        statusBackdrop.layer?.masksToBounds = true
        statusBackdrop.addSubview(statusLabel)

        previewView.wantsLayer = true
        previewView.layer?.cornerRadius = 12
        previewView.layer?.cornerCurve = .continuous
        previewView.layer?.masksToBounds = true
        previewView.alphaValue = 1

        let root = NSView()
        root.wantsLayer = true
        root.layer?.backgroundColor = NSColor.clear.cgColor
        root.addSubview(previewView)
        root.addSubview(statusBackdrop)
        panel.contentView = root
        NSLayoutConstraint.activate([
            previewView.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            previewView.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            previewView.bottomAnchor.constraint(equalTo: root.bottomAnchor),
            previewView.topAnchor.constraint(equalTo: root.topAnchor, constant: WidgetPanelContentLayout.topGap),
            statusBackdrop.centerXAnchor.constraint(equalTo: previewView.centerXAnchor),
            statusBackdrop.centerYAnchor.constraint(equalTo: previewView.centerYAnchor),
            statusBackdrop.leadingAnchor.constraint(greaterThanOrEqualTo: previewView.leadingAnchor, constant: 24),
            statusBackdrop.trailingAnchor.constraint(lessThanOrEqualTo: previewView.trailingAnchor, constant: -24),
            statusLabel.leadingAnchor.constraint(equalTo: statusBackdrop.leadingAnchor, constant: 14),
            statusLabel.trailingAnchor.constraint(equalTo: statusBackdrop.trailingAnchor, constant: -14),
            statusLabel.topAnchor.constraint(equalTo: statusBackdrop.topAnchor, constant: 10),
            statusLabel.bottomAnchor.constraint(equalTo: statusBackdrop.bottomAnchor, constant: -10)
        ])
    }

    private func addCompactAccessories(to panel: NSPanel) {
        captureButton.identifier = Self.powerToggleIdentifier
        captureButton.target = self
        captureButton.action = #selector(toggleCapture)
        captureButton.setButtonType(.toggle)
        captureButton.bezelStyle = .texturedRounded
        captureButton.controlSize = .small
        captureButton.image = NSImage(systemSymbolName: "power", accessibilityDescription: "Preview power")
        captureButton.title = ""
        captureButton.imagePosition = .imageOnly
        captureButton.toolTip = DisplayPreviewPowerState.off.actionLabel

        menuButton.image = NSImage(systemSymbolName: "ellipsis.circle", accessibilityDescription: "Display controls")
        menuButton.imagePosition = .imageOnly
        menuButton.bezelStyle = .texturedRounded
        menuButton.controlSize = .small
        menuButton.target = self
        menuButton.action = #selector(showControlsMenu(_:))
        menuButton.toolTip = "Display controls"
        menuButton.setAccessibilityLabel("Display controls")

        let controls = NSStackView(views: [captureButton, menuButton])
        controls.orientation = .horizontal
        controls.alignment = .centerY
        controls.spacing = 6
        controls.translatesAutoresizingMaskIntoConstraints = false
        let container = NSView()
        container.addSubview(controls)
        let titlebarHeight = panel.standardWindowButton(.closeButton)?.superview?.bounds.height ?? 32
        NSLayoutConstraint.activate([
            container.widthAnchor.constraint(equalTo: controls.widthAnchor, constant: 8),
            container.heightAnchor.constraint(equalToConstant: titlebarHeight),
            controls.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            controls.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -8),
            controls.centerYAnchor.constraint(equalTo: container.centerYAnchor)
        ])
        container.frame.size = container.fittingSize
        let accessory = NSTitlebarAccessoryViewController()
        accessory.view = container
        accessory.layoutAttribute = .right
        panel.addTitlebarAccessoryViewController(accessory)
        compactControls = container
        compactAccessoryController = accessory
    }

    @objc private func showControlsMenu(_ sender: NSButton) {
        let menu = makeControlsMenu()
        menu.popUp(positioning: nil, at: NSPoint(x: 0, y: sender.bounds.maxY + 4), in: sender)
    }

    /// Exposed for tests so the menu contract is checked without popping it up.
    func makeControlsMenu() -> NSMenu {
        let menu = NSMenu(title: "Display")
        let status = NSMenuItem(title: statusText, action: nil, keyEquivalent: "")
        status.isEnabled = false
        menu.addItem(status)
        menu.addItem(.separator())
        if sources.isEmpty {
            let unavailable = NSMenuItem(title: "No source displays available", action: nil, keyEquivalent: "")
            unavailable.isEnabled = false
            menu.addItem(unavailable)
        } else {
            for source in sources {
                let item = NSMenuItem(title: source.label, action: #selector(sourceChanged(_:)), keyEquivalent: "")
                item.target = self
                item.representedObject = NSNumber(value: source.id)
                item.state = source.id == selectedSourceID ? .on : .off
                menu.addItem(item)
            }
        }
        menu.addItem(.separator())
        let matchAspect = NSMenuItem(
            title: "Match Display Aspect Ratio",
            action: #selector(matchDisplayAspectRatio),
            keyEquivalent: ""
        )
        matchAspect.target = self
        matchAspect.isEnabled = currentSourceAspect != nil
        menu.addItem(matchAspect)
        let center = NSMenuItem(
            title: "Move Pointer to Source Center",
            action: #selector(moveToCenter),
            keyEquivalent: ""
        )
        center.target = self
        center.isEnabled = centerEnabled
        menu.addItem(center)
        let help = NSMenuItem(
            title: "Click the preview to move the pointer there without clicking the destination.",
            action: nil,
            keyEquivalent: ""
        )
        help.isEnabled = false
        menu.addItem(help)
        return menu
    }

    @objc private func sourceChanged(_ sender: NSMenuItem) {
        let id = (sender.representedObject as? NSNumber)?.uint32Value
        selectedSourceID = id
        updateMenuAccessibility()
        // The coordinator accepts the new source first: a resize-triggered
        // onFrameChanged runs its persist and placement validation, which must see the
        // new selection rather than the previous one.
        onSourceSelected?(id)
        normalizeSelectedSourceAspectIfNeeded()
    }

    @objc private func toggleCapture() { onToggleCapture?() }
    @objc private func moveToCenter() { onMoveToCenter?() }
    @objc private func matchDisplayAspectRatio() { matchCurrentSourceAspect(animated: true) }

    /// Authoritative enablement: NSMenu's automatic validation would otherwise
    /// re-enable an item merely because its target responds to the action.
    func validateMenuItem(_ menuItem: NSMenuItem) -> Bool {
        if menuItem.action == #selector(matchDisplayAspectRatio) {
            return currentSourceAspect != nil
        }
        if menuItem.action == #selector(moveToCenter) {
            return centerEnabled
        }
        return true
    }

    private func updateMenuAccessibility() {
        let source = sources.first(where: { $0.id == selectedSourceID })?.name ?? "No source selected"
        menuButton.setAccessibilityHelp("\(source). \(statusText)")
    }

    private func installChromeTracking(on panel: NSPanel) {
        guard let frameView = panel.contentView?.superview else { return }
        if let titlebarView = panel.standardWindowButton(.closeButton)?.superview {
            chromeBackground.material = .headerView
            chromeBackground.blendingMode = .withinWindow
            chromeBackground.state = .active
            chromeBackground.wantsLayer = true
            chromeBackground.layer?.cornerRadius = 10
            chromeBackground.layer?.cornerCurve = .continuous
            chromeBackground.layer?.masksToBounds = true
            chromeBackground.setAccessibilityElement(false)
            chromeBackground.frame = titlebarView.bounds
            chromeBackground.autoresizingMask = [.width, .height]
            titlebarView.addSubview(chromeBackground, positioned: .below, relativeTo: nil)
        }
        chromeTrackingView = frameView
        updateChromeTrackingArea()
    }

    private func updateChromeTrackingArea() {
        guard let frameView = chromeTrackingView else { return }
        if let chromeTrackingArea { frameView.removeTrackingArea(chromeTrackingArea) }
        let area = NSTrackingArea(
            rect: .zero,
            options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect],
            owner: self,
            userInfo: nil
        )
        frameView.addTrackingArea(area)
        chromeTrackingArea = area
    }

    private func revealChrome() {
        chromeHideGeneration += 1
        setChromeVisible(true)
    }

    private func scheduleChromeHide() {
        chromeHideGeneration += 1
        let generation = chromeHideGeneration
        Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            guard let self, self.chromeHideGeneration == generation, !self.pointerIsInPanel else { return }
            self.setChromeVisible(false)
        }
    }

    private var pointerIsInPanel: Bool {
        guard let panel = window, panel.isVisible else { return false }
        return panel.frame.contains(NSEvent.mouseLocation)
    }

    private func setChromeVisible(_ visible: Bool) {
        guard let panel = window else { return }
        let effectiveVisibility = visible || NSWorkspace.shared.isVoiceOverEnabled
        guard chromeVisible != effectiveVisibility else { return }
        chromeVisible = effectiveVisibility
        panel.titleVisibility = .hidden
        panel.titlebarAppearsTransparent = true
        let views: [NSView] = standardWindowButtons(in: panel).map { $0 as NSView }
            + [compactControls].compactMap { $0 }
            + [chromeBackground]
        views.forEach { $0.isHidden = false }
        let targetAlpha: CGFloat = effectiveVisibility ? 1 : 0
        if NSWorkspace.shared.accessibilityDisplayShouldReduceMotion {
            views.forEach { $0.alphaValue = targetAlpha }
        } else {
            NSAnimationContext.runAnimationGroup { context in
                context.duration = 0.16
                views.forEach { $0.animator().alphaValue = targetAlpha }
            }
        }
        guard !effectiveVisibility else { return }
        let generation = chromeHideGeneration
        Task { @MainActor [weak self] in
            if !NSWorkspace.shared.accessibilityDisplayShouldReduceMotion {
                try? await Task.sleep(nanoseconds: 170_000_000)
            }
            guard let self, self.chromeHideGeneration == generation, !self.chromeVisible else { return }
            views.forEach { $0.isHidden = true }
        }
    }

    private func standardWindowButtons(in panel: NSWindow) -> [NSButton] {
        [NSWindow.ButtonType.closeButton, .miniaturizeButton, .zoomButton]
            .compactMap { panel.standardWindowButton($0) }
    }

    private static func screen(containingMostOf frame: NSRect) -> NSScreen? {
        NSScreen.screens
            .max { $0.frame.intersection(frame).area < $1.frame.intersection(frame).area }
            .flatMap { $0.frame.intersection(frame).area > 0 ? $0 : nil }
    }

    func windowWillClose(_ notification: Notification) { onClose?() }

    /// Live resize proposes a frame; the returned frame keeps the preview viewport
    /// aspect-matched. Without a valid source the proposal is untouched.
    func windowWillResize(_ sender: NSWindow, to frameSize: NSSize) -> NSSize {
        guard let aspect = currentSourceAspect else { return frameSize }
        return aspectMatchedFrameSize(proposingFrame: frameSize, aspect: aspect, in: sender)
    }

    func windowDidMove(_ notification: Notification) { if let frame = window?.frame { onFrameChanged?(frame) } }

    /// Re-fits programmatic frame changes, then always reports the final frame so
    /// overlap placement stays current during a live resize. A correction posts its
    /// own nested notification, which is ignored here so the settled frame is
    /// reported once instead of once per setFrame.
    func windowDidResize(_ notification: Notification) {
        guard !isNormalizingAspect, let window else { return }
        normalizeViewportAspectIfNeeded(in: window)
        onFrameChanged?(window.frame)
    }
    func windowDidEndLiveResize(_ notification: Notification) { if let frame = window?.frame { onFrameChanged?(frame) } }
    func windowDidBecomeKey(_ notification: Notification) { revealChrome(); scheduleChromeHide() }
    override func mouseEntered(with event: NSEvent) { revealChrome() }
    override func mouseExited(with event: NSEvent) { scheduleChromeHide() }
    func windowDidMiniaturize(_ notification: Notification) { onVisibilityChanged?(false) }
    func windowDidDeminiaturize(_ notification: Notification) { onVisibilityChanged?(true) }
    func windowDidChangeOcclusionState(_ notification: Notification) {
        // Occlusion includes ordinary app switching and window coverage. Only explicit
        // miniaturization should suspend a user-owned preview.
    }
}

private final class NonInteractiveStatusLabel: NSTextField {
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
}

private final class DisplayStatusEffectView: NSVisualEffectView {
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
}
