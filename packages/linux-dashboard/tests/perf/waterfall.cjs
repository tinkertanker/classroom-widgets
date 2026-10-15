// Prints what happened while each Timer and Randomiser panel opened, from the
// raw results that `launchBench.cjs --keep-raw` writes: app:// requests and
// the panel's load milestones, in ms after the open was requested.
// usage: node packages/linux-dashboard/tests/perf/waterfall.cjs <raw/*-panels.json.gz>...
const { readFileSync } = require('node:fs');
const { basename } = require('node:path');
const { gunzipSync } = require('node:zlib');

const milestones = new Set(['nav-start', 'preload', 'dom-ready', 'did-finish-load', 'msg:panel-ready', 'content', 'content-raf2', 'msg:panel-content-ready', 'show']);
for (const file of process.argv.slice(2)) {
  const result = JSON.parse(gunzipSync(readFileSync(file)).toString());
  for (const [label, phase] of Object.entries(result.phases)) {
    if (!/-(first|repeat)$/.test(label)) continue;
    const requested = result.marks.find((entry) => entry.name === `${label}:request`)?.t;
    if (requested === undefined) continue;
    const viewWc = result.marks.find((entry) => entry.t >= requested && entry.name === 'nav-start' && entry.extra?.widgetId === phase.widgetId)?.extra.wc;
    console.log(`## ${basename(file)} ${label} (content painted ${phase.contentPainted.toFixed(0)} ms)`);
    for (const entry of result.marks) {
      if (entry.t < requested || entry.t > requested + phase.contentPainted + 1) continue;
      const at = (entry.t - requested).toFixed(1).padStart(7);
      if (entry.name === 'request') {
        console.log(`${at}  request ${entry.extra.url.replace(/^app:\/\/classroomwidgets/, '')} (handler ${entry.extra.ms.toFixed(1)} ms)`);
      } else if (milestones.has(entry.name) && (entry.extra?.wc === viewWc || entry.extra?.role === 'chrome')) {
        console.log(`${at}  ${entry.name} ${entry.extra?.role ?? ''}`);
      }
    }
    console.log('');
  }
}
