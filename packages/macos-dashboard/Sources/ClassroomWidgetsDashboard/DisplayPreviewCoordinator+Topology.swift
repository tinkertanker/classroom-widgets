import AppKit
import CoreGraphics

/// Display arrangement changes and showing or hiding the preview as
/// external displays come and go.
extension DisplayPreviewCoordinator {
    func screenParametersChanged() {
        let topologyChanged = catalog.refreshTopology()
        logDisplayTransition(
            .topologyNotice,
            trigger: "didChangeScreenParameters",
            reason: topologyChanged ? "topologyChanged" : "noTopologyChange",
            source: selectedSource,
            intent: intent.wantsCapture,
            enabled: selectedSource != nil,
            extra: "displays=\(catalog.topologySummary())"
        )
        scheduleReconnectCheck()
        guard let controller = windowController else { return }
        controller.previewView.discardPendingClick()
        let hostID = hostDisplayID(controller.window)
        let candidates = catalog.eligibleSources(hostDisplayID: hostID)
        let match = selectedSource.flatMap { catalog.currentMatching($0) }
        let isHostCandidate = match.map { current in
            candidates.contains { $0.uuid == current.uuid }
        } ?? false

        switch DisplayPreviewTopologyPolicy.outcome(
            hasWindow: true,
            selectedSourceID: selectedSource?.id,
            currentMatchID: match?.id,
            isHostCandidate: isHostCandidate
        ) {
        case .ignore:
            // No source yet: a display that just arrived may be the one to preview.
            refreshSources(preselect: true)
            return
        case .preserveSource:
            guard let current = match else { return }
            selectedSource = current
            if switchToSavedSource(from: current, among: candidates) { return }
            controller.setSources(candidates, selectedID: current.id, retainingSelectedSource: current)
            // Host-filtered candidacy is a placement fact: while the preview
            // overlaps its own source the menu keeps its selection and the
            // existing overlap/hidden auto-resume intent stays intact.
            if topologyChanged, let geometry = presentedGeometry {
                // Same source and bounds: keep pointer mapping usable by adopting
                // the new revision instead of discarding it.
                presentedGeometry = DisplayPreviewFrameGeometry(
                    imageRect: geometry.imageRect,
                    sourceBounds: current.bounds,
                    sourceID: current.id,
                    topologyRevision: catalog.topologyRevision
                )
            }
            logDisplayTransition(
                .topologyPreserved,
                trigger: "didChangeScreenParameters",
                reason: isHostCandidate ? "sourceStillValid" : "sourceStillValidHostOverlap",
                source: current,
                intent: intent.wantsCapture,
                enabled: true
            )
            if topologyChanged {
                validateWindowPlacement()
            }
            return
        case .reset:
            break
        }

        cancelDeferredRestarts()
        cancelFrameRecovery()
        presentedGeometry = nil
        logDisplayTransition(
            .topologyReset,
            trigger: "didChangeScreenParameters",
            reason: selectedSource == nil ? "noSelectedSource" : "sourceChanged",
            source: selectedSource,
            intent: false,
            enabled: false
        )
        pause(message: "Display arrangement changed. Check the source, then turn the preview on.")
        selectedSource = nil
        intent.select(sourceID: nil)
        refreshSources(preselect: true)
    }

    /// A stand-in chosen while the saved display was missing gives way when it
    /// returns. A manual pick is saved, so it never counts as a stand-in. A live
    /// stand-in only moves shortly after an automatic reopen.
    private func switchToSavedSource(from current: DisplayDescriptor, among candidates: [DisplayDescriptor]) -> Bool {
        guard let savedUUID = defaultsWriter.value(forKey: Keys.sourceUUID), savedUUID != current.uuid,
              let saved = catalog.matchSavedUUID(savedUUID, among: candidates)
        else { return false }
        let running = intent.wantsCapture
        let justReopened = autoReopenedAt.map {
            Date().timeIntervalSince($0) < DisplayPreviewReconnectPolicy.standInSwitchSeconds
        } ?? false
        guard !running || justReopened else { return false }
        let carried = autoResume
        selectSource(saved.id)
        guard selectedSource == saved else { return true }
        if running {
            if session == nil {
                start(trigger: .visibilityResume)
            } else {
                // Starts once the stand-in's stream has stopped.
                autoResume.requestRestart(sourceUUID: saved.uuid)
            }
        } else if carried.hasPendingRestart {
            // Keep a hidden/overlap restart and its blockers for the new source.
            autoResume = carried
            autoResume.retarget(sourceUUID: saved.uuid)
        }
        return true
    }

    /// Debounced: one plug or unplug posts several notices.
    private func scheduleReconnectCheck() {
        reconnectTask?.cancel()
        reconnectTask = Task { @MainActor [weak self] in
            guard let delay = self?.reconnectDebounceNanoseconds else { return }
            try? await Task.sleep(nanoseconds: delay)
            guard !Task.isCancelled, let self else { return }
            self.reconnectTask = nil
            self.applyDisplayAvailability()
        }
    }

    private func applyDisplayAvailability() {
        guard !stopLifecycle.terminating else { return }
        let showOnReconnect = defaults.object(forKey: DashboardSettingKeys.displayPreviewShowOnReconnect) as? Bool ?? true
        switch reconnect.displaysChanged(
            externalDisplayAvailable: DisplayPreviewReconnectPolicy.hasExternalDisplay(in: catalog.displays()),
            isOpen: windowController != nil,
            showOnReconnect: showOnReconnect
        ) {
        case .hide:
            logDisplayTransition(.disconnectHide, trigger: "didChangeScreenParameters", source: selectedSource)
            closeTrigger = "disconnectHide"
            dismiss()
            closeTrigger = nil
        case .show:
            logDisplayTransition(.reconnectShow, trigger: "didChangeScreenParameters")
            open(activatingApp: false)
        case .none:
            break
        }
    }
}
