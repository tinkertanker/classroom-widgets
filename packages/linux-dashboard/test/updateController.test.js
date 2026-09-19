const test = require('node:test');
const assert = require('node:assert/strict');
const { UpdateController } = require('../out/main/updateController.js');

const releasePage = 'https://example.test/releases/v2.0.0';

function releaseResponse(kind = 'deb') {
  const suffix = kind === 'appimage' ? '-linux-x86_64.AppImage' : '-linux-amd64.deb';
  return {
    ok: true,
    status: 200,
    async json() {
      return {
        tag_name: 'v2.0.0',
        html_url: releasePage,
        assets: [{
          name: `ClassroomWidgets-v2.0.0${suffix}`,
          browser_download_url: 'https://example.test/update-package',
          digest: `sha256:${'a'.repeat(64)}`,
        }],
      };
    },
  };
}

function harness({ responses = [], fetch, download, installAppImage, installDeb, useDefaultInstallDeb = false, execFile, openPath } = {}) {
  const dialogs = [];
  const downloads = [];
  const appImageInstalls = [];
  const debInstalls = [];
  const opened = [];
  const execFiles = [];
  const openedPaths = [];
  let relaunches = 0;
  let quits = 0;
  const queue = [...responses];
  const dependencies = {
    isPackaged: () => true,
    fetch: fetch || (async () => releaseResponse(process.env.APPIMAGE ? 'appimage' : 'deb')),
    async showMessageBox(options) {
      dialogs.push(options);
      return { response: queue.shift() ?? 1 };
    },
    async openExternal(url) { opened.push(url); },
    async openPath(path) {
      openedPaths.push(path);
      return openPath ? openPath(path) : '';
    },
    async execFile(file, args) {
      execFiles.push([file, args]);
      if (execFile) return execFile(file, args);
    },
    relaunch() { relaunches += 1; },
    async download(asset) {
      downloads.push(asset);
      if (download) return download(asset);
      return '/tmp/intercepted-update-package';
    },
    async installAppImage(path) {
      appImageInstalls.push(path);
      if (installAppImage) return installAppImage(path);
    },
  };
  if (!useDefaultInstallDeb) {
    dependencies.installDeb = async (path, pageUrl) => {
      debInstalls.push([path, pageUrl]);
      if (installDeb) return installDeb(path, pageUrl);
    };
  }
  const controller = new UpdateController('1.0.0', () => { quits += 1; }, dependencies);
  return {
    controller, dialogs, downloads, appImageInstalls, debInstalls, opened, execFiles, openedPaths,
    get relaunches() { return relaunches; },
    get quits() { return quits; },
  };
}

test('automatic approved download failure is visible and offers Downloads', async () => {
  delete process.env.APPIMAGE;
  const h = harness({
    responses: [0, 0],
    download: async () => { throw new Error('Update download returned 503'); },
  });

  await h.controller.check();

  assert.equal(h.dialogs.length, 2);
  assert.equal(h.dialogs[1].message, 'Unable to install update.');
  assert.match(h.dialogs[1].detail, /Update download returned 503/);
  assert.deepEqual(h.dialogs[1].buttons, ['Open Downloads', 'Cancel']);
  assert.deepEqual(h.opened, [releasePage]);
  assert.deepEqual(h.debInstalls, []);
});

test('manual check failure explains how to retry and checking resets', async () => {
  delete process.env.APPIMAGE;
  let attempts = 0;
  const h = harness({
    fetch: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('network unavailable');
      return releaseResponse();
    },
    responses: [1, 1],
  });

  await h.controller.check(true);
  await h.controller.check(true);

  assert.equal(attempts, 2);
  assert.equal(h.dialogs[0].message, 'Unable to check for updates.');
  assert.match(h.dialogs[0].detail, /connection.*try again/i);
  assert.match(h.dialogs[1].message, /2\.0\.0 is available/);
});

test('automatic check failure before approval stays quiet', async () => {
  delete process.env.APPIMAGE;
  const h = harness({ fetch: async () => { throw new Error('offline'); } });

  await h.controller.check();

  assert.deepEqual(h.dialogs, []);
  assert.deepEqual(h.downloads, []);
});

