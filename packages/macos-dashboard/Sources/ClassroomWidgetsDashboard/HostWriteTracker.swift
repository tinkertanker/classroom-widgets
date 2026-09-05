/// Tracks collection writes across deactivation attempts and web-host reloads.
@MainActor
final class HostWriteTracker {
    private var count = 0
    private var failed = false
    private var generation = 0
    private var waiters: [(@MainActor (Bool) -> Void)] = []

    func begin() -> Int {
        count += 1
        return generation
    }

    func wait(completion: @escaping @MainActor (Bool) -> Void) {
        guard count > 0 else {
            completion(!failed)
            return
        }
        waiters.append(completion)
    }

    func finish(succeeded: Bool, generation: Int) {
        guard generation == self.generation else { return }
        count = max(0, count - 1)
        failed = failed || !succeeded
        guard count == 0 else { return }
        let completions = waiters
        waiters.removeAll()
        let allSucceeded = !failed
        completions.forEach { $0(allSucceeded) }
    }

    func acknowledgeFailure() {
        // A failed deactivation attempt must not poison subsequent attempts.
        // Pending writes and their callbacks still belong to the live host.
        failed = false
    }

    func reset() {
        let completions = waiters
        waiters.removeAll()
        generation += 1
        count = 0
        failed = false
        completions.forEach { $0(false) }
    }
}
