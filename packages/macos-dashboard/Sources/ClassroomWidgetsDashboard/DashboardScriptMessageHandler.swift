import WebKit

/// A widget type that the web renderer has declared safe to create in an
/// isolated compact panel. The host remains the authority here: native only
/// presents the options it receives and passes the selected type back.
struct CompactWidgetOption: Equatable {
    let widgetType: Int
    let title: String
}

/// The host's complete compact-widget inventory. The host instance identifier
/// distinguishes a fresh web process from a stale delivery whose local
/// revision happened to restart at zero.
struct WidgetPanelInventoryPayload {
    let hostInstanceID: String
    let revision: Int
    let windowMode: DashboardWindowMode
    let widgets: [[String: Any]]
}

@MainActor
final class DashboardScriptMessageHandler: NSObject, WKScriptMessageHandler {
    var onVisibilityChanged: (@MainActor (Bool) -> Void)?
    var onWindowModeRequested: (@MainActor (DashboardWindowMode) -> Void)?
    var onWidgetPanelsChanged: (@MainActor (WidgetPanelInventoryPayload) -> Void)?
    var onCompactWidgetOptionsChanged: (@MainActor ([CompactWidgetOption]) -> Void)?

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        // The user script is injected into all frames, so only honour messages
        // from a frame actually served by our bundle. Combined with the
        // navigation policy (which keeps foreign content out of the web view),
        // this stops any embedded/remote content from driving the native shell.
        guard message.frameInfo.request.url?.scheme == dashboardURLScheme else {
            return
        }

        guard
            let body = message.body as? [String: Any],
            let type = body["type"] as? String
        else {
            return
        }

        switch type {
        case "visibility-changed":
            guard let visible = body["visible"] as? Bool else { return }
            onVisibilityChanged?(visible)
        case "window-mode-requested":
            guard
                let rawMode = body["mode"] as? String,
                let mode = DashboardWindowMode(bridgeValue: rawMode)
            else { return }
            onWindowModeRequested?(mode)
        case "widget-panels-changed":
            guard (body["schemaVersion"] as? NSNumber)?.intValue == 1,
                  let rawHostInstanceID = body["hostInstanceId"] as? String,
                  !rawHostInstanceID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                  let revision = (body["inventoryRevision"] as? NSNumber)?.intValue,
                  revision >= 0,
                  let rawWindowMode = body["windowMode"] as? String,
                  let windowMode = DashboardWindowMode(bridgeValue: rawWindowMode),
                  let widgets = body["widgets"] as? [[String: Any]]
            else { return }
            onWidgetPanelsChanged?(WidgetPanelInventoryPayload(
                hostInstanceID: rawHostInstanceID.trimmingCharacters(in: .whitespacesAndNewlines),
                revision: revision,
                windowMode: windowMode,
                widgets: widgets
            ))
            if let optionsPayload = body["compactWidgetOptions"] as? [[String: Any]] {
                onCompactWidgetOptionsChanged?(Self.compactWidgetOptions(from: optionsPayload))
            }
        default:
            return
        }
    }

    private static func compactWidgetOptions(from payload: [[String: Any]]) -> [CompactWidgetOption] {
        var seenWidgetTypes = Set<Int>()
        return payload.compactMap { option in
            guard let widgetType = (option["widgetType"] as? NSNumber)?.intValue,
                  let rawTitle = option["title"] as? String
            else { return nil }

            let title = rawTitle.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !title.isEmpty, seenWidgetTypes.insert(widgetType).inserted else { return nil }
            return CompactWidgetOption(widgetType: widgetType, title: title)
        }
    }
}
