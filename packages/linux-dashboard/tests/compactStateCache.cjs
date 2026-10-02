// #223 real Electron host/panel check. Build teacher and Linux first, then run:
// CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR=<dir> xvfb-run -a packages/linux-dashboard/node_modules/.bin/electron --no-sandbox --disable-gpu packages/linux-dashboard/tests/compactStateCache.cjs
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const root = resolve(__dirname, '..');
const evidence = resolve(process.env.CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR
  || join(tmpdir(), 'classroom-widgets-test-evidence/compact-state-cache'));
mkdirSync(evidence, { recursive: true });
const temporary = mkdtempSync(join(tmpdir(), 'classroom-compact-cache-'));
app.setAppPath(root);
app.setPath('userData', temporary);
app.setPath('sessionData', temporary);
process.env.XDG_CONFIG_HOME = temporary;
const { registerPrivilegedScheme, installProtocolHandler } = require('../out/main/appProtocol');
const { DashboardSettings } = require('../out/main/settings');
const { WidgetHostController } = require('../out/main/hostController');
registerPrivilegedScheme();
const lines = [];
const record = message => { lines.push(message); console.log(message); };
const delay = ms => new Promise(done => setTimeout(done, ms));
async function until(label, check) {
  for (let i = 0; i < 200; i++) {
    const value = await check();
    if (value) return value;
    await delay(50);
  }
  throw new Error(`Timed out: ${label}`);
}
const inventory = host => host.panelCoordinator.lastInventory;
const panelViews = () => BrowserWindow.getAllWindows()
  .filter(win => win.webContents.getURL().endsWith('panel-chrome.html'))
  .map(win => win.contentView.children[0]?.webContents).filter(Boolean);
const texts = view => view.executeJavaScript(`Array.from(document.querySelectorAll('textarea')).map(e => e.value)`);
const watchdog = setTimeout(() => finish(new Error('E2E timed out')), 120000);

app.whenReady().then(async () => {
  installProtocolHandler();
  const host = new WidgetHostController(new DashboardSettings(), 'compact-cache-e2e');
  await host.start();
  await until('host ready', () => host.widgetOptions.length > 0);
  const hostView = BrowserWindow.getAllWindows().find(win => win.webContents.getURL().includes('dashboard=1')).webContents;
  // Six independent Lists, each with a substantial state, make accidental
  // all-widget work visible rather than testing a one-widget trivial case.
  for (let index = 0; index < 6; index++) await host.addWidget(2);
  await until('six Lists', () => inventory(host)?.widgets.length === 6);
  const ids = inventory(host).widgets.map(widget => widget.id);
  for (const [index, id] of ids.entries()) {
    const state = {
      items: Array.from({ length: 100 }, (_, row) => ({
        id: `item-${index}-${row}`, text: `List ${index} row ${row}`, status: row % 5, isEditing: row === 0
      })),
      inputs: Array.from({ length: 100 }, (_, row) => `List ${index} row ${row}`),
      statuses: Array.from({ length: 100 }, (_, row) => row % 5)
    };
    await hostView.executeJavaScript(`window.classroomPanelHost.applyStateChange(${JSON.stringify({
      schemaVersion: 1, widgetId: id, baseRevision: 0, state, flush: true
    })})`);
    await until(`List ${index} state`, () => inventory(host).widgets.find(widget => widget.id === id)
      ?.snapshotPayload.state?.inputs?.[0] === `List ${index} row 0`);
  }
  const view = await until('editable List0 panel', async () => {
    for (const candidate of panelViews()) if ((await texts(candidate))[0] === 'List 0 row 0') return candidate;
  });
  await delay(500);
  await hostView.executeJavaScript(`(() => {
    const clone = window.structuredClone;
    const stringify = JSON.stringify;
    window.cacheProbe = { clones: 0, signatures: 0 };
    window.structuredClone = function(value, ...args) {
      if (Array.isArray(value?.items)) window.cacheProbe.clones++;
      return clone.call(this, value, ...args);
    };
    JSON.stringify = function(value, ...args) {
      if (Array.isArray(value?.items)) window.cacheProbe.signatures++;
      return stringify.call(this, value, ...args);
    };
  })()`);
  const before = inventory(host).widgets.map(widget => ({ id: widget.id, revision: widget.revision, stateRevision: widget.stateRevision }));
  await view.executeJavaScript(`document.querySelector('textarea').focus()`);
  // Real keyboard input invokes the List onChange, panel checkpoint and native
  // state bridge. Wait between keys so React cannot hide work by batching them.
  for (const [index, key] of [...'ABCDE'].entries()) {
    view.sendInputEvent({ type: 'char', keyCode: key });
    await until(`edit ${index}`, () => inventory(host).widgets[0].snapshotPayload.state.inputs[0].endsWith('ABCDE'.slice(0, index + 1)));
  }
  const counts = await hostView.executeJavaScript('window.cacheProbe');
  record(`Six 100-row Lists, five edits: host state clones=${counts.clones}, state signature serializations=${counts.signatures}`);
  const edited = inventory(host).widgets[0];
  assert.ok(edited.stateRevision > before[0].stateRevision);
  for (let index = 1; index < 6; index++) {
    assert.equal(inventory(host).widgets[index].revision, before[index].revision);
    assert.equal(inventory(host).widgets[index].stateRevision, before[index].stateRevision);
    assert.equal(inventory(host).widgets[index].snapshotPayload.state.inputs[0], `List ${index} row 0`);
  }
  // Metadata updates must not invalidate unchanged state; hiding one List
  // must retain its complete snapshot and other panels' state revisions.
  await host.toggleWidget(2);
  await until('last List hidden', () => inventory(host).widgets.at(-1).hidden);
  assert.equal(inventory(host).widgets.at(-1).stateRevision, before.at(-1).stateRevision);
  await host.showWidget(2);
  await until('last List visible again', () => !inventory(host).widgets.at(-1).hidden);
  // Reload immediately after one more key: final pending native edits must
  // survive recovery, not just snapshots whose debounce already completed.
  view.sendInputEvent({ type: 'char', keyCode: 'Z' });
  await until('last key rendered', async () => (await texts(view))[0]?.endsWith('ABCDEZ'));
  const previousHostInstance = inventory(host).hostInstanceId;
  await host.reloadWidgets();
  await until('new host instance after reload', () => inventory(host).hostInstanceId !== previousHostInstance);
  const restored = await until('restored edited List', async () => {
    for (const candidate of panelViews()) if ((await texts(candidate))[0] === 'List 0 row 0ABCDEZ') return candidate;
  });
  assert.equal(inventory(host).widgets.length, 6);
  writeFileSync(join(evidence, 'list-restored.png'), (await restored.capturePage()).toPNG());
  record('PASS exact latest text, unchanged List states/revisions, hide/show and immediate pending-edit reload');
  assert.equal(counts.clones, 5, 'only the edited List may be cloned for each edit');
  assert.ok(counts.signatures <= 10, 'unchanged Lists must not be serialized for state signatures');
  record('PASS bounded host clone/signature work; complete inventory format preserved');
}).then(() => finish(), finish);

function finish(error) {
  clearTimeout(watchdog);
  if (error) record(`FAIL: ${error.stack || error}`);
  writeFileSync(join(evidence, 'compact-state-cache.txt'), lines.join('\n') + '\n');
  rmSync(temporary, { recursive: true, force: true });
  app.exit(error ? 1 : 0);
}
