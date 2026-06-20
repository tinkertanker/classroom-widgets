import CoreGraphics
import WebKit

struct DashboardGlassRegion {
    let rect: CGRect
    let radius: CGFloat
}

@MainActor
final class DashboardScriptMessageHandler: NSObject, WKScriptMessageHandler {
    var onVisibilityChanged: (@MainActor (Bool) -> Void)?
    var onInteractiveRegionsChanged: (@MainActor ([CGRect]) -> Void)?
    var onGlassRegionsChanged: (@MainActor ([DashboardGlassRegion]) -> Void)?

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
        case "glass-regions-changed":
            guard let rawRegions = body["regions"] as? [[String: Double]] else { return }
            onGlassRegionsChanged?(rawRegions.map { region in
                DashboardGlassRegion(
                    rect: CGRect(
                        x: region["x"] ?? 0,
                        y: region["y"] ?? 0,
                        width: region["width"] ?? 0,
                        height: region["height"] ?? 0
                    ),
                    radius: CGFloat(region["radius"] ?? 0)
                )
            })
        default:
            return
        }
    }
}
