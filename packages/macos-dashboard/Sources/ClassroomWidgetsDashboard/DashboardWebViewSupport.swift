import AppKit
import Foundation
import WebKit

enum ExternalLinkOpener {
    static let allowedSchemes: Set<String> = ["http", "https", "mailto"]

    static func isAllowed(_ url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased() else { return false }
        return allowedSchemes.contains(scheme)
    }

    @discardableResult
    static func open(_ url: URL, using open: (URL) -> Void = { NSWorkspace.shared.open($0) }) -> Bool {
        guard isAllowed(url) else {
            DashboardLog.web.error("Blocked external link with disallowed scheme: \(url.scheme ?? "nil", privacy: .public)")
            return false
        }
        open(url)
        return true
    }
}

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
    private let defaults: UserDefaults

    init(delayNanoseconds: UInt64 = 300_000_000, defaults: UserDefaults = .standard) {
        self.delayNanoseconds = delayNanoseconds
        self.defaults = defaults
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

    func flush() {
        generation += 1
        guard !pending.isEmpty else { return }
        let values = pending
        pending.removeAll()
        values.forEach { defaults.set($0.value, forKey: $0.key) }
    }
}
