// A/B launch benchmark for the real Linux shell (startup, Timer and Randomiser
// panels, memory and CPU). Each launch is a separate Electron process running
// benchEntry.cjs, which requires a variant's own compiled out/main/main.js.
//
// Build the teacher app once and keep it fixed for every variant, e.g.
//   pnpm --filter @classroom-widgets/teacher build:desktop
// snapshot each shell variant (a directory holding out/, src/renderer/,
// assets/ and package.json from `npm run build`), then from the repo root:
//   xvfb-run -a -s '-screen 0 1920x1080x24' node packages/linux-dashboard/tests/perf/launchBench.cjs \
//     --variant base=<dir> --variant fix=<dir> --runs 10 --out <evidence dir> [--web-root <teacher build>] \
//     [--network live|blocked] [--keep-raw]
// Runs are interleaved ABAB with the order alternating each iteration; the
// first iteration is a warm-up and is excluded from the summary. Each
// iteration and variant uses a fresh profile for three launches: cold start,
// warm start, then a warm launch that opens Timer and Randomiser panels.
const { spawn } = require('node:child_process');
const { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, appendFileSync, existsSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { gzipSync } = require('node:zlib');

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
};
const variants = [];
args.forEach((arg, index) => {
  if (arg !== '--variant') return;
  const [name, dir] = args[index + 1].split('=');
  variants.push({ name, dir: resolve(dir) });
});
if (variants.length === 0) throw new Error('Pass at least one --variant name=<app dir>');
const runs = Number(option('runs', 10));
const warmup = Number(option('warmup', 1));
const network = option('network', 'live');
const keepRaw = args.includes('--keep-raw');
const phases = (option('phases', 'cold,warm,panels')).split(',');
const root = resolve(__dirname, '..', '..');
const webRoot = resolve(option('web-root', join(root, '..', 'teacher', 'build')));
const outDir = resolve(option('out', join(tmpdir(), 'classroom-widgets-test-evidence/linux-launch-bench')));
const electron = require(join(root, 'node_modules', 'electron'));
mkdirSync(outDir, { recursive: true });
const rawDir = join(outDir, 'raw');
if (keepRaw) mkdirSync(rawDir, { recursive: true });
const metricsFile = join(outDir, 'runs.jsonl');
rmSync(metricsFile, { force: true });

function launch(variant, profile, scenario) {
  const resultFile = join(profile, `..`, `result-${Date.now()}.json`);
  const env = {
    ...process.env,
    BENCH_APP_DIR: variant.dir,
    BENCH_PROFILE: profile,
    BENCH_OUT: resultFile,
    BENCH_SCENARIO: scenario,
    BENCH_NETWORK: network,
    CLASSROOM_WIDGETS_WEB_ROOT: webRoot,
  };
  delete env.ELECTRON_RUN_AS_NODE;
  return new Promise((done) => {
    env.BENCH_SPAWN = String(performance.timeOrigin + performance.now());
    const child = spawn(electron, ['--no-sandbox', '--disable-gpu', join(__dirname, 'benchEntry.cjs')], { env, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk).slice(-4000); });
    const killer = setTimeout(() => child.kill('SIGKILL'), 240000);
    child.on('exit', (code) => {
      clearTimeout(killer);
      let result = null;
      try {
        result = JSON.parse(readFileSync(resultFile, 'utf8'));
        rmSync(resultFile, { force: true });
      } catch {
        result = { errors: [`no result (exit ${code}): ${stderr.slice(-800)}`], marks: [], phases: {}, samples: {} };
      }
      done(result);
    });
  });
}

