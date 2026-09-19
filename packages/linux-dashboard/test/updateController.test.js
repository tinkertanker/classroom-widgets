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

function harness({ responses = [], fetch, download, installAppImage, installDeb } = {}) {
  const dialogs = [];
  const downloads = [];
  const appImageInstalls = [];
  const debInstalls = [];
  const opened = [];
  const queue = [...responses];
  const controller = new UpdateController('1.0.0', () => assert.fail('must not quit in controller tests'), {
    isPackaged: () => true,
    fetch: fetch || (async () => releaseResponse(process.env.APPIMAGE ? 'appimage' : 'deb')),
    async showMessageBox(options) {
      dialogs.push(options);
      return { response: queue.shift() ?? 1 };
    },
    async openExternal(url) { opened.push(url); },
    async download(asset) {
      downloads.push(asset);
      if (download) return download(asset);
      return '/tmp/intercepted-update-package';
    },
    async installAppImage(path) {
      appImageInstalls.push(path);
      if (installAppImage) return installAppImage(path);
    },
    async installDeb(path, pageUrl) {
      debInstalls.push([path, pageUrl]);
      if (installDeb) return installDeb(path, pageUrl);
    },
  });
  return { controller, dialogs, downloads, appImageInstalls, debInstalls, opened };
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
