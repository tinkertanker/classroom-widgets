const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const CONFIG_PATH = path.resolve(__dirname, 'server.config.js');

function loadTrustProxy(value) {
  delete require.cache[CONFIG_PATH];
  if (value === undefined) delete process.env.TRUST_PROXY;
  else process.env.TRUST_PROXY = value;
  return require(CONFIG_PATH).TRUST_PROXY;
}

describe('TRUST_PROXY parsing', () => {
  const original = process.env.TRUST_PROXY;
  afterEach(() => {
    delete require.cache[CONFIG_PATH];
    if (original === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = original;
    require(CONFIG_PATH);
  });

  it('accepts positive integers', () => {
    assert.equal(loadTrustProxy('1'), 1);
    assert.equal(loadTrustProxy(' 2 '), 2);
  });

  it('defaults to 0 when unset', () => {
    assert.equal(loadTrustProxy(undefined), 0);
  });

  it('rejects malformed values rather than parsing a numeric prefix', () => {
    for (const bad of ['2junk', '1.5', '-1', '0', 'true', '', '1e3', '0x2', 'Infinity']) {
      assert.equal(loadTrustProxy(bad), 0, `TRUST_PROXY=${JSON.stringify(bad)} should be rejected`);
    }
  });
});
