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
            context.coordinator.resourceSchemeHandler,
            forURLScheme: StudioResourceSchemeHandler.scheme
        )
        configuration.userContentController.addUserScript(
            WKUserScript(
                source: """
                window.__CLASSROOM_WIDGET_ASSET_BASE_URL__ = 'classroom-widget://studio/assets/';
                window.__CLASSROOM_WIDGET_PREVIEW_BOOTED__ = false;
                window.addEventListener('error', function (event) {
                  if (window.__CLASSROOM_WIDGET_PREVIEW_BOOTED__) return;
                  if (!event.error && !event.message) return;
                  window.webkit?.messageHandlers?.studioBridge?.postMessage({
                    type: 'error',
                    message: 'The student preview could not start.'
                  });
                });
                window.addEventListener('unhandledrejection', function () {
                  if (window.__CLASSROOM_WIDGET_PREVIEW_BOOTED__) return;
                  window.webkit?.messageHandlers?.studioBridge?.postMessage({
                    type: 'error',
                    message: 'The student preview could not start.'
                  });
                });
                """,
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
        webView.load(URLRequest(url: StudioResourceSchemeHandler.playerEntryURL))

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.state = $state
        context.coordinator.resourceSchemeHandler.update(localAssets)
        context.coordinator.queue(spec)
    }

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: Coordinator.bridgeName)
        webView.navigationDelegate = nil
        coordinator.detach()
    }

    @MainActor
    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        static let bridgeName = "studioBridge"

        var state: Binding<PreviewLoadState>
        fileprivate let resourceSchemeHandler: StudioResourceSchemeHandler
        private weak var webView: WKWebView?
        private var pendingObject: Any?
        private var pendingFingerprint: Data?
        private var sentFingerprint: Data?
        private var playerIsReady = false
        private var navigationGeneration = 0
        private var navigationTask: Task<Void, Never>?
        private var handshakeTask: Task<Void, Never>?
        private var loadTask: Task<Void, Never>?
        private var inFlightFingerprint: Data?
        private let navigationTimeout: Duration

        init(
            state: Binding<PreviewLoadState>,
            localAssets: [LocalWidgetAssetFile],
            navigationTimeout: Duration = .seconds(30)
        ) {
            self.state = state
            resourceSchemeHandler = StudioResourceSchemeHandler(localAssets: localAssets)
            self.navigationTimeout = navigationTimeout
        }

        func attach(_ webView: WKWebView) {
            self.webView = webView
        }

        func detach() {
            navigationTask?.cancel()
            navigationTask = nil
            handshakeTask?.cancel()
            handshakeTask = nil
            loadTask?.cancel()
            loadTask = nil
            inFlightFingerprint = nil
            webView = nil
        }

        func queue(_ spec: WidgetSpec) {
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.sortedKeys]
            guard let data = try? encoder.encode(spec), data != pendingFingerprint else { return }
            pendingFingerprint = data
            pendingObject = try? JSONSerialization.jsonObject(with: data)
            if playerIsReady {
                state.wrappedValue = .loading
            }
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
                navigationTask?.cancel()
                navigationTask = nil
                webView?.evaluateJavaScript("window.__CLASSROOM_WIDGET_PREVIEW_BOOTED__ = true;")
                handshakeTask?.cancel()
                handshakeTask = nil
                if pendingFingerprint == sentFingerprint {
                    state.wrappedValue = .ready
                } else {
                    state.wrappedValue = .loading
                    sendPendingIfPossible()
                }
            case "loaded":
                guard playerIsReady, let fingerprint = inFlightFingerprint else { return }
                loadTask?.cancel()
                loadTask = nil
                inFlightFingerprint = nil
                sentFingerprint = fingerprint
                if pendingFingerprint == fingerprint {
                    state.wrappedValue = .ready
                } else {
                    sendPendingIfPossible()
                }
            case "error":
                let message = body["message"] as? String ?? "The student preview could not render this widget."
                navigationTask?.cancel()
                navigationTask = nil
                handshakeTask?.cancel()
                handshakeTask = nil
                loadTask?.cancel()
                loadTask = nil
                inFlightFingerprint = nil
                state.wrappedValue = .failed(message)
            default:
                break
            }
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            navigationGeneration += 1
            playerIsReady = false
            sentFingerprint = nil
            handshakeTask?.cancel()
            handshakeTask = nil
            loadTask?.cancel()
            loadTask = nil
            inFlightFingerprint = nil
            state.wrappedValue = .loading

            let generation = navigationGeneration
            let timeout = navigationTimeout
            navigationTask?.cancel()
            navigationTask = Task { @MainActor [weak self] in
                try? await Task.sleep(for: timeout)
                guard let self,
                      !Task.isCancelled,
                      self.navigationGeneration == generation,
                      !self.playerIsReady
                else { return }
                self.navigationTask = nil
                self.state.wrappedValue = .failed(
                    "The student preview took too long to open. Reload it and try again."
                )
            }
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            navigationTask?.cancel()
            navigationTask = nil
            sendPendingIfPossible()
            guard !playerIsReady else { return }

            let generation = navigationGeneration
            handshakeTask?.cancel()
            handshakeTask = Task { @MainActor [weak self] in
                try? await Task.sleep(for: .seconds(8))
                guard let self,
                      !Task.isCancelled,
                      self.navigationGeneration == generation,
                      !self.playerIsReady
                else { return }
                self.state.wrappedValue = .failed(
                    "The student preview did not start. Reload it and try again."
                )
            }
        }

        func webView(
            _ webView: WKWebView,
            didFail navigation: WKNavigation!,
            withError error: Error
        ) {
            navigationTask?.cancel()
            navigationTask = nil
            handshakeTask?.cancel()
            handshakeTask = nil
            loadTask?.cancel()
            loadTask = nil
            inFlightFingerprint = nil
            state.wrappedValue = .failed(
                "The student preview could not open. Reload it and try again."
            )
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: Error
        ) {
            navigationTask?.cancel()
            navigationTask = nil
            handshakeTask?.cancel()
            handshakeTask = nil
            loadTask?.cancel()
            loadTask = nil
            inFlightFingerprint = nil
            state.wrappedValue = .failed(
                "The student preview could not open. Reload it and try again."
            )
        }

        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            navigationTask?.cancel()
            navigationTask = nil
            handshakeTask?.cancel()
            handshakeTask = nil
            loadTask?.cancel()
            loadTask = nil
            inFlightFingerprint = nil
            playerIsReady = false
            state.wrappedValue = .failed(
                "The student preview stopped unexpectedly. Reload it and try again."
            )
        }

        private func sendPendingIfPossible() {
            guard playerIsReady,
                  pendingFingerprint != sentFingerprint,
                  inFlightFingerprint == nil,
                  let fingerprint = pendingFingerprint,
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

            let generation = navigationGeneration
            inFlightFingerprint = fingerprint
            state.wrappedValue = .loading
            loadTask = Task { @MainActor [weak self, weak webView] in
                guard let self, let webView else { return }
                do {
                    let _: Any? = try await webView.callAsyncJavaScript(
                        script,
                        arguments: ["spec": pendingObject],
                        in: nil,
                        contentWorld: .page
                    )
                    guard !Task.isCancelled,
                          self.navigationGeneration == generation,
                          self.inFlightFingerprint == fingerprint
                    else { return }
                    try? await Task.sleep(for: .seconds(8))
                    guard !Task.isCancelled,
                          self.navigationGeneration == generation,
                          self.inFlightFingerprint == fingerprint
                    else { return }
                    self.loadTask = nil
                    self.inFlightFingerprint = nil
                    self.state.wrappedValue = .failed(
                        "The student preview did not finish rendering. Reload it and try again."
                    )
                } catch {
                    guard !Task.isCancelled,
                          self.navigationGeneration == generation,
                          self.inFlightFingerprint == fingerprint
                    else { return }
                    self.loadTask = nil
                    self.inFlightFingerprint = nil
                    if self.pendingFingerprint == fingerprint {
                        self.state.wrappedValue = .failed(
                            "The student preview could not update. Reload it and try again."
                        )
                    } else {
                        self.sendPendingIfPossible()
                    }
                }
            }
        }
    }
}

