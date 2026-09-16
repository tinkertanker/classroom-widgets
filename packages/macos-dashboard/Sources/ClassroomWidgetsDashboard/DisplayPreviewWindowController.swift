import AppKit
import CoreMedia

@MainActor
final class DisplayPreviewWindowController: NSWindowController, NSWindowDelegate {
    let previewView = DisplayPreviewView(frame: .zero)
    var onSourceSelected: ((CGDirectDisplayID?) -> Void)?
    var onToggleCapture: (() -> Void)?
    var onMoveToCenter: (() -> Void)?
    var onClose: (() -> Void)?
    var onFrameChanged: ((NSRect) -> Void)?
    var onVisibilityChanged: ((Bool) -> Void)?

    private let captureButton = NSButton(title: "Start", target: nil, action: nil)
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
    private var statusText = "Choose a display to preview."
    private var centerEnabled = false

    init(frame: NSRect, backgroundOpacity: Double, keepOnAllSpaces: Bool) {
        let panel = NSPanel(
            contentRect: frame,
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
        panel.contentMinSize = NSSize(width: 320, height: 240)
        super.init(window: panel)
        panel.delegate = self
        configureContent(in: panel)
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
    }

    func showStatus(_ text: String, buttonTitle: String, buttonEnabled: Bool, centerEnabled: Bool) {
        if statusText != text {
            statusText = text
            statusLabel.stringValue = text
            statusLabel.setAccessibilityLabel("Display Preview status: \(text)")
        }
        if captureButton.title != buttonTitle { captureButton.title = buttonTitle }
        if let compactControls { compactControls.frame.size = compactControls.fittingSize }
        captureButton.toolTip = buttonTitle
        captureButton.setAccessibilityLabel(buttonTitle)
        captureButton.isEnabled = buttonEnabled
        self.centerEnabled = centerEnabled
        statusBackdrop.isHidden = text.hasPrefix("Live:")
        updateMenuAccessibility()
    }

    @discardableResult
    func showFrame(_ sampleBuffer: CMSampleBuffer, size: CGSize) -> Bool {
        previewView.display(sampleBuffer, sourceSize: size)
    }

    func clearFrame() { previewView.clear() }

    private func configureContent(in panel: NSPanel) {
        previewView.translatesAutoresizingMaskIntoConstraints = false
        statusBackdrop.translatesAutoresizingMaskIntoConstraints = false
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        statusLabel.alignment = .center
        statusLabel.maximumNumberOfLines = 3
        statusLabel.lineBreakMode = .byWordWrapping
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
            previewView.topAnchor.constraint(equalTo: root.topAnchor, constant: -WidgetPanelContentLayout.topGap),
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
        captureButton.target = self
        captureButton.action = #selector(toggleCapture)
        captureButton.bezelStyle = .texturedRounded
        captureButton.controlSize = .small
        captureButton.toolTip = "Start"

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
        controls.frame.size = controls.fittingSize
        let accessory = NSTitlebarAccessoryViewController()
        accessory.view = controls
        accessory.layoutAttribute = .right
        panel.addTitlebarAccessoryViewController(accessory)
        compactControls = controls
        compactAccessoryController = accessory
    }

    @objc private func showControlsMenu(_ sender: NSButton) {
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
        menu.popUp(positioning: nil, at: NSPoint(x: 0, y: sender.bounds.maxY + 4), in: sender)
    }

    @objc private func sourceChanged(_ sender: NSMenuItem) {
        let id = (sender.representedObject as? NSNumber)?.uint32Value
        selectedSourceID = id
        updateMenuAccessibility()
        onSourceSelected?(id)
    }

    @objc private func toggleCapture() { onToggleCapture?() }
    @objc private func moveToCenter() { onMoveToCenter?() }

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

    func windowWillClose(_ notification: Notification) { onClose?() }
    func windowDidMove(_ notification: Notification) { if let frame = window?.frame { onFrameChanged?(frame) } }
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
