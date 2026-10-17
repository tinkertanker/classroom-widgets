import Foundation

@MainActor
final class DisplayPreviewStopOperation {
    enum State: Equatable {
        case running
        case succeeded
        case failed
    }

    private let ownerID: ObjectIdentifier
    private var waiters: [UUID: CheckedContinuation<Bool, Never>] = [:]
    private(set) var state: State = .running
    private let onFailure: (Error) -> Void
    private let onLateSuccess: () -> Void

    init(
        owner: AnyObject,
        operation: @escaping () async throws -> Void,
        onFailure: @escaping (Error) -> Void = { _ in },
        onLateSuccess: @escaping () -> Void = {}
    ) {
        ownerID = ObjectIdentifier(owner)
        self.onFailure = onFailure
        self.onLateSuccess = onLateSuccess
        Task { @MainActor [weak self] in
            do {
                try await operation()
                _ = self?.finish(succeeded: true)
            } catch {
                if self?.finish(succeeded: false) == true {
                    self?.onFailure(error)
                }
            }
        }
    }

    func matches(_ owner: AnyObject) -> Bool {
        ownerID == ObjectIdentifier(owner)
    }

    func wait(timeoutNanoseconds: UInt64) async -> Bool {
        switch state {
        case .succeeded: return true
        case .failed: return false
        case .running: break
        }
        let waiterID = UUID()
        return await withCheckedContinuation { continuation in
            waiters[waiterID] = continuation
            Task { @MainActor [weak self] in
                try? await Task.sleep(nanoseconds: timeoutNanoseconds)
                self?.timeout(waiterID)
            }
        }
    }

    func confirmTerminalStop() {
        _ = finish(succeeded: true)
    }

    @discardableResult
    private func finish(succeeded: Bool) -> Bool {
        guard state == .running else { return false }
        state = succeeded ? .succeeded : .failed
        let pending = Array(waiters.values)
        waiters.removeAll()
        if pending.isEmpty, succeeded { onLateSuccess() }
        for continuation in pending {
            continuation.resume(returning: succeeded)
        }
        return true
    }

    private func timeout(_ waiterID: UUID) {
        guard let continuation = waiters.removeValue(forKey: waiterID) else { return }
        continuation.resume(returning: false)
    }
}
