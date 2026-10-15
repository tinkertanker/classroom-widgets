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
//   --fonts mode       replay:<ms> | offline | hang:<ms> (see fonts.mjs) [replay:100]
//   --settle ms        idle time after "ready" for late work and LCP [1500]
//   --window ms        measuring window for a running Timer [10000]
//   --no-compress      serve without gzip, like the desktop apps' disk reads
//   --out dir          writes raw.jsonl, summary.json and summary.md
// Set CHROME_BIN to use a particular Chromium.
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { serveBuild } from './staticServer.mjs';
import { fontsInstaller, parseFontsMode } from './fonts.mjs';
import { HEADLINE, IN_USE, SCENARIOS } from './scenarios.mjs';

const teacherDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function parseArgs(argv) {
  const options = { builds: [], scenarios: 'headline', runs: 10, warmup: 1, cpu: [1, 4], fonts: 'replay:100', settle: 1500, window: 10000, compress: true, out: null };
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
      case '--scenarios': options.scenarios = value(); break;
      case '--runs': options.runs = Number(value()); break;
      case '--warmup': options.warmup = Number(value()); break;
      case '--cpu': options.cpu = value().split(',').map(Number); break;
      case '--fonts': options.fonts = value(); break;
      case '--settle': options.settle = Number(value()); break;
      case '--window': options.window = Number(value()); break;
      case '--no-compress': options.compress = false; break;
      case '--out': options.out = value(); break;
      default:
        throw new Error(`unknown option ${arg}`);
    }
  }
  if (!options.builds.length) options.builds.push({ name: 'current', dir: join(teacherDir, 'build') });
  const groups = { headline: HEADLINE, 'in-use': IN_USE, all: Object.keys(SCENARIOS) };
  options.scenarioList = options.scenarios.split(',').flatMap((name) => groups[name] ?? [name]);
  for (const name of options.scenarioList) if (!SCENARIOS[name]) throw new Error(`unknown scenario ${name}`);
  return options;
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
    `# Teacher perf benchmark`,
    '',
    `Builds: ${builds.map((build) => `\`${build.name}\` = ${build.dir}`).join(', ')}`,
    `Runs: ${options.runs} measured (+${options.warmup} warm-up) per build, scenario and CPU rate, interleaved. Fonts: ${options.fonts}. Compression: ${options.compress ? 'gzip' : 'none'}. Each cell: median (p90) [n].`,
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
  const out = options.out ? resolve(options.out) : null;
  if (out) {
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, 'raw.jsonl'), '');
  }
  const servers = [];
  for (const build of options.builds) {
    const server = await serveBuild(build.dir, { compress: options.compress });
    servers.push({ ...build, dir: server.root, server });
  }
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || undefined });
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
              installFonts: fontsInstaller(fonts), errors: [],
            };
            const started = Date.now();
            let metrics;
            try {
              metrics = await SCENARIOS[scenario](env);
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
  }
  const summary = summarise(samples, servers);
  const report = markdown(summary, servers, options);
  if (out) {
    writeFileSync(join(out, 'summary.json'), JSON.stringify({ options: { ...options, builds: servers.map(({ name, dir }) => ({ name, dir })) }, errors, summary }, null, 2));
    writeFileSync(join(out, 'summary.md'), report + (errors.length ? `\n## Errors\n\n${errors.map((error) => `- ${error}`).join('\n')}\n` : ''));
    console.log(`Wrote ${join(out, 'summary.md')}`);
  } else {
    console.log(report);
  }
  if (errors.length) process.exitCode = 1;
}

await main();
