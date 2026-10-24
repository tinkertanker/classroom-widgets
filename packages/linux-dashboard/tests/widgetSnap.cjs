// Drives the real app (out/main/main.js with the teacher build and its hidden
// host) through each widget's "Arrange widgets" title-bar menu and its
// position presets, across two displays. Build the teacher app and this
// package first, then from the repository root (install xvfb on headless Linux):
// xvfb-run -a -s '-screen 0 2560x800x24' packages/linux-dashboard/node_modules/.bin/electron --no-sandbox --disable-gpu packages/linux-dashboard/tests/widgetSnap.cjs --background
// As in arrange.cjs, one 2560-wide X screen is reported as two 1280x800 displays.
// Evidence goes to $CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR (default: the system temp
// directory's classroom-widgets-test-evidence/linux-widget-snap): widget-snap.txt
// with every step and the frames it observed, plus screenshots.
const electron = require('electron');
const { app, BrowserWindow, Menu, Tray } = electron;
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const root = resolve(__dirname, '..');
app.setAppPath(root);
const evidence = resolve(process.env.CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR || join(tmpdir(), 'classroom-widgets-test-evidence', 'linux-widget-snap'));
mkdirSync(evidence, { recursive: true });
const temporary = mkdtempSync(join(tmpdir(), 'classroom-widget-snap-test-'));
process.env.XDG_CONFIG_HOME = temporary;
const userData = join(temporary, 'ClassroomWidgets');
app.setPath('userData', userData);
mkdirSync(userData, { recursive: true });

const LEFT = { x: 0, y: 0, width: 1280, height: 800 };
const RIGHT = { x: 1280, y: 0, width: 1280, height: 800 };
const displays = [LEFT, RIGHT].map((bounds, index) => ({
  id: index + 1, bounds, workArea: bounds, size: { width: bounds.width, height: bounds.height },
  workAreaSize: { width: bounds.width, height: bounds.height }, scaleFactor: 1, rotation: 0, internal: false,
}));
const overlap = (a, b) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
  * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
app.whenReady().then(() => {
  const { screen } = electron;
  screen.getAllDisplays = () => displays;
  screen.getPrimaryDisplay = () => displays[0];
  screen.getDisplayMatching = (rect) => (overlap(rect, RIGHT) > overlap(rect, LEFT) ? displays[1] : displays[0]);
});

const menus = [];
const setContextMenu = Tray.prototype.setContextMenu;
Tray.prototype.setContextMenu = function (menu) {
  menus.push(menu);
  return setContextMenu.call(this, menu);
};
let popped = null;
Menu.prototype.popup = function () { popped = this; }; // Use the real items without grabbing the pointer.
const item = (label) => menus[menus.length - 1].items.find((entry) => entry.label === label);
const arrangeItem = (label) => item('Arrange Widgets').submenu.items.find((entry) => entry.label === label);

