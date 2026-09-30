const test = require('node:test');
const assert = require('node:assert/strict');
const { DisplayReconnectPolicy } = require('../out/main/displayReconnect.js');

// Mirrors the pure policy tests on macOS and Windows. Each test is one way
// the hide-on-disconnect / show-on-reconnect behaviour could go wrong.

function autoHidden() {
  const policy = new DisplayReconnectPolicy(true);
  assert.equal(policy.displaysChanged(false, true, true), 'hide');
  policy.windowClosed();
  return policy;
}

test('losing the external display hides an open widget and remembers why', () => {
  const policy = autoHidden();
  assert.equal(policy.hiddenByDisconnect, true);
});

test('the widget comes back once when the display reconnects', () => {
  const policy = autoHidden();
  assert.equal(policy.displaysChanged(true, false, true), 'show');
  policy.windowOpened();
  assert.equal(policy.displaysChanged(true, true, true), 'none');
  assert.equal(policy.hiddenByDisconnect, false);
});

test('with the setting off the widget stays hidden, even after later notices', () => {
  const policy = autoHidden();
  assert.equal(policy.displaysChanged(true, false, false), 'none');
  assert.equal(policy.displaysChanged(true, false, true), 'none');
  assert.equal(policy.hiddenByDisconnect, false);
});

test('a widget the user closed is never brought back', () => {
  const policy = new DisplayReconnectPolicy(true);
  policy.windowOpened();
  policy.windowClosed();
  assert.equal(policy.displaysChanged(false, false, true), 'none');
  assert.equal(policy.displaysChanged(true, false, true), 'none');
});

test('opening then closing while disconnected cancels the pending reconnect', () => {
  const policy = autoHidden();
  policy.windowOpened();
  policy.windowClosed();
  assert.equal(policy.displaysChanged(true, false, true), 'none');
});

test('a widget opened on a single display is not hidden by unrelated notices', () => {
  const policy = new DisplayReconnectPolicy(false);
  policy.windowOpened();
  assert.equal(policy.displaysChanged(false, true, true), 'none');
  assert.equal(policy.displaysChanged(false, true, true), 'none');
});

test('repeated notices while disconnected neither re-hide nor forget the auto-hide', () => {
  const policy = autoHidden();
  assert.equal(policy.displaysChanged(false, false, true), 'none');
  assert.equal(policy.hiddenByDisconnect, true);
  assert.equal(policy.displaysChanged(true, false, true), 'show');
});

test('keeping an external display (three to two) does not hide the widget', () => {
  const policy = new DisplayReconnectPolicy(true);
  assert.equal(policy.displaysChanged(true, true, true), 'none');
});

test('a hide that has not closed yet does not count as the user closing it', () => {
  const policy = new DisplayReconnectPolicy(true);
  assert.equal(policy.displaysChanged(false, true, true), 'hide');
  assert.equal(policy.hiddenByDisconnect, false, 'only a completed close is remembered');
  policy.windowClosed();
  assert.equal(policy.hiddenByDisconnect, true);
});
