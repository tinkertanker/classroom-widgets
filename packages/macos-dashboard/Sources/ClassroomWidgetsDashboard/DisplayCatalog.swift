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

    func topologyChanged() { topologyRevision &+= 1 }

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

    static func displayID(for screen: NSScreen?) -> CGDirectDisplayID? {
        (screen?.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber)?.uint32Value
    }
}