const log = [];
const panels = {};
const settle = () => new Promise((done) => setTimeout(done, 400));
async function waitFor(what, check) {
  for (let i = 0; i < 300; i++) {
    const result = await check();
    if (result) return result;
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error(`Timed out waiting for ${what}`);
}
async function open(label, title) {
  item(label).click();
  panels[title] = await waitFor(`the ${title} panel`, () => BrowserWindow.getAllWindows().find((win) => win.getTitle() === title && win.isVisible()));
}
function snapshot(name) {
  try {
    execFileSync('import', ['-display', process.env.DISPLAY, '-window', 'root', join(evidence, `${name}.png`)]);
  } catch (error) {
    log.push(`(screenshot ${name} failed: ${error.message})`);
  }
}

const EXPECTED = ['Left Half', 'Right Half', 'Top Half', 'Bottom Half', 'Top Left', 'Top Right', 'Bottom Left', 'Bottom Right', 'Centre', 'Fill Screen'];
async function snap(title, label, display) {
  const win = panels[title];
  popped = null;
  await win.webContents.executeJavaScript("document.getElementById('arrange').click()");
  const menu = await waitFor(`${title} arrange menu`, () => popped);
  const labels = menu.items.filter((entry) => entry.type !== 'separator' && entry.enabled).map((entry) => entry.label);
  assert.deepEqual(labels.slice(-EXPECTED.length), EXPECTED, 'the arrange menu lists the position presets');
  menu.items.find((entry) => entry.label === label).click();
  await settle();
  const bounds = win.getBounds();
  const [minWidth, minHeight] = win.getMinimumSize();
  const [maxWidth, maxHeight] = win.getMaximumSize();
  log.push(`${title} → ${label}: ${JSON.stringify(bounds)} (min ${minWidth}x${minHeight}, max ${maxWidth}x${maxHeight}, resizable ${win.isResizable()})`);
  const area = { x: display.x + 12, y: display.y + 12, width: display.width - 24, height: display.height - 24 };
  assert.ok(bounds.x >= area.x && bounds.y >= area.y && bounds.x + bounds.width <= area.x + area.width
    && bounds.y + bounds.height <= area.y + area.height, `${title} ${label} stays inside its display's work area`);
  assert.ok(bounds.width >= minWidth && bounds.height >= minHeight, `${title} ${label} respects the minimum size`);
  if (maxWidth > 0) assert.ok(bounds.width <= maxWidth + 1 && bounds.height <= maxHeight + 1, `${title} ${label} respects the maximum size`);
  return { bounds, area };
}

require('../out/main/main.js');

app.whenReady().then(async () => {
  try {
    await waitFor('widget options in the tray', () => item('⏱️  Timer'));
    await open('⏱️  Timer', 'Timer');
    await open('🚦  Traffic Light', 'Traffic Light');
    await settle();
    // A row layout first: a preset must take the panel back to free placement.
    arrangeItem('Arrange in a Row').click();
    await settle();
    log.push('Tray → Arrange in a Row');

    for (const [title, display] of [['Timer', LEFT], ['Traffic Light', RIGHT]]) {
      if (display === RIGHT) {
        // Dragged to the right-hand display: presets stay on that display.
        panels[title].setBounds({ ...panels[title].getBounds(), x: RIGHT.x + 300, y: 300 });
        await settle();
      }
      const resizable = panels[title].isResizable();
      const before = panels[title].getBounds();
      const left = await snap(title, 'Left Half', display);
      assert.equal(left.bounds.x, left.area.x, `${title} Left Half touches the left edge`);
      if (title === 'Timer') {
        assert.ok(arrangeItem('Free Placement').checked, 'a preset switches the layout to free placement');
      }
      const right = await snap(title, 'Right Half', display);
      assert.equal(right.bounds.x + right.bounds.width, right.area.x + right.area.width, `${title} Right Half touches the right edge`);
      const corner = await snap(title, 'Bottom Right', display);
      assert.equal(corner.bounds.x + corner.bounds.width, corner.area.x + corner.area.width);
      assert.equal(corner.bounds.y + corner.bounds.height, corner.area.y + corner.area.height);
      snapshot(`${title.replace(' ', '-').toLowerCase()}-bottom-right`);
      const topLeft = await snap(title, 'Top Left', display);
      assert.deepEqual([topLeft.bounds.x, topLeft.bounds.y], [topLeft.area.x, topLeft.area.y]);
      const fill = await snap(title, 'Fill Screen', display);
      if (!resizable) {
        assert.deepEqual([fill.bounds.width, fill.bounds.height], [before.width, before.height], `${title} is fixed-size, so it is only moved`);
      }
      const centred = await snap(title, 'Centre', display);
      assert.deepEqual([centred.bounds.width, centred.bounds.height], [fill.bounds.width, fill.bounds.height], 'Centre keeps the size');
      snapshot(`${title.replace(' ', '-').toLowerCase()}-centre`);
    }

    log.push('PASS');
    writeFileSync(join(evidence, 'widget-snap.txt'), log.join('\n') + '\n');
    process.stdout.write(`PASS — evidence in ${evidence}\n`);
    finish(0);
  } catch (error) {
    log.push(`FAIL: ${error.stack || error.message}`);
    writeFileSync(join(evidence, 'widget-snap.txt'), log.join('\n') + '\n');
    process.stderr.write(`${error.stack || error.message}\n`);
    finish(1);
  }
});

function finish(code) {
  rmSync(temporary, { recursive: true, force: true });
  app.exit(code);
}