const first = (result, name, role) => result.marks.find((entry) => entry.name === name && (role === undefined || entry.extra?.role === role))?.t ?? null;
function startupMetrics(result) {
  const launcherWc = result.marks.find((entry) => entry.name === 'content-raf2' && entry.extra?.role === 'launcher')?.extra.wc;
  const show = result.marks.find((entry) => entry.name === 'show' && entry.extra?.wc === launcherWc)?.t ?? null;
  const shownFrames = result.marks.find((entry) => entry.name === 'show-raf2' && entry.extra?.wc === launcherWc)?.t ?? null;
  const painted = first(result, 'content-raf2', 'launcher');
  const interactive = result.samples['launcher-interactive'];
  const fonts = result.marks.find((entry) => entry.name === 'net' && entry.extra?.host === 'fonts.googleapis.com' && entry.extra?.role === 'host');
  return {
    launcherPainted: painted !== null && shownFrames !== null ? Math.max(painted, shownFrames) : null,
    entry: first(result, 'entry'),
    ready: first(result, 'ready'),
    hostNavStart: first(result, 'nav-start', 'host'),
    hostPreload: first(result, 'preload', 'host'),
    hostDomReady: first(result, 'dom-ready', 'host'),
    hostInventory: first(result, 'msg:widget-panels-changed', 'host'),
    launcherCreated: result.marks.find((entry) => entry.name === 'win-created' && entry.extra?.wc === launcherWc)?.t ?? null,
    launcherNavStart: first(result, 'nav-start', 'launcher'),
    launcherPreload: first(result, 'preload', 'launcher'),
    launcherContent: first(result, 'content', 'launcher'),
    launcherShow: show,
    cpuMsToInteractive: interactive?.totals.cpuMs ?? null,
    pssMiBAtInteractive: interactive ? interactive.totals.pssKiB / 1024 : null,
    privateMiBAtInteractive: interactive ? interactive.totals.privateKiB / 1024 : null,
    processesAtInteractive: interactive?.totals.processes ?? null,
    hostFontsCssMs: fonts?.extra.ms ?? null,
  };
}
function panelMetrics(result) {
  const metrics = {};
  for (const [label, phase] of Object.entries(result.phases)) {
    for (const key of ['contentPainted', 'windowShown', 'viewNavStart', 'viewPreload', 'viewLoaded', 'panelReady', 'contentReady', 'chromeLoaded']) {
      metrics[`${label}.${key}`] = phase[key];
    }
  }
  const memory = (label) => result.samples[label]?.totals;
  for (const label of ['idle-no-panels', 'timer-and-randomiser-open']) {
    const totals = memory(label);
    if (!totals) continue;
    metrics[`${label}.pssMiB`] = totals.pssKiB / 1024;
    metrics[`${label}.privateMiB`] = totals.privateKiB / 1024;
    metrics[`${label}.processes`] = totals.processes;
  }
  for (const label of ['cpu-idle', 'cpu-timer-running', 'cpu-randomiser-spin']) {
    if (result.samples[label]) metrics[`${label}.cpuPercent`] = result.samples[label].cpuPercent;
  }
  for (const label of ['frames-randomiser-spin', 'frames-timer-running']) {
    const frames = result.samples[label];
    if (!frames) continue;
    metrics[`${label}.p50`] = frames.p50;
    metrics[`${label}.p95`] = frames.p95;
    metrics[`${label}.max`] = frames.max;
    metrics[`${label}.over33ms`] = frames.over33ms;
    metrics[`${label}.longTaskMs`] = frames.longTasks.total;
  }
  return metrics;
}

