import AppKit
import WebKit

/// Owns the authoritative React/Zustand widget store without presenting it.
/// Only WidgetPanelCoordinator is allowed to create visible widget windows.
@MainActor
final class WidgetHostController: NSObject, WKNavigationDelegate, WKUIDelegate {
    private let webView: WKWebView
    private let scriptMessageHandler: DashboardScriptMessageHandler
    private let widgetPanelCoordinator: WidgetPanelCoordinator
    private var lastInventoryWidgetIDs: Set<String> = []
    private var widgetIDsBeforePendingCreation: Set<String>?
    private var pendingWidgetCreation = false
    private var pendingRecoveryChanges: [WidgetPanelStateChange]?
    private var reloadInProgress = false
    private var pendingHostWriteCount = 0
    private var pendingHostWriteFailed = false
    private var hostWriteGeneration = 0
    private var pendingHostWriteWaiters: [(@MainActor (Bool) -> Void)] = []

    private(set) var widgetOptions: [CompactWidgetOption] = []

    override init() {
        let configuration = WKWebViewConfiguration()
        configuration.setURLSchemeHandler(
            DashboardWebKitShared.schemeHandler,
            forURLScheme: dashboardURLScheme
        )
        DashboardWebKitShared.schemeHandler.prewarmCriticalAssets()
        configuration.userContentController.addUserScript(WKUserScript(
            source: "window.__CLASSROOM_WIDGETS_MACOS__ = true;",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        ))

        scriptMessageHandler = DashboardScriptMessageHandler()
        widgetPanelCoordinator = WidgetPanelCoordinator(compactPresentationActive: true)
        webView = WKWebView(frame: .zero, configuration: configuration)
        super.init()

        ClassroomWebViewTuning.apply(to: webView)
        webView.setValue(false, forKey: "drawsBackground")
        webView.navigationDelegate = self
        webView.uiDelegate = self

        scriptMessageHandler.onWidgetPanelsChanged = { [weak self] inventory in
            self?.reconcileWidgetPanels(inventory)
        }
        scriptMessageHandler.onCompactWidgetOptionsChanged = { [weak self] options in
            self?.setWidgetOptions(options)
        }
        widgetPanelCoordinator.onPanelStateChange = { [weak self] change in
            self?.applyPanelStateChange(change)
        }
        widgetPanelCoordinator.onRandomiserListChange = { [weak self] change in
            self?.applyRandomiserListChange(change)
        }
        widgetPanelCoordinator.onWidgetCreationRequested = { [weak self] widgetType in
            self?.addWidget(widgetType)
        }
        widgetPanelCoordinator.onWidgetRemovalRequested = { [weak self] widgetID in
            self?.removeWidget(widgetID)
        }
        webView.configuration.userContentController.add(scriptMessageHandler, name: "classroomDashboard")

        applySettings()
        loadHost()
    }

    deinit {
        MainActor.assumeIsolated {
            webView.configuration.userContentController.removeScriptMessageHandler(forName: "classroomDashboard")
        }
    }

    func addWidget(_ widgetType: Int) {
        pendingWidgetCreation = true
        widgetIDsBeforePendingCreation = lastInventoryWidgetIDs
        webView.callAsyncJavaScript(
            """
            return (() => {
              const host = window.classroomPanelHost;
              return host?.addWidget ? host.addWidget(widgetType) : false;
            })()
            """,
            arguments: ["widgetType": widgetType],
            in: nil,
            in: .page
        ) { [weak self] result in
            guard case let .success(value) = result, value as? Bool == true else {
                self?.pendingWidgetCreation = false
                self?.widgetIDsBeforePendingCreation = nil
                if case let .failure(error) = result {
                    DashboardLog.web.error("Unable to add widget: \(error.localizedDescription, privacy: .public)")
                }
                return
            }
        }
    }

    func reloadWidgets() {
        guard !reloadInProgress else { return }
        reloadInProgress = true
        widgetPanelCoordinator.prepareForDeactivation { [weak self] changes, prepared in
            guard let self else { return }
            guard prepared else {
                self.reloadInProgress = false
                self.widgetPanelCoordinator.deactivate()
                self.widgetPanelCoordinator.activate()
                return
            }
            self.flushChangesAndReload(changes)
        }
    }

