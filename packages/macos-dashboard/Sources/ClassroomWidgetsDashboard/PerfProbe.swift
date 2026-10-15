import AppKit
import Darwin
import WebKit

/// Opt-in timing marks for the benchmark in `packages/macos-dashboard/perf`.
///
/// Everything here is inert unless the app is launched with
/// `--perf-log=<file>` (or `CLASSROOM_WIDGETS_PERF_LOG=<file>`); call sites
/// only read a constant. Marks are JSON lines with `t` in milliseconds since
/// the process started and `wall` in Unix milliseconds.
enum PerfProbe {
    struct Configuration {
        let logURL: URL
        let scenario: String
    }

    static let configuration: Configuration? = {
        let arguments = CommandLine.arguments
        func argument(_ name: String) -> String? {
            let prefix = "--\(name)="
            return arguments.first { $0.hasPrefix(prefix) }.map { String($0.dropFirst(prefix.count)) }
        }
        let environment = ProcessInfo.processInfo.environment
        guard let path = argument("perf-log") ?? environment["CLASSROOM_WIDGETS_PERF_LOG"], !path.isEmpty else {
            return nil
        }
        let scenario = argument("perf-scenario") ?? environment["CLASSROOM_WIDGETS_PERF_SCENARIO"] ?? "none"
        return Configuration(logURL: URL(fileURLWithPath: path), scenario: scenario)
    }()

    static var isEnabled: Bool { configuration != nil }

    /// Wall-clock process start, from the kernel, in Unix milliseconds.
    static let processStartWall: Double = {
        var info = kinfo_proc()
        var size = MemoryLayout<kinfo_proc>.stride
        var mib: [Int32] = [CTL_KERN, KERN_PROC, KERN_PROC_PID, getpid()]
        guard sysctl(&mib, u_int(mib.count), &info, &size, nil, 0) == 0 else { return wallMilliseconds() }
        let start = info.kp_proc.p_un.__p_starttime
        return Double(start.tv_sec) * 1000 + Double(start.tv_usec) / 1000
    }()

    static func wallMilliseconds() -> Double {
        var now = timeval()
        gettimeofday(&now, nil)
        return Double(now.tv_sec) * 1000 + Double(now.tv_usec) / 1000
    }

    private static let writer = DispatchQueue(label: "classroom-widgets.perf-log")
    private static let lock = NSLock()
    private static var events: [(name: String, fields: [String: Any])] = []
    private static let handle: FileHandle? = {
        guard let url = configuration?.logURL else { return nil }
        FileManager.default.createFile(atPath: url.path, contents: nil)
        return try? FileHandle(forWritingTo: url)
    }()

