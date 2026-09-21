const test = require('node:test');
const assert = require('node:assert/strict');
const {
  appImageUpdateRelaunchDelay,
  hasExplicitOzonePlatform,
  isBackgroundLaunch,
  migrateAutostartDesktopEntry,
  relaunchExecutable,
  shouldForceX11,
  usesX11OzonePlatform,
  x11RelaunchArguments,
} = require('../out/main/startup.js');

test('background launch arguments suppress the launcher', () => {
  assert.equal(isBackgroundLaunch(['/opt/classroom-widgets']), false);
  assert.equal(isBackgroundLaunch(['/opt/classroom-widgets', '--background']), true);
});

test('Wayland sessions use XWayland when Electron has no explicit backend', () => {
  assert.equal(shouldForceX11('linux', { XDG_SESSION_TYPE: 'wayland', DISPLAY: ':0' }, false), true);
  assert.equal(shouldForceX11('linux', { WAYLAND_DISPLAY: 'wayland-0', DISPLAY: ':0' }, false), true);
});

test('only an explicit ozone-platform argument overrides the launch policy', () => {
  assert.equal(hasExplicitOzonePlatform(['/opt/classroom-widgets', '--background']), false);
  assert.equal(hasExplicitOzonePlatform(['/opt/classroom-widgets', '--ozone-platform=x11']), true);
  assert.equal(hasExplicitOzonePlatform(['/opt/classroom-widgets', '-ozone-platform=wayland']), true);
  assert.equal(hasExplicitOzonePlatform(['/opt/classroom-widgets', '--OZONE-PLATFORM=wayland']), false);
  assert.equal(hasExplicitOzonePlatform(['/opt/classroom-widgets', '--', '--ozone-platform=wayland']), false);
});

test('effective X11 detection follows Chromium equals and last-switch semantics', () => {
  assert.equal(usesX11OzonePlatform(['/opt/classroom-widgets', '--ozone-platform=x11']), true);
  assert.equal(usesX11OzonePlatform(['/opt/classroom-widgets', '-ozone-platform=x11']), true);
  assert.equal(usesX11OzonePlatform(['/opt/classroom-widgets', '--ozone-platform', 'x11']), false);
  assert.equal(usesX11OzonePlatform(['/opt/classroom-widgets', '--OZONE-PLATFORM=x11']), false);
  assert.equal(usesX11OzonePlatform(['/opt/classroom-widgets', '--ozone-platform=x11', '--ozone-platform=wayland']), false);
  assert.equal(usesX11OzonePlatform(['/opt/classroom-widgets', '--ozone-platform=wayland', '-ozone-platform=x11']), true);
  assert.equal(usesX11OzonePlatform(['/opt/classroom-widgets', '--', '--ozone-platform=x11']), false);
});

test('Wayland relaunch preserves application arguments and adds the X11 process flag', () => {
  const arguments_ = ['/opt/classroom-widgets', '--background', '--disable-gpu'];
  assert.deepEqual(
    x11RelaunchArguments('linux', { XDG_SESSION_TYPE: 'wayland' }, arguments_),
    ['--background', '--disable-gpu', '--ozone-platform=x11'],
  );
  assert.equal(
    x11RelaunchArguments('linux', { XDG_SESSION_TYPE: 'wayland' }, [...arguments_, '--ozone-platform=wayland']),
    null,
  );
});

test('Wayland relaunch inserts X11 before the Chromium argument terminator', () => {
  const first = x11RelaunchArguments(
    'linux',
    { XDG_SESSION_TYPE: 'wayland' },
    ['/opt/classroom-widgets', '/repo/app', '--', '--background'],
  );
  assert.deepEqual(first, ['/repo/app', '--ozone-platform=x11', '--', '--background']);
  assert.equal(
    x11RelaunchArguments('linux', { XDG_SESSION_TYPE: 'wayland' }, ['/opt/classroom-widgets', ...first]),
    null,
  );
});

test('Wayland relaunch uses the stable AppImage path when packaged', () => {
  assert.equal(relaunchExecutable({ APPIMAGE: '/apps/ClassroomWidgets.AppImage' }, '/tmp/.mount/app'), '/apps/ClassroomWidgets.AppImage');
  assert.equal(relaunchExecutable({}, '/opt/Classroom Widgets/classroom-widgets'), '/opt/Classroom Widgets/classroom-widgets');
});

test('an AppImage update backup keeps the relaunch trampoline alive past the updater health check', () => {
  const environment = { APPIMAGE: '/apps/ClassroomWidgets.AppImage' };
  assert.ok(appImageUpdateRelaunchDelay(environment, ['ClassroomWidgets.AppImage.previous-token']) > 2000);
  assert.equal(appImageUpdateRelaunchDelay(environment, ['ClassroomWidgets.AppImage']), 0);
  assert.equal(appImageUpdateRelaunchDelay({}, ['ClassroomWidgets.AppImage.previous-token']), 0);
});

test('display backend policy preserves X11, other platforms, and explicit Electron flags', () => {
  assert.equal(shouldForceX11('linux', { XDG_SESSION_TYPE: 'x11' }, false), false);
  assert.equal(shouldForceX11('linux', { XDG_SESSION_TYPE: 'x11', WAYLAND_DISPLAY: 'wayland-0' }, false), false);
  assert.equal(shouldForceX11('darwin', { XDG_SESSION_TYPE: 'wayland' }, false), false);
  assert.equal(shouldForceX11('linux', { XDG_SESSION_TYPE: 'wayland' }, true), false);
});

test('autostart migration changes only Exec in the Desktop Entry section', () => {
  const legacy = [
    '[Desktop Entry]',
    'Type=Application',
    'Exec="/custom/Classroom Widgets" --existing-flag',
    'Hidden=true',
    'X-GNOME-Autostart-enabled=false',
    'X-Custom=value',
    '',
    '[Desktop Action Add]',
    'Exec="/custom/Classroom Widgets" --add',
    '',
  ].join('\r\n');

  assert.equal(migrateAutostartDesktopEntry(legacy), legacy.replace(
    'Exec="/custom/Classroom Widgets" --existing-flag',
    'Exec="/custom/Classroom Widgets" --existing-flag --background',
  ));
});

test('autostart migration is idempotent', () => {
  const current = '[Desktop Entry]\nExec="/opt/Classroom Widgets" --background\nHidden=false\n';
  assert.equal(migrateAutostartDesktopEntry(current), current);
});
