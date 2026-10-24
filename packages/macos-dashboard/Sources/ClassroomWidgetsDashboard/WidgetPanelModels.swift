import AppKit


/// A host-provided description of one widget panel. The enclosing inventory
/// revision is monotonic for each host instance so native can reject stale
/// reconciliation results without blocking a reloaded web process.
struct WidgetPanelDescriptor {
    struct Size: Equatable {
        let width: CGFloat
        let height: CGFloat

        init(width: CGFloat, height: CGFloat) {
            self.width = width
            self.height = height
        }

        var cgSize: NSSize {
            NSSize(width: max(width, 1), height: max(height, 1))
        }
    }

    let id: String
    let title: String
    let preferredContentSize: Size
    let minimumContentSize: Size
    let maximumContentSize: Size?
    let isResizable: Bool
    let aspectRatio: CGFloat?
    let hidden: Bool
    let snapshotPayload: [String: Any]

    init(
        id: String,
        title: String,
        preferredContentSize: Size,
        minimumContentSize: Size = Size(width: 240, height: 160),
        maximumContentSize: Size? = nil,
        isResizable: Bool = true,
        aspectRatio: CGFloat? = nil,
        hidden: Bool = false,
        snapshotPayload: [String: Any]
    ) {
        self.id = id
        self.title = title
        self.preferredContentSize = preferredContentSize
        self.minimumContentSize = minimumContentSize
        self.maximumContentSize = maximumContentSize
        self.isResizable = isResizable
        self.aspectRatio = aspectRatio
        self.hidden = hidden
        self.snapshotPayload = snapshotPayload
    }
}

struct WidgetPanelSnapshot {
    let hostInstanceID: String
    let revision: Int
    let widgets: [WidgetPanelDescriptor]

    init(hostInstanceID: String, revision: Int, widgets: [WidgetPanelDescriptor]) {
        self.hostInstanceID = hostInstanceID
        self.revision = revision
        self.widgets = widgets
    }
}

enum WidgetPanelLayout: String, Codable {
    case freeform
    case row
    case column
}

struct WidgetPanelStateChange {
    let widgetID: String
    let payload: [String: Any]
}

struct WidgetPanelRandomiserListChange {
    let payload: [String: Any]
}
