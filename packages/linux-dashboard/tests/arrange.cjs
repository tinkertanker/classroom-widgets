// Drives the real app (out/main/main.js with the teacher build and its hidden
// host) through Arrange Widgets from the tray, across two displays, with a
// panel that has been closed but not yet removed by the host. Build the
// teacher app and this package first, then from the repository root (install
// xvfb on headless Linux):
// xvfb-run -a -s '-screen 0 2560x800x24' packages/linux-dashboard/node_modules/.bin/electron --no-sandbox --disable-gpu packages/linux-dashboard/tests/arrange.cjs --background
// Xvfb has a single monitor, so the X screen must be 2560 wide: this script
// reports it to the app as two side-by-side 1280x800 displays.
// Evidence goes to $CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR (default: the system temp
// directory's classroom-widgets-test-evidence/linux-arrange): arrange.txt with
// every step and the panel frames it observed.
const electron = require('electron');
const { app, BrowserWindow, Tray } = electron;
const assert = require('node:assert/strict');
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const root = resolve(__dirname, '..');
app.setAppPath(root);
const evidence = resolve(process.env.CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR || join(tmpdir(), 'classroom-widgets-test-evidence', 'linux-arrange'));
mkdirSync(evidence, { recursive: true });
const temporary = mkdtempSync(join(tmpdir(), 'classroom-arrange-test-'));
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
// The screen module is only usable once the app is ready; this handler is
// registered before main.js's own, so it runs first.
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
const latest = () => menus[menus.length - 1];
const item = (label) => latest().items.find((entry) => entry.label === label);
const arrangeItem = (label) => item('Arrange Widgets').submenu.items.find((entry) => entry.label === label);

const log = [];
const panels = {};
const frame = (title) => panels[title].getBounds();
const describe = (title) => {
  const { x, y, width, height } = frame(title);
  return `${title}: ${x},${y} ${width}x${height}${panels[title].isVisible() ? '' : ' (hidden)'}`;
};
const record = (title) => log.push(`## ${title}`, ...Object.keys(panels).map(describe), `Arrange Widgets enabled: ${item('Arrange Widgets').enabled}`, '');
// Rows and columns are centred in the display's work area inset by 12px, so
// the group's leading and trailing margins match only when exactly `titles`
// were laid out there.
function assertCentred(titles, axis, display) {
  const [start, extent] = axis === 'x' ? ['x', 'width'] : ['y', 'height'];
  const frames = titles.map(frame);
  const lead = frames[0][start] - (display[start] + 12);
  const last = frames[frames.length - 1];
  const trail = display[start] + display[extent] - 12 - (last[start] + last[extent]);
  assert.ok(Math.abs(lead - trail) <= 1, `${titles.join(', ')} are centred together on the display (margins ${lead} and ${trail})`);
  for (const title of titles) assert.ok(frame(title).x >= display.x && frame(title).x < display.x + display.width, `${title} is on the display at x=${display.x}`);
}
const settle = () => new Promise((done) => setTimeout(done, 400));

async function waitFor(what, check) {
  for (let i = 0; i < 300; i++) {
    if (await check()) return;
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error(`Timed out waiting for ${what}`);
}

async function open(label, title) {
  item(label).click();
  await waitFor(`the ${title} panel`, () => (panels[title] = BrowserWindow.getAllWindows().find((win) => win.getTitle() === title && win.isVisible())));
}

require('../out/main/main.js');

app.whenReady().then(async () => {
  try {
    await waitFor('widget options in the tray', () => item('⏱️  Timer'));
    await open('⏱️  Timer', 'Timer');
    await open('🔤  Text Banner', 'Text Banner');
    await open('🚦  Traffic Light', 'Traffic Light');
    await settle();

    // Drag Traffic Light to the right-hand display, then focus it.
    const light = frame('Traffic Light');
    panels['Traffic Light'].setBounds({ ...light, x: RIGHT.x + 300, y: 300 });
    panels['Traffic Light'].focus();
    await settle();
    const freeform = Object.fromEntries(Object.keys(panels).map((title) => [title, frame(title)]));
    record('Free placement, Traffic Light dragged to the right display and focused');
    assert.ok(frame('Timer').x < RIGHT.x && frame('Text Banner').x < RIGHT.x, 'Timer and Text Banner start on the left display');

    arrangeItem('Arrange in a Row').click();
    await settle();
    record('Tray → Arrange in a Row');
    // The focused panel's display, not the first panel's (Timer, on the left).
    assertCentred(['Timer', 'Text Banner', 'Traffic Light'], 'x', RIGHT);

    arrangeItem('Free Placement').click();
    await settle();
    record('Tray → Free Placement');
    for (const title of Object.keys(panels)) assert.deepEqual(frame(title), freeform[title], `${title} returns to its free-placement frame`);

    // Closing a panel hides it at once; the host removes it on its next
    // inventory. Holding it hidden reproduces the state in between.
    panels.Timer.hide();
    arrangeItem('Arrange in a Column').click();
    await settle();
    record('Timer hidden as if just closed, then Tray → Arrange in a Column');
    assert.deepEqual(frame('Timer'), freeform.Timer, 'the closing panel is not laid out');
    assertCentred(['Text Banner', 'Traffic Light'], 'y', RIGHT);

    arrangeItem('Free Placement').click();
    await settle();
    record('Tray → Free Placement');
    for (const title of Object.keys(panels)) assert.deepEqual(frame(title), freeform[title], `${title} returns to its free-placement frame`);

    panels['Text Banner'].hide();
    panels['Traffic Light'].hide();
    arrangeItem('Free Placement').click();
    await settle();
    record('Every panel hidden as if just closed, then Tray → Free Placement');
    assert.equal(item('Arrange Widgets').enabled, false, 'Arrange Widgets is disabled with no panel on screen');

    log.push('PASS');
    writeFileSync(join(evidence, 'arrange.txt'), log.join('\n') + '\n');
    process.stdout.write(`PASS — evidence in ${evidence}\n`);
    finish(0);
  } catch (error) {
    log.push(`FAIL: ${error.stack || error.message}`);
    writeFileSync(join(evidence, 'arrange.txt'), log.join('\n') + '\n');
    process.stderr.write(`${error.stack || error.message}\n`);
    finish(1);
  }
});

function finish(code) {
  rmSync(temporary, { recursive: true, force: true });
  app.exit(code);
}
