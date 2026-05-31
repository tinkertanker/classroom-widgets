import AppKit
import Carbon

enum DashboardShortcutFormatter {
    static func title(keyCode: Int, modifiers: Int) -> String? {
        guard keyCode != -1 else {
            return nil
        }

        let flags = NSEvent.ModifierFlags(rawValue: UInt(modifiers))
        return modifierSymbols(from: flags) + keyTitle(for: keyCode)
    }

    static func keyEquivalent(for keyCode: Int) -> String? {
        guard keyCode != -1 else {
            return nil
        }

        if let specialKey = specialMenuKeyEquivalents[keyCode] {
            return specialKey
        }

        return keyCodeToUSKeyboardCharacter[keyCode]?.lowercased()
    }

    static func modifierFlags(from modifiers: Int) -> NSEvent.ModifierFlags {
        NSEvent.ModifierFlags(rawValue: UInt(modifiers)).intersection(.deviceIndependentFlagsMask)
    }

    static func modifierSymbols(from flags: NSEvent.ModifierFlags) -> String {
        var symbols = ""
        if flags.contains(.control) { symbols += "⌃" }
        if flags.contains(.option) { symbols += "⌥" }
        if flags.contains(.shift) { symbols += "⇧" }
        if flags.contains(.command) { symbols += "⌘" }
        return symbols
    }

    static func keyTitle(for keyCode: Int) -> String {
        if let specialKey = specialKeys[keyCode] {
            return specialKey
        }

        return keyCodeToUSKeyboardCharacter[keyCode] ?? "?"
    }

    private static let specialKeys: [Int: String] = [
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

    private static let specialMenuKeyEquivalents: [Int: String] = [
        kVK_Return: "\r",
        kVK_Tab: "\t",
        kVK_Space: " ",
        kVK_Delete: "\u{8}",
        kVK_Escape: "\u{1b}",
        kVK_ForwardDelete: String(UnicodeScalar(NSDeleteFunctionKey)!),
        kVK_LeftArrow: String(UnicodeScalar(NSLeftArrowFunctionKey)!),
        kVK_RightArrow: String(UnicodeScalar(NSRightArrowFunctionKey)!),
        kVK_UpArrow: String(UnicodeScalar(NSUpArrowFunctionKey)!),
        kVK_DownArrow: String(UnicodeScalar(NSDownArrowFunctionKey)!),
        kVK_Home: String(UnicodeScalar(NSHomeFunctionKey)!),
        kVK_End: String(UnicodeScalar(NSEndFunctionKey)!),
        kVK_PageUp: String(UnicodeScalar(NSPageUpFunctionKey)!),
        kVK_PageDown: String(UnicodeScalar(NSPageDownFunctionKey)!),
        kVK_F1: String(UnicodeScalar(NSF1FunctionKey)!),
        kVK_F2: String(UnicodeScalar(NSF2FunctionKey)!),
        kVK_F3: String(UnicodeScalar(NSF3FunctionKey)!),
        kVK_F4: String(UnicodeScalar(NSF4FunctionKey)!),
        kVK_F5: String(UnicodeScalar(NSF5FunctionKey)!),
        kVK_F6: String(UnicodeScalar(NSF6FunctionKey)!),
        kVK_F7: String(UnicodeScalar(NSF7FunctionKey)!),
        kVK_F8: String(UnicodeScalar(NSF8FunctionKey)!),
        kVK_F9: String(UnicodeScalar(NSF9FunctionKey)!),
        kVK_F10: String(UnicodeScalar(NSF10FunctionKey)!),
        kVK_F11: String(UnicodeScalar(NSF11FunctionKey)!),
        kVK_F12: String(UnicodeScalar(NSF12FunctionKey)!)
    ]

    private static let keyCodeToUSKeyboardCharacter: [Int: String] = [
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
