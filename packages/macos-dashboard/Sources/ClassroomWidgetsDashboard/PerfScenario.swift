import AppKit

/// Benchmark driver for `--perf-scenario=startup|panels`, constructed only
/// when perf logging is on and one of those scenarios is named. It opens
/// widgets through the same host call as the menu, closes them as the close
/// button does, samples memory and CPU, then quits so `perf/bench.py` can
/// launch the next run.
@MainActor
final class PerfScenario {
    private let host: WidgetHostController
    private let scenario: String
    private let waiters = PerfEventWaiters.shared
    private var failed = false

    private static let timerType = 1
    private static let randomiserType = 0
    private static let randomiserChoices = [
        "Avery", "Blake", "Casey", "Devon", "Emery", "Finley",
        "Harper", "Jordan", "Kai", "Logan", "Morgan", "Quinn"
    ]
    private static let longListChoices = (1...500).map { String(format: "Student %03d", $0) }

    /// Whether `scenario` names a benchmark run. Logging alone (`--perf-log`
    /// with no scenario) leaves the app running instead of quitting.
    nonisolated static func runs(_ scenario: String) -> Bool {
        scenario == "startup" || scenario == "panels"
    }

    init(host: WidgetHostController, scenario: String) {
        self.host = host
        self.scenario = scenario
    }

    func start() {
        Task { @MainActor in
            await run()
            PerfProbe.mark("scenario.finished", ["scenario": scenario, "failed": failed])
            PerfProbe.flush()
            Self.quit()
        }
    }

