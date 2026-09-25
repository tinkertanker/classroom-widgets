const test = require('node:test');
const assert = require('node:assert/strict');
const { widgetMenuItems } = require('../out/main/widgetMenu.js');

// Ways the shared widget menu section could fail:
// 1. A separator is missing where menuGroup changes, drawn inside a group, or drawn
//    between Display and the first group (Display leads the first group whatever
//    its number).
// 2. It starts or ends with a separator, so callers that add their own get doubles.
// 3. Before the teacher app sends options the menu offers nothing, or a clickable
//    placeholder.
// 4. A shortcut hint is also registered by Electron as a menu accelerator, or a hint
//    is shown for an unassigned shortcut.
// 5. A row launches a different widget type from the one it names.
const layout = (items) => items.map((item) => (item.type === 'separator' ? '---' : item.label));

function build(options, accelerators = {}) {
  const added = [];
  let displays = 0;
  const items = widgetMenuItems(options, {
    openDisplay: () => { displays += 1; },
    addWidget: (type) => added.push(type),
    displayAccelerator: accelerators.display ?? null,
    widgetAccelerator: (type) => accelerators[type] ?? null,
  });
  return { items, added, displays: () => displays };
}

test('groups widgets after Display with one separator per menuGroup change', () => {
  const { items } = build([
    { widgetType: 1, title: 'Timer', menuGroup: 2, emoji: '⏱️' },
    { widgetType: 7, title: 'Text Banner', menuGroup: 2 },
    { widgetType: 4, title: 'Traffic Light', menuGroup: 3, emoji: '🚦' },
    { widgetType: 9, title: 'Sound Effects', menuGroup: 5, emoji: '🔊' },
    { widgetType: 6, title: 'Link Shortener', menuGroup: 5 },
  ]);
  assert.deepEqual(layout(items), [
    '🖥️  Display', '⏱️  Timer', 'Text Banner',
    '---', '🚦  Traffic Light',
    '---', '🔊  Sound Effects', 'Link Shortener',
  ]);
});

test('shows a disabled loading row after Display until options arrive', () => {
  const { items } = build([]);
  assert.deepEqual(layout(items), ['🖥️  Display', 'Loading widgets…']);
  assert.equal(items[1].enabled, false);
  assert.equal(items[1].click, undefined);
});

test('rows launch their own widget and show only assigned shortcuts as hints', () => {
  const h = build([
    { widgetType: 1, title: 'Timer', menuGroup: 0 },
    { widgetType: 7, title: 'Text Banner', menuGroup: 0 },
  ], { display: 'Ctrl+Alt+Shift+0', 7: 'Ctrl+Alt+Shift+2' });
  const [display, timer, banner] = h.items;
  assert.equal(display.accelerator, 'Ctrl+Alt+Shift+0');
  assert.equal(timer.accelerator, undefined);
  assert.equal(banner.accelerator, 'Ctrl+Alt+Shift+2');
  for (const item of [display, banner]) assert.equal(item.registerAccelerator, false);
  banner.click();
  timer.click();
  display.click();
  assert.deepEqual(h.added, [7, 1]);
  assert.equal(h.displays(), 1);
});
