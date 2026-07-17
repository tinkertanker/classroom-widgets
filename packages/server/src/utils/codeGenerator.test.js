const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { generateCode, generateSessionCode } = require('./codeGenerator');
const { SAFE_CHARACTERS, LIMITS } = require('../config/constants');

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

  it('defaults to the configured room code length', () => {
    assert.equal(generateCode().length, LIMITS.ROOM_CODE_LENGTH);
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

describe('generateSessionCode', () => {
  it('derives the exclusion set from existing session keys', () => {
    const sessions = new Map([['AAAAA', {}], ['BBBBB', {}]]);
    const code = generateSessionCode(sessions);
    assert.equal(code.length, LIMITS.ROOM_CODE_LENGTH);
    assert.ok(!sessions.has(code));
  });
});