test('Later does not download or install', async () => {
  delete process.env.APPIMAGE;
  const h = harness({ responses: [1] });

  await h.controller.check();

  assert.equal(h.dialogs.length, 1);
  assert.deepEqual(h.downloads, []);
  assert.deepEqual(h.debInstalls, []);
});

test('approved AppImage staging error identifies the unwritable location and recovery path', async () => {
  const previous = process.env.APPIMAGE;
  process.env.APPIMAGE = '/opt/Classroom Widgets/ClassroomWidgets.AppImage';
  try {
    const h = harness({
      responses: [0, 1],
      installAppImage: async () => {
        throw new Error("EACCES: permission denied, copyfile '/tmp/update' -> '/opt/Classroom Widgets/ClassroomWidgets.AppImage.update-123'");
      },
    });

    await h.controller.check();

    assert.deepEqual(h.appImageInstalls, ['/tmp/intercepted-update-package']);
    assert.equal(h.dialogs[1].message, 'Unable to install update.');
    assert.match(h.dialogs[1].detail, /permission denied/);
    assert.match(h.dialogs[1].detail, /\/opt\/Classroom Widgets\/ClassroomWidgets\.AppImage/);
    assert.match(h.dialogs[1].detail, /writable/i);
    assert.deepEqual(h.dialogs[1].buttons, ['Open Downloads', 'Cancel']);
  } finally {
    if (previous === undefined) delete process.env.APPIMAGE;
    else process.env.APPIMAGE = previous;
  }
});

test('automatic approved deb failure reports package-manager and opener errors', async () => {
  delete process.env.APPIMAGE;
  const h = harness({
    responses: [0, 1],
    useDefaultInstallDeb: true,
    execFile: async () => { throw new Error('pkexec: authorization failed'); },
    openPath: async () => 'No application is registered for .deb files',
  });

  await h.controller.check();

  assert.deepEqual(h.execFiles, [['pkexec', ['apt-get', 'install', '-y', '/tmp/intercepted-update-package']]]);
  assert.deepEqual(h.openedPaths, ['/tmp/intercepted-update-package']);
  assert.equal(h.dialogs[1].message, 'Unable to install update.');
  assert.match(h.dialogs[1].detail, /pkexec: authorization failed/);
  assert.match(h.dialogs[1].detail, /No application is registered for \.deb files/);
  assert.deepEqual(h.dialogs[1].buttons, ['Open Downloads', 'Cancel']);
  assert.equal(h.relaunches, 0);
  assert.equal(h.quits, 0);
});

test('manual approved deb failure preserves a rejected opener error and offers Downloads', async () => {
  delete process.env.APPIMAGE;
  const h = harness({
    responses: [0, 0],
    useDefaultInstallDeb: true,
    execFile: async () => { throw new Error('pkexec exited with status 126'); },
    openPath: async () => { throw new Error('desktop package portal unavailable'); },
  });

  await h.controller.check(true);

  assert.equal(h.dialogs[1].message, 'Unable to install update.');
  assert.match(h.dialogs[1].detail, /pkexec exited with status 126/);
  assert.match(h.dialogs[1].detail, /desktop package portal unavailable/);
  assert.deepEqual(h.opened, [releasePage]);
  assert.equal(h.relaunches, 0);
  assert.equal(h.quits, 0);
});

test('successful native deb install relaunches and quits without opening the package', async () => {
  delete process.env.APPIMAGE;
  const h = harness({
    responses: [0],
    useDefaultInstallDeb: true,
    openPath: async () => assert.fail('must not open the package after a successful native install'),
  });

  await h.controller.check();

  assert.equal(h.dialogs.length, 1);
  assert.deepEqual(h.openedPaths, []);
  assert.equal(h.relaunches, 1);
  assert.equal(h.quits, 1);
});

test('successful desktop package handoff is not reported as an installation failure', async () => {
  delete process.env.APPIMAGE;
  const h = harness({
    responses: [0],
    useDefaultInstallDeb: true,
    execFile: async () => { throw new Error('no graphical PolicyKit agent'); },
    openPath: async () => '',
  });

  await h.controller.check();

  assert.equal(h.dialogs.length, 1);
  assert.deepEqual(h.openedPaths, ['/tmp/intercepted-update-package']);
  assert.equal(h.relaunches, 0);
  assert.equal(h.quits, 0);
});
