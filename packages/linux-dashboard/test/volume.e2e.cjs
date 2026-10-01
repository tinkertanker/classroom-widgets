// Run after the teacher and Linux builds:
// CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR=/path/to/evidence xvfb-run -a \
//   node_modules/.bin/electron --no-sandbox --force-device-scale-factor=2 test/volume.e2e.cjs
// Requires xdotool for real native-menu keyboard input and ImageMagick for its capture.
const { app, BrowserWindow, Menu, globalShortcut, screen, desktopCapturer } = require('electron');
const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const packageDir = resolve(__dirname, '..');
const evidenceDir = process.env.CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR;
assert.ok(evidenceDir, 'Set CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR to retain screenshots and the check log');
mkdirSync(evidenceDir, { recursive: true });
const userData = mkdtempSync(join(tmpdir(), 'classroom-volume-'));
app.setAppPath(packageDir);
app.setPath('userData', userData);
app.setPath('sessionData', userData);
process.env.XDG_CONFIG_HOME = userData;
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const { registerPrivilegedScheme, installProtocolHandler } = require('../out/main/appProtocol');
const { DashboardSettings } = require('../out/main/settings');
const { WidgetHostController } = require('../out/main/hostController');
const { WidgetShortcutController } = require('../out/main/widgetShortcuts');
const { DisplayCatalog } = require('../out/main/displayCatalog');
const { DisplayPreviewCoordinator } = require('../out/main/displayPreview');
const { openSettingsWindow } = require('../out/main/settingsWindow');
registerPrivilegedScheme();

const checks = [];
const expected = [['Mute', 0], ['Level 1', 0.1], ['Level 2', 0.25], ['Level 3', 0.5], ['Level 4', 1]];
const measuredPeaks = new Map();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, description) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const result = await check();
    if (result) return result;
    await delay(50);
  }
  throw new Error(`Timed out: ${description}`);
}
function record(description, observed) {
  checks.push({ description, observed });
  console.log(`PASS ${description}: ${JSON.stringify(observed)}`);
}
async function capture(win, name) {
  await win.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  writeFileSync(join(evidenceDir, name), (await win.webContents.capturePage()).toPNG());
}

let host, shortcuts, display;
let activeRecorder;
let lastMenu;
const buildMenu = Menu.buildFromTemplate;
Menu.buildFromTemplate = function (...args) {
  lastMenu = buildMenu.apply(this, args);
  return lastMenu;
};

const watchdog = setTimeout(() => finish(new Error('Run timeout')), 90000);

