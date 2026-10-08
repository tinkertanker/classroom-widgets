import AppKit
import WebKit
import XCTest
@testable import ClassroomWidgets

final class WidgetCheckpointTests: XCTestCase {
    @MainActor
    func testFailedReloadPreservesHealthyPendingEdits() async throws {
        try await exerciseFailedCheckpoint(quit: false)
    }

    @MainActor
    func testRefusedQuitPreservesHealthyPendingEdits() async throws {
        try await exerciseFailedCheckpoint(quit: true)
    }

    @MainActor
    func testFailedReloadDoesNotExposeStaleEditorWhileHealthyCheckpointIsPending() async throws {
        try await exerciseFailedCheckpoint(quit: false, delayRecovery: true)
    }

    @MainActor
    private func exerciseFailedCheckpoint(quit: Bool, delayRecovery: Bool = false) async throws {
        try XCTSkipUnless(FileManager.default.fileExists(atPath: WebRootResolver.resolve().appendingPathComponent("index.html").path),
                          "Build teacher assets with pnpm --filter @classroom-widgets/teacher build:desktop")
        _ = NSApplication.shared
        let panels = WidgetPanelCoordinator()
        let host = WidgetHostController(websiteDataStore: .nonPersistent(), panelCoordinator: panels)
        defer { panels.deactivate(); host.webView.stopLoading() }
        try await waitUntil { !host.widgetOptions.isEmpty }
        print("CHECKPOINT fixture: host loaded")
        host.addWidget(2) // List
        host.addWidget(12) // QR Code
        try await waitUntil { self.panelWebView(title: "List") != nil && self.panelWebView(title: "QR Code") != nil }
        let list = try XCTUnwrap(panelWebView(title: "List"))
        let qr = try XCTUnwrap(panelWebView(title: "QR Code"))
        try await waitUntil { (try? await list.evaluateJavaScript("!!document.querySelector('textarea')")) as? Bool == true }
        try await waitUntil { (try? await qr.evaluateJavaScript("!!window.classroomWidgetPanel")) as? Bool == true }
        print("CHECKPOINT fixture: List and QR loaded")

        // Keep A in flight by withholding its acknowledgement. A subsequent real
        // textarea edit queues AB in React, rather than handing native a fake state.
        _ = try await list.evaluateJavaScript("window.classroomWidgetPanel.receiveSnapshot = () => {}; true")
        try await type("A", in: list)
        try await waitUntil { try await self.hostContains("A", host: host) }
        try await type("AB", in: list)
        let alreadySaved = try await hostContains("AB", host: host)
        XCTAssertFalse(alreadySaved, "The last edit must still be pending, not already saved")
        _ = try await qr.evaluateJavaScript("window.classroomWidgetPanel.takePendingState = () => null; true")

        if delayRecovery {
            // Hold host applications in FIFO order, modelling a slow host without
            // blocking the independent panel renderer or reordering user edits.
            _ = try await host.webView.evaluateJavaScript("""
                (() => {
                  const apply = window.classroomPanelHost.applyStateChange;
                  window.deferredPanelChanges = [];
                  window.classroomPanelHost.applyStateChange = change => new Promise(resolve => {
                    window.deferredPanelChanges.push(() => resolve(apply(change)));
                  });
                  window.releasePanelChanges = () => {
                    window.classroomPanelHost.applyStateChange = apply;
                    window.deferredPanelChanges.splice(0).forEach(run => run());
                    return true;
                  };
                })()
                """)
        }

        if quit {
            let ready = await host.prepareForTermination()
            XCTAssertFalse(ready, "The unresponsive QR checkpoint must refuse quit")
        } else {
            host.reloadWidgets()
        }
        if delayRecovery {
            try await waitUntil { (try? await host.webView.evaluateJavaScript("window.deferredPanelChanges.length > 0")) as? Bool == true }
            try await Task.sleep(nanoseconds: 600_000_000)
            let stale = panelWebView(title: "List")
            if let stale {
                try await waitUntil { (try? await stale.evaluateJavaScript("!!document.querySelector('textarea')")) as? Bool == true }
                let before = try await stale.evaluateJavaScript("document.querySelector('textarea').value")
                try await type("AC", in: stale)
                try await waitUntil { (try? await host.webView.evaluateJavaScript("window.deferredPanelChanges.length == 2")) as? Bool == true }
                let edited = try await stale.evaluateJavaScript("document.querySelector('textarea').value")
                print("SLOW-HOST staleEditor=\(before) userEdited=\(edited) queuedApplications=2")
            }
            XCTAssertNil(stale, "Do not expose an editable stale snapshot while the healthy checkpoint is unapplied")
            _ = try await host.webView.evaluateJavaScript("window.releasePanelChanges()")
            try await waitUntil { (try? await self.panelWebView(title: "List")?.evaluateJavaScript("document.querySelector('textarea')?.value")) as? String == "AB" }
        }
        try await waitUntil { self.panelWebView(title: "List").map { $0 !== list } == true }
        let rebuilt = try XCTUnwrap(panelWebView(title: "List"))
        try await waitUntil { (try? await rebuilt.evaluateJavaScript("!!document.querySelector('textarea')")) as? Bool == true }
        let text = try await rebuilt.evaluateJavaScript("document.querySelector('textarea').value") as? String
        XCTAssertEqual(text, "AB", "A failed sibling checkpoint must not discard healthy queued text")
        // The host debounces its localStorage persistence independently of the
        // inventory acknowledgement used to rebuild the visible panel.
        try await waitUntil { try await self.hostContains("AB", host: host) }
        let saved = try await hostContains("AB", host: host)
        XCTAssertTrue(saved, "The authoritative host must retain the healthy edit too")
        print("CHECKPOINT \(quit ? "refused-quit" : "failed-reload"): rebuiltList=\(text ?? "nil") hostContainsAB=\(saved)")

        if let directory = ProcessInfo.processInfo.environment["CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR"] {
            let image = try await rebuilt.takeSnapshot(configuration: nil)
            let bitmap = try XCTUnwrap(image.tiffRepresentation.flatMap(NSBitmapImageRep.init(data:)))
            let png = try XCTUnwrap(bitmap.representation(using: .png, properties: [:]))
            try png.write(to: URL(fileURLWithPath: directory).appendingPathComponent(quit ? "refused-quit.png" : "failed-reload.png"))
        }
        host.reloadWidgets()
        try await waitUntil { self.panelWebView(title: "List").map { $0 !== rebuilt } == true }
        try await waitUntil { (try? await self.panelWebView(title: "List")?.evaluateJavaScript("document.querySelector('textarea')?.value")) as? String == "AB" }
    }

