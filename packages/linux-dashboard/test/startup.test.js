const test = require('node:test');
const assert = require('node:assert/strict');
const { isBackgroundLaunch, migrateAutostartDesktopEntry } = require('../out/main/startup.js');

test('background launch arguments suppress the launcher', () => {
  assert.equal(isBackgroundLaunch(['/opt/classroom-widgets']), false);
  assert.equal(isBackgroundLaunch(['/opt/classroom-widgets', '--background']), true);
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