app.whenReady().then(async () => {
  installProtocolHandler();
  const settings = new DashboardSettings();
  settings.outputVolume = 0.75;
  settings.save();
  host = new WidgetHostController(settings, 'volume-e2e');
  display = new DisplayPreviewCoordinator(settings, new DisplayCatalog(screen), { desktopCapturer, screen });
  shortcuts = new WidgetShortcutController(settings, globalShortcut,
    type => host.showWidget(type), type => host.dismissWidget(type), type => host.toggleWidget(type), display);
  host.on('widgetOptionsChanged', () => shortcuts.updateOptions(host.widgetOptions));
  settings.on('changed', () => host.applySettings());
  await host.start();
  await until(() => host.widgetOptions.length > 0, 'host widget inventory');
  const soundType = host.widgetOptions.find(option => option.title === 'Sound Effects').widgetType;
  await host.addWidget(soundType);
  await host.addWidget(soundType);
  const panelWindows = await until(() => {
    const windows = BrowserWindow.getAllWindows().filter(win => win.webContents.getURL().endsWith('panel-chrome.html'));
    return windows.length === 2 && windows;
  }, 'two floating panels');
  const soundViews = panelWindows.map(win => win.contentView.children[0].webContents);
  for (const view of soundViews) {
    await until(() => view.executeJavaScript("!!document.getElementById('sound-Victory')"), 'sound buttons');
    await view.executeJavaScript(`
      window.playedAudio = [];
      const originalPlay = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function (...args) {
        window.playedAudio.push(this);
        window.lastPlayback = originalPlay.apply(this, args);
        return window.lastPlayback;
      };
      void 0;
    `);
  }
  openSettingsWindow(settings, shortcuts, 'volume-e2e');
  const settingsWindow = await until(() => BrowserWindow.getAllWindows().find(win => win.webContents.getURL().endsWith('settings.html')), 'settings window');
  const settingsView = settingsWindow.webContents;
  await until(() => settingsView.executeJavaScript("document.getElementById('volume')?.options.length === 6"), 'volume options');
  const choice = () => settingsView.executeJavaScript(`(() => {
    const select = document.getElementById('volume');
    return { label: select.selectedOptions[0].textContent, value: Number(select.value) };
  })()`);
  assert.deepEqual(await choice(), { label: 'Custom', value: 0.75 });
  assert.equal(DashboardSettings.load().outputVolume, 0.75);
  record('opening Settings preserves a legacy value as Custom', await choice());
  await capture(settingsWindow, 'volume-custom.png');
  const options = await settingsView.executeJavaScript(`Array.from(document.getElementById('volume').options)
    .filter(option => !option.disabled).map(option => [option.textContent, Number(option.value)])`);
  assert.deepEqual(options, expected);

  async function verifyAudio(label, gain) {
    for (const [index, view] of soundViews.entries()) {
      await until(() => view.executeJavaScript(`window.__CLASSROOM_WIDGETS_AUDIO_VOLUME__ === ${gain}`), 'live native audio setting');
      let recorder, recording, recorded;
      if (index === 0 && process.env.CLASSROOM_WIDGETS_TEST_AUDIO_MONITOR && !measuredPeaks.has(gain)) {
        recorded = [];
        recorder = spawn('parec', ['--device=' + process.env.CLASSROOM_WIDGETS_TEST_AUDIO_MONITOR,
          '--format=s16le', '--rate=48000', '--channels=2', '--latency-msec=20', '--process-time-msec=20', '--raw']);
        activeRecorder = recorder;
        recorder.stdout.on('data', chunk => recorded.push(chunk));
        recording = new Promise((resolve, reject) => {
          recorder.on('error', reject);
          recorder.on('close', code => code === 0 || code === null ? resolve() : reject(new Error(`parec exited ${code}`)));
        });
        await until(() => recorded.length > 0, 'PulseAudio monitor connected');
      }
      await view.executeJavaScript("document.getElementById('sound-Victory').click()");
      const observed = await view.executeJavaScript(`(async () => {
        await window.lastPlayback;
        const audio = window.playedAudio.at(-1);
        return { volume: audio.volume, playing: !audio.paused, readyState: audio.readyState };
      })()`);
      assert.equal(observed.volume, gain);
      assert.equal(observed.playing, true);
      assert.ok(observed.readyState >= 2);
      record(`${label} applies to actual playback in panel ${index + 1}`, observed);
      if (recorder) {
        await delay(1800);
        recorder.kill('SIGTERM');
        await recording;
        activeRecorder = undefined;
        const samples = Buffer.concat(recorded);
        assert.ok(samples.length > 48000, 'PulseAudio captured PCM samples');
        let peak = 0;
        for (let offset = 0; offset + 1 < samples.length; offset += 2) peak = Math.max(peak, Math.abs(samples.readInt16LE(offset)));
        measuredPeaks.set(gain, peak);
        record(`${label} digital output peak`, peak);
      }
      await view.executeJavaScript('window.playedAudio.at(-1).pause()');
    }
    assert.equal(DashboardSettings.load().outputVolume, gain);
    assert.deepEqual(await choice(), { label, value: gain });
    for (const win of panelWindows) {
      const name = await win.webContents.executeJavaScript("document.getElementById('volume').getAttribute('aria-label')");
      assert.equal(name, `Output volume: ${label}`);
    }
  }
  for (const [label, gain] of expected) {
    await settingsView.executeJavaScript(`
      document.getElementById('volume').value = '${gain}';
      document.getElementById('volume').dispatchEvent(new Event('change', { bubbles: true }));
    `);
    await until(() => settings.outputVolume === gain, 'Settings IPC commit');
    await verifyAudio(label, gain);
    if (gain === 0 || gain === 0.1) await capture(settingsWindow, gain === 0 ? 'volume-muted.png' : 'volume-level-1.png');
  }
  for (const [index, [label, gain]] of expected.entries()) {
    const panel = panelWindows[0];
    panel.show();
    panel.focus();
    lastMenu = undefined;
    await panel.webContents.executeJavaScript("document.getElementById('volume').click()");
    await until(() => lastMenu, 'native volume menu');
    assert.deepEqual(lastMenu.items.filter(item => item.type === 'checkbox').map(item => item.label), expected.map(([name]) => name));
    const checked = lastMenu.items.filter(item => item.checked).map(item => item.label);
    assert.deepEqual(checked, [await choice().then(value => value.label)]);
    await delay(150);
    if (index === 1) execFileSync('import', ['-window', 'root', join(evidenceDir, 'volume-menu.png')]);
    // Start at Level 4 and navigate upward to the desired choice in the real native menu.
    execFileSync('xdotool', ['key', '--clearmodifiers', 'End', ...Array(4 - index).fill('Up'), 'Return']);
    await until(() => settings.outputVolume === gain, `native menu selection ${label}`);
    await verifyAudio(label, gain);
    record('native menu selection synchronizes Settings and persists', { label, gain });
  }
  if (measuredPeaks.size) {
    const full = measuredPeaks.get(1);
    assert.ok(full > 1000, 'full-volume playback produced non-silent PCM');
    assert.equal(measuredPeaks.get(0), 0, 'Mute produces silent PCM');
    for (const [label, gain] of expected) {
      const ratio = measuredPeaks.get(gain) / full;
      assert.ok(Math.abs(ratio - gain) < 0.02, `${label} measured output ratio ${ratio} should match ${gain}`);
      record(`${label} measured digital gain relative to Level 4`, ratio);
    }
  }
  record('all five Settings and native-menu choices verified', expected);
}).then(() => finish(null), error => finish(error));

async function finish(error) {
  clearTimeout(watchdog);
  activeRecorder?.kill('SIGTERM');
  if (error) console.error(error);
  writeFileSync(join(evidenceDir, 'volume-e2e.json'), JSON.stringify({
    passed: !error, error: error?.stack, electron: process.versions.electron, checks,
  }, null, 2));
  shortcuts?.unregisterAll();
  display?.shutdown();
  host?.markShuttingDown();
  host?.panelCoordinator.deactivate();
  for (const win of BrowserWindow.getAllWindows()) win.destroy();
  rmSync(userData, { recursive: true, force: true });
  app.exit(error ? 1 : 0);
}
