#!/usr/bin/env python3
"""Launch-to-paint benchmark for the macOS app.

Build each variant with make_bench_app.sh, then:

  bench.py run --app base=/tmp/base.app --app fix=/tmp/fix.app \\
      --scenario startup --runs 20 --out results/startup
  bench.py summarize results/startup --baseline base

`run` launches the bundles through LaunchServices (open -n -W -F) with
--perf-log and --perf-scenario, interleaving variants (ABAB, then BABA) so
drift hits both equally. The app's PerfScenario writes JSON-lines marks and
quits. Before every launch the bench bundle's preferences and WebKit website
data are removed (the HTTP cache is kept), so each launch starts from the same
empty workspace, as on a first launch. --keep-state removes them only before
the first round, so later launches are relaunches with the data the previous
run left. That data is keyed by bundle identifier, so --keep-state needs each
variant built with its own BENCH_BUNDLE_ID (see make_bench_app.sh); otherwise
every launch would reuse the other variant's data. --cold also drops the file
cache with `sudo -n purge`.

Scenarios: `startup` (launch until the launcher is painted, then sample
memory, and again 6 s later) and `panels` (launch, then open/close Timer and
Randomiser four times each, open both, sample memory, idle CPU, running-Timer
CPU, two Randomiser spins with frame intervals, a muted play of each
widget's own sound to show that audio still loads, and a Randomiser opened
with 500 choices whose settings list is scrolled to the end and back).

`summarize` writes metrics.csv (one row per run and metric), summary.csv and
summary.md (median, p90, IQR, n per variant, and the change against the
baseline variant with a two-sided Mann-Whitney U p-value). Warm-up rounds
are kept in the raw files and excluded from the summary.
Standard library only, Python 3.9+.
"""

import argparse
import csv
import json
import math
import os
import plistlib
import shutil
import statistics
import subprocess
import sys
import time

HOME = os.path.expanduser("~")


def bundle_id(app):
    with open(os.path.join(app, "Contents", "Info.plist"), "rb") as fh:
        return plistlib.load(fh)["CFBundleIdentifier"]