    func applySettings() {
        widgetPanelCoordinator.applyPresentationSettings(
            backgroundOpacity: backgroundOpacity,
            keepOnAllSpaces: UserDefaults.standard.bool(forKey: DashboardSettingKeys.keepOnAllSpaces)
        )
        setWebBackgroundOpacity(backgroundOpacity)
    }

    func flushPersistedState() {
        widgetPanelCoordinator.flushPersistedFrames()
    }

    func prepareForTermination() async -> Bool {
        flushPersistedState()
        guard !reloadInProgress else { return false }
        reloadInProgress = true
        guard let preparation: ([WidgetPanelStateChange], Bool) = await resultWithTimeout(
            nanoseconds: 2_000_000_000,
            operation: { completion in
                widgetPanelCoordinator.prepareForDeactivation { completion(($0, $1)) }
            }
        ), preparation.1 else {
            reloadInProgress = false
            widgetPanelCoordinator.deactivate()
            widgetPanelCoordinator.activate()
            return false
        }

        for retriesRemaining in stride(from: 20, through: 0, by: -1) {
            if await resultWithTimeout(operation: { completion in
                applyFinalPanelStateChanges(preparation.0, completion: completion)
            }) == true {
                widgetPanelCoordinator.deactivate()
                return true
            }
            if retriesRemaining > 0 {
                try? await Task.sleep(nanoseconds: 150_000_000)
            }
        }
        reloadInProgress = false
        widgetPanelCoordinator.deactivate()
        widgetPanelCoordinator.activate()
        return false
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        setWebBackgroundOpacity(backgroundOpacity)
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }
        if url.scheme == dashboardURLScheme || url.scheme == "about" {
            decisionHandler(.allow)
            return
        }
        decisionHandler(.cancel)
        if navigationAction.navigationType == .linkActivated {
            NSWorkspace.shared.open(url)
        }
    }

    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if let url = navigationAction.request.url, url.scheme != dashboardURLScheme {
            NSWorkspace.shared.open(url)
        }
        return nil
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        DashboardLog.web.error("Widget host process terminated; reloading")
        guard !reloadInProgress else {
            resetHostWriteTracking()
            loadHost()
            return
        }
        reloadInProgress = true
        widgetPanelCoordinator.prepareForDeactivation { [weak self] changes, _ in
            guard let self else { return }
            self.resetHostWriteTracking()
            self.pendingRecoveryChanges = changes
            self.widgetPanelCoordinator.deactivate()
            self.loadHost()
        }
    }

    private func loadHost() {
        var components = URLComponents()
        components.scheme = dashboardURLScheme
        components.host = "app"
        components.path = "/"
        components.queryItems = [
            URLQueryItem(name: "dashboard", value: "1"),
            URLQueryItem(name: "visible", value: "0"),
            URLQueryItem(name: "mode", value: "compact"),
            URLQueryItem(name: "backgroundOpacity", value: String(backgroundOpacity))
        ]
        if let url = components.url {
            webView.load(URLRequest(url: url))
        }
    }

    private func reconcileWidgetPanels(_ inventory: WidgetPanelInventoryPayload) {
        let descriptors = inventory.widgets.compactMap(Self.widgetPanelDescriptor(from:))
        guard widgetPanelCoordinator.reconcile(snapshot: WidgetPanelSnapshot(
            hostInstanceID: inventory.hostInstanceID,
            revision: inventory.revision,
            widgets: descriptors
        )) else { return }

        let widgetIDs = Set(descriptors.map(\.id))
        lastInventoryWidgetIDs = widgetIDs
        if pendingWidgetCreation,
           !widgetIDs.subtracting(widgetIDsBeforePendingCreation ?? []).isEmpty {
            pendingWidgetCreation = false
            widgetIDsBeforePendingCreation = nil
        }

        if let changes = pendingRecoveryChanges {
            pendingRecoveryChanges = nil
            finishRecovery(changes.filter { widgetIDs.contains($0.widgetID) })
            return
        }
        reloadInProgress = false
        widgetPanelCoordinator.activate()
    }

    private func setWidgetOptions(_ options: [CompactWidgetOption]) {
        guard options != widgetOptions else { return }
        widgetOptions = options
        widgetPanelCoordinator.setWidgetCreationOptions(options)
    }

    private func applyPanelStateChange(
        _ change: WidgetPanelStateChange,
        completion: (@MainActor (Bool) -> Void)? = nil
    ) {
        webView.callAsyncJavaScript(
            """
            return (() => {
              const host = window.classroomPanelHost;
              return host?.applyStateChange ? host.applyStateChange(change) : false;
            })()
            """,
            arguments: ["change": change.payload],
            in: nil,
            in: .page
        ) { result in
            if case let .failure(error) = result {
                DashboardLog.web.error("Unable to apply widget state: \(error.localizedDescription, privacy: .public)")
            }
            if case let .success(value) = result {
                completion?(value as? Bool == true)
            } else {
                completion?(false)
            }
        }
    }

    private func applyRandomiserListChange(_ change: WidgetPanelRandomiserListChange) {
        let generation = hostWriteGeneration
        pendingHostWriteCount += 1
        webView.callAsyncJavaScript(
            """
            return (() => {
              const host = window.classroomPanelHost;
              return host?.applyRandomiserListChange ? host.applyRandomiserListChange(change) : false;
            })()
            """,
            arguments: ["change": change.payload],
            in: nil,
            in: .page
        ) { [weak self] result in
            let succeeded: Bool
            if case let .success(value) = result {
                succeeded = value as? Bool == true
            } else {
                succeeded = false
            }
            self?.finishHostWrite(succeeded: succeeded, generation: generation)
        }
    }

    private func removeWidget(_ widgetID: String) {
        webView.callAsyncJavaScript(
            """
            return (() => {
              const host = window.classroomPanelHost;
              return host?.removeWidget ? host.removeWidget(widgetID) : false;
            })()
            """,
            arguments: ["widgetID": widgetID],
            in: nil,
            in: .page
        ) { result in
            if case let .failure(error) = result {
                DashboardLog.web.error("Unable to remove widget: \(error.localizedDescription, privacy: .public)")
            }
        }
    }

    private func flushChangesAndReload(_ changes: [WidgetPanelStateChange], retriesRemaining: Int = 20) {
        applyFinalPanelStateChanges(changes) { [weak self] applied in
            guard let self else { return }
            guard applied else {
                guard retriesRemaining > 0 else {
                    self.reloadInProgress = false
                    self.widgetPanelCoordinator.deactivate()
                    self.widgetPanelCoordinator.activate()
                    return
                }
                Task { @MainActor in
                    try? await Task.sleep(nanoseconds: 150_000_000)
                    self.flushChangesAndReload(changes, retriesRemaining: retriesRemaining - 1)
                }
                return
            }
            self.widgetPanelCoordinator.deactivate()
            self.resetHostWriteTracking()
            self.loadHost()
        }
    }

    private func finishRecovery(_ changes: [WidgetPanelStateChange], retriesRemaining: Int = 20) {
        applyFinalPanelStateChanges(changes) { [weak self] applied in
            guard let self else { return }
            guard applied || retriesRemaining == 0 else {
                Task { @MainActor in
                    try? await Task.sleep(nanoseconds: 150_000_000)
                    self.finishRecovery(changes, retriesRemaining: retriesRemaining - 1)
                }
                return
            }
            self.reloadInProgress = false
            self.widgetPanelCoordinator.activate()
        }
    }

    private func applyFinalPanelStateChanges(
        _ changes: [WidgetPanelStateChange],
        completion: @escaping @MainActor (Bool) -> Void
    ) {
        guard !changes.isEmpty else {
            awaitPendingHostWrites(completion: completion)
            return
        }
        var remaining = changes.count
        var allApplied = true
        for change in changes {
            applyPanelStateChange(change) { applied in
                allApplied = allApplied && applied
                remaining -= 1
                if remaining == 0 {
                    self.awaitPendingHostWrites { completion(allApplied && $0) }
                }
            }
        }
    }

    private func awaitPendingHostWrites(completion: @escaping @MainActor (Bool) -> Void) {
        guard pendingHostWriteCount > 0 else {
            completion(!pendingHostWriteFailed)
            return
        }
        pendingHostWriteWaiters.append(completion)
    }

    private func finishHostWrite(succeeded: Bool, generation: Int) {
        guard generation == hostWriteGeneration else { return }
        pendingHostWriteCount = max(0, pendingHostWriteCount - 1)
        pendingHostWriteFailed = pendingHostWriteFailed || !succeeded
        guard pendingHostWriteCount == 0 else { return }
        let waiters = pendingHostWriteWaiters
        pendingHostWriteWaiters.removeAll()
        let allSucceeded = !pendingHostWriteFailed
        waiters.forEach { $0(allSucceeded) }
    }

    private func resetHostWriteTracking() {
        let waiters = pendingHostWriteWaiters
        pendingHostWriteWaiters.removeAll()
        hostWriteGeneration += 1
        pendingHostWriteCount = 0
        pendingHostWriteFailed = false
        waiters.forEach { $0(false) }
    }

    private func resultWithTimeout<Value>(
        nanoseconds: UInt64 = 1_000_000_000,
        operation: (@escaping @MainActor (Value) -> Void) -> Void
    ) async -> Value? {
        await withCheckedContinuation { continuation in
            var completed = false
            let complete: @MainActor (Value?) -> Void = { value in
                guard !completed else { return }
                completed = true
                continuation.resume(returning: value)
            }
            operation { complete($0) }
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: nanoseconds)
                complete(nil)
            }
        }
    }

    private var backgroundOpacity: Double {
        min(max(UserDefaults.standard.double(forKey: DashboardSettingKeys.compactBackgroundOpacity), 0), 1)
    }

    private func setWebBackgroundOpacity(_ opacity: Double) {
        webView.evaluateJavaScript(
            "window.classroomDashboard?.setBackgroundOpacity?.(\(opacity)); true"
        )
    }

    private static func widgetPanelDescriptor(from payload: [String: Any]) -> WidgetPanelDescriptor? {
        guard (payload["schemaVersion"] as? NSNumber)?.intValue == 1,
              let id = payload["widgetId"] as? String, !id.isEmpty,
              let title = payload["title"] as? String,
              let preferred = payload["preferredSize"] as? [String: Any],
              let preferredWidth = (preferred["width"] as? NSNumber)?.doubleValue,
              let preferredHeight = (preferred["height"] as? NSNumber)?.doubleValue,
              let minimum = payload["minimumSize"] as? [String: Any],
              let minimumWidth = (minimum["width"] as? NSNumber)?.doubleValue,
              let minimumHeight = (minimum["height"] as? NSNumber)?.doubleValue,
              let maximumValue = payload["maximumSize"],
              let isResizable = payload["isResizable"] as? Bool,
              let maintainsAspectRatio = payload["maintainsAspectRatio"] as? Bool
        else { return nil }

        let maximumSize: WidgetPanelDescriptor.Size?
        if maximumValue is NSNull {
            maximumSize = nil
        } else if let maximum = maximumValue as? [String: Any],
                  let width = (maximum["width"] as? NSNumber)?.doubleValue,
                  let height = (maximum["height"] as? NSNumber)?.doubleValue {
            maximumSize = .init(width: CGFloat(width), height: CGFloat(height))
        } else {
            return nil
        }
        return WidgetPanelDescriptor(
            id: id,
            title: title,
            preferredContentSize: .init(width: CGFloat(preferredWidth), height: CGFloat(preferredHeight)),
            minimumContentSize: .init(width: CGFloat(minimumWidth), height: CGFloat(minimumHeight)),
            maximumContentSize: maximumSize,
            isResizable: isResizable,
            aspectRatio: maintainsAspectRatio && preferredHeight > 0 ? CGFloat(preferredWidth / preferredHeight) : nil,
            snapshotPayload: payload
        )
    }
}
