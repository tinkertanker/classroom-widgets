#!/usr/bin/env node
// Startup, Timer/Randomiser panel, memory and CPU benchmark for published
// Windows builds (scripts/build_windows.ps1 -Publish). Windows only, Node 22+.
//
//   node packages/windows-dashboard/perf/bench.mjs --build base=C:\cw\dist-base --build fix=C:\cw\dist-fix
//       [--runs 10] [--warmup 1] [--scenario full|startup] [--cold] [--restore] [--out DIR] [--port 9333]
//   node packages/windows-dashboard/perf/bench.mjs --summarize DIR
//
// Each build runs in turn (order alternates every round) against the same
// restored profile, so only the native build varies. The app writes timing
// marks to CLASSROOM_WIDGETS_PERF_LOG (see Source/PerfLog.cs); the driver
// clicks through the launcher over the DevTools port the way a user would.
// The real %LOCALAPPDATA%\ClassroomWidgets is moved aside for the run and put
// back afterwards. --cold empties the Windows standby list before every
// launch (needs an elevated prompt). --restore leaves Timer and Randomiser
// open in the profile, so every launch restores two panels; without it the
// profile has none. Output in DIR (default
// perf-results/windows-<timestamp>): runs/<build>-<round>/marks.jsonl and
// run.json, results.csv, summary.json and summary.md. --summarize rebuilds
// the last three from a finished run's raw files, on any platform.

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TIMER = 1;
const RANDOMISER = 0;
const WIDGET_NAMES = { [TIMER]: 'Timer', [RANDOMISER]: 'Randomiser' };

const args = parseArgs(process.argv.slice(2));
const summarizeDir = args.summarize ? path.resolve(args.summarize) : undefined;
const previous = summarizeDir ? JSON.parse(fs.readFileSync(path.join(summarizeDir, 'summary.json'), 'utf8')) : undefined;
const builds = previous ? previous.builds.map((name) => ({ name })) : args.build.map((spec) => {
  const [name, dir] = spec.split(/=(.*)/s);
  const exe = path.resolve(dir, 'ClassroomWidgets.exe');
  if (!fs.existsSync(exe)) throw new Error(`No ClassroomWidgets.exe in ${dir}`);
  return { name, dir: path.resolve(dir), exe };
});
if (builds.length === 0) throw new Error('Pass at least one --build name=publishDir');
if (!previous && process.platform !== 'win32') throw new Error('The Windows benchmark runs on Windows only.');

const runs = previous?.runs ?? Number(args.runs ?? 10);
const warmup = previous?.warmup ?? Number(args.warmup ?? 1);
const scenario = previous?.scenario ?? args.scenario ?? 'full';
const cold = previous?.cold ?? Boolean(args.cold);
const restore = previous?.restore ?? Boolean(args.restore);
if (restore && scenario !== 'startup') throw new Error('--restore needs --scenario startup (restored panels would make every open a repeat open).');
const port = Number(args.port ?? 9333);
const outDir = summarizeDir ?? path.resolve(args.out ?? path.join('perf-results', `windows-${new Date().toISOString().replace(/[:.]/g, '-')}`));
const dataDir = path.join(process.env.LOCALAPPDATA ?? os.tmpdir(), 'ClassroomWidgets');
const goldenDir = path.join(os.tmpdir(), 'classroom-widgets-bench-profile');
const backupDir = `${dataDir}.bench-backup`;

fs.mkdirSync(path.join(outDir, 'runs'), { recursive: true });
const log = (line) => {
  const text = `${new Date().toISOString()} ${line}`;
  console.log(text);
  fs.appendFileSync(path.join(outDir, 'bench.log'), `${text}\n`);
};


async function main() {
  log(`builds: ${builds.map((b) => `${b.name}=${b.dir}`).join(', ')}; runs=${runs} warmup=${warmup} scenario=${scenario} cold=${cold} restore=${restore}`);
  log(`machine: ${os.cpus().length}x ${os.cpus()[0]?.model}, ${(os.totalmem() / 2 ** 30).toFixed(1)} GB, ${os.release()}`);
  await killAll();
  if (fs.existsSync(dataDir)) {
    if (fs.existsSync(backupDir)) throw new Error(`${backupDir} exists from an interrupted run; restore or remove it first.`);
    fs.renameSync(dataDir, backupDir);
    log(`moved existing profile to ${backupDir}`);
  }
  const results = [];
  try {
    if (cold && purgeStandby() !== 0) throw new Error('--cold needs an elevated prompt (SeProfileSingleProcessPrivilege).');
    await prepareProfile(builds[0]);
    for (let round = 0; round < warmup + runs; round += 1) {
      const order = round % 2 === 0 ? builds : [...builds].reverse();
      for (const build of order) {
        const measured = round >= warmup;
        const label = `${build.name}-${measured ? round - warmup : `warmup${round}`}`;
        try {
          const result = await runOnce(build, label);
          if (measured) results.push(result);
          log(`${label}: ${summaryLine(result.metrics)}`);
        } catch (error) {
          log(`${label}: FAILED ${error.stack ?? error}`);
          await killAll();
        }
      }
    }
  } finally {
    await killAll();
    removeDir(dataDir);
    if (fs.existsSync(backupDir)) fs.renameSync(backupDir, dataDir);
  }
  writeSummaries(results);
}

