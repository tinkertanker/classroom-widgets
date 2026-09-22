import CoreFoundation
import WebKit

func dashboardInteger(_ value: Any?) -> Int? {
    guard let number = value as? NSNumber,
          CFGetTypeID(number) != CFBooleanGetTypeID()
    else { return nil }

    var decimal = number.decimalValue
    guard !decimal.isNaN else { return nil }
    var rounded = Decimal()
    NSDecimalRound(&rounded, &decimal, 0, .plain)
    guard decimal == rounded,
          decimal >= Decimal(Int.min),
          decimal <= Decimal(Int.max)
    else { return nil }
    return Int(NSDecimalNumber(decimal: decimal).stringValue)
}

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
    let widgets: [[String: Any]]
}

@MainActor
final class DashboardScriptMessageHandler: NSObject, WKScriptMessageHandler {
    var onWidgetPanelsChanged: (@MainActor (WidgetPanelInventoryPayload) -> Void)?
    var onCompactWidgetOptionsChanged: (@MainActor ([CompactWidgetOption]) -> Void)?
    var onDesktopLauncherAddWidget: (@MainActor (Int) -> Void)?
    var onDesktopLauncherClose: (@MainActor () -> Void)?
    var onDesktopLauncherOpenDisplayPreview: (@MainActor () -> Void)?

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
        case "desktop-launcher-add-widget":
            guard dashboardInteger(body["schemaVersion"]) == 1,
                  let widgetType = dashboardInteger(body["widgetType"])
            else { return }
            onDesktopLauncherAddWidget?(widgetType)
        case "desktop-launcher-close":
            guard dashboardInteger(body["schemaVersion"]) == 1 else { return }
            onDesktopLauncherClose?()
        case "desktop-launcher-open-display-preview":
            guard dashboardInteger(body["schemaVersion"]) == 1 else { return }
            onDesktopLauncherOpenDisplayPreview?()
        case "widget-panels-changed":
            guard dashboardInteger(body["schemaVersion"]) == 1,
                  let rawHostInstanceID = body["hostInstanceId"] as? String,
                  !rawHostInstanceID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                  let revision = dashboardInteger(body["inventoryRevision"]),
                  revision >= 0,
                  let widgets = body["widgets"] as? [[String: Any]]
            else { return }
            onWidgetPanelsChanged?(WidgetPanelInventoryPayload(
                hostInstanceID: rawHostInstanceID.trimmingCharacters(in: .whitespacesAndNewlines),
                revision: revision,
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
            guard let widgetType = dashboardInteger(option["widgetType"]),
                  let rawTitle = option["title"] as? String
            else { return nil }

            let title = rawTitle.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !title.isEmpty, seenWidgetTypes.insert(widgetType).inserted else { return nil }
            return CompactWidgetOption(widgetType: widgetType, title: title)
        }
    }
}
