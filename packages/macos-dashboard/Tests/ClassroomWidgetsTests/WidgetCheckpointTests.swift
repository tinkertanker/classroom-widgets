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
    func testRefusedQuitDoesNotExposeStaleEditorWhileHealthyCheckpointIsPending() async throws {
        try await exerciseFailedCheckpoint(quit: true, delayRecovery: true)
    }

    @MainActor
    func testFailedReloadResumesAfterSameStateCheckpointCompletes() async throws {
        try await exerciseSameStateCheckpoint(quit: false)
    }

    @MainActor
    func testRefusedQuitResumesAfterSameStateCheckpointCompletes() async throws {
        try await exerciseSameStateCheckpoint(quit: true)
    }

    @MainActor
    private func exerciseSameStateCheckpoint(quit: Bool) async throws {
        try XCTSkipUnless(FileManager.default.fileExists(atPath: WebRootResolver.resolve().appendingPathComponent("index.html").path),
                          "Build teacher assets with pnpm --filter @classroom-widgets/teacher build:desktop")
        _ = NSApplication.shared
        let panels = WidgetPanelCoordinator()
        let host = WidgetHostController(websiteDataStore: .nonPersistent(), panelCoordinator: panels)
        defer { panels.deactivate(); host.webView.stopLoading() }
        try await waitUntil { !host.widgetOptions.isEmpty }
        host.addWidget(2)
        host.addWidget(12)
        try await waitUntil { self.panelWebView(title: "List") != nil && self.panelWebView(title: "QR Code") != nil }
        let list = try XCTUnwrap(panelWebView(title: "List"))
        let qr = try XCTUnwrap(panelWebView(title: "QR Code"))
        try await waitUntil { (try? await list.evaluateJavaScript("!!document.querySelector('textarea')")) as? Bool == true }
        try await waitUntil { (try? await qr.evaluateJavaScript("!!window.classroomWidgetPanel")) as? Bool == true }

        // Queue A again through real textarea edits before acknowledging A.
        // Object property order is not part of the native bridge contract.
        _ = try await list.evaluateJavaScript("""
            window.receiveHeldSnapshot = window.classroomWidgetPanel.receiveSnapshot;
            window.classroomWidgetPanel.receiveSnapshot = snapshot => { window.heldSnapshot = snapshot; };
            true
            """)
        try await type("A", in: list)
        try await waitUntil { try await self.hostContains("A", host: host) }
        try await waitUntil { (try? await list.evaluateJavaScript("window.heldSnapshot?.state?.items?.[0]?.text === 'A'")) as? Bool == true }
        try await type("AB", in: list)
        try await type("A", in: list)
        let revisionValue = try await list.evaluateJavaScript("window.heldSnapshot.stateRevision") as? NSNumber
        let baseRevision = try XCTUnwrap(revisionValue).intValue

        // Observe real host acceptance/publication, holding only flush completion.
        // A >= revision check without awaiting apply must fail the early-open check.
        _ = try await host.webView.evaluateJavaScript("""
            (() => {
              const apply = window.classroomPanelHost.applyStateChange;
              window.noOpCalls = [];
              window.noOpInventories = 0;
              window.classroomPanelHost.applyStateChange = change => {
                const run = () => {
                  const accepted = apply(change);
                  window.noOpCalls.push({ baseRevision: change.baseRevision, flush: !!change.flush,
                    text: change.state.items[0].text, accepted });
                  return accepted;
                };
                if (change.flush) return new Promise(resolve => { window.releaseNoOpFlush = () => resolve(run()); });
                return run();
              };
              const handler = window.webkit.messageHandlers.classroomDashboard;
              const post = handler.postMessage.bind(handler);
              handler.postMessage = message => {
                if (message.type === 'widget-panels-changed') window.noOpInventories++;
                post(message);
              };
              return true;
            })()
            """)
        _ = try await list.evaluateJavaScript("""
            (() => {
              const snapshot = window.heldSnapshot;
              window.receiveHeldSnapshot({ ...snapshot, state: {
                statuses: snapshot.state.statuses, inputs: snapshot.state.inputs, items: snapshot.state.items
              }});
              const take = window.classroomWidgetPanel.takePendingState;
              window.classroomWidgetPanel.takePendingState = () => {
                window.producedCheckpoint = take();
                return window.producedCheckpoint;
              };
              return true;
            })()
            """)
        try await waitUntil { (try? await host.webView.evaluateJavaScript("window.noOpCalls.length === 1 && window.noOpCalls[0].accepted")) as? Bool == true }
        _ = try await qr.evaluateJavaScript("window.classroomWidgetPanel.takePendingState = () => null; true")
        if quit {
            let ready = await host.prepareForTermination()
            XCTAssertFalse(ready)
        } else {
            host.reloadWidgets()
        }
        try await waitUntil { (try? await host.webView.evaluateJavaScript("typeof window.releaseNoOpFlush === 'function'")) as? Bool == true }
        let checkpointRevision = try await list.evaluateJavaScript("window.producedCheckpoint.baseRevision") as? NSNumber
        let checkpointText = try await list.evaluateJavaScript("window.producedCheckpoint.state.items[0].text") as? String
        XCTAssertEqual(checkpointRevision?.intValue, baseRevision, "The real producer must checkpoint at the already-published revision")
        XCTAssertEqual(checkpointText, "A")
        try await Task.sleep(nanoseconds: 600_000_000)
        XCTAssertNil(panelWebView(title: "List"), "An equal snapshot must not reopen editors before the asynchronous flush completes")
        print("NO-OP beforeRelease action=\(quit ? "quit" : "reload") baseRevision=\(baseRevision) checkpointRevision=\(checkpointRevision?.intValue ?? -1) editorVisible=\(panelWebView(title: "List") != nil)")
        _ = try await host.webView.evaluateJavaScript("window.releaseNoOpFlush(); true")
        try await waitUntil { (try? await host.webView.evaluateJavaScript("window.noOpCalls.some(call => call.flush && call.accepted)")) as? Bool == true }
        for _ in 0..<100 {
            if panelWebView(title: "List") != nil { break }
            try await Task.sleep(nanoseconds: 50_000_000)
        }
        let calls = try await host.webView.evaluateJavaScript("JSON.stringify(window.noOpCalls)") as? String
        let publications = try await host.webView.evaluateJavaScript("window.noOpInventories") as? NSNumber
        let saved = try await hostContains("A", host: host)
        let rebuilt = panelWebView(title: "List")
        print("NO-OP afterRelease action=\(quit ? "quit" : "reload") calls=\(calls ?? "nil") publications=\(publications?.intValue ?? -1) editorVisible=\(rebuilt != nil) hostContainsA=\(saved)")
        XCTAssertEqual(publications?.intValue, 0, "The accepted same-state flush must exercise a real host no-op, not a fresh inventory")
        XCTAssertTrue(saved)
        XCTAssertNotNil(rebuilt, "An accepted same-state checkpoint must resume editors without waiting forever for an inventory that will not publish")
        guard let rebuilt else { return }
        try await waitUntil { (try? await rebuilt.evaluateJavaScript("document.querySelector('textarea')?.value")) as? String == "A" }
        try await type("AB", in: rebuilt)
        try await waitUntil { try await self.hostContains("AB", host: host) }
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
                  const handler = window.webkit.messageHandlers.classroomDashboard;
                  const post = handler.postMessage.bind(handler);
                  window.deferredInventories = [];
                  handler.postMessage = message => {
                    if (message.type === 'widget-panels-changed') {
                      window.deferredInventories.push(message);
                    } else {
                      post(message);
                    }
                  };
                  window.releaseInventories = () => {
                    handler.postMessage = post;
                    window.deferredInventories.splice(0).forEach(post);
                    return true;
                  };
                  return true;
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
                print("SLOW-HOST staleEditor=\(before as? String ?? "unavailable") userEdited=\(edited as? String ?? "unavailable") queuedApplications=2")
            }
            XCTAssertNil(stale, "Do not expose an editable stale snapshot while the healthy checkpoint is unapplied")
            _ = try await host.webView.evaluateJavaScript("window.releasePanelChanges()")
            try await waitUntil { (try? await host.webView.evaluateJavaScript("window.deferredInventories.length > 0")) as? Bool == true }
            try await Task.sleep(nanoseconds: 600_000_000)
            let unpublishedEditor = panelWebView(title: "List")
            XCTAssertNil(unpublishedEditor, "Host application alone must not expose an editor before its fresh inventory arrives")
            print("SLOW-HOST appliedButUnpublished editorVisible=\(unpublishedEditor != nil)")
            _ = try await host.webView.evaluateJavaScript("window.releaseInventories()")
            do {
                try await waitUntil { (try? await self.panelWebView(title: "List")?.evaluateJavaScript("document.querySelector('textarea')?.value")) as? String == "AB" }
            } catch {
                let panelText = try? await panelWebView(title: "List")?.evaluateJavaScript("document.querySelector('textarea')?.value")
                let hostText = try? await host.webView.evaluateJavaScript("""
                    (() => {
                      const data = JSON.parse(localStorage.getItem('classroom-widgets-storage-v2') || 'null');
                      const workspace = data?.workspaces?.[data.currentWorkspaceId];
                      const listId = workspace?.widgets?.find(widget => widget.type === 2)?.id;
                      const state = workspace?.widgetStates?.find(([id]) => id === listId)?.[1];
                      return state?.items?.[0]?.text ?? state?.inputs?.[0] ?? null;
                    })()
                    """)
                print("SLOW-HOST afterRelease panel=\(panelText as? String ?? "unavailable") host=\(hostText as? String ?? "unavailable")")
                throw error
            }
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
        if delayRecovery {
            try await type("ABC", in: rebuilt)
            try await waitUntil { try await self.hostContains("ABC", host: host) }
        }
        host.reloadWidgets()
        try await waitUntil { self.panelWebView(title: "List").map { $0 !== rebuilt } == true }
        let expectedText = delayRecovery ? "ABC" : "AB"
        try await waitUntil { (try? await self.panelWebView(title: "List")?.evaluateJavaScript("document.querySelector('textarea')?.value")) as? String == expectedText }
        print("CHECKPOINT follow-up reload: panel=\(expectedText)")
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
