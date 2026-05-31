import AppKit
import Carbon
import SwiftUI

struct KeyboardShortcutRecorder: View {
    @Binding var keyCode: Int
    @Binding var modifiers: Int

    var placeholder = "Click to set"
    @State private var isRecording = false

    var body: some View {
        HStack(spacing: 6) {
            RecorderField(
                keyCode: $keyCode,
                modifiers: $modifiers,
                isRecording: $isRecording,
                placeholder: placeholder
            )
            .frame(width: 150, height: 26)
            .background(isRecording ? Color.accentColor.opacity(0.15) : Color(nsColor: .controlBackgroundColor))
            .clipShape(.rect(cornerRadius: 6))
            .overlay {
                RoundedRectangle(cornerRadius: 6)
                    .stroke(isRecording ? Color.accentColor : Color(nsColor: .separatorColor), lineWidth: 1)
            }

            if keyCode != -1 {
                Button("Clear shortcut", systemImage: "xmark.circle.fill") {
                    keyCode = -1
                    modifiers = 0
                }
                .labelStyle(.iconOnly)
                .buttonStyle(.plain)
                .foregroundStyle(.secondary)
                .help("Clear shortcut")
            }
        }
    }
}

private struct RecorderField: NSViewRepresentable {
    @Binding var keyCode: Int
    @Binding var modifiers: Int
    @Binding var isRecording: Bool
    var placeholder: String

    func makeNSView(context: Context) -> RecorderNSView {
        let view = RecorderNSView()
        view.delegate = context.coordinator
        view.placeholder = placeholder
        return view
    }

    func updateNSView(_ nsView: RecorderNSView, context: Context) {
        nsView.placeholder = placeholder
        nsView.updateDisplay(keyCode: keyCode, modifiers: modifiers, isRecording: isRecording)
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    final class Coordinator: NSObject, RecorderNSViewDelegate {
        var parent: RecorderField

        init(_ parent: RecorderField) {
            self.parent = parent
        }

        func recorderDidStartRecording() {
            parent.isRecording = true
        }

        func recorderDidEndRecording() {
            parent.isRecording = false
        }

        func recorderDidCaptureShortcut(keyCode: Int, modifiers: Int) {
            parent.keyCode = keyCode
            parent.modifiers = modifiers
            parent.isRecording = false
        }
    }
}

private protocol RecorderNSViewDelegate: AnyObject {
    func recorderDidStartRecording()
    func recorderDidEndRecording()
    func recorderDidCaptureShortcut(keyCode: Int, modifiers: Int)
}

private final class RecorderNSView: NSView {
    weak var delegate: RecorderNSViewDelegate?

    var placeholder = "Click to set"

    private var isRecording = false
    private var currentKeyCode = -1
    private var currentModifiers = 0

    private let textField: NSTextField = {
        let field = NSTextField(labelWithString: "")
        field.alignment = .center
        field.font = .systemFont(ofSize: 12)
        field.textColor = .secondaryLabelColor
        return field
    }()

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    override var acceptsFirstResponder: Bool { true }

    override func mouseDown(with event: NSEvent) {
        startRecording()
    }

    override func keyDown(with event: NSEvent) {
        guard isRecording else {
            if event.keyCode == UInt16(kVK_Space) || event.keyCode == UInt16(kVK_Return) {
                startRecording()
                return
            }
            super.keyDown(with: event)
            return
        }

        if event.keyCode == UInt16(kVK_Escape) {
            stopRecording()
            return
        }

        let flags = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
        let hasModifier = flags.contains(.command) || flags.contains(.option) || flags.contains(.control) || flags.contains(.shift)
        guard hasModifier, !Self.modifierOnlyKeys.contains(event.keyCode) else {
            return
        }

        currentKeyCode = Int(event.keyCode)
        currentModifiers = Int(flags.rawValue)
        delegate?.recorderDidCaptureShortcut(keyCode: currentKeyCode, modifiers: currentModifiers)
        stopRecording()
    }

    override func flagsChanged(with event: NSEvent) {
        guard isRecording else {
            super.flagsChanged(with: event)
            return
        }

        let flags = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
        textField.stringValue = DashboardShortcutFormatter.modifierSymbols(from: flags) + "..."
        textField.textColor = .labelColor
    }

    override func resignFirstResponder() -> Bool {
        if isRecording {
            stopRecording()
        }
        return super.resignFirstResponder()
    }

    func updateDisplay(keyCode: Int, modifiers: Int, isRecording: Bool) {
        currentKeyCode = keyCode
        currentModifiers = modifiers
        self.isRecording = isRecording

        if !isRecording {
            updateDisplayText()
        }
    }

    private func setup() {
        setAccessibilityRole(.button)
        setAccessibilityLabel("Keyboard shortcut")
        setAccessibilityHelp("Press to record a new keyboard shortcut")
        addSubview(textField)
        textField.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            textField.leadingAnchor.constraint(greaterThanOrEqualTo: leadingAnchor, constant: 8),
            textField.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor, constant: -8),
            textField.centerXAnchor.constraint(equalTo: centerXAnchor),
            textField.centerYAnchor.constraint(equalTo: centerYAnchor)
        ])
        updateDisplayText()
    }

    private func startRecording() {
        isRecording = true
        window?.makeFirstResponder(self)
        textField.stringValue = "Press shortcut..."
        textField.textColor = .labelColor
        setAccessibilityValue("Recording shortcut")
        delegate?.recorderDidStartRecording()
    }

    private func stopRecording() {
        isRecording = false
        window?.makeFirstResponder(nil)
        updateDisplayText()
        delegate?.recorderDidEndRecording()
    }

    private func updateDisplayText() {
        if currentKeyCode == -1 {
            textField.stringValue = placeholder
            textField.textColor = .secondaryLabelColor
            setAccessibilityValue("No shortcut")
            return
        }

        textField.stringValue = DashboardShortcutFormatter.title(keyCode: currentKeyCode, modifiers: currentModifiers) ?? "?"
        textField.textColor = .labelColor
        setAccessibilityValue(textField.stringValue)
    }

    private static let modifierOnlyKeys: Set<UInt16> = [
        UInt16(kVK_Command), UInt16(kVK_RightCommand),
        UInt16(kVK_Option), UInt16(kVK_RightOption),
        UInt16(kVK_Control), UInt16(kVK_RightControl),
        UInt16(kVK_Shift), UInt16(kVK_RightShift)
    ]

}