// Recomputes the metrics of a finished run from its run.json and
// marks.jsonl files, in launch order.
function summarize() {
  const results = [];
  for (const label of fs.readdirSync(path.join(outDir, 'runs'))) {
    const runFile = path.join(outDir, 'runs', label, 'run.json');
    if (label.includes('warmup') || !fs.existsSync(runFile)) continue;
    const run = JSON.parse(fs.readFileSync(runFile, 'utf8'));
    run.marks = new Marks(path.join(outDir, 'runs', label, 'marks.jsonl')).all();
    run.metrics = metricsFor(run);
    results.push(run);
  }
  results.sort((a, b) => a.spawnedAt - b.spawnedAt);
  log(`summarized ${results.length} runs again`);
  writeSummaries(results);
}

// The profile every run starts from: WebView2 caches warm from one session
// that opened Timer and Randomiser and, unless --restore, removed them.
async function prepareProfile(build) {
  removeDir(dataDir);
  removeDir(goldenDir);
  const marksPath = path.join(outDir, 'profile-setup-marks.jsonl');
  fs.rmSync(marksPath, { force: true });
  const app = launch(build, marksPath);
  try {
    const marks = new Marks(marksPath);
    await marks.waitUntil((all) => launcherOnScreenAt(all, Date.now()), 90_000, 'first-run launcher');
    await sleep(2000);
    for (const type of [TIMER, RANDOMISER]) {
      if (type !== TIMER) await reopenLauncher(build, marks);
      await openFromLauncher(type, marks);
    }
    if (!restore) await removeAllPanels(marks);
    await sleep(3000);
  } finally {
    await closeBrowserThenKill(app.pid);
  }
  fs.cpSync(dataDir, goldenDir, { recursive: true });
  log(`profile prepared from ${build.name} (${(dirSize(goldenDir) / 2 ** 20).toFixed(1)} MB)`);
}

// A hard kill of the WebView2 browser loses local storage writes it has not
// committed yet (Chromium batches them), so the profile run ends the app
// alone, asks the browser to close cleanly and waits for it to exit.
async function closeBrowserThenKill(pid) {
  let browserUrl;
  try {
    browserUrl = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl;
  } catch (error) {
    log(`no DevTools browser endpoint: ${error.message}`);
  }
  spawnSync('taskkill', ['/PID', String(pid), '/F'], { stdio: 'ignore' });
  if (browserUrl) {
    await new Promise((resolve) => {
      const socket = new WebSocket(browserUrl);
      const done = () => { clearTimeout(timer); try { socket.close(); } catch {} resolve(); };
      const timer = setTimeout(done, 5000);
      socket.onopen = () => socket.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
      socket.onmessage = done;
      socket.onerror = done;
      socket.onclose = done;
    });
  }
  await waitForProfileRelease(30_000);
}

const screenshotTaken = new Set();

async function runOnce(build, label) {
  const runDir = path.join(outDir, 'runs', label);
  fs.mkdirSync(runDir, { recursive: true });
  const marksPath = path.join(runDir, 'marks.jsonl');
  fs.rmSync(marksPath, { force: true });
  await killAll();
  removeDir(dataDir);
  fs.cpSync(goldenDir, dataDir, { recursive: true });
  if (cold && purgeStandby() !== 0) throw new Error('standby purge failed');
  const spawnedAt = Date.now();
  const app = launch(build, marksPath);
  const marks = new Marks(marksPath);
  const run = { build: build.name, label, spawnedAt, cold, scenario, samples: {}, opens: {} };
  try {
    await marks.waitUntil((all) => launcherOnScreenAt(all, Date.now()), 90_000, 'launcher painted on screen');
    await sleep(1000);
    if (!screenshotTaken.has(build.name)) {
      screenshotTaken.add(build.name);
      screenshot(path.join(runDir, 'launcher.png'));
    }
    await sleep(2000);
    run.launcherResources = await resourcesOf((t) => t.url.includes('surface=widget-launcher'));
    run.samples.launch = await sampleWindow(app.pid, scenario === 'startup' ? 2000 : 5000);
    if (scenario !== 'startup') {
      run.opens['timer.first'] = await openFromLauncher(TIMER, marks);
      await reopenLauncher(build, marks);
      run.opens['randomiser.first'] = await openFromLauncher(RANDOMISER, marks);
      await removeAllPanels(marks);
      await reopenLauncher(build, marks);
      run.opens['timer.repeat'] = await openFromLauncher(TIMER, marks);
      await reopenLauncher(build, marks);
      run.opens['randomiser.repeat'] = await openFromLauncher(RANDOMISER, marks);
      await sleep(3000);
      run.samples.twoPanels = await sampleWindow(app.pid, 5000);
      if (!screenshotTaken.has(`${build.name}-panels`)) {
        screenshotTaken.add(`${build.name}-panels`);
        screenshot(path.join(runDir, 'panels.png'));
      }
      run.samples.timerRunning = await measureTimer(app.pid, run.opens['timer.repeat'].widgetId);
      run.samples.randomiserSpin = await measureSpin(app.pid, run.opens['randomiser.repeat'].widgetId);
    }
  } finally {
    await killTree(app.pid);
  }
  run.marks = marks.all();
  run.metrics = metricsFor(run);
  fs.writeFileSync(path.join(runDir, 'run.json'), JSON.stringify({ ...run, marks: undefined }, null, 1));
  return run;
}

