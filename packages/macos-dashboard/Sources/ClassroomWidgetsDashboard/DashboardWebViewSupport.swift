import Foundation
import WebKit

enum DashboardWebKitShared {
    static let schemeHandler = StaticFileSchemeHandler(webRoot: WebRootResolver.resolve())
    static let panelProcessPool = WKProcessPool()
}

enum ClassroomWebViewTuning {
    static func apply(to webView: WKWebView) {
        webView.allowsBackForwardNavigationGestures = false
        webView.allowsLinkPreview = false
    }
}

@MainActor
final class DebouncedDefaultsWriter {
    private var pending: [String: String] = [:]
    private var generation = 0
    private let delayNanoseconds: UInt64

    init(delayNanoseconds: UInt64 = 300_000_000) {
        self.delayNanoseconds = delayNanoseconds
    }

    func set(_ value: String, forKey key: String) {
        pending[key] = value
        generation += 1
        let scheduledGeneration = generation
        let delay = delayNanoseconds
        Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: delay)
            guard let self, self.generation == scheduledGeneration else { return }
            self.flush()
        }
    }

    func setImmediately(_ value: String, forKey key: String) {
        pending[key] = value
        flush()
    }

    func flush() {
        generation += 1
        guard !pending.isEmpty else { return }
        let values = pending
        pending.removeAll()
        let defaults = UserDefaults.standard
        values.forEach { defaults.set($0.value, forKey: $0.key) }
    }
}
