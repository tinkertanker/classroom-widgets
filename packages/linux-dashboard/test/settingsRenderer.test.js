const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { setImmediate: settle } = require('node:timers/promises');
const { runInNewContext } = require('node:vm');

function shortcut(widgetType, title, accelerator = 'Ctrl+Alt+K') {
  return {
    widgetType, title, accelerator, dismissAccelerator: accelerator,
    state: 'inactive', dismissState: 'inactive',
    detail: 'Paused while recording', dismissDetail: 'Paused while recording',
  };
}

async function renderer(shortcuts = [], display = shortcut('display', 'Display')) {
  const document = { activeElement: null };
  // Model the relevant DOM distinction: detaching a focused descendant blurs it,
  // while moveBefore preserves focus. Real Chromium/native checks cover the DOM.
  function element() {
    const listeners = new Map();
    const node = {
      children: [], parentNode: null, className: '', textContent: '', attributes: {},
      addEventListener: (name, callback) => listeners.set(name, callback),
      dispatch: (name, event) => listeners.get(name)?.(event),
      setAttribute(name, value) { this.attributes[name] = value; },
      contains(target) { return this === target || this.children.some(child => child.contains(target)); },
      focus() {
        if (document.activeElement === this) return;
        document.activeElement?.dispatch('blur');
        document.activeElement = this;
      },
      remove() {
        if (this.contains(document.activeElement)) {
          document.activeElement.dispatch('blur');
          document.activeElement = null;
        }
        if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1);
        this.parentNode = null;
      },
      appendChild(child) { child.remove(); this.children.push(child); child.parentNode = this; },
      append(...children) { children.forEach(child => this.appendChild(child)); },
      replaceChildren() { [...this.children].forEach(child => child.remove()); },
      moveBefore(child, reference) {
        assert.equal(child.parentNode, this, 'rows must already be attached before a state-preserving move');
        this.children.splice(this.children.indexOf(child), 1);
        const index = reference === null ? this.children.length : this.children.indexOf(reference);
        assert.ok(index >= 0);
        this.children.splice(index, 0, child);
      },
    };
    node.classList = {
      contains: name => node.className.split(' ').includes(name),
      add: name => { if (!node.classList.contains(name)) node.className += ' ' + name; },
      remove: name => { node.className = node.className.split(' ').filter(value => value !== name).join(' '); },
    };
    return node;
  }
  const elements = {};
  document.getElementById = id => elements[id] || (elements[id] = element());
  document.createElement = element;
  let changed;
  const capturing = [], assignments = [];
  const api = {
    get: async () => ({ shortcuts, displayShortcut: display, linkShortener: {} }),
    onShortcutsChanged: callback => { changed = callback; },
    setCapturing: active => capturing.push(active),
    setDisplayShortcut: async (...args) => { assignments.push(['display', ...args]); return { ok: true }; },
    setShortcut: async (...args) => { assignments.push(args); return { ok: true }; },
  };
  runInNewContext(readFileSync(join(__dirname, '../src/renderer/settings.js'), 'utf8'), {
    document, window: { classroomSettings: api }, setTimeout, clearTimeout,
  });
  await settle();
  function field(title, action) {
    const row = elements.shortcuts.children.find(row => row.children[0]?.textContent === title);
    return row?.children[action === 'show' ? 1 : 2];
  }
  return {
    document, elements, capturing, assignments, field,
    render: (next, nextDisplay = display) => changed(next, nextDisplay),
    begin(title, action) {
      const button = field(title, action).children[0];
      button.focus();
      button.dispatch('click');
      return button;
    },
  };
}

function key(button, key, modifiers = {}) {
  button.dispatch('keydown', {
    key, code: key.length === 1 ? 'Key' + key.toUpperCase() : key,
    preventDefault() {}, stopPropagation() {}, ...modifiers,
  });
}