function launch(build, marksPath) {
  const env = {
    ...process.env,
    CLASSROOM_WIDGETS_PERF_LOG: marksPath,
    CLASSROOM_WIDGETS_DEBUG_PORT: String(port),
    CLASSROOM_WIDGETS_DEVTOOLS: '1'
  };
  delete env.CLASSROOM_WIDGETS_WEB_ROOT;
  const child = spawn(build.exe, [], { cwd: build.dir, env, stdio: 'ignore', detached: false });
  child.on('error', (error) => log(`spawn error: ${error}`));
  return child;
}

// The tray's Open Widget Launcher and a second launch take the same path.
async function reopenLauncher(build, marks) {
  const shown = marks.count((m) => m.src === 'native' && m.mark === 'launcher.show');
  const env = { ...process.env };
  delete env.CLASSROOM_WIDGETS_PERF_LOG;
  spawn(build.exe, [], { cwd: build.dir, env, stdio: 'ignore' });
  await marks.waitFor((_, all) => all.filter((m) => m.src === 'native' && m.mark === 'launcher.show').length > shown, 20_000, 'launcher reopened');
  await sleep(1500);
}

async function openFromLauncher(type, marks) {
  const launcher = await target((t) => t.url.includes('surface=widget-launcher'));
  const name = WIDGET_NAMES[type];
  const clickedAt = await evaluate(launcher, `(() => {
    const buttons = [...document.querySelectorAll('button')];
    const button = buttons.find((b) => b.textContent.trim() === ${JSON.stringify(name)})
      ?? buttons.find((b) => new RegExp(${JSON.stringify(`\\b${name}\\b`)}).test(b.textContent));
    if (!button) throw new Error('no ${name} button');
    const at = performance.timeOrigin + performance.now();
    button.click();
    return at;
  })()`);
  const created = await marks.waitFor((m) => m.src === 'native' && m.mark === 'panel.create' && m.widgetType === type && m.t >= clickedAt - 5,
    20_000, `${name} panel created`);
  const painted = await marks.waitFor((m) => isWeb(m, 'widget-panel', 'content.painted') && m.msg.widgetId === created.widgetId,
    30_000, `${name} panel painted`);
  await sleep(1500);
  const resources = await resourcesOf((t) => t.url.includes(`widgetId=${encodeURIComponent(created.widgetId)}`));
  return { widgetId: created.widgetId, widgetType: type, clickedAt, paintedAt: painted.msg.t, resources };
}

// What a page fetched: request count, bytes transferred (cache hits count 0), and the
// Google Fonts requests that index.html makes render-blocking.
const resourceScript = `(() => {
  const entries = performance.getEntriesByType('resource');
  const fonts = entries.filter((e) => /fonts\\.(googleapis|gstatic)\\.com/.test(e.name));
  return {
    count: entries.length,
    transferKB: Math.round(entries.reduce((sum, e) => sum + (e.transferSize || 0), 0) / 1024),
    fonts: fonts.map((e) => ({ host: new URL(e.name).host, startMs: Math.round(e.startTime), endMs: Math.round(e.responseEnd),
      transferBytes: e.transferSize, blocking: e.renderBlockingStatus }))
  };
})()`;

// The resource summary of the page matching predicate, or undefined; it never fails a run.
async function resourcesOf(predicate) {
  try {
    return await evaluate(await target(predicate, 5000), resourceScript);
  } catch {
    return undefined;
  }
}

async function removeAllPanels(marks) {
  const open = marks.all().filter((m) => m.src === 'native' && m.mark === 'panel.create').map((m) => m.widgetId);
  const closed = new Set(marks.all().filter((m) => m.src === 'native' && m.mark === 'panel.close').map((m) => m.widgetId));
  const ids = [...new Set(open)].filter((id) => !closed.has(id));
  const host = await target((t) => t.url.includes('dashboard=1'));
  for (const id of ids) await evaluate(host, `window.classroomPanelHost.removeWidget(${JSON.stringify(id)})`);
  for (const id of ids) await marks.waitFor((m) => m.src === 'native' && m.mark === 'panel.close' && m.widgetId === id, 15_000, `panel ${id} closed`);
  await sleep(1500);
}

// Replaces a widget's saved state through the hidden host and reloads its
// panel (widgets read saved state when they mount), then waits until
// readyExpression is true in the reloaded page. The panel is unloaded first,
// because a mounted widget reports its own state back over the new one.
async function setStateAndReload(widgetId, state, readyExpression) {
  const isPanel = (t) => t.url.includes(`widgetId=${encodeURIComponent(widgetId)}`);
  const panelTarget = await target(isPanel);
  // The page rewrote its path to "/", which the virtual host does not serve;
  // load the /index.html entry URL the app itself navigates to.
  const entry = new URL(panelTarget.url);
  entry.pathname = '/index.html';
  await send(panelTarget, 'Page.navigate', { url: 'about:blank' });
  await sleep(500);
  const host = await target((t) => t.url.includes('dashboard=1'));
  const applied = await evaluate(host, `window.classroomPanelHost.applyStateChange(${JSON.stringify({
    schemaVersion: 1, widgetId, baseRevision: 0, flush: true, state
  })})`);
  if (applied !== true) throw new Error(`host refused the state for ${widgetId}`);
  await sleep(500);
  await send(panelTarget, 'Page.navigate', { url: entry.href });
  const deadline = Date.now() + 20_000;
  for (;;) {
    const panel = await target(isPanel);
    if (await evaluate(panel, readyExpression).catch(() => false)) {
      await sleep(1500);
      return panel;
    }
    if (Date.now() > deadline) throw new Error(`panel ${widgetId} never rendered its new state`);
    await sleep(250);
  }
}

