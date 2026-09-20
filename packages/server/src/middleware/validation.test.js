const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isValidSessionCode } = require('./validation');
const { generateCode } = require('../utils/codeGenerator');
const { SAFE_CHARACTERS, LIMITS } = require('../config/constants');
const shared = require('@classroom-widgets/shared/constants/sessionCode.json');

describe('isValidSessionCode', () => {
  it('shares its alphabet and length with the client-side validator', () => {
    assert.equal(SAFE_CHARACTERS, shared.alphabet);
    assert.equal(LIMITS.ROOM_CODE_LENGTH, shared.length);
  });

  it('accepts every generated code', () => {
    for (let i = 0; i < 200; i++) {
      assert.equal(isValidSessionCode(generateCode()), true);
    }
  });

  it('rejects characters the generator never emits', () => {
    for (const code of ['MMMMMM', 'XXXXXX', 'AAAAA0', 'AAAAAI', 'AAAAAO', 'AAAAAL', 'aaaaaa']) {
      assert.equal(isValidSessionCode(code), false, code);
    }
  });

  it('rejects wrong lengths and non-strings', () => {
    assert.equal(isValidSessionCode('AAAAA'), false);
    assert.equal(isValidSessionCode('AAAAAAA'), false);
    assert.equal(isValidSessionCode(123456), false);
    assert.equal(isValidSessionCode(undefined), false);
  });
});