for (const action of ['show', 'dismiss']) {
  test(`inventory arriving during Display ${action} recording preserves the button, focus and pause`, async () => {
    const h = await renderer();
    const button = h.begin('Display', action);
    h.render([shortcut(1, 'Timer', 'Ctrl+Alt+Shift+2')], shortcut('display', 'Display', 'Ctrl+Alt+Shift+0'));
    assert.deepEqual(h.capturing, [true], 'inventory must not send capturing=false');
    assert.equal(h.field('Display', action).children[0], button);
    assert.equal(h.document.activeElement, button);
    assert.equal(button.textContent, 'Press shortcut…');
    assert.equal(button.attributes['aria-label'], `${action} shortcut for Display: Ctrl+Alt+Shift+0`);
    assert.equal(h.field('Display', action).children[2].textContent, 'Paused while recording');
    assert.deepEqual(h.elements.shortcuts.children.map(row => row.children[0].textContent), ['Display', 'Timer']);
    key(button, 'E', { ctrlKey: true, altKey: true });
    await settle();
    assert.deepEqual(h.assignments, [['display', action, 'Ctrl+Alt+E']]);
    assert.deepEqual(h.capturing, [true, false]);
  });
}

test('adding, reordering and removing other rows preserves widget recording and live values', async () => {
  const timer = shortcut(1, 'Timer', 'Ctrl+Alt+T');
  const list = shortcut(2, 'List', 'Ctrl+Alt+L');
  const h = await renderer([timer, list]);
  const button = h.begin('Timer', 'dismiss');
  for (const inventory of [[list, timer], [shortcut(3, 'Text'), list, timer], [timer]]) {
    h.render(inventory);
    assert.deepEqual(h.capturing, [true]);
    assert.equal(h.document.activeElement, button);
    assert.equal(h.field('Timer', 'dismiss').children[0], button);
    assert.deepEqual(h.elements.shortcuts.children.map(row => row.children[0].textContent), ['Display', ...inventory.map(row => row.title)]);
  }
  h.render([{ ...timer, title: 'Timer renamed', dismissAccelerator: null }]);
  assert.equal(h.field('Timer renamed', 'dismiss').children[0], button);
  assert.equal(button.textContent, 'Press shortcut…');
  assert.equal(h.field('Timer renamed', 'dismiss').children[1].disabled, true);
  key(button, 'Escape');
  assert.deepEqual(h.capturing, [true, false]);
  assert.equal(button.textContent, 'Set shortcut');
  assert.deepEqual(h.assignments, []);
});

for (const end of ['Escape', 'Tab', 'blur']) {
  test(`${end} after inventory still ends Display recording`, async () => {
    const h = await renderer();
    const button = h.begin('Display', 'dismiss');
    h.render([shortcut(1, 'Timer')]);
    assert.deepEqual(h.capturing, [true]);
    if (end === 'blur') h.elements.resetShortcuts.focus();
    else key(button, end);
    assert.deepEqual(h.capturing, [true, false]);
    assert.equal(button.classList.contains('capturing'), false);
    assert.deepEqual(h.assignments, []);
  });
}

test('removing the recorded widget ends recording rather than leaving shortcuts paused', async () => {
  const h = await renderer([shortcut(1, 'Timer'), shortcut(2, 'List')]);
  const button = h.begin('Timer', 'show');
  h.render([shortcut(2, 'List')]);
  assert.deepEqual(h.capturing, [true, false]);
  assert.equal(button.classList.contains('capturing'), false);
  assert.equal(h.field('Timer', 'show'), undefined);
  assert.deepEqual(h.elements.shortcuts.children.map(row => row.children[0].textContent), ['Display', 'List']);
});

test('empty inventory renders loading and recovers without leaving stale rows', async () => {
  const h = await renderer([shortcut(1, 'Timer')], null);
  h.begin('Timer', 'dismiss');
  h.render([], null);
  assert.deepEqual(h.capturing, [true, false]);
  assert.equal(h.elements.resetShortcuts.disabled, true);
  assert.equal(h.elements.shortcuts.children[0].textContent, 'Loading widgets…');
  h.render([shortcut(2, 'List')], null);
  assert.equal(h.elements.resetShortcuts.disabled, false);
  assert.deepEqual(h.elements.shortcuts.children.map(row => row.children[0].textContent), ['List']);
});