const buttonReady = (pattern) => `[...document.querySelectorAll('button')].some((b) => ${pattern}.test(b.textContent) && !b.disabled)`;

// CPU while a running five-minute Timer ticks for ten seconds (the default
// ten-second timer would finish during the sample).
async function measureTimer(pid, widgetId) {
  const panel = await setStateAndReload(widgetId, { segmentValues: ['00', '05', '00'] }, buttonReady('/Start/'));
  await evaluate(panel, clickScript('Start'));
  await sleep(1000);
  const running = () => evaluate(panel, buttonReady('/Pause/'));
  if (!(await running())) throw new Error('Timer did not start');
  const before = await evaluate(panel, 'JSON.stringify(window.__cwPerf.longTasks)');
  const sample = await sampleWindow(pid, 10_000);
  const after = await evaluate(panel, 'JSON.stringify(window.__cwPerf.longTasks)');
  sample.longTasks = diffLongTasks(JSON.parse(before), JSON.parse(after));
  sample.stillRunning = await running();
  if (sample.stillRunning) await evaluate(panel, clickScript('Pause'));
  return sample;
}

// CPU, frame intervals and long tasks while a 30-name Randomiser spins (3.6 s animation).
async function measureSpin(pid, widgetId) {
  const names = Array.from({ length: 30 }, (_, index) => `Student ${index + 1}`);
  const panel = await setStateAndReload(widgetId, { input: names.join('\n'), choices: names, removedChoices: [] },
    `${buttonReady('/Randomise!!/')} && document.body.textContent.includes('Student 1')`);
  await evaluate(panel, `(() => {
    const frames = window.__cwFrames = [];
    const tick = (t) => { frames.push(t); if (frames.length < 1000) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    window.__cwLongTasksBefore = JSON.stringify(window.__cwPerf.longTasks);
  })()`);
  await evaluate(panel, clickScript('Randomise!!'));
  const sample = await sampleWindow(pid, 4500);
  const result = JSON.parse(await evaluate(panel, `JSON.stringify({ frames: window.__cwFrames, before: window.__cwLongTasksBefore, after: JSON.stringify(window.__cwPerf.longTasks) })`));
  const intervals = result.frames.slice(1).map((t, i) => t - result.frames[i]).filter((_, i) => result.frames[i] - result.frames[0] < 4000);
  sample.frames = {
    count: intervals.length,
    p50: quantile(intervals, 0.5),
    p95: quantile(intervals, 0.95),
    max: Math.max(...intervals),
    over25: intervals.filter((d) => d > 25).length
  };
  sample.longTasks = diffLongTasks(JSON.parse(result.before), JSON.parse(result.after));
  return sample;
}

function clickScript(label) {
  return `(() => {
    const button = [...document.querySelectorAll('button')].find((b) => b.textContent.includes(${JSON.stringify(label)}) && !b.disabled);
    if (!button) throw new Error('no ${label} button');
    button.click();
    return true;
  })()`;
}

function diffLongTasks(before, after) {
  return { count: after.count - before.count, totalMs: round(after.totalMs - before.totalMs), maxMs: round(after.maxMs) };
}

// ---- process sampling (PowerShell CIM) ------------------------------------

async function sampleWindow(pid, durationMs) {
  const start = processTree(pid);
  await sleep(durationMs);
  const end = processTree(pid);
  const elapsed = end[0].at - start[0].at;
  const cpuStart = new Map(start.map((p) => [p.pid, p.cpu]));
  let cpu = 0;
  for (const p of end) cpu += p.cpu - (cpuStart.get(p.pid) ?? p.cpu);
  return { cpuPercent: round((cpu / 1e4 / elapsed) * 100), elapsedMs: elapsed, memory: memoryBreakdown(end) };
}

function memoryBreakdown(processes) {
  const breakdown = { totalMB: 0, appMB: 0, browserMB: 0, rendererMB: 0, gpuMB: 0, otherMB: 0, renderers: 0, processes: processes.length };
  for (const p of processes) {
    const mb = p.wsPrivate / 2 ** 20;
    breakdown.totalMB += mb;
    if (/^ClassroomWidgets/i.test(p.name)) breakdown.appMB += mb;
    else if (!p.type) breakdown.browserMB += mb;
    else if (p.type === 'renderer') { breakdown.rendererMB += mb; breakdown.renderers += 1; }
    else if (p.type === 'gpu-process') breakdown.gpuMB += mb;
    else breakdown.otherMB += mb;
  }
  for (const key of Object.keys(breakdown)) if (key.endsWith('MB')) breakdown[key] = round(breakdown[key]);
  return breakdown;
}

