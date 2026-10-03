// #212: real saved-workspace startup, process/private-memory measurement and
// deferred-panel lifecycle. Build teacher and Linux first; run under Xvfb.
// Run separate processes with counts 0, 10 and 30 for comparable startup samples.
const { app, BrowserWindow, protocol } = require('electron');
const assert = require('node:assert/strict');
const { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const count = Number(process.argv.find(arg => arg.startsWith('--count='))?.split('=')[1] ?? 10);
assert.ok([0, 10, 30].includes(count), 'use --count=0, 10 or 30');
const root = resolve(__dirname, '..');
const evidence = resolve(process.env.CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR
  || join(tmpdir(), 'classroom-widgets-test-evidence/hidden-panels'));
mkdirSync(evidence, { recursive: true });
const temporary = mkdtempSync(join(tmpdir(), 'classroom-hidden-panels-'));
app.setAppPath(root);
app.setPath('userData', temporary);
app.setPath('sessionData', temporary);
process.env.XDG_CONFIG_HOME = temporary;
const { registerPrivilegedScheme, installProtocolHandler, ORIGIN } = require('../out/main/appProtocol');
const { DashboardSettings } = require('../out/main/settings');
const { WidgetHostController } = require('../out/main/hostController');
registerPrivilegedScheme();
const lines = [];
const violations = [];
const record = message => { lines.push(message); console.log(message); };
const delay = ms => new Promise(done => setTimeout(done, ms));
async function until(label, check) {
  for (let i = 0; i < 400; i++) {
    const value = await check();
    if (value) return value;
    await delay(50);
  }
  throw new Error(`Timed out: ${label}`);
}
const windows = () => BrowserWindow.getAllWindows().filter(win => win.webContents.getURL().endsWith('panel-chrome.html'));
const inventory = host => host.panelCoordinator.lastInventory;
const viewFor = id => windows().find(win => new URL(win.contentView.children[0].webContents.getURL(), ORIGIN).searchParams.get('widgetId') === id);
const text = view => view.executeJavaScript(`document.querySelector('textarea')?.value`);
const hasButton = (view, label) => view.executeJavaScript(`Array.from(document.querySelectorAll('button')).some(b => b.textContent.trim().endsWith(${JSON.stringify(label)}))`);
const click = (view, label) => view.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().endsWith(${JSON.stringify(label)})).click()`);
const expectWindows = (label, expected) => {
  const actual = windows().length;
  record(`${label}: panel windows=${actual}, expected=${expected}`);
  if (actual !== expected) violations.push(`${label}: ${actual} instead of ${expected}`);
};
const watchdog = setTimeout(() => finish(new Error('E2E timed out')), 180000);

app.whenReady().then(async () => {
  // Seed actual origin storage without mounting the teacher app or any panels.
  // Then restore the production protocol handler before opening the real host.
  protocol.handle('app', () => new Response('<!doctype html><title>Fixture storage</title>'));
  const seed = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false } });
  await seed.loadURL(`${ORIGIN}/fixture`);
  const ids = Array.from({ length: count }, (_, index) => `hidden-list-${index}`);
  const listState = value => ({ items: [{ id: 'row', text: value, status: 3, isEditing: true }], inputs: [value], statuses: [3] });
  const storage = {
    version: 2, currentWorkspaceId: 'hidden-fixture',
    workspaces: { 'hidden-fixture': {
      id: 'hidden-fixture', name: 'Hidden fixture', createdAt: 1, updatedAt: 1,
      widgets: ids.map((id, index) => ({ id, type: 2, hidden: true, position: { x: 0, y: 0 }, size: { width: 350, height: 400 }, zIndex: index })),
      widgetStates: ids.map((id, index) => [id, listState(`Saved row ${index}`)]),
      background: 'lowpoly', scale: 1, scrollPosition: { x: 0, y: 0 }, layoutFormat: 'canvas'
    } },
    globalSettings: { theme: 'light', classEndTime: null },
    session: { code: null, createdAt: null },
    savedCollections: { randomiserLists: {}, questionBanks: {}, pollQuestions: {} }
  };
  await seed.webContents.executeJavaScript(`localStorage.setItem('classroom-widgets-storage-v2', ${JSON.stringify(JSON.stringify(storage))})`);
  protocol.unhandle('app');
  installProtocolHandler();
  const settings = new DashboardSettings();
  settings.outputVolume = 0; // Instrument the alarm attempt without playing sound.
  const savedFrame = { left: 97, top: 121, width: 320, height: 310 };
  if (count) settings.panelFrames[ids.at(-1)] = savedFrame;
  settings.save();
  const host = new WidgetHostController(DashboardSettings.load(), 'hidden-panels-e2e');
  await host.start();
  seed.destroy();
  await until('saved hidden inventory', () => host.widgetOptions.length && inventory(host)?.widgets.length === count);
  await delay(3000);
  // A baseline eager implementation must finish loading its hidden Lists before
  // sampling; the candidate has no panel renderers to wait for.
  for (const win of windows()) await until('hidden List rendered', () => text(win.contentView.children[0].webContents));
  const metrics = app.getAppMetrics();
  let privateKiB = 0;
  for (const metric of metrics) {
    const rollup = readFileSync(`/proc/${metric.pid}/smaps_rollup`, 'utf8');
    for (const match of rollup.matchAll(/^Private_(?:Clean|Dirty|Hugetlb):\s+(\d+) kB/gm)) privateKiB += Number(match[1]);
  }
  const sample = { hiddenLists: count, panelWindows: windows().length,
    rendererProcesses: metrics.filter(metric => metric.type === 'Tab').length,
    privateKiB, totalProcesses: metrics.length };
  record(`Startup sample: ${JSON.stringify(sample)}`);
  writeFileSync(join(evidence, `memory-${count}.json`), JSON.stringify(sample, null, 2) + '\n');
  expectWindows('Never-shown hidden Lists', 0);
  if (count !== 10) {
    assert.deepEqual(violations, []);
    return;
  }

  const hostView = BrowserWindow.getAllWindows().find(win => win.webContents.getURL().includes('dashboard=1')).webContents;
  const id = ids.at(-1);
  const revised = listState('Latest saved row');
  const baseRevision = inventory(host).widgets.find(widget => widget.id === id).revision;
  assert.equal(await hostView.executeJavaScript(`window.classroomPanelHost.applyStateChange(${JSON.stringify({ schemaVersion: 1, widgetId: id, baseRevision, state: revised, flush: true })})`), true);
  await until('hidden state updated', () => inventory(host).widgets.find(widget => widget.id === id).snapshotPayload.state.inputs[0] === 'Latest saved row');
  await host.showWidget(2);
  const win = await until('shown deferred List', () => viewFor(id)?.isVisible() && viewFor(id));
  const view = win.contentView.children[0].webContents;
  await until('latest List text', async () => await text(view) === 'Latest saved row');
  assert.deepEqual(win.getBounds(), { x: 97, y: 121, width: 320, height: 310 }, 'first reveal restores the saved frame');
  expectWindows('First reveal only creates the selected List', 1);
  await view.executeJavaScript(`const input=document.querySelector('textarea'); input.focus(); input.setSelectionRange(input.value.length,input.value.length)`);
  view.sendInputEvent({ type: 'char', keyCode: 'Z' });
  await until('real edit rendered', async () => await text(view) === 'Latest saved rowZ');
  await host.toggleWidget(2);
  await until('List hidden again', () => inventory(host).widgets.find(widget => widget.id === id).hidden && !win.isVisible());
  assert.equal(win.isDestroyed(), false, 'an already-created hidden panel stays alive');
  await host.showWidget(2);
  await until('same List shown again', () => win.isVisible());
  assert.equal(viewFor(id).id, win.id, 'rehide/show reuses the panel');
  await host.toggleWidget(2);
  const oldHost = inventory(host).hostInstanceId;
  await host.reloadWidgets();
  await until('genuine new host', () => inventory(host).hostInstanceId !== oldHost);
  await delay(500);
  expectWindows('Hidden Lists after host reload', 0);
  assert.equal(inventory(host).widgets.find(widget => widget.id === id).snapshotPayload.state.inputs[0], 'Latest saved rowZ');
  await host.showWidget(2);
  const restored = await until('restored List', () => viewFor(id)?.isVisible() && viewFor(id));
  const restoredView = restored.contentView.children[0].webContents;
  await until('exact edit restored', async () => await text(restoredView) === 'Latest saved rowZ');
  assert.deepEqual(restored.getBounds(), win.isDestroyed() ? { x: 97, y: 121, width: 320, height: 310 } : win.getBounds());
  writeFileSync(join(evidence, 'list-restored.png'), (await restoredView.capturePage()).toPNG());
  record('PASS latest hidden state, saved frame, real edit, rehide/show identity and genuine reload recovery');
  await hostView.executeJavaScript(`window.classroomPanelHost.removeWidget(${JSON.stringify(ids[0])})`);
  await until('unused hidden List removed', () => !inventory(host).widgets.some(widget => widget.id === ids[0]));
  assert.equal(viewFor(ids[0]), undefined, 'removing a deferred descriptor must not create its panel');

  // Timer remains eager even when it starts hidden after a reload. Verify a
  // real countdown and an alarm play attempt while its native window is hidden.
  await host.addWidget(1);
  const timerId = await until('Timer inventory', () => inventory(host).widgets.find(widget => widget.snapshotPayload.widgetType === 1)?.id);
  let timer = await until('Timer window', () => viewFor(timerId));
  await until('Timer Start', () => hasButton(timer.contentView.children[0].webContents, 'Start'));
  await click(timer.contentView.children[0].webContents, 'Start');
  await until('running Timer', () => hasButton(timer.contentView.children[0].webContents, 'Pause'));
  await host.toggleWidget(1);
  await until('hidden Timer', () => inventory(host).widgets.find(widget => widget.id === timerId).hidden && !timer.isVisible());
  assert.equal(timer.isDestroyed(), false);
  await host.toggleWidget(2); // Hide the restored List before reloading.
  const timerHost = inventory(host).hostInstanceId;
  await host.reloadWidgets();
  await until('new host for hidden Timer', () => inventory(host).hostInstanceId !== timerHost);
  timer = await until('eager hidden Timer', () => viewFor(timerId));
  const timerView = timer.contentView.children[0].webContents;
  await until('restored running hidden Timer', () => hasButton(timerView, 'Pause'));
  record(`Restored hidden Timer: ${JSON.stringify(inventory(host).widgets.find(widget => widget.id === timerId).snapshotPayload.state.timer)}`);
  await timerView.executeJavaScript(`window.alarmAttempts=0; HTMLMediaElement.prototype.play=function(){window.alarmAttempts++;return Promise.resolve()}; void 0`);
  await until('hidden Timer completes', () => inventory(host).widgets.find(widget => widget.id === timerId).snapshotPayload.state.timer.timerFinished === true);
  assert.equal(timer.isVisible(), false);
  assert.equal(await timerView.executeJavaScript('window.alarmAttempts'), 1, 'hidden Timer attempts its alarm once');
  expectWindows('Only the background-audio Timer loads on reload', 1);
  record('PASS hidden running Timer survives reload, completes and attempts its alarm once');
  assert.deepEqual(violations, [], 'never-shown passive panels must be deferred');
}).then(() => finish(), finish);

function finish(error) {
  clearTimeout(watchdog);
  if (error) record(`FAIL: ${error.stack || error}`);
  else record('PASS hidden-panel allocation and lifecycle');
  writeFileSync(join(evidence, `hidden-panels-${count}.txt`), lines.join('\n') + '\n');
  rmSync(temporary, { recursive: true, force: true });
  app.exit(error ? 1 : 0);
}
