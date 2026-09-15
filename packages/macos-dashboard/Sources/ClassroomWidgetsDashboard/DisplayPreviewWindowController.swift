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

    private let sourcePicker = NSPopUpButton(frame: .zero, pullsDown: false)
    private let captureButton = NSButton(title: "Start", target: nil, action: nil)
    private let centerButton = NSButton(title: "Move pointer to source display center", target: nil, action: nil)
    private let statusLabel = NSTextField(labelWithString: "Choose a display to preview.")
    private let explanationLabel = NSTextField(wrappingLabelWithString: "Click the preview to move your pointer there. This does not click the item.")

    init(frame: NSRect, backgroundOpacity: Double, keepOnAllSpaces: Bool) {
        let panel = NSPanel(
            contentRect: frame,
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        panel.title = "Display Preview"
        panel.level = .floating
        panel.hidesOnDeactivate = false
        panel.isReleasedWhenClosed = false
        panel.contentMinSize = NSSize(width: 320, height: 240)
        super.init(window: panel)
        panel.delegate = self
        configureContent(in: panel)
        applyPresentationSettings(backgroundOpacity: backgroundOpacity, keepOnAllSpaces: keepOnAllSpaces)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func applyPresentationSettings(backgroundOpacity: Double, keepOnAllSpaces: Bool) {
        guard let window else { return }
        window.backgroundColor = NSColor.windowBackgroundColor.withAlphaComponent(min(max(backgroundOpacity, 0), 1))
        window.isOpaque = backgroundOpacity >= 1
        var behavior: NSWindow.CollectionBehavior = [.fullScreenAuxiliary]
        if keepOnAllSpaces { behavior.insert(.canJoinAllSpaces) }
        window.collectionBehavior = behavior
    }

    func setSources(_ sources: [DisplayDescriptor], selectedID: CGDirectDisplayID?) {
        sourcePicker.removeAllItems()
        sourcePicker.addItem(withTitle: "Choose a display…")
        sourcePicker.lastItem?.representedObject = NSNumber(value: UInt32.max)
        for source in sources {
            sourcePicker.addItem(withTitle: source.label)
            sourcePicker.lastItem?.representedObject = NSNumber(value: source.id)
        }
        if let selectedID,
           let index = sourcePicker.itemArray.firstIndex(where: { ($0.representedObject as? NSNumber)?.uint32Value == selectedID }) {
            sourcePicker.selectItem(at: index)
        } else {
            sourcePicker.selectItem(at: 0)
        }
        sourcePicker.isEnabled = !sources.isEmpty
    }

    func showStatus(_ text: String, buttonTitle: String, buttonEnabled: Bool, centerEnabled: Bool) {
        statusLabel.stringValue = text
        statusLabel.setAccessibilityLabel("Display Preview status: \(text)")
        captureButton.title = buttonTitle
        captureButton.isEnabled = buttonEnabled
        centerButton.isEnabled = centerEnabled
    }

    @discardableResult
    func showFrame(_ sampleBuffer: CMSampleBuffer, size: CGSize) -> Bool {
        previewView.display(sampleBuffer, sourceSize: size)
    }
    func clearFrame() { previewView.clear() }

    private func configureContent(in panel: NSPanel) {
        [sourcePicker, captureButton, centerButton].forEach { $0.translatesAutoresizingMaskIntoConstraints = false }
        [statusLabel, explanationLabel, previewView].forEach { $0.translatesAutoresizingMaskIntoConstraints = false }
        sourcePicker.target = self
        sourcePicker.action = #selector(sourceChanged)
        captureButton.target = self
        captureButton.action = #selector(toggleCapture)
        centerButton.target = self
        centerButton.action = #selector(moveToCenter)
        statusLabel.lineBreakMode = .byTruncatingTail
        statusLabel.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)

        let root = NSView()
        root.addSubview(sourcePicker)
        root.addSubview(captureButton)
        root.addSubview(previewView)
        root.addSubview(statusLabel)
        root.addSubview(explanationLabel)
        root.addSubview(centerButton)
        panel.contentView = root
        NSLayoutConstraint.activate([
            sourcePicker.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 12),
            sourcePicker.topAnchor.constraint(equalTo: root.topAnchor, constant: 12),
            captureButton.leadingAnchor.constraint(equalTo: sourcePicker.trailingAnchor, constant: 8),
            captureButton.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -12),
            captureButton.centerYAnchor.constraint(equalTo: sourcePicker.centerYAnchor),
            sourcePicker.widthAnchor.constraint(greaterThanOrEqualToConstant: 210),
            previewView.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 12),
            previewView.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -12),
            previewView.topAnchor.constraint(equalTo: sourcePicker.bottomAnchor, constant: 10),
            statusLabel.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 12),
            statusLabel.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -12),
            statusLabel.topAnchor.constraint(equalTo: previewView.bottomAnchor, constant: 8),
            explanationLabel.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 12),
            explanationLabel.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -12),
            explanationLabel.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 4),
            centerButton.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 12),
            centerButton.bottomAnchor.constraint(equalTo: root.bottomAnchor, constant: -10),
            centerButton.topAnchor.constraint(equalTo: explanationLabel.bottomAnchor, constant: 6)
        ])
    }

    @objc private func sourceChanged() {
        let value = (sourcePicker.selectedItem?.representedObject as? NSNumber)?.uint32Value
        onSourceSelected?(value == UInt32.max ? nil : value)
    }
    @objc private func toggleCapture() { onToggleCapture?() }
    @objc private func moveToCenter() { onMoveToCenter?() }

    func windowWillClose(_ notification: Notification) { onClose?() }
    func windowDidMove(_ notification: Notification) { if let frame = window?.frame { onFrameChanged?(frame) } }
    func windowDidEndLiveResize(_ notification: Notification) { if let frame = window?.frame { onFrameChanged?(frame) } }
    func windowDidMiniaturize(_ notification: Notification) { onVisibilityChanged?(false) }
    func windowDidDeminiaturize(_ notification: Notification) { onVisibilityChanged?(true) }
    func windowDidChangeOcclusionState(_ notification: Notification) {
        guard let window else { return }
        onVisibilityChanged?(window.occlusionState.contains(.visible))
    }
}