function processTree(pid) {
  return powershellJson(`
    $root = ${Number(pid)}
    $all = @(Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId,Name,KernelModeTime,UserModeTime,CommandLine)
    $at = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $byParent = @{}
    foreach ($p in $all) { $k = [int]$p.ParentProcessId; if (-not $byParent.ContainsKey($k)) { $byParent[$k] = New-Object System.Collections.ArrayList }; [void]$byParent[$k].Add($p) }
    $seen = @{}; $tree = New-Object System.Collections.ArrayList; $queue = New-Object System.Collections.Queue
    foreach ($p in $all) { if ([int]$p.ProcessId -eq $root) { $queue.Enqueue($p) } }
    while ($queue.Count -gt 0) {
      $p = $queue.Dequeue(); $id = [int]$p.ProcessId
      if ($seen.ContainsKey($id)) { continue }; $seen[$id] = $true; [void]$tree.Add($p)
      if ($byParent.ContainsKey($id)) { foreach ($c in $byParent[$id]) { if ([int]$c.ProcessId -ne $id) { $queue.Enqueue($c) } } }
    }
    $perf = @{}
    foreach ($c in @(Get-CimInstance Win32_PerfRawData_PerfProc_Process -Property IDProcess,WorkingSetPrivate,PrivateBytes)) { $perf[[int]$c.IDProcess] = $c }
    @($tree | ForEach-Object {
      $c = $perf[[int]$_.ProcessId]
      $type = if ($_.CommandLine -match '--type=([a-z-]+)') { $Matches[1] } else { '' }
      [pscustomobject]@{ pid = [int]$_.ProcessId; name = $_.Name; type = $type; at = $at; cpu = [double]($_.KernelModeTime + $_.UserModeTime);
        wsPrivate = if ($c) { [double]$c.WorkingSetPrivate } else { 0 }; privateBytes = if ($c) { [double]$c.PrivateBytes } else { 0 } }
    }) | ConvertTo-Json -Compress -Depth 3
  `);
}

function powershellJson(script) {
  const encoded = Buffer.from(`$ProgressPreference = 'SilentlyContinue'\n${script}`, 'utf16le').toString('base64');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], { encoding: 'utf8', maxBuffer: 32 * 2 ** 20 });
  if (result.status !== 0) throw new Error(`PowerShell failed: ${result.stderr}`);
  const text = result.stdout.trim();
  if (!text) return [];
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed : [parsed];
}

function purgeStandby() {
  const [code] = powershellJson(`
    Add-Type -TypeDefinition @"
    using System;
    using System.Runtime.InteropServices;
    public static class CwStandby {
      [StructLayout(LayoutKind.Sequential, Pack = 4)] struct TokenPrivileges { public int Count; public long Luid; public int Attributes; }
      [DllImport("advapi32.dll", SetLastError = true)] static extern bool OpenProcessToken(IntPtr process, uint access, out IntPtr token);
      [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)] static extern bool LookupPrivilegeValue(string system, string name, out long luid);
      [DllImport("advapi32.dll", SetLastError = true)] static extern bool AdjustTokenPrivileges(IntPtr token, bool disableAll, ref TokenPrivileges state, int length, IntPtr previous, IntPtr returned);
      [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
      [DllImport("ntdll.dll")] static extern int NtSetSystemInformation(int infoClass, ref int info, int length);
      public static int Purge() {
        IntPtr token;
        if (!OpenProcessToken(GetCurrentProcess(), 0x28, out token)) return -1;
        long luid;
        if (!LookupPrivilegeValue(null, "SeProfileSingleProcessPrivilege", out luid)) return -2;
        var privileges = new TokenPrivileges { Count = 1, Luid = luid, Attributes = 2 };
        if (!AdjustTokenPrivileges(token, false, ref privileges, 0, IntPtr.Zero, IntPtr.Zero) || Marshal.GetLastWin32Error() != 0) return -3;
        int flushModified = 3, purgeStandby = 4;
        NtSetSystemInformation(80, ref flushModified, 4);
        return NtSetSystemInformation(80, ref purgeStandby, 4);
      }
    }
"@
    [CwStandby]::Purge() | ConvertTo-Json
  `);
  return code;
}

function screenshot(file) {
  try {
    powershellJson(`
      Add-Type -AssemblyName System.Windows.Forms, System.Drawing
      $bounds = [System.Windows.Forms.SystemInformation]::VirtualScreen
      $bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      $graphics.CopyFromScreen($bounds.Left, $bounds.Top, 0, 0, $bitmap.Size)
      $bitmap.Save('${file.replace(/'/g, "''")}', [System.Drawing.Imaging.ImageFormat]::Png)
      $graphics.Dispose(); $bitmap.Dispose()
    `);
  } catch (error) {
    log(`screenshot failed: ${error.message}`);
  }
}

async function killTree(pid) {
  spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
  await waitForProfileRelease();
}

async function killAll() {
  spawnSync('taskkill', ['/IM', 'ClassroomWidgets.exe', '/T', '/F'], { stdio: 'ignore' });
  await waitForProfileRelease();
}

