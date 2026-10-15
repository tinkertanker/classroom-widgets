#!/usr/bin/env node
// Teacher-app performance benchmark: board start-up, the desktop launcher and
// widget-panel surfaces, opening Timer and Randomiser, and both widgets in
// use. Compares any number of production builds in one interleaved run
// (A B A B ..., alternating which goes first), each in a fresh browser
// context, with and without CPU throttling.
//
//   pnpm --filter @classroom-widgets/teacher perf:bench \
//     --build base=/path/to/baseline/build --build fix=build \
//     --runs 10 --cpu 1,4 --out /tmp/perf-run
//
// Options (defaults in brackets):
//   --build name=dir   a production build to serve; repeatable [current=build]
//   --scenarios list   comma list, or "headline", "in-use", "all" [headline]
//   --runs n           measured runs per build, scenario and CPU rate [10]
//   --warmup n         discarded runs before measuring [1]
//   --cpu list         CDP CPU throttling rates [1,4]
//   --network mode     none, slow4g (1.6 Mbps, 150 ms), fast4g (9 Mbps, 60 ms)
//                      or <down kbps>:<rtt ms> [none]
//   --fonts mode       replay:<ms> | offline | hang:<ms> | none | serve (see fonts.mjs) [replay:100]
//   --settle ms        idle time after "ready" for late work and LCP [1500]
//   --window ms        measuring window for a running Timer [10000]
//   --no-compress      serve without gzip, like the desktop apps' disk reads
//   --out dir          writes raw.jsonl, summary.json and summary.md
// Set CHROME_BIN to use a particular Chromium.
//
// board-history (not in the default set) reloads a board whose live session
// holds `--submissions` Drop Box entries and `--questions` questions. The
// teacher builds connect to the server URL they were built with
// (VITE_SERVER_URL, by default http://localhost:3001), so the bench starts
// this checkout's server on `--history-port` [3001] to match.
//
// Student app: `--app student` takes student builds (`vite build` of
// packages/student with --outDir) and runs student-load, student-join and
// server-join (studentScenarios.mjs). Each build gets its own server; by
// default this checkout's packages/server, or `--server name=dir` for the
// build of the same name. A session there holds `--submissions n` [300]
// Drop Box entries and `--questions n` [200] questions; server-join times
// `--joins n` [20] joins per sample.
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { serveBuild } from './staticServer.mjs';
import { fontsInstaller, parseFontsMode, startFontsHost } from './fonts.mjs';
import { HEADLINE, IN_USE, SCENARIOS } from './scenarios.mjs';
import { STUDENT_DEFAULT, STUDENT_SCENARIOS, startStudentTarget } from './studentScenarios.mjs';
import { HISTORY_ROOMS } from './fixtures.mjs';
import { hostSession, startServer } from './liveSession.mjs';

const teacherDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function parseArgs(argv) {
  const options = {
    app: 'teacher', builds: [], servers: {}, scenarios: null, runs: 10, warmup: 1, cpu: [1, 4], fonts: 'replay:100',
    settle: 1500, window: 10000, compress: true, out: null, submissions: 300, questions: 200, joins: 20, network: 'none', historyPort: 3001,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    const [flag, inline] = arg.startsWith('--') && arg.includes('=') ? arg.split(/=(.*)/s) : [arg, undefined];
    const value = () => inline ?? next();
    switch (flag) {
      case '--build': {
        const spec = value();
        const at = spec.indexOf('=');
        options.builds.push(at > 0 ? { name: spec.slice(0, at), dir: spec.slice(at + 1) } : { name: spec.split('/').filter(Boolean).pop(), dir: spec });
        break;
      }
      case '--app': options.app = value(); break;
      case '--server': {
        const [name, dir] = value().split(/=(.*)/s);
        options.servers[name] = dir;
        break;
      }
      case '--submissions': options.submissions = Number(value()); break;
      case '--questions': options.questions = Number(value()); break;
      case '--joins': options.joins = Number(value()); break;
      case '--history-port': options.historyPort = Number(value()); break;
      case '--scenarios': options.scenarios = value(); break;
      case '--runs': options.runs = Number(value()); break;
      case '--warmup': options.warmup = Number(value()); break;
      case '--cpu': options.cpu = value().split(',').map(Number); break;
      case '--network': options.network = value(); break;
      case '--fonts': options.fonts = value(); break;
      case '--settle': options.settle = Number(value()); break;
      case '--window': options.window = Number(value()); break;
      case '--no-compress': options.compress = false; break;
      case '--out': options.out = value(); break;
      default:
        throw new Error(`unknown option ${arg}`);
    }
  }
  if (!['teacher', 'student'].includes(options.app)) throw new Error(`unknown --app ${options.app}`);
  const student = options.app === 'student';
  if (!options.builds.length) {
    if (student) throw new Error('--app student needs --build name=<student build dir>');
    options.builds.push({ name: 'current', dir: join(teacherDir, 'build') });
  }
  for (const build of options.builds) build.serverDir = options.servers[build.name];
  options.registry = student ? STUDENT_SCENARIOS : SCENARIOS;
  const groups = student
    ? { student: STUDENT_DEFAULT, all: Object.keys(STUDENT_SCENARIOS) }
    : { headline: HEADLINE, 'in-use': IN_USE, all: Object.keys(SCENARIOS) };
  options.scenarioList = (options.scenarios ?? (student ? 'student' : 'headline')).split(',').flatMap((name) => groups[name] ?? [name]);
  for (const name of options.scenarioList) if (!options.registry[name]) throw new Error(`unknown scenario ${name}`);
  return options;
}

