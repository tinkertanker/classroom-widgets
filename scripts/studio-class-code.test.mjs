import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createClassCode,
  normaliseClassCode,
  parseClassNumber,
  parseMaximumUses,
} from './studio-class-code.mjs';

test('creates four digits followed by four unambiguous uppercase letters', () => {
  const selected = [0, 1, 2, 3];
  assert.equal(createClassCode('1234', () => selected.shift()), '1234ABCD');
});

test('requires an operator-supplied four-digit class number', () => {
  assert.equal(parseClassNumber('0042'), '0042');
  for (const value of ['123', '12345', '12A4', ' 1234 ']) {
    assert.throws(() => parseClassNumber(value));
  }
});

test('requires a fixed activation limit between 1 and 100', () => {
  assert.equal(parseMaximumUses('1'), 1);
  assert.equal(parseMaximumUses('30'), 30);
  assert.equal(parseMaximumUses('100'), 100);
  for (const value of ['0', '101', '-1', '1.5', ' 30 ']) {
    assert.throws(() => parseMaximumUses(value));
  }
});

test('normalises compact and hyphenated class codes to the same value', () => {
  assert.equal(normaliseClassCode('1234abcd'), '1234ABCD');
  assert.equal(normaliseClassCode(' 1234-ABCD '), '1234ABCD');
  for (const value of ['123-ABCD', '12345-ABCD', '1234-ABC1', 'ABCD-1234', '1234--ABCD']) {
    assert.equal(normaliseClassCode(value), null);
  }
});