// WebView2 browser processes can outlive a killed host briefly; wait for the
// ones using this profile so it can be replaced, killing them after graceMs.
async function waitForProfileRelease(graceMs = 5000) {
  const needle = path.join(dataDir, 'WebView2').toLowerCase().replace(/'/g, "''");
  const killAt = Date.now() + graceMs;
  let killed = false;
  for (;;) {
    const left = powershellJson(`@(Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.ToLower().Contains('${needle}') } | ForEach-Object { [int]$_.ProcessId }) | ConvertTo-Json -Compress`);
    if (left.length === 0) return;
    if (!killed && Date.now() >= killAt) {
      if (graceMs > 5000) log(`WebView2 still running ${graceMs} ms after the app ended; killing it`);
      for (const id of left) spawnSync('taskkill', ['/PID', String(id), '/T', '/F'], { stdio: 'ignore' });
      killed = true;
    } else if (killed && Date.now() >= killAt + 5000) {
      throw new Error('WebView2 processes did not exit');
    }
    await sleep(250);
  }
}

// ---- DevTools protocol -----------------------------------------------------

async function target(predicate, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const found = (await response.json()).find((t) => t.type === 'page' && predicate(t));
      if (found) return found;
    } catch {
      // The browser may still be starting.
    }
    if (Date.now() > deadline) throw new Error('DevTools target not found');
    await sleep(100);
  }
}

async function send(targetInfo, method, params) {
  const socket = new WebSocket(targetInfo.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = () => reject(new Error(`DevTools connection to ${targetInfo.url} failed`));
  });
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${method} timed out`)), 20_000);
      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.id !== 1) return;
        clearTimeout(timer);
        if (message.error) reject(new Error(`${method}: ${message.error.message}`));
        else resolve(message.result);
      };
      socket.send(JSON.stringify({ id: 1, method, params }));
    });
  } finally {
    socket.close();
  }
}

async function evaluate(targetInfo, expression) {
  const result = await send(targetInfo, 'Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(`${result.exceptionDetails.exception?.description ?? result.exceptionDetails.text}`);
  return result.result.value;
}

// ---- marks -----------------------------------------------------------------

class Marks {
  constructor(file) {
    this.file = file;
  }

  all() {
    if (!fs.existsSync(this.file)) return [];
    return fs.readFileSync(this.file, 'utf8').split('\n').filter(Boolean).flatMap((line) => {
      try { return [JSON.parse(line)]; } catch { return []; }
    });
  }

  count(predicate) {
    return this.all().filter(predicate).length;
  }

  waitFor(predicate, timeoutMs, what) {
    return this.waitUntil((all) => all.find((mark) => predicate(mark, all)), timeoutMs, what);
  }

  async waitUntil(compute, timeoutMs, what) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const value = compute(this.all());
      if (value !== undefined) return value;
      if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`);
      await sleep(25);
    }
  }
}

function isWeb(mark, surface, name) {
  return mark.src === 'web' && mark.msg?.surface === surface && mark.msg?.mark === name;
}

// When the launcher's widget grid is first on screen, or undefined until
// then. A launcher that loads when shown paints after the native Show call.
// A preloaded one painted off screen before it; once shown it repaints at
// the window's size (resize, visibilitychange), and that frame counts when
// it comes within a second. Otherwise the web view's earlier frame is what
// shows, from when WPF has rendered the window (launcher.rendered). `now`
// lets a live wait give the repaint its second.
function launcherOnScreenAt(all, now = Infinity) {
  const shown = all.find((m) => m.src === 'native' && m.mark === 'launcher.show');
  if (!shown) return undefined;
  const paints = all.filter((m) => isWeb(m, 'widget-launcher', 'content.painted') || isWeb(m, 'widget-launcher', 'content.repainted'));
  const after = paints.find((m) => m.msg.t >= shown.t);
  if (!paints.some((m) => m.msg.t < shown.t)) return after?.msg.t;
  if (after && after.msg.t <= shown.t + 1000) return after.msg.t;
  if (now < shown.t + 1000) return undefined;
  return all.find((m) => m.src === 'native' && m.mark === 'launcher.rendered' && m.t >= shown.t)?.t;
}

function launcherPreloaded(all) {
  const shown = all.find((m) => m.src === 'native' && m.mark === 'launcher.show');
  return shown !== undefined && all.some((m) => isWeb(m, 'widget-launcher', 'content.painted') && m.msg.t < shown.t);
}

// ---- metrics ---------------------------------------------------------------