    @MainActor
    private func hostContains(_ text: String, host: WidgetHostController) async throws -> Bool {
        let data = try JSONEncoder().encode(text)
        let quoted = try XCTUnwrap(String(data: data, encoding: .utf8))
        return try await host.webView.evaluateJavaScript("Object.values(localStorage).some(value => value.includes(JSON.stringify(\(quoted))))") as? Bool == true
    }

    @MainActor
    private func type(_ text: String, in view: WKWebView) async throws {
        let data = try JSONEncoder().encode(text)
        let quoted = try XCTUnwrap(String(data: data, encoding: .utf8))
        _ = try await view.evaluateJavaScript("""
            (() => {
              const input = document.querySelector('textarea');
              Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, \(quoted));
              input.dispatchEvent(new Event('input', { bubbles: true }));
            })()
            """)
        try await Task.sleep(nanoseconds: 100_000_000)
    }

    @MainActor
    private func panelWebView(title: String) -> WKWebView? {
        func webView(in view: NSView) -> WKWebView? {
            if let web = view as? WKWebView { return web }
            return view.subviews.lazy.compactMap { webView(in: $0) }.first
        }
        return NSApp.windows.filter { $0.title == title && $0.isVisible }
            .compactMap { $0.contentView.flatMap { webView(in: $0) } }.first
    }

    @MainActor
    private func waitUntil(_ condition: () async throws -> Bool) async throws {
        for _ in 0..<200 {
            if try await condition() { return }
            try await Task.sleep(nanoseconds: 50_000_000)
        }
        XCTFail("Timed out waiting for the real WebKit fixture")
        throw NSError(domain: "WidgetCheckpointTests", code: 1)
    }
}
