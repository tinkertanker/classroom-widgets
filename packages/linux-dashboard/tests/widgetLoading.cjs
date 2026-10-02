// Build teacher with `pnpm --filter @classroom-widgets/teacher build --manifest`
// and Linux with `npm run build`, then from the repository root run:
// xvfb-run -a packages/linux-dashboard/node_modules/.bin/electron --no-sandbox --disable-gpu packages/linux-dashboard/tests/widgetLoading.cjs
const { app, BrowserWindow, session } = require('electron');
const assert = require('node:assert/strict');
const { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const root = resolve(__dirname, '..');
const build = resolve(root, '../teacher/build');
const manifest = JSON.parse(readFileSync(join(build, '.vite/manifest.json'), 'utf8'));
const widgetEntries = Object.entries(manifest).filter(([source]) =>
  source.startsWith('src/features/widgets/') && source.endsWith('/index.tsx'));
assert.ok(widgetEntries.length > 15, 'production manifest identifies widget chunks');
const evidence = resolve(process.env.CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR
  || join(tmpdir(), 'classroom-widgets-test-evidence/linux-widget-loading'));
mkdirSync(evidence, { recursive: true });
const temporary = mkdtempSync(join(tmpdir(), 'classroom-widget-loading-'));
app.setAppPath(root);
app.setPath('userData', temporary);
app.setPath('sessionData', temporary);
process.env.XDG_CONFIG_HOME = temporary;
const { registerPrivilegedScheme, installProtocolHandler } = require('../out/main/appProtocol');
const { DashboardSettings } = require('../out/main/settings');
const { WidgetHostController } = require('../out/main/hostController');
const { LauncherWindow } = require('../out/main/launcherWindow');
registerPrivilegedScheme();

const log = [];
const violations = [];
const requests = new Map();
const delay = ms => new Promise(done => setTimeout(done, ms));
const record = message => { log.push(message); console.log(message); };
async function until(description, check) {
  for (let i = 0; i < 200; i++) {
    const value = await check();
    if (value) return value;
    await delay(50);
  }
  throw new Error(`Timed out: ${description}`);
}
async function checkLoads(view, label, expected) {
  await delay(3000); // Exceed the old idle preload deadline.
  const files = [...(requests.get(view.id) ?? [])];
  const loaded = widgetEntries.filter(([, entry]) => files.includes(entry.file))
    .map(([source]) => source.slice('src/features/widgets/'.length, -'/index.tsx'.length)).sort();
  const bytes = [...new Set(files)].filter(file => file.startsWith('assets/') && file.endsWith('.js'))
    .reduce((total, file) => total + readFileSync(join(build, file)).length, 0);
  record(`${label}: widget entries=${JSON.stringify(loaded)}, JavaScript bytes requested=${bytes}`);
  if (JSON.stringify(loaded) !== JSON.stringify(expected)) violations.push({ label, expected, loaded });
}
const panel = () => BrowserWindow.getAllWindows()
  .find(win => win.webContents.getURL().endsWith('panel-chrome.html'))?.contentView.children[0]?.webContents;
const hasButton = (view, label) => view.executeJavaScript(
  `Array.from(document.querySelectorAll('button')).some(b => b.textContent.trim().endsWith(${JSON.stringify(label)}))`);
const clickButton = (view, label) => view.executeJavaScript(
  `Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().endsWith(${JSON.stringify(label)})).click()`);

const watchdog = setTimeout(() => finish(new Error('E2E timed out')), 60000);
app.whenReady().then(async () => {
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    if (!requests.has(details.webContentsId)) requests.set(details.webContentsId, new Set());
    requests.get(details.webContentsId).add(new URL(details.url).pathname.slice(1));
    callback({});
  });
  installProtocolHandler();
  const host = new WidgetHostController(new DashboardSettings(), 'widget-loading-e2e');
  await host.start();
  await until('host inventory', () => host.widgetOptions.length > 0);
  const hostView = BrowserWindow.getAllWindows().find(win => win.webContents.getURL().includes('dashboard=1')).webContents;
  await checkLoads(hostView, 'Empty hidden host', []);

  const launcher = new LauncherWindow('widget-loading-e2e', type => void host.addWidget(type), () => {});
  launcher.show();
  const launcherView = await until('launcher', () => BrowserWindow.getAllWindows()
    .find(win => win.webContents.getURL().includes('surface=widget-launcher'))?.webContents);
  await until('launcher Timer button', () => hasButton(launcherView, 'Timer'));
  await checkLoads(launcherView, 'Launcher', []);
  await clickButton(launcherView, 'Timer');

  let view = await until('Timer panel', panel);
  await until('Timer first render', () => hasButton(view, 'Start'));
  await view.executeJavaScript(`document.querySelector('[aria-label="Mute timer sound"]').click()`);
  await clickButton(view, 'Start');
  await until('running Timer', () => hasButton(view, 'Pause'));
  await clickButton(view, 'Pause');
  await until('paused Timer', () => hasButton(view, 'Resume'));
  await checkLoads(view, 'First Timer panel, started and paused', ['timer']);

  await host.reloadWidgets();
  view = await until('reloaded Timer panel', panel);
  await until('restored paused Timer', () => hasButton(view, 'Resume'));
  assert.ok(await view.executeJavaScript(`!!document.querySelector('[aria-label="Unmute timer sound"]')`));
  await checkLoads(view, 'Restored paused, muted Timer panel', ['timer']);
  writeFileSync(join(evidence, 'timer-restored.png'), (await view.capturePage()).toPNG());
  assert.deepEqual(violations, [], 'only selected widgets may load in each native webview');
  record('PASS: native launcher, first panel interaction and host reload');
}).then(() => finish(), finish);

function finish(error) {
  clearTimeout(watchdog);
  if (error) record(`FAIL: ${error.stack || error}`);
  writeFileSync(join(evidence, 'widget-loading.txt'), log.join('\n') + '\n');
  rmSync(temporary, { recursive: true, force: true });
  app.exit(error ? 1 : 0);
}
