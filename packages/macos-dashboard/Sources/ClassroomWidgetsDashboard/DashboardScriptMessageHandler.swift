import CoreGraphics
import WebKit

@MainActor
final class DashboardScriptMessageHandler: NSObject, WKScriptMessageHandler {
    var onVisibilityChanged: (@MainActor (Bool) -> Void)?
    var onInteractiveRegionsChanged: (@MainActor ([CGRect]) -> Void)?

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
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
        case "interactive-regions-changed":
            guard let rawRegions = body["regions"] as? [[String: Double]] else { return }
            onInteractiveRegionsChanged?(rawRegions.map { region in
                CGRect(
                    x: region["x"] ?? 0,
                    y: region["y"] ?? 0,
                    width: region["width"] ?? 0,
                    height: region["height"] ?? 0
                )
            })
        default:
            return
        }
    }
}
