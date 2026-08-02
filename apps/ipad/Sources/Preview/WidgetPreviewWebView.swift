import SwiftUI
@preconcurrency import WebKit

enum PreviewLoadState: Equatable {
    case loading
    case ready
    case failed(String)
}

struct WidgetPreviewWebView: UIViewRepresentable {
    let source: ArtifactSource
    let localAssets: [LocalWidgetAssetFile]
    @Binding var state: PreviewLoadState
    @Binding var presentableError: String?
    var onSnapshot: ((Data) -> Void)?

    init(
        source: ArtifactSource,
        localAssets: [LocalWidgetAssetFile],
        state: Binding<PreviewLoadState> = .constant(.loading),
        presentableError: Binding<String?> = .constant(nil),
        onSnapshot: ((Data) -> Void)? = nil
    ) {
        self.source = source
        self.localAssets = localAssets
        _state = state
        _presentableError = presentableError
        self.onSnapshot = onSnapshot
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(state: $state, presentableError: $presentableError, onSnapshot: onSnapshot, assets: localAssets)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.preferences.isTextInteractionEnabled = true
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        configuration.mediaTypesRequiringUserActionForPlayback = .all
        configuration.setURLSchemeHandler(context.coordinator.handler, forURLScheme: AssetSchemeHandler.scheme)

        let view = WKWebView(frame: .zero, configuration: configuration)
        view.navigationDelegate = context.coordinator
        view.isOpaque = false
        view.backgroundColor = .clear
        view.scrollView.contentInsetAdjustmentBehavior = .never
        view.allowsBackForwardNavigationGestures = false
        context.coordinator.view = view
        context.coordinator.load(source)
        return view
    }

    func updateUIView(_ view: WKWebView, context: Context) {
        context.coordinator.state = $state
        context.coordinator.presentableError = $presentableError
        context.coordinator.onSnapshot = onSnapshot
        context.coordinator.handler.assets = localAssets
        let coordinator = context.coordinator
        DispatchQueue.main.async {
            coordinator.load(source)
        }
    }

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate {
        var state: Binding<PreviewLoadState>
        var presentableError: Binding<String?>
        var onSnapshot: ((Data) -> Void)?
        let handler: AssetSchemeHandler
        weak var view: WKWebView?
        private var displayed: ArtifactSource?
        private var requested: ArtifactSource?
        private var activeNavigation: WKNavigation?
        private var rejectedRevisionID: String?
        private var restoring = false
        private var snapshottedRevisionIDs: Set<String> = []

        init(state: Binding<PreviewLoadState>, presentableError: Binding<String?>, onSnapshot: ((Data) -> Void)?, assets: [LocalWidgetAssetFile]) {
            self.state = state
            self.presentableError = presentableError
            self.onSnapshot = onSnapshot
            handler = AssetSchemeHandler(assets)
        }

        func load(_ source: ArtifactSource) {
            guard source.revision.id != rejectedRevisionID,
                  source.revision.id != requested?.revision.id
            else { return }
            rejectedRevisionID = nil
            requested = source
            restoring = false
            state.wrappedValue = .loading
            activeNavigation = view?.loadHTMLString(
                source.html,
                baseURL: AssetSchemeHandler.documentBaseURL
            )
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            guard navigation === activeNavigation, let requested else { return }
            activeNavigation = nil
            displayed = requested
            state.wrappedValue = .ready
            if restoring {
                restoring = false
                return
            }
            guard snapshottedRevisionIDs.insert(requested.revision.id).inserted else { return }
            let revisionID = requested.revision.id
            webView.takeSnapshot(with: nil) { [weak self] image, _ in
                guard self?.displayed?.revision.id == revisionID,
                      let data = image?.jpegData(compressionQuality: 0.72)
                else { return }
                self?.onSnapshot?(data)
            }
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            guard navigation === activeNavigation else { return }
            recover(webView)
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: Error
        ) {
            guard navigation === activeNavigation else { return }
            recover(webView)
        }

        private func recover(_ webView: WKWebView) {
            guard !restoring else { return }
            activeNavigation = nil
            let message = "The new preview could not open. Your previous preview was restored."
            state.wrappedValue = .failed(message)
            presentableError.wrappedValue = message
            guard let displayed, displayed.revision.id != requested?.revision.id else { return }
            rejectedRevisionID = requested?.revision.id
            restoring = true
            requested = displayed
            activeNavigation = webView.loadHTMLString(
                displayed.html,
                baseURL: AssetSchemeHandler.documentBaseURL
            )
        }
    }
}

final class AssetSchemeHandler: NSObject, WKURLSchemeHandler, @unchecked Sendable {
    static let scheme = "classroom-widget"
    static let documentBaseURL = URL(string: "classroom-widget://preview/")!
    private let lock = NSLock()
    private var stored: [LocalWidgetAssetFile]

    var assets: [LocalWidgetAssetFile] {
        get { lock.withLock { stored } }
        set { lock.withLock { stored = newValue } }
    }

    init(_ assets: [LocalWidgetAssetFile]) { stored = assets }

    static func assetID(from url: URL) -> String? {
        guard url.scheme == scheme, url.host == "preview" else { return nil }
        let components = url.pathComponents.filter { $0 != "/" }
        guard components.count == 2, components[0] == "assets" else { return nil }
        return components[1].removingPercentEncoding
    }

    func webView(_ webView: WKWebView, start task: any WKURLSchemeTask) {
        guard let requestURL = task.request.url,
              let id = Self.assetID(from: requestURL),
              let asset = assets.first(where: { $0.id == id }),
              let fileURL = LocalWidgetAssetStorage.url(for: asset),
              let data = try? Data(contentsOf: fileURL)
        else {
            task.didFailWithError(URLError(.fileDoesNotExist))
            return
        }
        task.didReceive(URLResponse(url: requestURL, mimeType: asset.mediaType, expectedContentLength: data.count, textEncodingName: nil))
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: any WKURLSchemeTask) {}
}
