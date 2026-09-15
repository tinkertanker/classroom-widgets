import AppKit

@MainActor
enum DisplayPreviewMenu {
    static let title = "Display"

    static func makePanelMenu(
        options: [CompactWidgetOption],
        target: AnyObject?,
        displayAction: Selector?,
        widgetAction: Selector?
    ) -> NSMenu {
        let menu = NSMenu(title: "Add Widget")
        let displayItem = NSMenuItem(title: title, action: displayAction, keyEquivalent: "")
        displayItem.target = target
        menu.addItem(displayItem)
        if !options.isEmpty { menu.addItem(.separator()) }
        for option in options {
            let item = NSMenuItem(title: option.title, action: widgetAction, keyEquivalent: "")
            item.target = target
            item.tag = option.widgetType
            menu.addItem(item)
        }
        if options.isEmpty {
            let item = NSMenuItem(title: "No compact widgets available", action: nil, keyEquivalent: "")
            item.isEnabled = false
            menu.addItem(item)
        }
        return menu
    }
}