    static func mark(_ name: String, _ fields: [String: Any] = [:]) {
        guard configuration != nil else { return }
        let wall = wallMilliseconds()
        var record = fields
        record["name"] = name
        record["wall"] = wall
        record["t"] = wall - processStartWall
        let event = record
        lock.lock()
        events.append((name: name, fields: event))
        lock.unlock()
        writer.async {
            let object: [String: Any] = JSONSerialization.isValidJSONObject(event)
                ? event
                : ["name": name, "wall": wall, "t": wall - processStartWall, "invalid": String(describing: event)]
            guard let data = try? JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]) else { return }
            try? handle?.write(contentsOf: data + Data("\n".utf8))
        }
        DispatchQueue.main.async {
            MainActor.assumeIsolated { PerfEventWaiters.shared.eventsChanged() }
        }
    }

    /// Marks every stretch of more than 50 ms in which the main run loop did
    /// not wait for events (`main.busy`), so main-thread stalls show up in the
    /// timeline. The first stretch runs from this call to the first wait.
    static func monitorMainThread() {
        guard isEnabled else { return }
        var busySince = wallMilliseconds()
        let activities = CFRunLoopActivity.afterWaiting.rawValue | CFRunLoopActivity.beforeWaiting.rawValue
        let observer = CFRunLoopObserverCreateWithHandler(nil, activities, true, 0) { _, activity in
            let now = wallMilliseconds()
            if activity == .afterWaiting {
                busySince = now
            } else if now - busySince > 50 {
                mark("main.busy", ["start": busySince - processStartWall, "ms": now - busySince])
            }
        }
        CFRunLoopAddObserver(CFRunLoopGetMain(), observer, .commonModes)
    }

    /// Blocks until queued marks are on disk.
    static func flush() {
        guard configuration != nil else { return }
        writer.sync {}
        try? handle?.synchronize()
    }

    static var eventCount: Int {
        lock.lock()
        defer { lock.unlock() }
        return events.count
    }

    static func firstEvent(named name: String, since cursor: Int, where predicate: ([String: Any]) -> Bool) -> [String: Any]? {
        lock.lock()
        let candidates = events.count > cursor ? Array(events[cursor...]) : []
        lock.unlock()
        return candidates.first { $0.name == name && predicate($0.fields) }?.fields
    }

    // MARK: Web content

    static let messageHandlerName = "classroomPerf"

    /// Posts `painted` two frames after the surface first shows interactive
    /// content: the launcher's widget buttons, or a panel's rendered widget.
    static let pageScript = """
    (() => {
      if (window.top !== window) return;
      const surface = new URLSearchParams(location.search).get('surface') || 'host';
      const post = (body) => { try { window.webkit.messageHandlers.\(messageHandlerName).postMessage(body); } catch (_) {} };
      const now = () => (performance.timeOrigin || 0) + performance.now();
      const ready = surface === 'widget-launcher'
        ? () => document.querySelectorAll('main .grid > button').length >= 3
        : () => {
            const root = document.querySelector('.compact-widget-panel-root');
            return !!root && !root.querySelector('.compact-widget-panel-loading') && !!root.querySelector('button');
          };
      const round = (value) => Math.round((value || 0) * 10) / 10;
      const timings = () => {
        const nav = performance.getEntriesByType('navigation')[0];
        const paint = {};
        for (const entry of performance.getEntriesByType('paint')) paint[entry.name] = round(entry.startTime);
        const resources = performance.getEntriesByType('resource').map((entry) => ({
          name: entry.name.slice(0, 160),
          type: entry.initiatorType,
          start: round(entry.startTime),
          end: round(entry.responseEnd),
          transfer: entry.transferSize || 0,
          body: entry.decodedBodySize || 0
        }));
        return {
          timeOrigin: performance.timeOrigin || 0,
          nav: nav ? {
            fetchStart: round(nav.fetchStart),
            responseEnd: round(nav.responseEnd),
            domInteractive: round(nav.domInteractive),
            domContentLoaded: round(nav.domContentLoadedEventEnd),
            load: round(nav.loadEventEnd)
          } : null,
          paint,
          resources,
          activeElement: document.activeElement ? document.activeElement.tagName : null,
          hasFocus: document.hasFocus(),
          visibility: document.visibilityState
        };
      };
      let done = false;
      const check = () => {
        if (done || !ready()) return done;
        done = true;
        const readyAt = now();
        requestAnimationFrame(() => requestAnimationFrame(() => {
          post(Object.assign({ type: 'painted', surface, readyAt, paintedAt: now() }, timings()));
          // Where typing goes a second later (the launcher focuses its search box).
          setTimeout(() => post({
            type: 'focus',
            activeElement: document.activeElement ? document.activeElement.tagName : null,
            hasFocus: document.hasFocus()
          }), 1000);
        }));
        return true;
      };
      const observer = new MutationObserver(() => { if (check()) observer.disconnect(); });
      observer.observe(document, { childList: true, subtree: true });
      document.addEventListener('DOMContentLoaded', () => { if (check()) observer.disconnect(); });
    })();
    """

    /// Adds the page script and its message handler when perf logging is on.
    @MainActor
    static func install(in userContentController: WKUserContentController, surface: String, id: String? = nil) {
        guard isEnabled else { return }
        userContentController.addUserScript(WKUserScript(source: pageScript, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        userContentController.add(PerfScriptMessageHandler(surface: surface, id: id), name: messageHandlerName)
    }
}

@MainActor
private final class PerfScriptMessageHandler: NSObject, WKScriptMessageHandler {
    private let surface: String
    private let id: String?

    init(surface: String, id: String?) {
        self.surface = surface
        self.id = id
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard var body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        if let id { body["widgetId"] = id }
        PerfProbe.mark("\(surface).\(type)", body)
    }
}

@MainActor
final class PerfEventWaiters {
    static let shared = PerfEventWaiters()

    private struct Waiter {
        let id: UUID
        let name: String
        let cursor: Int
        let predicate: ([String: Any]) -> Bool
        let continuation: CheckedContinuation<[String: Any]?, Never>
    }

    private var waiters: [Waiter] = []

    func wait(
        for name: String,
        since cursor: Int,
        timeout: TimeInterval,
        where predicate: @escaping ([String: Any]) -> Bool = { _ in true }
    ) async -> [String: Any]? {
        if let match = PerfProbe.firstEvent(named: name, since: cursor, where: predicate) { return match }
        let id = UUID()
        return await withCheckedContinuation { continuation in
            waiters.append(Waiter(id: id, name: name, cursor: cursor, predicate: predicate, continuation: continuation))
            Task { @MainActor [weak self] in
                try? await Task.sleep(nanoseconds: UInt64(timeout * 1_000_000_000))
                self?.resolve(id, with: nil)
            }
        }
    }

    func eventsChanged() {
        for waiter in waiters {
            if let match = PerfProbe.firstEvent(named: waiter.name, since: waiter.cursor, where: waiter.predicate) {
                resolve(waiter.id, with: match)
            }
        }
    }

    private func resolve(_ id: UUID, with value: [String: Any]?) {
        guard let index = waiters.firstIndex(where: { $0.id == id }) else { return }
        waiters.remove(at: index).continuation.resume(returning: value)
    }
}

/// CPU time and memory of this app and the WebKit helper processes it started.
/// A helper counts only when launchd names this app as its responsible
/// process, so helpers that Safari or another WebKit app starts during a run
/// are left out.
enum PerfProcessSampler {
    struct Sample {
        let pid: pid_t
        let name: String
        let cpuNanoseconds: UInt64
        let footprint: UInt64
        let resident: UInt64
        /// Unix milliseconds.
        let started: Double
    }

    private static let timebase: mach_timebase_info_data_t = {
        var info = mach_timebase_info_data_t()
        mach_timebase_info(&info)
        return info
    }()

    private typealias ResponsiblePIDFunction = @convention(c) (pid_t) -> pid_t

    /// launchd records the process that asked for an XPC service as that
    /// service's responsible process. This is SPI, so it is looked up at run
    /// time; without it, helpers are matched by start time alone.
    private static func responsiblePIDFunction() -> ResponsiblePIDFunction? {
        guard let symbol = dlsym(UnsafeMutableRawPointer(bitPattern: -2), "responsibility_get_pid_responsible_for_pid") else {
            return nil
        }
        return unsafeBitCast(symbol, to: ResponsiblePIDFunction.self)
    }

    static func sample() -> [Sample] {
        let selfPID = getpid()
        let uid = getuid()
        let responsiblePID = responsiblePIDFunction()
        var pids = [pid_t](repeating: 0, count: 8192)
        let count = pids.withUnsafeMutableBytes { proc_listallpids($0.baseAddress, Int32($0.count)) }
        guard count > 0 else { return [] }
        var samples: [Sample] = []
        for pid in pids.prefix(Int(count)) where pid > 0 {
            var bsd = proc_bsdinfo()
            let bsdSize = Int32(MemoryLayout<proc_bsdinfo>.size)
            guard proc_pidinfo(pid, PROC_PIDTBSDINFO, 0, &bsd, bsdSize) == bsdSize, bsd.pbi_uid == uid else { continue }
            var nameBuffer = [CChar](repeating: 0, count: 256)
            guard proc_name(pid, &nameBuffer, UInt32(nameBuffer.count)) > 0 else { continue }
            let name = nameBuffer.withUnsafeBufferPointer { String(cString: $0.baseAddress!) }
            let started = Double(bsd.pbi_start_tvsec) * 1000 + Double(bsd.pbi_start_tvusec) / 1000
            let isOwnHelper = name.hasPrefix("com.apple.WebKit") && started >= PerfProbe.processStartWall
                && (responsiblePID.map { $0(pid) == selfPID } ?? true)
            guard pid == selfPID || isOwnHelper else { continue }
            var usage = rusage_info_v4()
            let result = withUnsafeMutablePointer(to: &usage) {
                $0.withMemoryRebound(to: rusage_info_t?.self, capacity: 1) { proc_pid_rusage(pid, RUSAGE_INFO_V4, $0) }
            }
            guard result == 0 else { continue }
            let ticks = usage.ri_user_time + usage.ri_system_time
            samples.append(Sample(
                pid: pid,
                name: pid == selfPID ? "app" : name,
                cpuNanoseconds: ticks * UInt64(timebase.numer) / UInt64(max(timebase.denom, 1)),
                footprint: usage.ri_phys_footprint,
                resident: usage.ri_resident_size,
                started: started
            ))
        }
        return samples
    }

    /// Footprint and resident memory per process group, in MiB.
    static func memorySummary(_ samples: [Sample]) -> [String: Any] {
        var groups: [String: [String: Double]] = [:]
        for sample in samples {
            let group = groupName(sample.name)
            var entry = groups[group] ?? ["count": 0, "footprintMiB": 0, "residentMiB": 0]
            entry["count", default: 0] += 1
            entry["footprintMiB", default: 0] += Double(sample.footprint) / 1_048_576
            entry["residentMiB", default: 0] += Double(sample.resident) / 1_048_576
            groups[group] = entry
        }
        let total = groups.values.reduce(into: ["footprintMiB": 0.0, "residentMiB": 0.0]) { result, entry in
            result["footprintMiB", default: 0] += entry["footprintMiB"] ?? 0
            result["residentMiB", default: 0] += entry["residentMiB"] ?? 0
        }
        return ["groups": groups, "total": total]
    }

    /// CPU milliseconds per process group between two samples.
    static func cpuSummary(from start: [Sample], to end: [Sample], seconds: Double) -> [String: Any] {
        let before = Dictionary(start.map { ($0.pid, $0.cpuNanoseconds) }, uniquingKeysWith: { first, _ in first })
        var groups: [String: Double] = [:]
        for sample in end {
            let delta = sample.cpuNanoseconds >= (before[sample.pid] ?? 0) ? sample.cpuNanoseconds - (before[sample.pid] ?? 0) : 0
            groups[groupName(sample.name), default: 0] += Double(delta) / 1_000_000
        }
        let total = groups.values.reduce(0, +)
        return ["seconds": seconds, "cpuMs": groups, "totalCpuMs": total, "cpuPercent": seconds > 0 ? total / (seconds * 10) : 0]
    }

    private static func groupName(_ name: String) -> String {
        if name == "app" { return "app" }
        if name.contains("WebContent") { return "webContent" }
        if name.contains("GPU") { return "gpu" }
        if name.contains("Networking") { return "networking" }
        return "otherWebKit"
    }
}
