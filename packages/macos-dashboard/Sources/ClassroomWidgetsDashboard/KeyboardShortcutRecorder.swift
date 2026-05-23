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
        textField.stringValue = modifierSymbols(from: flags) + "..."
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
            return
        }

        let flags = NSEvent.ModifierFlags(rawValue: UInt(currentModifiers))
        textField.stringValue = modifierSymbols(from: flags) + keyString(from: currentKeyCode)
        textField.textColor = .labelColor
    }

    private func modifierSymbols(from flags: NSEvent.ModifierFlags) -> String {
        var symbols = ""
        if flags.contains(.control) { symbols += "⌃" }
        if flags.contains(.option) { symbols += "⌥" }
        if flags.contains(.shift) { symbols += "⇧" }
        if flags.contains(.command) { symbols += "⌘" }
        return symbols
    }

    private func keyString(from keyCode: Int) -> String {
        let specialKeys: [Int: String] = [
            kVK_Return: "↩",
            kVK_Tab: "⇥",
            kVK_Space: "Space",
            kVK_Delete: "⌫",
            kVK_ForwardDelete: "⌦",
            kVK_Escape: "⎋",
            kVK_LeftArrow: "←",
            kVK_RightArrow: "→",
            kVK_UpArrow: "↑",
            kVK_DownArrow: "↓",
            kVK_Home: "↖",
            kVK_End: "↘",
            kVK_PageUp: "⇞",
            kVK_PageDown: "⇟",
            kVK_F1: "F1", kVK_F2: "F2", kVK_F3: "F3", kVK_F4: "F4",
            kVK_F5: "F5", kVK_F6: "F6", kVK_F7: "F7", kVK_F8: "F8",
            kVK_F9: "F9", kVK_F10: "F10", kVK_F11: "F11", kVK_F12: "F12"
        ]

        if let specialKey = specialKeys[keyCode] {
            return specialKey
        }

        guard let scalar = keyCodeToUSKeyboardCharacter[keyCode] else {
            return "?"
        }

        return scalar
    }

    private static let modifierOnlyKeys: Set<UInt16> = [
        UInt16(kVK_Command), UInt16(kVK_RightCommand),
        UInt16(kVK_Option), UInt16(kVK_RightOption),
        UInt16(kVK_Control), UInt16(kVK_RightControl),
        UInt16(kVK_Shift), UInt16(kVK_RightShift)
    ]

    private let keyCodeToUSKeyboardCharacter: [Int: String] = [
        kVK_ANSI_A: "A", kVK_ANSI_S: "S", kVK_ANSI_D: "D", kVK_ANSI_F: "F",
        kVK_ANSI_H: "H", kVK_ANSI_G: "G", kVK_ANSI_Z: "Z", kVK_ANSI_X: "X",
        kVK_ANSI_C: "C", kVK_ANSI_V: "V", kVK_ANSI_B: "B", kVK_ANSI_Q: "Q",
        kVK_ANSI_W: "W", kVK_ANSI_E: "E", kVK_ANSI_R: "R", kVK_ANSI_Y: "Y",
        kVK_ANSI_T: "T", kVK_ANSI_1: "1", kVK_ANSI_2: "2", kVK_ANSI_3: "3",
        kVK_ANSI_4: "4", kVK_ANSI_6: "6", kVK_ANSI_5: "5", kVK_ANSI_Equal: "=",
        kVK_ANSI_9: "9", kVK_ANSI_7: "7", kVK_ANSI_Minus: "-", kVK_ANSI_8: "8",
        kVK_ANSI_0: "0", kVK_ANSI_RightBracket: "]", kVK_ANSI_O: "O",
        kVK_ANSI_U: "U", kVK_ANSI_LeftBracket: "[", kVK_ANSI_I: "I",
        kVK_ANSI_P: "P", kVK_ANSI_L: "L", kVK_ANSI_J: "J", kVK_ANSI_Quote: "'",
        kVK_ANSI_K: "K", kVK_ANSI_Semicolon: ";", kVK_ANSI_Backslash: "\\",
        kVK_ANSI_Comma: ",", kVK_ANSI_Slash: "/", kVK_ANSI_N: "N",
        kVK_ANSI_M: "M", kVK_ANSI_Period: "."
    ]
}
