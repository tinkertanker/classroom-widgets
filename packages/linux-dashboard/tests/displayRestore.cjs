// Drives the real Display coordinator and window under a window manager: a preset
// chosen while Display is maximised, full screen, or full screen over maximised
// must restore the window first and then apply the preset, and an F11 round trip
// on a maximised window must still come back maximised. Needs a window manager,
// so from this package (after npm run build):
// xvfb-run -a -s '-screen 0 2560x900x24' sh -c 'openbox & sleep 1.5; node_modules/.bin/electron --no-sandbox --disable-gpu tests/displayRestore.cjs'
// Evidence goes to $CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR (default: the system temp
// directory's classroom-widgets-test-evidence/linux-display-restore).
const { app, BrowserWindow, screen } = require('electron');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const root = resolve(__dirname, '..');
app.setAppPath(root);
const evidence = resolve(process.env.CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR || join(tmpdir(), 'classroom-widgets-test-evidence', 'linux-display-restore'));
mkdirSync(evidence, { recursive: true });
const delay = (ms) => new Promise((done) => setTimeout(done, ms));
const log = [];

app.whenReady().then(async () => {
  try {
    const { DisplayPreviewCoordinator } = require(join(root, 'out/main/displayPreview.js'));
    const { DisplayCatalog } = require(join(root, 'out/main/displayCatalog.js'));
    let saved = null;
    const settings = {
      alwaysOnTop: false,
      displayPreviewShowOnReconnect: true,
      getDisplayPreviewFrame: () => undefined,
      getDisplayPreviewSourceId: () => null,
      setDisplayPreviewSourceId() {},
      setDisplayPreviewFrame(frame) { saved = frame; },
    };
    const coordinator = new DisplayPreviewCoordinator(settings, new DisplayCatalog(screen));
    coordinator.open();
    await delay(1500);
    const win = BrowserWindow.getAllWindows()[0];
    const area = screen.getPrimaryDisplay().workArea;
    log.push(`work area ${JSON.stringify(area)}`);
    const state = () => `max=${win.isMaximized()} fs=${win.isFullScreen()} bounds=${JSON.stringify(win.getBounds())}`;
    const normal = async () => {
      if (win.isFullScreen()) win.setFullScreen(false);
      await delay(500);
      if (win.isMaximized()) win.unmaximize();
      await delay(500);
      win.setBounds({ x: 300, y: 200, width: 600, height: 460 });
      await delay(400);
    };
    const check = async (label, preset) => {
      const started = Date.now();
      coordinator.snapTo(preset);
      // Well inside the 1 s fallback: the preset must follow the restore itself.
      await delay(600);
      log.push(`${label} → ${preset} after ${Date.now() - started} ms: ${state()} saved=${JSON.stringify(saved)}`);
      assert.ok(!win.isMaximized() && !win.isFullScreen(), `${label}: the window is restored`);
      const b = win.getBounds();
      assert.ok(b.width < area.width / 2 + 1, `${label}: ${preset} is applied, not the maximised frame`);
      if (preset === 'left-half') assert.equal(b.x, area.x + 12, `${label}: left edge`);
      else assert.equal(b.x + b.width, area.x + area.width - 12, `${label}: right edge`);
      assert.ok(saved && saved.width === b.width, `${label}: the snapped frame is saved`);
    };

    win.maximize(); await delay(700);
    await check('maximised', 'left-half');
    await normal();
    win.setFullScreen(true); await delay(700);
    await check('full screen', 'right-half');
    await normal();
    win.maximize(); await delay(700);
    win.setFullScreen(true); await delay(700);
    await check('full screen over maximised', 'left-half');
    await normal();

    // Centre keeps the restored size, not the maximised one.
    for (const [label, enter] of [
      ['maximised', async () => { win.maximize(); await delay(700); }],
      ['full screen over maximised', async () => { win.maximize(); await delay(700); win.setFullScreen(true); await delay(700); }],
    ]) {
      await enter();
      coordinator.snapTo('centre');
      await delay(600);
      const b = win.getBounds();
      log.push(`${label} → centre: ${state()}`);
      assert.ok(!win.isMaximized() && !win.isFullScreen(), `${label} centre: restored`);
      assert.deepEqual([b.width, b.height], [600, 460], `${label} centre: keeps the restored size`);
      assert.equal(b.x, area.x + Math.round((area.width - 600) / 2), `${label} centre: centred`);
      await normal();
    }

    // F11 without a preset: leaving full screen returns to maximised.
    win.maximize(); await delay(700);
    win.setFullScreen(true); await delay(700);
    win.setFullScreen(false); await delay(700);
    log.push(`F11 round trip: ${state()}`);
    assert.ok(win.isMaximized(), 'an F11 round trip keeps a maximised window maximised');

    log.push('PASS');
    writeFileSync(join(evidence, 'display-restore.txt'), log.join('\n') + '\n');
    process.stdout.write(`PASS — evidence in ${evidence}\n`);
    app.exit(0);
  } catch (error) {
    log.push(`FAIL: ${error.stack || error.message}`);
    writeFileSync(join(evidence, 'display-restore.txt'), log.join('\n') + '\n');
    process.stderr.write(`${error.stack || error.message}\n`);
    app.exit(1);
  }
});
