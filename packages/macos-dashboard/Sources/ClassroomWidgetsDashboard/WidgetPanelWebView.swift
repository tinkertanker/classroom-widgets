import AppKit
import WebKit

@MainActor
final class WidgetPanelWebViewFactory {
    func makeWebView(widgetID: String) -> (webView: WKWebView, messageHandler: WidgetPanelScriptMessageHandler) {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.processPool = DashboardWebKitShared.panelProcessPool
        configuration.allowsAirPlayForMediaPlayback = false
        configuration.setURLSchemeHandler(DashboardWebKitShared.schemeHandler, forURLScheme: dashboardURLScheme)

        let userContentController = WKUserContentController()
        userContentController.addUserScript(WKUserScript(
            source: DesktopHostScripts.macosFlag + DashboardAudioSettings.script(),
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        ))
        let messageHandler = WidgetPanelScriptMessageHandler(widgetID: widgetID)
        userContentController.add(messageHandler, name: "classroomWidgetPanel")
        PerfProbe.install(in: userContentController, surface: "widget-panel", id: widgetID)
        configuration.userContentController = userContentController

        let webView = WKWebView(frame: .zero, configuration: configuration)
        ClassroomWebViewTuning.apply(to: webView)
        webView.setValue(false, forKey: "drawsBackground")
        return (webView, messageHandler)
    }
}

@MainActor
final class WidgetPanelScriptMessageHandler: NSObject, WKScriptMessageHandler {
    var onReady: (@MainActor () -> Void)?
    var onContentReady: (@MainActor () -> Void)?
    var onStateChange: (@MainActor (WidgetPanelStateChange) -> Void)?
    var onRandomiserListChange: (@MainActor (WidgetPanelRandomiserListChange) -> Void)?
    var onWritesCheckpoint: (@MainActor () -> Void)?

    private let widgetID: String

    init(widgetID: String) {
        self.widgetID = widgetID
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.request.url?.scheme == dashboardURLScheme,
              let body = message.body as? [String: Any],
              let type = body["type"] as? String
        else { return }

        let requestedWidgetID = body["widgetId"] as? String
        guard requestedWidgetID == nil || requestedWidgetID == widgetID else { return }
        let revision = (body["baseRevision"] as? NSNumber)?.intValue

        switch type {
        case "open-settings":
            NSApp.sendAction(#selector(AppDelegate.showSettings), to: NSApp.delegate, from: nil)
        case "panel-ready":
            onReady?()
        case "panel-content-ready":
            onContentReady?()
        case "panel-state-change":
            guard revision != nil, body["state"] != nil else { return }
            var payload = body
            payload.removeValue(forKey: "flush")
            onStateChange?(WidgetPanelStateChange(widgetID: widgetID, payload: payload))
        case "randomiser-list-save":
            guard (body["schemaVersion"] as? NSNumber)?.intValue == 1,
                  let name = body["name"] as? String,
                  !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                  let choices = body["choices"] as? [String],
                  choices.count <= 10_000
            else { return }
            onRandomiserListChange?(WidgetPanelRandomiserListChange(payload: body))
        case "randomiser-list-delete":
            guard (body["schemaVersion"] as? NSNumber)?.intValue == 1,
                  let id = body["id"] as? String,
                  !id.isEmpty
            else { return }
            onRandomiserListChange?(WidgetPanelRandomiserListChange(payload: body))
        case "panel-writes-checkpoint":
            onWritesCheckpoint?()
        default:
            return
        }
    }
}
