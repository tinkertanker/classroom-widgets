import SwiftUI
@preconcurrency import WebKit

enum PreviewLoadState: Equatable {
    case loading
    case ready
    case failed(String)
}

struct WidgetPreviewWebView: UIViewRepresentable {
    let spec: WidgetSpec
    let localAssets: [LocalWidgetAssetFile]
    @Binding var state: PreviewLoadState

    func makeCoordinator() -> Coordinator {
        Coordinator(state: $state, localAssets: localAssets)
    }

    func makeUIView(context: Context) -> WKWebView {
        let contentController = WKUserContentController()
        contentController.add(context.coordinator, name: Coordinator.bridgeName)

        let configuration = WKWebViewConfiguration()
        configuration.userContentController = contentController
        configuration.setURLSchemeHandler(
            context.coordinator.assetSchemeHandler,
            forURLScheme: LocalAssetSchemeHandler.scheme
        )
        configuration.userContentController.addUserScript(
            WKUserScript(
                source: "window.__CLASSROOM_WIDGET_ASSET_BASE_URL__ = 'classroom-widget-asset://assets/';",
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
        )
        configuration.websiteDataStore = .nonPersistent()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.preferences.isTextInteractionEnabled = true
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        configuration.mediaTypesRequiringUserActionForPlayback = .all

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsBackForwardNavigationGestures = false

        context.coordinator.attach(webView)
        context.coordinator.queue(spec)
        state = .loading

        if let entryURL = Self.playerEntryURL() {
            webView.loadFileURL(entryURL, allowingReadAccessTo: entryURL.deletingLastPathComponent())
        } else {
            webView.loadHTMLString(Self.emergencyFallbackHTML, baseURL: nil)
        }

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.state = $state
        context.coordinator.assetSchemeHandler.update(localAssets)
        context.coordinator.queue(spec)
    }

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: Coordinator.bridgeName)
        webView.navigationDelegate = nil
    }

    private static func playerEntryURL(bundle: Bundle = .main) -> URL? {
        let candidates = [
            bundle.url(forResource: "index", withExtension: "html", subdirectory: "widget-player"),
            bundle.url(forResource: "index", withExtension: "html", subdirectory: "PreviewFallback"),
            bundle.url(forResource: "index", withExtension: "html")
        ]
        return candidates.compactMap { $0 }.first
    }

    private static let emergencyFallbackHTML = """
    <!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>body{font:17px -apple-system;margin:0;padding:32px;color:#343330;background:#fdfcfb}main{max-width:680px;margin:auto}</style>
    </head><body><main><h1>Student preview</h1><p>The bundled player could not be found.</p></main>
    <script>window.webkit?.messageHandlers?.studioBridge?.postMessage({type:'ready'});</script></body></html>
    """

    @MainActor
    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        static let bridgeName = "studioBridge"

        var state: Binding<PreviewLoadState>
        fileprivate let assetSchemeHandler: LocalAssetSchemeHandler
        private weak var webView: WKWebView?
        private var pendingObject: Any?
        private var pendingFingerprint: Data?
        private var sentFingerprint: Data?
        private var playerIsReady = false

        init(state: Binding<PreviewLoadState>, localAssets: [LocalWidgetAssetFile]) {
            self.state = state
            assetSchemeHandler = LocalAssetSchemeHandler(localAssets: localAssets)
        }

        func attach(_ webView: WKWebView) {
            self.webView = webView
        }

        func queue(_ spec: WidgetSpec) {
            guard let data = try? JSONEncoder().encode(spec), data != pendingFingerprint else { return }
            pendingFingerprint = data
            pendingObject = try? JSONSerialization.jsonObject(with: data)
            sendPendingIfPossible()
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == Self.bridgeName,
                  let body = message.body as? [String: Any],
                  let type = body["type"] as? String
            else { return }

            switch type {
            case "ready":
                playerIsReady = true
                state.wrappedValue = .ready
                sendPendingIfPossible()
            case "error":
                let message = body["message"] as? String ?? "The student preview could not render this widget."
                state.wrappedValue = .failed(message)
            default:
                break
            }
        }

        func webView(
            _ webView: WKWebView,
            didFail navigation: WKNavigation!,
            withError error: Error
        ) {
            state.wrappedValue = .failed(error.localizedDescription)
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: Error
        ) {
            state.wrappedValue = .failed(error.localizedDescription)
        }

        private func sendPendingIfPossible() {
            guard playerIsReady,
                  pendingFingerprint != sentFingerprint,
                  let pendingObject,
                  let webView
            else { return }

            let script = """
            if (window.ClassroomWidgetsPlayer?.load) {
              window.ClassroomWidgetsPlayer.load(spec);
            } else {
              window.dispatchEvent(new CustomEvent('classroom-widgets:load', { detail: spec }));
            }
            """

            let fingerprint = pendingFingerprint
            sentFingerprint = fingerprint
            Task { @MainActor [weak self, weak webView] in
                guard let self, let webView else { return }
                do {
                    let _: Any? = try await webView.callAsyncJavaScript(
                        script,
                        arguments: ["spec": pendingObject],
                        in: nil,
                        contentWorld: .page
                    )
                    self.state.wrappedValue = .ready
                } catch {
                    if self.sentFingerprint == fingerprint {
                        self.sentFingerprint = nil
                    }
                    self.state.wrappedValue = .failed(error.localizedDescription)
                }
            }
        }
    }
}

fileprivate final class LocalAssetSchemeHandler: NSObject, WKURLSchemeHandler, @unchecked Sendable {
    static let scheme = "classroom-widget-asset"

    private let lock = NSLock()
    private var assets: [String: LocalWidgetAssetFile]

    init(localAssets: [LocalWidgetAssetFile]) {
        assets = Dictionary(uniqueKeysWithValues: localAssets.map { ($0.id, $0) })
    }

    func update(_ localAssets: [LocalWidgetAssetFile]) {
        lock.withLock {
            assets = Dictionary(uniqueKeysWithValues: localAssets.map { ($0.id, $0) })
        }
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: any WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url,
              url.scheme == Self.scheme,
              url.host == "assets",
              url.pathComponents.count == 2,
              let assetID = url.lastPathComponent.removingPercentEncoding,
              let asset = lock.withLock({ assets[assetID] }),
              let fileURL = LocalWidgetAssetStorage.url(for: asset)
        else {
            urlSchemeTask.didFailWithError(URLError(.fileDoesNotExist))
            return
        }

        do {
            let data = try Data(contentsOf: fileURL, options: .mappedIfSafe)
            let response = URLResponse(
                url: url,
                mimeType: asset.mediaType,
                expectedContentLength: data.count,
                textEncodingName: nil
            )
            urlSchemeTask.didReceive(response)
            urlSchemeTask.didReceive(data)
            urlSchemeTask.didFinish()
        } catch {
            urlSchemeTask.didFailWithError(error)
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: any WKURLSchemeTask) {}
}