const NETWORKS = { slow4g: { downKbps: 1600, upKbps: 750, rttMs: 150 }, fast4g: { downKbps: 9000, upKbps: 9000, rttMs: 60 } };

function parseNetwork(mode) {
  if (mode === 'none') return null;
  if (NETWORKS[mode]) return NETWORKS[mode];
  const [downKbps, rttMs] = mode.split(':').map(Number);
  if (!(downKbps > 0) || !(rttMs >= 0)) throw new Error(`unknown --network ${mode}`);
  return { downKbps, upKbps: downKbps, rttMs };
}

const quantile = (sorted, q) => {
  if (!sorted.length) return null;
  const position = (sorted.length - 1) * q;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
};

function summarise(samples, builds) {
  const groups = new Map();
  for (const sample of samples) {
    const key = `${sample.scenario}|${sample.cpu}`;
    if (!groups.has(key)) groups.set(key, new Map());
    const byBuild = groups.get(key);
    if (!byBuild.has(sample.build)) byBuild.set(sample.build, []);
    byBuild.get(sample.build).push(sample.metrics);
  }
  const summary = [];
  for (const [key, byBuild] of groups) {
    const [scenario, cpu] = key.split('|');
    const metricNames = [...new Set([...byBuild.values()].flat().flatMap((metrics) => Object.keys(metrics)))];
    for (const metric of metricNames) {
      const row = { scenario, cpu: Number(cpu), metric, builds: {} };
      for (const build of builds) {
        const values = (byBuild.get(build.name) || []).map((metrics) => metrics[metric]).filter((value) => typeof value === 'number' && Number.isFinite(value)).sort((a, b) => a - b);
        row.builds[build.name] = { n: values.length, median: quantile(values, 0.5), p25: quantile(values, 0.25), p75: quantile(values, 0.75), p90: quantile(values, 0.9) };
      }
      summary.push(row);
    }
  }
  return summary;
}

const fmt = (value) => (value === null || value === undefined ? '–' : Math.abs(value) >= 100 ? value.toFixed(0) : Math.abs(value) >= 10 ? value.toFixed(1) : value.toFixed(2));