function metricsFor(run) {
  const marks = run.marks;
  const native = (name, predicate = () => true) => marks.find((m) => m.src === 'native' && m.mark === name && predicate(m));
  const web = (surface, name, predicate = () => true) => marks.find((m) => isWeb(m, surface, name) && predicate(m));
  const start = native('process.start')?.t;
  const metrics = {};
  const since = (key, t) => { if (start !== undefined && t !== undefined) metrics[key] = round(t - start); };
  metrics['spawn_to_process_ms'] = start === undefined ? undefined : round(start - run.spawnedAt);
  since('startup.onstartup_ms', native('app.startup')?.t);
  since('startup.native_done_ms', native('app.startup.end')?.t);
  since('startup.env_ready_ms', native('env.ready')?.t);
  since('startup.host_controller_ms', native('host.controller.ready')?.t);
  since('startup.host_ready_ms', native('host.inventory')?.t);
  since('startup.launcher_show_ms', native('launcher.show')?.t);
  since('startup.launcher_controller_ms', native('launcher.controller.ready')?.t);
  since('startup.launcher_fcp_ms', web('widget-launcher', 'fcp')?.msg.at);
  since('startup.launcher_content_painted_ms', web('widget-launcher', 'content.painted')?.msg.t);
  const painted = launcherOnScreenAt(marks);
  since('startup.launcher_painted_ms', painted);
  metrics['startup.launcher_preloaded'] = launcherPreloaded(marks) ? 1 : 0;
  const nativeBefore = marks.filter((m) => m.src === 'native' && painted !== undefined && m.t <= painted);
  metrics['startup.jit_ms'] = nativeBefore.at(-1)?.jitMs;
  metrics['startup.jit_methods'] = nativeBefore.at(-1)?.jitMethods;
  metrics['startup.restored_widgets'] = Number(/widgets=(\d+)/.exec(native('host.inventory')?.detail ?? '')?.[1] ?? NaN);

  for (const [key, open] of Object.entries(run.opens)) {
    const forWidget = (m) => m.widgetId === open.widgetId;
    const rel = (name, t) => { if (t !== undefined) metrics[`${key}.${name}_ms`] = round(t - open.clickedAt); };
    rel('native_add', marks.find((m) => m.src === 'native' && m.mark === 'launcher.add-widget' && m.t >= open.clickedAt - 5)?.t);
    rel('panel_create', native('panel.create', forWidget)?.t);
    rel('panel_show', native('panel.show', forWidget)?.t);
    rel('panel_init', native('panel.init', forWidget)?.t);
    rel('controller', native('panel.controller.ready', forWidget)?.t);
    rel('navigate', native('panel.navigate', forWidget)?.t);
    rel('doc_created', web('widget-panel', 'doc.created', (m) => m.msg.widgetId === open.widgetId)?.msg.t);
    rel('fcp', web('widget-panel', 'fcp', (m) => m.msg.widgetId === open.widgetId)?.msg.at);
    rel('panel_ready', native('panel.ready', forWidget)?.t);
    rel('content_ready', native('panel.content-ready', forWidget)?.t);
    rel('painted', open.paintedAt);
    metrics[`${key}.spare`] = marks.some((m) => m.src === 'native' && m.mark === 'panel.spare' && forWidget(m)) ? 1 : 0;
    const navigate = native('panel.navigate', forWidget)?.t;
    if (navigate !== undefined) metrics[`${key}.web_ms`] = round(open.paintedAt - navigate);
    resourceMetrics(metrics, key, open.resources);
  }

  resourceMetrics(metrics, 'startup.launcher', run.launcherResources);

  for (const [key, sample] of Object.entries(run.samples)) {
    if (!sample) continue;
    metrics[`${key}.cpu_percent`] = sample.cpuPercent;
    metrics[`${key}.mem_total_mb`] = sample.memory.totalMB;
    metrics[`${key}.mem_app_mb`] = sample.memory.appMB;
    metrics[`${key}.mem_browser_mb`] = sample.memory.browserMB;
    metrics[`${key}.mem_renderer_mb`] = sample.memory.rendererMB;
    metrics[`${key}.mem_gpu_mb`] = sample.memory.gpuMB;
    metrics[`${key}.renderers`] = sample.memory.renderers;
    if (sample.stillRunning !== undefined) metrics[`${key}.still_running`] = sample.stillRunning ? 1 : 0;
    if (sample.longTasks) {
      metrics[`${key}.longtask_count`] = sample.longTasks.count;
      metrics[`${key}.longtask_ms`] = sample.longTasks.totalMs;
    }
    if (sample.frames) {
      metrics[`${key}.frames`] = sample.frames.count;
      metrics[`${key}.frame_p95_ms`] = round(sample.frames.p95);
      metrics[`${key}.frame_max_ms`] = round(sample.frames.max);
      metrics[`${key}.frames_over_25ms`] = sample.frames.over25;
    }
  }
  return metrics;
}

function resourceMetrics(metrics, key, resources) {
  if (!resources) return;
  metrics[`${key}.requests`] = resources.count;
  metrics[`${key}.transfer_kb`] = resources.transferKB;
  const css = resources.fonts.find((f) => f.host === 'fonts.googleapis.com');
  if (css) {
    metrics[`${key}.fonts_css_end_ms`] = css.endMs;
    // Zero for a cache hit, and also when the response has no Timing-Allow-Origin.
    metrics[`${key}.fonts_css_transfer_bytes`] = css.transferBytes;
  }
}

function summaryLine(metrics) {
  const keys = ['startup.restored_widgets', 'startup.launcher_painted_ms', 'timer.first.painted_ms', 'randomiser.first.painted_ms', 'timer.repeat.painted_ms',
    'randomiser.repeat.painted_ms', 'twoPanels.mem_total_mb', 'timerRunning.cpu_percent', 'randomiserSpin.cpu_percent'];
  return keys.filter((key) => metrics[key] !== undefined).map((key) => `${key}=${metrics[key]}`).join(' ');
}