    /// Quits from a run-loop timer, not from this task: a main-actor task runs
    /// as a main-queue job, and AppKit waits for the delegate's deferred
    /// termination reply in a nested run loop that cannot drain the main queue
    /// while that job is still running. The watchdog exits if quitting stalls.
    private static func quit() {
        DispatchQueue.global().asyncAfter(deadline: .now() + 10) {
            PerfProbe.mark("scenario.quitTimeout")
            PerfProbe.flush()
            exit(0)
        }
        NSApp.perform(#selector(NSApplication.terminate(_:)), with: nil, afterDelay: 0)
    }

    private func run() async {
        PerfProbe.mark("scenario.start", ["scenario": scenario])
        guard await waiters.wait(for: "widget-launcher.painted", since: 0, timeout: 60) != nil else {
            return fail("launcher was not painted")
        }
        await pause(2)
        sampleMemory("launched")
        guard scenario == "panels" else {
            await pause(6)
            sampleMemory("settled")
            return
        }

        for (type, widget) in [(Self.timerType, "timer"), (Self.randomiserType, "randomiser")] {
            for index in 0..<4 {
                guard let id = await open(type, widget: widget, phase: index == 0 ? "first" : "repeat") else { return }
                await pause(1)
                guard await close(id) else { return }
                await pause(1)
            }
        }

        guard let timer = await open(Self.timerType, widget: "timer", phase: "both"),
              let randomiser = await open(Self.randomiserType, widget: "randomiser", phase: "both",
                                          state: Self.randomiserState(Self.randomiserChoices))
        else { return }
        guard await randomiserHasChoices(randomiser) else { return fail("randomiser choices did not load") }
        await pause(2)
        sampleMemory("timer+randomiser")
        await measureCPU("idle", seconds: 5)
        guard await click("Start", in: timer) else { return fail("timer start button not found") }
        await pause(1)
        await measureCPU("timer-running", seconds: 10)
        _ = await click("Pause", in: timer)
        await pause(1)
        for index in 0..<2 {
            await spin(randomiser, index: index)
            await pause(1)
        }
        await checkAudio(in: timer, label: "timer", fileExtension: ".wav")
        await checkAudio(in: randomiser, label: "randomiser", fileExtension: ".mp3")
        _ = await close(timer)
        _ = await close(randomiser)
        await pause(1)

        guard let long = await open(Self.randomiserType, widget: "randomiser", phase: "long",
                                    state: Self.randomiserState(Self.longListChoices)) else { return }
        guard await randomiserHasChoices(long) else { return fail("long randomiser list did not load") }
        await pause(1)
        await scroll(long)
        _ = await close(long)
        await pause(1)
    }

    private static func randomiserState(_ choices: [String]) -> [String: Any] {
        [
            "input": choices.joined(separator: "\n"),
            "choices": choices,
            "removedChoices": [String]()
        ]
    }

    private func open(_ widgetType: Int, widget: String, phase: String, state: [String: Any]? = nil) async -> String? {
        let cursor = PerfProbe.eventCount
        PerfProbe.mark("scenario.open.request", ["widget": widget, "phase": phase])
        let requested = PerfProbe.wallMilliseconds()
        host.addWidget(widgetType)
        guard let created = await waiters.wait(for: "panel.create.begin", since: cursor, timeout: 15, where: {
            ($0["widgetType"] as? Int) == widgetType
        }), let id = created["widgetId"] as? String else {
            fail("\(widget) panel was not created")
            return nil
        }
        if let state { host.perfApplyState(widgetID: id, state: state) }
        let isPanel: ([String: Any]) -> Bool = { ($0["widgetId"] as? String) == id }
        guard let painted = await waiters.wait(for: "widget-panel.painted", since: cursor, timeout: 20, where: isPanel) else {
            fail("\(widget) panel was not painted")
            return nil
        }
        _ = await waiters.wait(for: "panel.shown", since: cursor, timeout: 10, where: isPanel)

        var record: [String: Any] = ["widget": widget, "phase": phase, "widgetId": id, "t": requested - PerfProbe.processStartWall]
        for name in ["panel.create.begin", "panel.create.end", "panel.nav.start", "panel.nav.commit",
                     "panel.ready", "panel.contentReady", "panel.nav.finish", "panel.shown"] {
            if let wall = PerfProbe.firstEvent(named: name, since: cursor, where: isPanel)?["wall"] as? Double {
                record[name] = wall - requested
            }
        }
        if let wall = painted["wall"] as? Double { record["panel.painted"] = wall - requested }
        if let wall = painted["paintedAt"] as? Double { record["web.painted"] = wall - requested }
        if let origin = painted["timeOrigin"] as? Double, origin > 0 { record["web.timeOrigin"] = origin - requested }
        record["web.nav"] = painted["nav"] ?? NSNull()
        record["web.paint"] = painted["paint"] ?? NSNull()
        record["web.fonts"] = Self.fontTimings(painted["resources"] as? [[String: Any]] ?? [])
        PerfProbe.mark("scenario.open.done", record)
        return id
    }

    private static func fontTimings(_ resources: [[String: Any]]) -> [String: Any] {
        func ends(_ host: String) -> [Double] {
            resources.filter { ($0["name"] as? String)?.contains(host) == true }.compactMap { $0["end"] as? Double }
        }
        let css = resources.first { ($0["name"] as? String)?.contains("fonts.googleapis.com") == true }
        return [
            "cssStart": css?["start"] ?? NSNull(),
            "cssEnd": css?["end"] ?? NSNull(),
            "cssTransfer": css?["transfer"] ?? NSNull(),
            "fontFiles": ends("fonts.gstatic.com").count,
            "fontFilesEnd": ends("fonts.gstatic.com").max().map { $0 as Any } ?? NSNull(),
            "resources": resources.count
        ]
    }

    private func close(_ id: String) async -> Bool {
        let cursor = PerfProbe.eventCount
        host.perfPanels.perfClose(widgetID: id)
        guard await waiters.wait(for: "panel.closed", since: cursor, timeout: 10, where: {
            ($0["widgetId"] as? String) == id
        }) != nil else {
            fail("panel \(id) did not close")
            return false
        }
        return true
    }

    private func randomiserHasChoices(_ id: String) async -> Bool {
        let check = "return !document.body.innerText.includes('Enter a list to randomise!');"
        for _ in 0..<3 {
            if await host.perfPanels.perfEvaluate(widgetID: id, script: check) as? Bool == true { return true }
            // The first snapshot can race the preset state; reload picks up the latest one.
            let cursor = PerfProbe.eventCount
            host.perfPanels.perfReload(widgetID: id)
            _ = await waiters.wait(for: "widget-panel.painted", since: cursor, timeout: 20, where: {
                ($0["widgetId"] as? String) == id
            })
        }
        return false
    }

    private func click(_ label: String, in id: String) async -> Bool {
        await host.perfPanels.perfEvaluate(widgetID: id, script: """
            const button = [...document.querySelectorAll('button')]
              .find((candidate) => (candidate.textContent || '').includes(label));
            if (!button) return false;
            button.click();
            return true;
            """, arguments: ["label": label]) as? Bool == true
    }

    private static let frameStatsScript = """
        const frameStats = (intervals) => {
          const sorted = [...intervals].sort((a, b) => a - b);
          const pick = (q) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : 0;
          const span = intervals.reduce((sum, value) => sum + value, 0);
          return {
            count: intervals.length,
            spanMs: span,
            meanMs: span / Math.max(intervals.length, 1),
            p50Ms: pick(0.5),
            p95Ms: pick(0.95),
            p99Ms: pick(0.99),
            maxMs: sorted.length ? sorted[sorted.length - 1] : 0,
            over20: intervals.filter((value) => value > 20).length,
            over34: intervals.filter((value) => value > 34).length,
            over50: intervals.filter((value) => value > 50).length
          };
        };
        """

    private static let spinScript = frameStatsScript + """
        const button = [...document.querySelectorAll('button')]
          .find((candidate) => /Randomise|Again/.test(candidate.textContent || ''));
        if (!button) return { error: 'randomise button not found' };
        const intervals = [];
        let last = await new Promise((resolve) => requestAnimationFrame(resolve));
        let sampling = true;
        button.click();
        const tick = (time) => {
          intervals.push(time - last);
          last = time;
          if (sampling) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        await new Promise((resolve) => setTimeout(resolve, 4200));
        sampling = false;
        return frameStats(intervals);
        """

    /// Opens the Randomiser's settings and scrolls its list of choices to the
    /// end in one second and back in the next, one step per frame.
    private static let scrollScript = frameStatsScript + """
        const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
        const button = [...document.querySelectorAll('button')].find((candidate) => candidate.title === 'Settings');
        if (!button) return { error: 'settings button not found' };
        const clicked = performance.now();
        button.click();
        let list = null;
        for (let attempt = 0; attempt < 300 && !list; attempt += 1) {
          await frame();
          list = document.querySelector('textarea#textarea');
        }
        if (!list) return { error: 'list not found' };
        await frame();
        await frame();
        const settingsOpenMs = performance.now() - clicked;
        const range = list.scrollHeight - list.clientHeight;
        const lines = list.value.split('\\n').length;
        if (range <= 0) return { error: 'list does not scroll', lines };
        const intervals = [];
        const started = await frame();
        let last = started;
        let reached = 0;
        for (let time = started; time - started < 2000;) {
          time = await frame();
          intervals.push(time - last);
          last = time;
          const elapsed = time - started;
          const down = Math.min(1, elapsed / 1000);
          const up = Math.max(0, Math.min(1, (elapsed - 1050) / 950));
          list.scrollTop = Math.round(range * (down - up));
          reached = Math.max(reached, list.scrollTop);
        }
        return Object.assign(frameStats(intervals), { settingsOpenMs, lines, rangePx: range, reachedPx: reached });
        """

    private func spin(_ id: String, index: Int) async {
        let before = PerfProcessSampler.sample()
        let started = PerfProbe.wallMilliseconds()
        let frames = await host.perfPanels.perfEvaluate(widgetID: id, script: Self.spinScript)
        let after = PerfProcessSampler.sample()
        PerfProbe.mark("scenario.spin", [
            "index": index,
            "frames": frames ?? NSNull(),
            "cpu": PerfProcessSampler.cpuSummary(
                from: before, to: after, seconds: (PerfProbe.wallMilliseconds() - started) / 1000
            )
        ])
    }

    private func scroll(_ id: String) async {
        let before = PerfProcessSampler.sample()
        let started = PerfProbe.wallMilliseconds()
        let frames = await host.perfPanels.perfEvaluate(widgetID: id, script: Self.scrollScript)
        let after = PerfProcessSampler.sample()
        PerfProbe.mark("scenario.scroll", [
            "frames": frames ?? NSNull(),
            "cpu": PerfProcessSampler.cpuSummary(
                from: before, to: after, seconds: (PerfProbe.wallMilliseconds() - started) / 1000
            )
        ])
    }

    private static let audioScript = """
        const audio = new Audio(path);
        audio.muted = true;
        const started = performance.now();
        const event = await new Promise((resolve) => {
          audio.addEventListener('canplaythrough', () => resolve('canplaythrough'), { once: true });
          audio.addEventListener('error', () => resolve('error'), { once: true });
          setTimeout(() => resolve('timeout'), 5000);
          audio.load();
        });
        const loadMs = performance.now() - started;
        let played = false;
        if (event === 'canplaythrough') {
          try { await audio.play(); played = true; } catch (error) { played = String(error); }
          await new Promise((resolve) => setTimeout(resolve, 400));
          audio.pause();
        }
        return {
          event, loadMs, played, currentTime: audio.currentTime,
          duration: Number.isFinite(audio.duration) ? audio.duration : null,
          readyState: audio.readyState, error: audio.error ? audio.error.code : null
        };
        """

    /// Loads and plays (muted) the widget's own bundled sound in its panel, so
    /// every variant shows that audio still decodes through the scheme handler.
    private func checkAudio(in id: String, label: String, fileExtension: String) async {
        guard let path = PerfProbe.firstEvent(named: "scheme.response", since: 0, where: {
            ($0["path"] as? String)?.hasSuffix(fileExtension) == true
        })?["path"] as? String else {
            return fail("\(label) audio was never requested")
        }
        let result = await host.perfPanels.perfEvaluate(widgetID: id, script: Self.audioScript, arguments: ["path": path])
        PerfProbe.mark("scenario.audio", ["label": label, "path": path, "result": result ?? NSNull()])
    }

    private func measureCPU(_ label: String, seconds: Double) async {
        let before = PerfProcessSampler.sample()
        let started = PerfProbe.wallMilliseconds()
        await pause(seconds)
        let after = PerfProcessSampler.sample()
        PerfProbe.mark("scenario.cpu", [
            "label": label,
            "cpu": PerfProcessSampler.cpuSummary(
                from: before, to: after, seconds: (PerfProbe.wallMilliseconds() - started) / 1000
            )
        ])
    }

    private func sampleMemory(_ label: String) {
        let samples = PerfProcessSampler.sample()
        PerfProbe.mark("scenario.memory", [
            "label": label,
            "memory": PerfProcessSampler.memorySummary(samples),
            "processes": samples.map { sample -> [String: Any] in
                [
                    "pid": Int(sample.pid), "name": sample.name,
                    "footprintMiB": Double(sample.footprint) / 1_048_576,
                    "startMs": sample.started - PerfProbe.processStartWall
                ]
            }
        ])
    }

    private func pause(_ seconds: Double) async {
        try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
    }

    private func fail(_ message: String) {
        failed = true
        PerfProbe.mark("scenario.error", ["message": message])
    }
}