const records = [];
async function main() {
  const started = Date.now();
  for (let iteration = 0; iteration < runs + warmup; iteration++) {
    const order = iteration % 2 === 0 ? variants : [...variants].reverse();
    for (const variant of order) {
      const base = mkdtempSync(join(tmpdir(), 'cw-launch-bench-'));
      const profile = join(base, 'profile');
      const kinds = [];
      if (phases.includes('cold')) kinds.push(['cold', 'startup']);
      if (phases.includes('warm')) kinds.push(['warm', 'startup']);
      if (phases.includes('panels')) kinds.push(['panels', 'panels']);
      for (const [kind, scenario] of kinds) {
        const result = await launch(variant, profile, scenario);
        const metrics = { ...startupMetrics(result), ...(scenario === 'panels' ? panelMetrics(result) : {}) };
        const record = { iteration, warmup: iteration < warmup, variant: variant.name, kind, errors: result.errors, metrics };
        records.push(record);
        appendFileSync(metricsFile, JSON.stringify(record) + '\n');
        if (keepRaw) writeFileSync(join(rawDir, `${iteration}-${variant.name}-${kind}.json.gz`), gzipSync(JSON.stringify(result)));
        const headline = scenario === 'panels'
          ? `timer ${fmt(metrics['timer-first.contentPainted'])}/${fmt(metrics['timer-repeat.contentPainted'])} randomiser ${fmt(metrics['randomiser-first.contentPainted'])}/${fmt(metrics['randomiser-repeat.contentPainted'])}`
          : `launcher ${fmt(metrics.launcherPainted)}`;
        console.log(`[${iteration}${iteration < warmup ? ' warm-up' : ''}] ${variant.name} ${kind}: ${headline}${result.errors.length ? ` ERR ${result.errors[0].split('\n')[0]}` : ''}`);
      }
      rmSync(base, { recursive: true, force: true });
    }
  }
  writeSummary(Date.now() - started);
}
const fmt = (value) => (value === null || value === undefined ? '-' : value.toFixed(0));

function quantile(sorted, q) {
  if (sorted.length === 0) return null;
  const position = (sorted.length - 1) * q;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
}
function writeSummary(elapsedMs) {
  const summary = { variants: variants.map((variant) => variant.name), runs, warmup, network, webRoot, elapsedMs, metrics: {} };
  const kept = records.filter((record) => !record.warmup && record.errors.length === 0);
  const keys = new Set();
  for (const record of kept) for (const key of Object.keys(record.metrics)) keys.add(`${record.kind}:${key}`);
  for (const key of [...keys].sort()) {
    const [kind, metric] = key.split(/:(.*)/s);
    const row = {};
    for (const variant of variants) {
      const values = kept.filter((record) => record.variant === variant.name && record.kind === kind)
        .map((record) => record.metrics[metric]).filter((value) => typeof value === 'number').sort((a, b) => a - b);
      row[variant.name] = { n: values.length, median: quantile(values, 0.5), p25: quantile(values, 0.25), p75: quantile(values, 0.75), p90: quantile(values, 0.9) };
    }
    summary.metrics[key] = row;
  }
  summary.failedRuns = records.filter((record) => record.errors.length > 0).map((record) => ({ iteration: record.iteration, variant: record.variant, kind: record.kind, error: record.errors[0].slice(0, 300) }));
  writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 1) + '\n');
  const [a, b] = variants.map((variant) => variant.name);
  const lines = [`# Linux launch benchmark`, '', `variants: ${summary.variants.join(', ')}; runs per variant: ${runs} (+${warmup} warm-up discarded); network: ${network}`, `web root: ${webRoot}`, ''];
  lines.push(`| metric | ${variants.map((variant) => `${variant.name} median (p25-p75, p90) n`).join(' | ')}${b ? ' | delta | delta % |' : ''}`);
  lines.push(`|---|${variants.map(() => '---').join('|')}${b ? '|---|---|' : ''}`);
  for (const [key, row] of Object.entries(summary.metrics)) {
    const cells = variants.map((variant) => {
      const stats = row[variant.name];
      return stats.n ? `${stats.median.toFixed(1)} (${stats.p25.toFixed(1)}-${stats.p75.toFixed(1)}, ${stats.p90.toFixed(1)}) n=${stats.n}` : '-';
    });
    let delta = '';
    if (b && row[a].n && row[b].n) {
      const difference = row[b].median - row[a].median;
      delta = ` | ${difference.toFixed(1)} | ${row[a].median ? ((100 * difference) / row[a].median).toFixed(1) : '-'}% |`;
    } else if (b) delta = ' | - | - |';
    lines.push(`| ${key} | ${cells.join(' | ')}${delta}`);
  }
  if (summary.failedRuns.length) lines.push('', `Failed runs: ${JSON.stringify(summary.failedRuns)}`);
  writeFileSync(join(outDir, 'summary.md'), lines.join('\n') + '\n');
  console.log(lines.join('\n'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