function writeSummaries(results) {
  const keys = [...new Set(results.flatMap((r) => Object.keys(r.metrics)))];
  const csv = [['build', 'label', ...keys].join(',')];
  for (const result of results) csv.push([result.build, result.label, ...keys.map((key) => result.metrics[key] ?? '')].join(','));
  fs.writeFileSync(path.join(outDir, 'results.csv'), `${csv.join('\n')}\n`);

  const summary = { builds: builds.map((b) => b.name), runs, warmup, scenario, cold, restore, metrics: {} };
  for (const key of keys) {
    summary.metrics[key] = {};
    for (const build of builds) {
      const values = results.filter((r) => r.build === build.name).map((r) => r.metrics[key]).filter((v) => Number.isFinite(v));
      summary.metrics[key][build.name] = describe(values);
    }
    const base = results.filter((r) => r.build === builds[0].name).map((r) => r.metrics[key]).filter(Number.isFinite);
    for (const build of builds.slice(1)) {
      const other = results.filter((r) => r.build === build.name).map((r) => r.metrics[key]).filter(Number.isFinite);
      if (base.length && other.length) summary.metrics[key][`${build.name}_vs_${builds[0].name}`] = compare(base, other);
    }
  }
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 1));

  const lines = [`# Windows benchmark (${scenario}, ${cold ? 'cold' : 'warm'}${restore ? ', two restored panels' : ''}, n=${runs} per build after ${warmup} warm-up)`, '',
    `| metric | ${builds.map((b) => `${b.name} median (p25–p75, p90)`).join(' | ')} | ${builds.slice(1).map((b) => `${b.name} Δ median (p)`).join(' | ')} |`,
    `|---|${builds.map(() => '---').join('|')}|${builds.slice(1).map(() => '---').join('|')}|`];
  for (const key of keys) {
    const row = summary.metrics[key];
    const cells = builds.map((b) => (row[b.name].n ? `${row[b.name].median} (${row[b.name].p25}–${row[b.name].p75}, ${row[b.name].p90}) n=${row[b.name].n}` : '–'));
    const deltas = builds.slice(1).map((b) => {
      const c = row[`${b.name}_vs_${builds[0].name}`];
      return c ? `${c.delta >= 0 ? '+' : ''}${c.delta} (${c.percent >= 0 ? '+' : ''}${c.percent}%, p=${c.p})` : '–';
    });
    lines.push(`| ${key} | ${cells.join(' | ')} | ${deltas.join(' | ')} |`);
  }
  fs.writeFileSync(path.join(outDir, 'summary.md'), `${lines.join('\n')}\n`);
  log(`wrote ${path.join(outDir, 'summary.md')}`);
}

function describe(values) {
  if (values.length === 0) return { n: 0 };
  return { n: values.length, median: round(quantile(values, 0.5)), p25: round(quantile(values, 0.25)), p75: round(quantile(values, 0.75)),
    p90: round(quantile(values, 0.9)), min: round(Math.min(...values)), max: round(Math.max(...values)) };
}

// Difference of medians, and a two-sided Mann–Whitney U p-value (normal approximation).
function compare(base, other) {
  const delta = quantile(other, 0.5) - quantile(base, 0.5);
  const all = [...base.map((v) => [v, 0]), ...other.map((v) => [v, 1])].sort((a, b) => a[0] - b[0]);
  const ranks = new Array(all.length);
  for (let i = 0; i < all.length;) {
    let j = i;
    while (j + 1 < all.length && all[j + 1][0] === all[i][0]) j += 1;
    for (let k = i; k <= j; k += 1) ranks[k] = (i + j) / 2 + 1;
    i = j + 1;
  }
  const rankSum = all.reduce((sum, [, group], index) => sum + (group === 0 ? ranks[index] : 0), 0);
  const n1 = base.length;
  const n2 = other.length;
  const u = rankSum - (n1 * (n1 + 1)) / 2;
  const mean = (n1 * n2) / 2;
  const sd = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
  const z = sd === 0 ? 0 : (Math.abs(u - mean) - 0.5) / sd;
  const p = Math.min(1, 2 * (1 - normalCdf(Math.max(z, 0))));
  const baseMedian = quantile(base, 0.5);
  return { delta: round(delta), percent: baseMedian ? round((delta / baseMedian) * 100) : null, p: Number(p.toFixed(4)) };
}

function normalCdf(z) {
  const t = 1 / (1 + 0.2316419 * z);
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  return 1 - d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
}

function quantile(values, q) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return NaN;
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function round(value) {
  return Number.isFinite(value) ? Math.round(value * 10) / 10 : value;
}

// ---- utilities -------------------------------------------------------------

function parseArgs(argv) {
  const parsed = { build: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i].replace(/^--/, '');
    if (key === 'cold' || key === 'restore') { parsed[key] = true; continue; }
    const value = argv[i + 1];
    i += 1;
    if (key === 'build') parsed.build.push(value);
    else parsed[key] = value;
  }
  return parsed;
}

function removeDir(dir) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 19) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    }
  }
}

function dirSize(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (entry.isFile()) total += fs.statSync(path.join(entry.parentPath ?? entry.path, entry.name)).size;
  }
  return total;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

if (summarizeDir) summarize();
else await main();
