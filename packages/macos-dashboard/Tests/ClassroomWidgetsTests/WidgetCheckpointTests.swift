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
    func testFailedReloadRetriesRejectedHealthyCheckpointBeforeReopeningEditors() async throws {
        try await exerciseFailedCheckpoint(quit: false, delayRecovery: true, rejectedApplies: 1)
    }

    @MainActor
    func testRefusedQuitCanRetryRetainedCheckpointAfterRecoveryAttemptsFail() async throws {
        try await exerciseFailedCheckpoint(quit: true, delayRecovery: true, rejectedApplies: 100)
    }

    @MainActor
    func testFailedReloadCanRetryAppliedCheckpointWithoutInventoryAcknowledgement() async throws {
        try await exerciseFailedCheckpoint(quit: false, delayRecovery: true, lostInventory: true)
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
    func testHostRestartDuringFailedCheckpointWaitsForRecoveredInventory() async throws {
        try await exerciseRestartDuringResumption(sameState: false)
    }

    @MainActor
    func testHostRestartResumesSameStateCheckpointDespiteResetRevision() async throws {
        try await exerciseRestartDuringResumption(sameState: true)
    }

    @MainActor
    private func exerciseRestartDuringResumption(sameState: Bool) async throws {
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
        _ = try await list.evaluateJavaScript("window.classroomWidgetPanel.receiveSnapshot = () => {}; true")
        try await type("A", in: list)
        try await waitUntil { try await self.hostContains("A", host: host) }
        try await type("AB", in: list)
        if sameState { try await type("A", in: list) }
        _ = try await qr.evaluateJavaScript("window.classroomWidgetPanel.takePendingState = () => null; true")
        _ = try await host.webView.evaluateJavaScript("""
            window.classroomPanelHost.applyStateChange = () => {
              window.oldCheckpointWaiting = true;
              return new Promise(() => {});
            }; true
            """)
        host.reloadWidgets()
        try await waitUntil { (try? await host.webView.evaluateJavaScript("window.oldCheckpointWaiting === true")) as? Bool == true }
        XCTAssertNil(panelWebView(title: "List"))

        // Install the fault before the real replacement document loads. Keep the
        // real host apply, its completion, and native inventory independently gated.
        host.webView.configuration.userContentController.addUserScript(WKUserScript(source: """
            window.restartCalls = [];
            window.restartInventories = [];
            const handler = window.webkit.messageHandlers.classroomDashboard;
            const post = handler.postMessage.bind(handler);
            handler.postMessage = message => {
              if (message.type === 'widget-panels-changed') {
                if (window.restartApplying) { window.restartInventories.push(message); return; }
                const list = message.widgets.find(widget => widget.widgetType === 2);
                if (list) window.restartInitialRevision = list.stateRevision;
              }
              post(message);
            };
            window.releaseRestartInventories = () => {
              handler.postMessage = post;
              window.restartInventories.splice(0).forEach(post);
              return true;
            };
            let bridge;
            Object.defineProperty(window, 'classroomPanelHost', {
              configurable: true,
              get: () => bridge,
              set: value => {
                bridge = value;
                if (!value) return;
                const apply = value.applyStateChange;
                value.applyStateChange = change => {
                  if (!change.flush) return apply(change);
                  window.restartApplying = true;
                  const accepted = apply(change);
                  window.restartCalls.push({ accepted, baseRevision: change.baseRevision, text: change.state.items[0].text });
                  return new Promise(resolve => { window.completeRestartApply = () => resolve(accepted); });
                };
              }
            });
            """, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        // Inject the native termination notification, not a fake host response:
        // the controller must navigate and initialise its actual replacement host.
        host.webViewWebContentProcessDidTerminate(host.webView)
        try await waitUntil { (try? await host.webView.evaluateJavaScript("window.restartCalls?.some(call => call.accepted)")) as? Bool == true }
        XCTAssertNil(panelWebView(title: "List"), "Host restart must not reopen editors before retained apply completes")
        let calls = try await host.webView.evaluateJavaScript("JSON.stringify(window.restartCalls)") as? String
        let resetRevision = try await host.webView.evaluateJavaScript("window.restartInitialRevision") as? NSNumber
        let baseRevision = try await host.webView.evaluateJavaScript("window.restartCalls[0].baseRevision") as? NSNumber
        XCTAssertGreaterThan(try XCTUnwrap(baseRevision).intValue, try XCTUnwrap(resetRevision).intValue,
                             "The replacement host must exercise a lower revision namespace")
        _ = try await host.webView.evaluateJavaScript("window.completeRestartApply(); true")
        if !sameState {
            try await waitUntil { (try? await host.webView.evaluateJavaScript("window.restartInventories.length > 0")) as? Bool == true }
            try await Task.sleep(nanoseconds: 600_000_000)
            let stale = panelWebView(title: "List")
            let staleText = try? await stale?.evaluateJavaScript("document.querySelector('textarea')?.value")
            print("RESTART heldInventory: calls=\(calls ?? "nil") resetRevision=\(resetRevision?.intValue ?? -1) editorVisible=\(stale != nil) text=\(staleText as? String ?? "nil")")
            XCTAssertNil(stale, "Recovered state must reach native inventory before any editable stale panel is recreated")
        } else {
            let publications = try await host.webView.evaluateJavaScript("window.restartInventories.length") as? NSNumber
            XCTAssertEqual(publications?.intValue, 0, "A real same-state apply cannot publish a new inventory")
            print("RESTART no-op: calls=\(calls ?? "nil") resetRevision=\(resetRevision?.intValue ?? -1) publications=\(publications?.intValue ?? -1)")
        }
        _ = try await host.webView.evaluateJavaScript("window.releaseRestartInventories()")
        let expected = sameState ? "A" : "AB"
        try await waitUntil { (try? await self.panelWebView(title: "List")?.evaluateJavaScript("document.querySelector('textarea')?.value")) as? String == expected }
        try await waitUntil { try await self.hostContains(expected, host: host) }
        let restored = try XCTUnwrap(panelWebView(title: "List"))
        try await type("ABC", in: restored)
        try await waitUntil { try await self.hostContains("ABC", host: host) }
        print("RESTART restored=\(expected) followUpHost=ABC")
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
        do {
            try await waitUntil { (try? await rebuilt.evaluateJavaScript("document.querySelector('textarea')?.value")) as? String == "A" }
            print("NO-OP restoredEditor=A")
            try await type("AB", in: rebuilt)
            print("NO-OP follow-up edit dispatched")
            try await waitUntil { try await self.hostContains("AB", host: host) }
        } catch {
            let panelText = try? await rebuilt.evaluateJavaScript("document.querySelector('textarea')?.value")
            let calls = try? await host.webView.evaluateJavaScript("JSON.stringify(window.noOpCalls)")
            let hostHasA = try? await hostContains("A", host: host)
            let hostHasAB = try? await hostContains("AB", host: host)
            print("NO-OP follow-up failure panel=\(panelText as? String ?? "nil") hostA=\(hostHasA ?? false) hostAB=\(hostHasAB ?? false) calls=\(calls as? String ?? "nil")")
            throw error
        }
    }

    @MainActor
    private func exerciseFailedCheckpoint(quit: Bool, delayRecovery: Bool = false, rejectedApplies: Int = 0, lostInventory: Bool = false) async throws {
        try XCTSkipUnless(FileManager.default.fileExists(atPath: WebRootResolver.resolve().appendingPathComponent("index.html").path),
                          "Build teacher assets with pnpm --filter @classroom-widgets/teacher build:desktop")
        _ = NSApplication.shared
        let oldPolicy = NSApp.activationPolicy()
        NSApp.setActivationPolicy(.regular)
        NSApp.finishLaunching()
        defer { NSApp.setActivationPolicy(oldPolicy) }
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
                  window.rejectedAppliesRemaining = \(rejectedApplies);
                  window.rejectedCheckpoints = 0;
                  window.classroomPanelHost.applyStateChange = change => {
                    if (change.flush && window.rejectedAppliesRemaining > 0) {
                      window.rejectedAppliesRemaining--;
                      window.rejectedCheckpoints++;
                      return false;
                    }
                    return new Promise(resolve => {
                      window.deferredPanelChanges.push(() => resolve(apply(change)));
                    });
                  };
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
        if rejectedApplies > 0 {
            try await waitUntil { (try? await host.webView.evaluateJavaScript("window.rejectedCheckpoints > 0")) as? Bool == true }
            if rejectedApplies > 1 {
                // A persistently unavailable bridge must stop retrying, retain AB,
                // and allow an explicit retry once the host is available again.
                try await Task.sleep(nanoseconds: 4_000_000_000)
                let before = try await host.webView.evaluateJavaScript("window.rejectedCheckpoints") as? NSNumber
                try await Task.sleep(nanoseconds: 400_000_000)
                let after = try await host.webView.evaluateJavaScript("window.rejectedCheckpoints") as? NSNumber
                XCTAssertEqual(before, after, "Recovery attempts must be bounded")
                XCTAssertNil(panelWebView(title: "List"), "Failed application must not expose stale A")
                _ = try await host.webView.evaluateJavaScript("window.rejectedAppliesRemaining = 0; true")
                host.reloadWidgets()
            }
            var retried = false
            for _ in 0..<100 {
                retried = (try? await host.webView.evaluateJavaScript("window.deferredPanelChanges.length > 0")) as? Bool == true
                if retried { break }
                try await Task.sleep(nanoseconds: 50_000_000)
            }
            let rejected = try await host.webView.evaluateJavaScript("window.rejectedCheckpoints") as? NSNumber
            let savedA = try await hostContains("A", host: host)
            print("REJECTED-APPLY action=\(quit ? "quit" : "reload") rejected=\(rejected?.intValue ?? -1) retryQueued=\(retried) editorVisible=\(panelWebView(title: "List") != nil) hostContainsA=\(savedA)")
            XCTAssertTrue(retried, "A failed healthy checkpoint must not strand resumption permanently")
            guard retried else { return }
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
            if lostInventory {
                // Keep the real accepted AB inventory withheld beyond recovery's
                // bounded interval. A user retry must reapply retained AB without
                // exposing cached A or pretending that an inventory arrived.
                try await Task.sleep(nanoseconds: 4_000_000_000)
                XCTAssertNil(panelWebView(title: "List"), "An acknowledgement timeout must not reopen stale editors")
                _ = try await host.webView.evaluateJavaScript("""
                    const apply = window.classroomPanelHost.applyStateChange;
                    window.inventoryRetryCalls = [];
                    window.classroomPanelHost.applyStateChange = change => {
                      const accepted = apply(change);
                      window.inventoryRetryCalls.push({ accepted, flush: !!change.flush, text: change.state.items[0].text });
                      return accepted;
                    }; true
                    """)
                host.reloadWidgets()
                try await Task.sleep(nanoseconds: 600_000_000)
                let retried = (try? await host.webView.evaluateJavaScript("window.inventoryRetryCalls.some(call => call.accepted && call.flush && call.text === 'AB')")) as? Bool == true
                let calls = try await host.webView.evaluateJavaScript("JSON.stringify(window.inventoryRetryCalls)") as? String
                print("MISSING-INVENTORY retryAccepted=\(retried) calls=\(calls ?? "nil") editorVisible=\(panelWebView(title: "List") != nil)")
                XCTAssertTrue(retried, "An accepted checkpoint with no acknowledged inventory must allow a later explicit retry")
                XCTAssertNil(panelWebView(title: "List"), "Retry completion still must not bypass inventory acknowledgement")
                guard retried else { return }
            }
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
            let window = try XCTUnwrap(rebuilt.window)
            print("CAPTURE \(quit ? "quit" : "reload") before: visible=\(window.isVisible) unoccluded=\(window.occlusionState.contains(.visible)) frame=\(window.frame)")
            NSApp.activate(ignoringOtherApps: true)
            window.makeKeyAndOrderFront(nil)
            // XCTest pumps a CFRunLoop, not NSApplication.run(). Dispatch real
            // AppKit activation/visibility events before asking WebKit to paint.
            let deadline = Date().addingTimeInterval(2)
            while !window.occlusionState.contains(.visible), Date() < deadline {
                if let event = NSApp.nextEvent(matching: .any, until: Date().addingTimeInterval(0.05), inMode: .default, dequeue: true) {
                    NSApp.sendEvent(event)
                }
            }
            try await waitUntil { window.occlusionState.contains(.visible) }
            // DOM readiness can precede the first compositor frame in WebKit.
            _ = try await rebuilt.callAsyncJavaScript(
                "await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); return true;",
                arguments: [:], in: nil, in: .page
            )
            print("CAPTURE \(quit ? "quit" : "reload") ready: unoccluded=\(window.occlusionState.contains(.visible))")
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
        if rejectedApplies > 0 {
            let ready = await host.prepareForTermination()
            XCTAssertTrue(ready, "A recovered apply must not permanently refuse later quit")
            print("REJECTED-APPLY follow-up quit: ready=\(ready)")
        }
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