def reset_state(identifier):
    subprocess.run(["defaults", "delete", identifier], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for path in (
        os.path.join(HOME, "Library", "WebKit", identifier),
        os.path.join(HOME, "Library", "HTTPStorages", identifier),
        os.path.join(HOME, "Library", "HTTPStorages", identifier + ".binarycookies"),
        os.path.join(HOME, "Library", "Saved Application State", identifier + ".savedState"),
    ):
        if os.path.isdir(path):
            shutil.rmtree(path, ignore_errors=True)
        elif os.path.exists(path):
            os.remove(path)


def kill_app(app):
    executable = os.path.join(os.path.abspath(app), "Contents", "MacOS")
    subprocess.run(["pkill", "-9", "-f", executable], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def purge():
    subprocess.run(["sync"], check=False)
    result = subprocess.run(["sudo", "-n", "purge"], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    if result.returncode != 0:
        sys.exit("--cold needs passwordless `sudo purge`: " + result.stdout.decode(errors="replace"))


def read_marks(path):
    marks = []
    if not os.path.exists(path):
        return marks
    with open(path) as fh:
        for line in fh:
            line = line.strip()
            if line:
                try:
                    marks.append(json.loads(line))
                except ValueError:
                    pass
    return marks


def command_run(args):
    variants = []
    for spec in args.app:
        name, _, path = spec.partition("=")
        if not path:
            sys.exit("--app takes NAME=/path/to/App.app")
        variants.append((name, os.path.abspath(path)))
    index_path = os.path.join(args.out, "runs.csv")
    # Raw logs are named by round, so a second run into the same directory
    # would overwrite them while the old index rows still pointed at them.
    if os.path.exists(index_path):
        sys.exit("%s already holds a run; pass a new --out directory" % args.out)
    identifiers = [bundle_id(app) for _, app in variants]
    if args.keep_state and len(set(identifiers)) != len(identifiers):
        sys.exit("--keep-state needs each variant built with its own BENCH_BUNDLE_ID")
    os.makedirs(os.path.join(args.out, "runs"), exist_ok=True)
    timeout = args.timeout or (90 if args.scenario == "startup" else 300)
    with open(index_path, "w", newline="") as index_file:
        index = csv.writer(index_file)
        index.writerow(["variant", "round", "warmup", "order", "scenario", "cold", "state",
                        "launch_wall", "exit", "seconds", "log"])
        total_rounds = args.warmup + args.runs
        for round_number in range(total_rounds):
            ordered = variants if round_number % 2 == 0 else list(reversed(variants))
            for order, (name, app) in enumerate(ordered):
                identifier = bundle_id(app)
                kill_app(app)
                state = "kept" if args.keep_state and round_number > 0 else "fresh"
                if state == "fresh":
                    reset_state(identifier)
                if args.cold:
                    purge()
                time.sleep(args.gap)
                log = os.path.join(args.out, "runs", "%s-%s-%02d.jsonl" % (args.scenario, name, round_number))
                if os.path.exists(log):
                    os.remove(log)
                launch_wall = time.time() * 1000
                started = time.monotonic()
                command = ["open", "-n", "-W", "-F", app, "--args",
                           "--perf-log=" + os.path.abspath(log), "--perf-scenario=" + args.scenario]
                try:
                    result = subprocess.run(command, timeout=timeout)
                    exit_code = result.returncode
                except subprocess.TimeoutExpired:
                    kill_app(app)
                    exit_code = "timeout"
                seconds = time.monotonic() - started
                marks = read_marks(log)
                finished = any(m.get("name") == "scenario.finished" and not m.get("failed") for m in marks)
                errors = [m.get("message") for m in marks if m.get("name") == "scenario.error"]
                warmup = 1 if round_number < args.warmup else 0
                index.writerow([name, round_number, warmup, order, args.scenario, int(args.cold), state,
                                "%.3f" % launch_wall, exit_code, "%.1f" % seconds, os.path.relpath(log, args.out)])
                index_file.flush()
                status = "ok" if finished else "FAILED %s" % (errors or exit_code)
                print("[%d/%d] %s %s%s %.1fs %s" % (round_number + 1, total_rounds, name, args.scenario,
                                                   " (warm-up)" if warmup else "", seconds, status), flush=True)
                kill_app(app)


# ---------------------------------------------------------------------------
# Metric extraction


def first(marks, name, predicate=None):
    for mark in marks:
        if mark.get("name") == name and (predicate is None or predicate(mark)):
            return mark
    return None


def run_metrics(marks, launch_wall):
    """Returns {metric: value} for one run."""
    metrics = {}
    main = first(marks, "main")
    if main is None:
        return metrics
    process_start = main["wall"] - main["t"]
    if launch_wall:
        metrics["startup.openToProcessStart"] = process_start - launch_wall

    def at(name, key=None, predicate=None):
        mark = first(marks, name, predicate)
        if mark is not None:
            metrics[key or "startup." + name] = mark["t"]
        return mark

    at("main")
    at("app.delegate.init")
    at("app.willFinishLaunching")
    at("app.didFinishLaunching.begin")
    at("host.init.begin")
    at("host.init.end")
    at("app.didFinishLaunching.end")
    host_nav = at("host.nav.start")
    at("host.nav.commit")
    at("host.nav.finish")
    at("host.options")
    at("launcher.prepare")
    at("launcher.show")
    at("launcher.nav.start")
    at("launcher.nav.commit")
    at("launcher.nav.finish")
    at("launcher.visible")
    painted = at("widget-launcher.painted", "startup.launcherPainted")
    focus = first(marks, "widget-launcher.focus")
    if focus is not None:
        metrics["launcher.searchFocused"] = 1 if focus.get("activeElement") == "INPUT" and focus.get("hasFocus") else 0
    if painted is not None:
        if painted.get("paintedAt"):
            metrics["startup.launcherWebPainted"] = painted["paintedAt"] - process_start
        nav = painted.get("nav") or {}
        if painted.get("timeOrigin"):
            origin = painted["timeOrigin"] - process_start
            metrics["launcher.web.navStart"] = origin
            if nav.get("domContentLoaded"):
                metrics["launcher.web.domContentLoaded"] = nav["domContentLoaded"]
        fcp = (painted.get("paint") or {}).get("first-contentful-paint")
        if fcp:
            metrics["launcher.web.firstContentfulPaint"] = fcp
        for resource in painted.get("resources") or []:
            if "fonts.googleapis.com" in resource.get("name", ""):
                metrics["launcher.web.fontsCssEnd"] = resource.get("end")
        responses = [m for m in marks if m.get("name") == "scheme.response" and m["t"] <= painted["t"]]
        metrics["startup.schemeRequests"] = len(responses)
        metrics["startup.schemeKiB"] = sum(m.get("bytes", 0) for m in responses) / 1024.0
        metrics["startup.schemeMisses"] = sum(1 for m in responses if not m.get("hit"))
        # Main-thread stretches over 50 ms without waiting for events, until the launcher is painted.
        busy = [m for m in marks if m.get("name") == "main.busy" and m.get("start", 0) < painted["t"]]
        metrics["startup.mainBusyMs"] = sum(m.get("ms", 0) for m in busy)
        metrics["startup.mainBusyMaxMs"] = max([m.get("ms", 0) for m in busy] or [0])
        if host_nav is not None:
            metrics["startup.mainBusyBeforeHostNavMs"] = sum(
                min(m["start"] + m.get("ms", 0), host_nav["t"]) - m["start"]
                for m in busy if m["start"] < host_nav["t"])

    launched = first(marks, "scenario.memory", lambda m: m.get("label") == "launched")
    if launched is not None:
        # When each WebKit helper process started, in ms since the app process started.
        starts = {}
        for process in launched.get("processes") or []:
            name = process.get("name", "")
            group = "webContent" if "WebContent" in name else "gpu" if "GPU" in name else \
                "networking" if "Networking" in name else None
            if group and isinstance(process.get("startMs"), (int, float)):
                starts.setdefault(group, []).append(process["startMs"])
        for group, values in starts.items():
            values.sort()
            metrics["startup.spawn.%s" % group] = values[0]
            if group == "webContent" and len(values) > 1:
                metrics["startup.spawn.webContent2"] = values[1]

    finished = first(marks, "scenario.finished")
    terminated = first(marks, "app.willTerminate")
    if finished is not None:
        metrics["exit.quitTimeout"] = 1 if first(marks, "scenario.quitTimeout") else 0
        if terminated is not None:
            metrics["exit.quitMs"] = terminated["t"] - finished["t"]

    for mark in marks:
        if mark.get("name") == "scenario.memory":
            label = mark.get("label")
            memory = mark.get("memory") or {}
            total = memory.get("total") or {}
            groups = memory.get("groups") or {}
            metrics["memory.%s.totalFootprintMiB" % label] = total.get("footprintMiB")
            metrics["memory.%s.totalResidentMiB" % label] = total.get("residentMiB")
            for group, values in groups.items():
                metrics["memory.%s.%s.footprintMiB" % (label, group)] = values.get("footprintMiB")
                metrics["memory.%s.%s.count" % (label, group)] = values.get("count")

    repeats = {}
    for mark in marks:
        if mark.get("name") != "scenario.open.done":
            continue
        key = "%s.%s" % (mark.get("widget"), mark.get("phase"))
        values = {}
        for field in ("panel.create.begin", "panel.create.end", "panel.nav.start", "panel.nav.commit",
                      "panel.ready", "panel.contentReady", "panel.nav.finish", "panel.shown",
                      "panel.painted", "web.painted", "web.timeOrigin"):
            if isinstance(mark.get(field), (int, float)):
                values[field] = mark[field]
        nav = mark.get("web.nav") or {}
        if isinstance(nav, dict) and nav.get("domContentLoaded"):
            values["web.domContentLoaded"] = nav["domContentLoaded"]
        paint = mark.get("web.paint") or {}
        if isinstance(paint, dict) and paint.get("first-contentful-paint"):
            values["web.firstContentfulPaint"] = paint["first-contentful-paint"]
        fonts = mark.get("web.fonts") or {}
        if isinstance(fonts, dict) and isinstance(fonts.get("cssEnd"), (int, float)):
            values["web.fontsCssEnd"] = fonts["cssEnd"]
        if "panel.painted" in values and "panel.nav.start" in values:
            values["split.native"] = values["panel.nav.start"]
            values["split.web"] = values["panel.painted"] - values["panel.nav.start"]
        if mark.get("phase") == "repeat":
            for field, value in values.items():
                repeats.setdefault("%s.%s" % (key, field), []).append(value)
        else:
            for field, value in values.items():
                metrics["%s.%s" % (key, field)] = value
    for name, values in repeats.items():
        metrics[name] = statistics.median(values)

    # Bytes the app's scheme handler sent: per run, and per open (from the
    # request until just before the scenario closes the panel 1 s later).
    responses = [m for m in marks if m.get("name") == "scheme.response"]
    audio = [m for m in responses if m.get("path", "").endswith((".wav", ".mp3"))]
    metrics["scheme.totalMiB"] = sum(m.get("bytes", 0) for m in responses) / 1048576.0
    metrics["scheme.audioRequests"] = len(audio)
    metrics["scheme.audioMiB"] = sum(m.get("bytes", 0) for m in audio) / 1048576.0
    opened = {}
    for mark in marks:
        if mark.get("name") == "scenario.open.request":
            opened = mark
        elif mark.get("name") == "scenario.open.done" and opened:
            window = [m for m in responses if opened["t"] <= m["t"] <= mark["t"] + 900]
            key = "%s.%s" % (mark.get("widget"), mark.get("phase"))
            for field, value in (("schemeRequests", len(window)),
                                 ("schemeMiB", sum(m.get("bytes", 0) for m in window) / 1048576.0)):
                if mark.get("phase") == "repeat":
                    repeats.setdefault("%s.%s" % (key, field), []).append(value)
                else:
                    metrics["%s.%s" % (key, field)] = value
            opened = {}
    for name, values in repeats.items():
        if name.endswith((".schemeRequests", ".schemeMiB")):
            metrics[name] = statistics.median(values)

    for mark in marks:
        if mark.get("name") == "scenario.audio":
            result = mark.get("result") or {}
            label = mark.get("label")
            if isinstance(result, dict):
                played = result.get("event") == "canplaythrough" and result.get("played") is True \
                    and (result.get("currentTime") or 0) > 0
                metrics["audio.%s.ok" % label] = 1 if played else 0
                metrics["audio.%s.loadMs" % label] = result.get("loadMs")
        elif mark.get("name") == "scenario.cpu":
            cpu = mark.get("cpu") or {}
            label = mark.get("label")
            metrics["cpu.%s.percent" % label] = cpu.get("cpuPercent")
            seconds = cpu.get("seconds") or 0
            for group, value in (cpu.get("cpuMs") or {}).items():
                if seconds:
                    metrics["cpu.%s.%s.percent" % (label, group)] = value / (seconds * 10)
        elif mark.get("name") == "scenario.spin":
            frames = mark.get("frames") or {}
            prefix = "spin%d" % mark.get("index", 0)
            if isinstance(frames, dict):
                for field in ("count", "meanMs", "p95Ms", "p99Ms", "maxMs", "over34", "over50"):
                    if isinstance(frames.get(field), (int, float)):
                        metrics["%s.frames.%s" % (prefix, field)] = frames[field]
            cpu = mark.get("cpu") or {}
            metrics["%s.cpu.percent" % prefix] = cpu.get("cpuPercent")
        elif mark.get("name") == "scenario.scroll":
            frames = mark.get("frames") or {}
            if isinstance(frames, dict):
                for field in ("count", "meanMs", "p95Ms", "p99Ms", "maxMs", "over34", "over50"):
                    if isinstance(frames.get(field), (int, float)):
                        metrics["scroll.frames.%s" % field] = frames[field]
                for field in ("settingsOpenMs", "lines"):
                    if isinstance(frames.get(field), (int, float)):
                        metrics["scroll.%s" % field] = frames[field]
                if frames.get("rangePx"):
                    metrics["scroll.reachedEnd"] = 1 if frames.get("reachedPx", 0) >= frames["rangePx"] - 1 else 0
            cpu = mark.get("cpu") or {}
            metrics["scroll.cpu.percent"] = cpu.get("cpuPercent")
    return {k: v for k, v in metrics.items() if isinstance(v, (int, float)) and not math.isnan(v)}


# ---------------------------------------------------------------------------
# Statistics


def quantile(values, q):
    ordered = sorted(values)
    if not ordered:
        return float("nan")
    position = (len(ordered) - 1) * q
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return ordered[int(position)]
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)


def mann_whitney_p(a, b):
    """Two-sided Mann-Whitney U p-value, normal approximation with tie correction."""
    n1, n2 = len(a), len(b)
    if n1 < 2 or n2 < 2:
        return float("nan")
    combined = sorted([(v, 0) for v in a] + [(v, 1) for v in b])
    ranks = [0.0] * len(combined)
    tie_term = 0.0
    i = 0
    while i < len(combined):
        j = i
        while j + 1 < len(combined) and combined[j + 1][0] == combined[i][0]:
            j += 1
        rank = (i + j) / 2.0 + 1
        for k in range(i, j + 1):
            ranks[k] = rank
        ties = j - i + 1
        tie_term += ties ** 3 - ties
        i = j + 1
    r1 = sum(rank for rank, (_, group) in zip(ranks, combined) if group == 0)
    u1 = r1 - n1 * (n1 + 1) / 2.0
    n = n1 + n2
    variance = n1 * n2 / 12.0 * ((n + 1) - tie_term / (n * (n - 1)))
    if variance <= 0:
        return 1.0
    z = (u1 - n1 * n2 / 2.0) / math.sqrt(variance)
    return math.erfc(abs(z) / math.sqrt(2))


def command_summarize(args):
    rows = []
    variants = []  # in --app order, so the first variant is the default baseline
    with open(os.path.join(args.out, "runs.csv")) as fh:
        for run in csv.DictReader(fh):
            if run["round"] == "0" and run["variant"] not in variants:
                variants.append(run["variant"])
            marks = read_marks(os.path.join(args.out, run["log"]))
            ok = any(m.get("name") == "scenario.finished" and not m.get("failed") for m in marks)
            if not ok or (run["warmup"] == "1" and not args.include_warmup):
                continue
            launch_wall = float(run["launch_wall"]) if run["launch_wall"] else 0
            for metric, value in run_metrics(marks, launch_wall).items():
                rows.append({"variant": run["variant"], "round": run["round"], "metric": metric, "value": value})

    with open(os.path.join(args.out, "metrics.csv"), "w", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=["variant", "round", "metric", "value"])
        writer.writeheader()
        writer.writerows(rows)

    by_metric = {}
    for row in rows:
        if row["variant"] not in variants:
            variants.append(row["variant"])
        by_metric.setdefault(row["metric"], {}).setdefault(row["variant"], []).append(row["value"])
    baseline = args.baseline or (variants[0] if variants else None)

    summary = []
    for metric in sorted(by_metric):
        per_variant = by_metric[metric]
        base_values = per_variant.get(baseline, [])
        for variant in variants:
            values = per_variant.get(variant, [])
            if not values:
                continue
            entry = {
                "metric": metric, "variant": variant, "n": len(values),
                "median": statistics.median(values), "p90": quantile(values, 0.9),
                "q1": quantile(values, 0.25), "q3": quantile(values, 0.75),
                "mean": statistics.mean(values),
            }
            if variant != baseline and base_values:
                base_median = statistics.median(base_values)
                entry["delta"] = entry["median"] - base_median
                entry["deltaPercent"] = (entry["delta"] / base_median * 100) if base_median else float("nan")
                entry["p"] = mann_whitney_p(base_values, values)
            summary.append(entry)

    fields = ["metric", "variant", "n", "median", "p90", "q1", "q3", "mean", "delta", "deltaPercent", "p"]
    with open(os.path.join(args.out, "summary.csv"), "w", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader()
        for entry in summary:
            writer.writerow({k: (("%.3f" % v) if isinstance(v, float) else v) for k, v in entry.items()})

    def fmt(value, digits=1):
        if value is None or (isinstance(value, float) and math.isnan(value)):
            return ""
        return ("%." + str(digits) + "f") % value

    lines = ["# %s" % os.path.basename(os.path.abspath(args.out)), "",
             "Baseline variant: `%s`. Times in ms (startup: since process start; panels: since the open request)." % baseline,
             "", "| metric | variant | n | median | p90 | IQR | delta | % | p |", "|---|---|---|---|---|---|---|---|---|"]
    for entry in summary:
        lines.append("| %s | %s | %d | %s | %s | %s–%s | %s | %s | %s |" % (
            entry["metric"], entry["variant"], entry["n"], fmt(entry["median"]), fmt(entry["p90"]),
            fmt(entry["q1"]), fmt(entry["q3"]), fmt(entry.get("delta")), fmt(entry.get("deltaPercent")),
            fmt(entry.get("p"), 3)))
    with open(os.path.join(args.out, "summary.md"), "w") as fh:
        fh.write("\n".join(lines) + "\n")
    print("\n".join(lines))


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    run = sub.add_parser("run")
    run.add_argument("--app", action="append", required=True, help="NAME=/path/to/App.app (repeat for each variant)")
    run.add_argument("--scenario", choices=["startup", "panels"], default="startup")
    run.add_argument("--runs", type=int, default=10, help="measured rounds per variant")
    run.add_argument("--warmup", type=int, default=1, help="leading rounds excluded from the summary")
    run.add_argument("--cold", action="store_true", help="sudo -n purge before every launch")
    run.add_argument("--keep-state", action="store_true",
                     help="reset preferences and website data only before the first round")
    run.add_argument("--gap", type=float, default=2.0, help="seconds to idle before each launch")
    run.add_argument("--timeout", type=float, default=0)
    run.add_argument("--out", required=True)
    summarize = sub.add_parser("summarize")
    summarize.add_argument("out")
    summarize.add_argument("--baseline")
    summarize.add_argument("--include-warmup", action="store_true")
    args = parser.parse_args()
    if args.command == "run":
        command_run(args)
    else:
        command_summarize(args)


if __name__ == "__main__":
    main()
