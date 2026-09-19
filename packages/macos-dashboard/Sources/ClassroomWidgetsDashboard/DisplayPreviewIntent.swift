import Foundation

/// Separates requested capture intent from asynchronous stream lifetime.
struct DisplayPreviewIntent {
    private(set) var generation: UInt64 = 0
    private(set) var wantsCapture = false
    private(set) var selectedSourceID: UInt32?
    private(set) var isClosed = true

    mutating func open() {
        guard isClosed else { return }
        isClosed = false
        wantsCapture = false
        generation &+= 1
    }

    mutating func select(sourceID: UInt32?) {
        guard selectedSourceID != sourceID else { return }
        selectedSourceID = sourceID
        wantsCapture = false
        generation &+= 1
    }

    @discardableResult mutating func start() -> UInt64? {
        guard !isClosed, selectedSourceID != nil else { return nil }
        wantsCapture = true
        generation &+= 1
        return generation
    }

    mutating func pause() {
        wantsCapture = false
        generation &+= 1
    }

    mutating func close() {
        guard !isClosed else { return }
        isClosed = true
        wantsCapture = false
        generation &+= 1
    }

    func accepts(generation candidate: UInt64, sourceID: UInt32) -> Bool {
        !isClosed && wantsCapture && generation == candidate && selectedSourceID == sourceID
    }
}
