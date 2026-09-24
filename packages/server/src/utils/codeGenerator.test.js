const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { generateCode } = require('./codeGenerator');
const { SAFE_CHARACTERS } = require('../config/constants');

describe('generateCode', () => {
  it('generates codes of the requested length from safe characters only', () => {
    for (const length of [1, 5, 20]) {
      const code = generateCode(length);
      assert.equal(code.length, length);
      for (const ch of code) {
        assert.ok(SAFE_CHARACTERS.includes(ch), `unexpected character ${ch}`);
      }
    }
  });

  it('does not use Math.random', (t) => {
    const spy = t.mock.method(Math, 'random');
    for (let i = 0; i < 100; i++) generateCode();
    assert.equal(spy.mock.callCount(), 0);
  });

  it('avoids existing codes', () => {
    // With length 1 there are only SAFE_CHARACTERS.length possibilities;
    // exclude all but one and the generator must find the survivor.
    const survivor = SAFE_CHARACTERS[0];
    const existing = new Set(SAFE_CHARACTERS.split('').filter(c => c !== survivor));

    assert.equal(generateCode(1, existing), survivor);
  });

  it('throws instead of hanging when the code space is exhausted', () => {
    const everything = new Set(SAFE_CHARACTERS.split(''));
    assert.throws(
      () => generateCode(1, everything),
      /maximum attempts/
    );
  });
});
