import AppKit

extension DisplayPreviewCoordinator {
    func logDisplayTransition(
        _ transition: DisplayPreviewTransition,
        trigger: String,
        reason: String? = nil,
        source: DisplayDescriptor? = nil,
        intent: Bool? = nil,
        enabled: Bool? = nil,
        generation: UInt64? = nil,
        extra: String? = nil
    ) {
        var fields = "event=\(transition.rawValue) trigger=\(trigger)"
        if let reason { fields += " reason=\(reason)" }
        if let intent { fields += " intent=\(intent ? "capture" : "paused")" }
        if let enabled { fields += " enabled=\(enabled)" }
        if let source {
            fields += " sourceID=\(source.id) sourceHash=\(Self.displayIdentifierHash(source.uuid))"
        }
        fields += " topology=\(catalog.topologyRevision)"
        if let generation { fields += " generation=\(generation)" }
        if let extra { fields += " \(extra)" }
        // `notice` maps to OS_LOG_TYPE_DEFAULT, which is persisted for later
        // inspection; these transitions are deduplicated and low frequency, and
        // per-frame statuses never reach this funnel.
        DashboardLog.windowing.notice("Display Preview \(fields, privacy: .public)")
    }

    /// Non-reversible identifier so logs never carry a raw display UUID.
    private static func displayIdentifierHash(_ uuid: String) -> String {
        var hash: UInt64 = 0xcbf2_9ce4_8422_2325
        for byte in uuid.utf8 {
            hash = (hash ^ UInt64(byte)) &* 0x0000_0100_0000_01b3
        }
        return String(hash, radix: 16)
    }
}