fileprivate final class StudioResourceSchemeHandler: NSObject, WKURLSchemeHandler, @unchecked Sendable {
    static let scheme = "classroom-widget"
    static let playerEntryURL = URL(string: "classroom-widget://studio/player/index.html")!

    private let lock = NSLock()
    private var assets: [String: LocalWidgetAssetFile]
    private let bundle: Bundle

    init(localAssets: [LocalWidgetAssetFile], bundle: Bundle = .main) {
        assets = Dictionary(uniqueKeysWithValues: localAssets.map { ($0.id, $0) })
        self.bundle = bundle
    }

    func update(_ localAssets: [LocalWidgetAssetFile]) {
        lock.withLock {
            assets = Dictionary(uniqueKeysWithValues: localAssets.map { ($0.id, $0) })
        }
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: any WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url,
              url.scheme == Self.scheme,
              url.host == "studio"
        else {
            urlSchemeTask.didFailWithError(URLError(.fileDoesNotExist))
            return
        }

        let components = url.path.split(separator: "/").map(String.init)
        switch components.first {
        case "player":
            servePlayerResource(pathComponents: Array(components.dropFirst()), task: urlSchemeTask)
        case "assets":
            serveLocalAsset(pathComponents: Array(components.dropFirst()), task: urlSchemeTask)
        default:
            urlSchemeTask.didFailWithError(URLError(.fileDoesNotExist))
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: any WKURLSchemeTask) {}

    private func servePlayerResource(
        pathComponents: [String],
        task: any WKURLSchemeTask
    ) {
        let safeComponents = pathComponents.isEmpty ? ["index.html"] : pathComponents
        guard safeComponents.allSatisfy({ !$0.isEmpty && $0 != "." && $0 != ".." }),
              let rootURL = bundle.resourceURL?.appendingPathComponent(
                "widget-player",
                isDirectory: true
              )
        else {
            task.didFailWithError(URLError(.fileDoesNotExist))
            return
        }

        let fileURL = safeComponents.reduce(rootURL) { partialURL, component in
            partialURL.appendingPathComponent(component, isDirectory: false)
        }.standardizedFileURL
        let rootPath = rootURL.standardizedFileURL.path + "/"
        guard fileURL.path.hasPrefix(rootPath) else {
            task.didFailWithError(URLError(.noPermissionsToReadFile))
            return
        }

        serve(fileURL: fileURL, responseURL: task.request.url, task: task)
    }

    private func serveLocalAsset(
        pathComponents: [String],
        task: any WKURLSchemeTask
    ) {
        guard pathComponents.count == 1,
              let assetID = pathComponents[0].removingPercentEncoding,
              let asset = lock.withLock({ assets[assetID] }),
              let fileURL = LocalWidgetAssetStorage.url(for: asset)
        else {
            task.didFailWithError(URLError(.fileDoesNotExist))
            return
        }

        serve(
            fileURL: fileURL,
            responseURL: task.request.url,
            mimeType: asset.mediaType,
            task: task
        )
    }

    private func serve(
        fileURL: URL,
        responseURL: URL?,
        mimeType: String? = nil,
        task: any WKURLSchemeTask
    ) {
        do {
            let data = try Data(contentsOf: fileURL, options: .mappedIfSafe)
            let response = URLResponse(
                url: responseURL ?? fileURL,
                mimeType: mimeType ?? Self.mimeType(for: fileURL),
                expectedContentLength: data.count,
                textEncodingName: Self.isTextResource(fileURL) ? "utf-8" : nil
            )
            task.didReceive(response)
            task.didReceive(data)
            task.didFinish()
        } catch {
            task.didFailWithError(error)
        }
    }

    private static func mimeType(for url: URL) -> String {
        switch url.pathExtension.lowercased() {
        case "html": "text/html"
        case "js": "text/javascript"
        case "css": "text/css"
        case "json": "application/json"
        case "svg": "image/svg+xml"
        case "png": "image/png"
        case "jpg", "jpeg": "image/jpeg"
        case "webp": "image/webp"
        case "avif": "image/avif"
        case "woff": "font/woff"
        case "woff2": "font/woff2"
        default: "application/octet-stream"
        }
    }

    private static func isTextResource(_ url: URL) -> Bool {
        ["html", "js", "css", "json", "svg"].contains(url.pathExtension.lowercased())
    }
}