function markdown(summary, builds, options) {
  const lines = [
    `# ${options.app === 'student' ? 'Student' : 'Teacher'} perf benchmark`,
    '',
    `Builds: ${builds.map((build) => `\`${build.name}\` = ${build.dir}${build.serverDir ? ` (server ${build.serverDir})` : ''}`).join(', ')}`,
    ...(options.app === 'student' || options.scenarioList.includes('board-history') ? [`Session history: ${options.submissions} Drop Box entries, ${options.questions} questions.${options.app === 'student' ? ` server-join: ${options.joins} joins per sample.` : ''}`] : []),
    `Runs: ${options.runs} measured (+${options.warmup} warm-up) per build, scenario and CPU rate, interleaved. Fonts: ${options.fonts}. Network: ${options.network}. Compression: ${options.compress ? 'gzip' : 'none'}. Each cell: median (p90) [n].`,
    '',
  ];
  let current = '';
  for (const row of summary) {
    const heading = `${row.scenario} — CPU ${row.cpu}x`;
    if (heading !== current) {
      current = heading;
      lines.push('', `## ${heading}`, '', `| metric | ${builds.map((build) => build.name).join(' | ')} |${builds.length > 1 ? ' Δ median |' : ''}`, `|---|${builds.map(() => '---').join('|')}|${builds.length > 1 ? '---|' : ''}`);
    }
    const cells = builds.map((build) => {
      const stats = row.builds[build.name];
      return `${fmt(stats.median)} (${fmt(stats.p90)}) [${stats.n}]`;
    });
    let change = '';
    if (builds.length > 1) {
      const base = row.builds[builds[0].name].median;
      const last = row.builds[builds[builds.length - 1].name].median;
      change = base ? ` ${fmt(last - base)} (${(((last - base) / base) * 100).toFixed(1)}%) |` : ` ${fmt((last ?? 0) - (base ?? 0))} |`;
    }
    lines.push(`| ${row.metric} | ${cells.join(' | ')} |${change}`);
  }
  return lines.join('\n') + '\n';
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const fonts = parseFontsMode(options.fonts);
  const network = parseNetwork(options.network);
  const out = options.out ? resolve(options.out) : null;
  if (out) {
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, 'raw.jsonl'), '');
  }
  const servers = [];
  for (const build of options.builds) {
    if (options.app === 'student') {
      const target = await startStudentTarget(build, options);
      servers.push({ ...build, dir: resolve(build.dir), target, server: { url: target.url, close: target.stop } });
    } else {
      const server = await serveBuild(build.dir, { compress: options.compress });
      servers.push({ ...build, dir: server.root, server });
    }
  }
  let history = null;
  if (options.scenarioList.includes('board-history')) {
    const server = await startServer({ port: options.historyPort, corsOrigins: servers.map((build) => build.server.url) });
    try {
      const hosted = await hostSession(server.url, { ...HISTORY_ROOMS, submissions: options.submissions, questions: options.questions });
      // The page reclaims the session with the host token, as after a reload.
      hosted.teacher.disconnect();
      history = { serverUrl: server.url, code: hosted.code, hostToken: hosted.hostToken, createdAt: hosted.createdAt, submissions: options.submissions, questions: options.questions, stop: server.stop };
    } catch (error) {
      server.stop();
      throw error;
    }
  }
  const fontsHost = fonts.kind === 'serve' ? await startFontsHost(network) : null;
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || undefined, args: fontsHost?.args ?? [] });
  const samples = [];
  const errors = [];
  const total = (options.warmup + options.runs) * options.cpu.length * options.scenarioList.length * servers.length;
  let done = 0;
  try {
    for (let run = 0; run < options.warmup + options.runs; run++) {
      const order = run % 2 ? [...servers].reverse() : servers;
      for (const cpu of options.cpu) {
        for (const scenario of options.scenarioList) {
          for (const build of order) {
            const env = {
              browser, baseUrl: build.server.url, cpu, settleMs: options.settle, windowMs: options.window,
              installFonts: fontsInstaller(fonts, network), errors: [], target: build.target, joins: options.joins, network, history,
            };
            const started = Date.now();
            let metrics;
            try {
              metrics = await options.registry[scenario](env);
            } catch (error) {
              errors.push(`${build.name} ${scenario} cpu${cpu} run${run}: ${error.message.split('\n')[0]}`);
              console.error(`  ! ${errors[errors.length - 1]}`);
            }
            done++;
            const measured = run >= options.warmup;
            if (metrics && measured) {
              const sample = { build: build.name, scenario, cpu, run: run - options.warmup, metrics, pageErrors: env.errors };
              samples.push(sample);
              if (out) appendFileSync(join(out, 'raw.jsonl'), JSON.stringify(sample) + '\n');
            }
            const headline = metrics ? Object.entries(metrics).slice(0, 3).map(([key, value]) => `${key}=${fmt(value)}`).join(' ') : 'failed';
            console.log(`[${done}/${total}] ${measured ? 'run' : 'warm-up'} ${run} cpu${cpu} ${scenario} ${build.name}: ${headline} (${Date.now() - started} ms)`);
          }
        }
      }
    }
  } finally {
    await browser.close();
    for (const build of servers) await build.server.close();
    await fontsHost?.close();
    history?.stop();
  }
  const summary = summarise(samples, servers);
  const report = markdown(summary, servers, options);
  if (out) {
    const { registry, ...recorded } = options;
    writeFileSync(join(out, 'summary.json'), JSON.stringify({ options: { ...recorded, builds: servers.map(({ name, dir, serverDir }) => ({ name, dir, serverDir })) }, errors, summary }, null, 2));
    writeFileSync(join(out, 'summary.md'), report + (errors.length ? `\n## Errors\n\n${errors.map((error) => `- ${error}`).join('\n')}\n` : ''));
    console.log(`Wrote ${join(out, 'summary.md')}`);
  } else {
    console.log(report);
  }
  if (errors.length) process.exitCode = 1;
}

await main();
