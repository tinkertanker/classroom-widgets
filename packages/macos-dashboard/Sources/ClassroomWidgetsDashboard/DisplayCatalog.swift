import AppKit
import CoreGraphics

struct DisplayDescriptor: Equatable {
    let id: CGDirectDisplayID
    let uuid: String
    let name: String
    let bounds: CGRect
    let isActive: Bool
    let mirrorMasterID: CGDirectDisplayID?

    var label: String {
        "\(name) — \(Int(bounds.width)) × \(Int(bounds.height)), \(positionLabel)"
    }

    private var positionLabel: String {
        if bounds.minX < 0 { return "left" }
        if bounds.minY < 0 { return "above" }
        if bounds.minX > 0 { return "right" }
        if bounds.minY > 0 { return "below" }
        return "main desktop"
    }
}

@MainActor
final class DisplayCatalog {
    private(set) var topologyRevision: UInt64 = 1
    private var topologySignature: String?

    /// Returns true only when the connected-display set actually changed.
    /// `didChangeScreenParameters` also fires for menu bar, Dock, colour, and
    /// unrelated display changes, so callers must not treat every notice as a reset.
    @discardableResult
    func refreshTopology() -> Bool {
        let signature = displays().map { display in
            "\(display.id):\(display.uuid):\(display.bounds):\(display.isActive):\(display.mirrorMasterID ?? 0)"
        }.joined(separator: "|")
        guard signature != topologySignature else { return false }
        topologySignature = signature
        topologyRevision &+= 1
        return true
    }

    /// Public display IDs and bounds only; safe for structured logging.
    func topologySummary() -> String {
        displays().map { display in
            "\(display.id)@\(Int(display.bounds.minX)),\(Int(display.bounds.minY)):\(Int(display.bounds.width))x\(Int(display.bounds.height))\(display.isActive ? "" : ":inactive")"
        }.joined(separator: ",")
    }

    func displays() -> [DisplayDescriptor] {
        NSScreen.screens.compactMap { screen in
            guard let number = screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber else {
                return nil
            }
            let id = CGDirectDisplayID(number.uint32Value)
            guard let uuid = CGDisplayCreateUUIDFromDisplayID(id)?.takeRetainedValue() else { return nil }
            let mirrored = CGDisplayMirrorsDisplay(id)
            return DisplayDescriptor(
                id: id,
                uuid: CFUUIDCreateString(nil, uuid) as String,
                name: screen.localizedName,
                bounds: CGDisplayBounds(id),
                isActive: CGDisplayIsActive(id) != 0,
                mirrorMasterID: CGDisplayIsInMirrorSet(id) == 0 ? nil : mirrored
            )
        }
    }

    func eligibleSources(hostDisplayID: CGDirectDisplayID?) -> [DisplayDescriptor] {
        displays().filter { display in
            display.isActive && display.id != hostDisplayID && CGDisplayIsInMirrorSet(display.id) == 0
        }
    }

    func currentMatching(_ expected: DisplayDescriptor) -> DisplayDescriptor? {
        let matches = displays().filter { $0.uuid == expected.uuid }
        guard matches.count == 1, let match = matches.first, match.isActive,
              CGDisplayIsInMirrorSet(match.id) == 0, match.bounds == expected.bounds
        else { return nil }
        return match
    }

    func matchSavedUUID(_ uuid: String, among candidates: [DisplayDescriptor]) -> DisplayDescriptor? {
        let matches = candidates.filter { $0.uuid == uuid }
        return matches.count == 1 ? matches[0] : nil
    }

    /// Resolves the source to preview on a fresh launch. Remembered UUIDs are
    /// re-validated against the fresh candidate list, so an unplug/replug that
    /// changed the `CGDirectDisplayID` cannot leave a stale source behind. With
    /// nothing remembered, only a sole candidate is auto-selected.
    func resolveSource(
        rememberedUUIDs: [String],
        among candidates: [DisplayDescriptor]
    ) -> DisplayDescriptor? {
        for uuid in rememberedUUIDs {
            if let match = matchSavedUUID(uuid, among: candidates) { return match }
        }
        return candidates.count == 1 ? candidates[0] : nil
    }

    static func displayID(for screen: NSScreen?) -> CGDirectDisplayID? {
        (screen?.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber)?.uint32Value
    }
}
