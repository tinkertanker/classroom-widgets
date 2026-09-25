import AppKit

/// The widget list shared by the menu-bar menu and each panel's add button:
/// Display first, then compact widgets in the order the web app sends them
/// (most used first), with a separator wherever the menu group changes.
@MainActor
enum WidgetMenu {
    static let displayTitle = "Display"

    static func addWidgetItems(
        to menu: NSMenu,
        options: [CompactWidgetOption],
        target: AnyObject?,
        displayAction: Selector?,
        widgetAction: Selector?,
        shortcut: (ShortcutBindingState.Owner) -> DashboardShortcut? = { _ in nil }
    ) {
        let displayItem = NSMenuItem(title: displayTitle, action: displayAction, keyEquivalent: "")
        displayItem.target = target
        displayItem.image = symbol(for: nil, description: displayTitle)
        applyShortcut(shortcut(.display), to: displayItem)
        menu.addItem(displayItem)

        guard let firstGroup = options.first?.menuGroup else {
            let item = NSMenuItem(title: "Loading widgets…", action: nil, keyEquivalent: "")
            item.isEnabled = false
            menu.addItem(item)
            return
        }
        var group = firstGroup
        for option in options {
            if option.menuGroup != group {
                menu.addItem(.separator())
                group = option.menuGroup
            }
            let item = NSMenuItem(title: option.title, action: widgetAction, keyEquivalent: "")
            item.target = target
            item.tag = option.widgetType
            item.image = symbol(for: option.widgetType, description: option.title)
            applyShortcut(shortcut(.widget(option.widgetType)), to: item)
            menu.addItem(item)
        }
    }

    static func makePanelMenu(
        options: [CompactWidgetOption],
        target: AnyObject?,
        displayAction: Selector?,
        widgetAction: Selector?
    ) -> NSMenu {
        let menu = NSMenu(title: "Add Widget")
        addWidgetItems(to: menu, options: options, target: target, displayAction: displayAction, widgetAction: widgetAction)
        return menu
    }

    /// Shows a global shortcut beside its item. The hot key itself is
    /// registered elsewhere; status-item menus never handle key equivalents
    /// while closed.
    static func applyShortcut(_ shortcut: DashboardShortcut?, to item: NSMenuItem) {
        guard let shortcut, shortcut.isAssigned,
              let equivalent = DashboardShortcutFormatter.keyEquivalent(for: shortcut.keyCode) else { return }
        item.keyEquivalent = equivalent
        item.keyEquivalentModifierMask = DashboardShortcutFormatter.modifierFlags(from: shortcut.modifiers)
    }

    static func symbol(named name: String, description: String) -> NSImage? {
        NSImage(systemSymbolName: name, accessibilityDescription: description)
    }

    /// SF Symbol for a widget type, or for Display when `widgetType` is nil.
    /// Unknown widgets get no image.
    private static func symbol(for widgetType: Int?, description: String) -> NSImage? {
        let name: String?
        if let widgetType { name = symbolNames[widgetType] } else { name = "display" }
        return name.flatMap { symbol(named: $0, description: description) }
    }

    private static let symbolNames: [Int: String] = [
        0: "dice",
        1: "timer",
        2: "checklist",
        3: "list.bullet.clipboard",
        4: "light.beacon.max",
        6: "link",
        7: "textformat",
        9: "speaker.wave.2",
        12: "qrcode"
    ]
}
