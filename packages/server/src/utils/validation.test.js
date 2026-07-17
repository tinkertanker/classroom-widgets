const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validators, validate } = require('./validation');
const { LIMITS } = require('../config/constants');

describe('validators.sessionCode', () => {
  it('accepts 4-6 char alphanumeric codes (case-insensitive)', () => {
    for (const code of ['ABCD', 'ABC12', 'ABCDE9', 'abcde', '2345']) {
      assert.equal(validators.sessionCode(code).valid, true, code);
    }
  });

  it('rejects missing and non-string values', () => {
    for (const code of [undefined, null, '', 12345, {}, [], true]) {
      assert.equal(validators.sessionCode(code).valid, false, String(code));
    }
  });

  it('rejects wrong lengths and injection-style codes', () => {
    for (const code of ['ABC', 'ABCDEFG', 'AB CD', 'ABC\n1', 'AB-12', '../..', 'ABCD ', ' ABCD']) {
      assert.equal(validators.sessionCode(code).valid, false, JSON.stringify(code));
    }
  });
});

describe('validators.widgetId', () => {
  it('accepts normal ids up to 100 chars', () => {
    assert.equal(validators.widgetId('w').valid, true);
    assert.equal(validators.widgetId('a'.repeat(100)).valid, true);
  });

  it('rejects missing, non-string, and over-long ids', () => {
    assert.equal(validators.widgetId('').valid, false);
    assert.equal(validators.widgetId(null).valid, false);
    assert.equal(validators.widgetId(42).valid, false);
    assert.equal(validators.widgetId('a'.repeat(101)).valid, false);
  });
});

describe('validators.link', () => {
  it('accepts valid URLs up to the length limit', () => {
    assert.equal(validators.link('https://example.com').valid, true);
    const longPath = 'https://example.com/' + 'a'.repeat(LIMITS.MAX_LINK_LENGTH - 21);
    assert.equal(longPath.length, LIMITS.MAX_LINK_LENGTH - 1);
    assert.equal(validators.link(longPath).valid, true);
  });

  it('rejects over-long, missing, and malformed URLs', () => {
    assert.equal(validators.link('https://example.com/' + 'a'.repeat(LIMITS.MAX_LINK_LENGTH)).valid, false);
    assert.equal(validators.link(undefined).valid, false);
    assert.equal(validators.link('not a url').valid, false);
    assert.equal(validators.link('http//missing-colon.com').valid, false);
  });
});

describe('validators.normalizeUrl', () => {
  it('adds https:// to bare domains', () => {
    assert.equal(validators.normalizeUrl('example.com'), 'https://example.com');
    assert.equal(validators.normalizeUrl('sub.domain.co.uk/path?q=1'), 'https://sub.domain.co.uk/path?q=1');
  });

  it('leaves URLs with a protocol unchanged (besides trimming)', () => {
    assert.equal(validators.normalizeUrl('https://example.com'), 'https://example.com');
    assert.equal(validators.normalizeUrl('  http://example.com  '), 'http://example.com');
  });

  it('does not turn bare filenames into URLs', () => {
    for (const name of ['notes.txt', 'report.pdf', 'image.png', 'archive.tar.gz', 'script.js']) {
      assert.equal(validators.normalizeUrl(name), name);
    }
  });

  it('still normalizes domains whose path contains a file extension', () => {
    assert.equal(validators.normalizeUrl('domain.com/file.txt'), 'https://domain.com/file.txt');
  });

  it('leaves plain text, spaces, and non-strings untouched', () => {
    assert.equal(validators.normalizeUrl('hello world.com'), 'hello world.com');
    assert.equal(validators.normalizeUrl('no-dot'), 'no-dot');
    assert.equal(validators.normalizeUrl(''), '');
    assert.equal(validators.normalizeUrl(null), null);
    assert.equal(validators.normalizeUrl(undefined), undefined);
    assert.equal(validators.normalizeUrl(42), 42);
  });

  it('ignores over-long inputs to avoid pathological URL parsing', () => {
    const huge = 'a'.repeat(2001) + '.com';
    assert.equal(validators.normalizeUrl(huge), huge);
  });
});

describe('validators.isLink', () => {
  it('recognizes URLs with and without protocol', () => {
    assert.equal(validators.isLink('https://example.com'), true);
    assert.equal(validators.isLink('example.com'), true);
  });

  it('rejects plain text and non-strings', () => {
    assert.equal(validators.isLink('just some text'), false);
    assert.equal(validators.isLink(''), false);
    assert.equal(validators.isLink(null), false);
    assert.equal(validators.isLink(12), false);
  });
});

describe('validators.textSubmission', () => {
  it('enforces the 280 character boundary after trimming', () => {
    assert.equal(validators.textSubmission('a'.repeat(280)).valid, true);
    assert.equal(validators.textSubmission('a'.repeat(281)).valid, false);
    assert.equal(validators.textSubmission('  ' + 'a'.repeat(280) + '  ').valid, true);
  });

  it('rejects empty and whitespace-only submissions', () => {
    assert.equal(validators.textSubmission('').valid, false);
    assert.equal(validators.textSubmission('   \n\t ').valid, false);
    assert.equal(validators.textSubmission(null).valid, false);
  });
});

describe('validators.question', () => {
  it('enforces the max question length boundary', () => {
    assert.equal(validators.question('a'.repeat(LIMITS.MAX_QUESTION_LENGTH)).valid, true);
    assert.equal(validators.question('a'.repeat(LIMITS.MAX_QUESTION_LENGTH + 1)).valid, false);
  });

  it('rejects empty/whitespace-only questions and non-strings', () => {
    assert.equal(validators.question('  ').valid, false);
    assert.equal(validators.question(undefined).valid, false);
    assert.equal(validators.question(['x']).valid, false);
  });
});

describe('validators.feedbackValue', () => {
  it('accepts the boundaries and decimals in between', () => {
    for (const v of [1, 1.5, 3, 4.99, 5]) {
      assert.equal(validators.feedbackValue(v).valid, true, String(v));
    }
  });

  it('rejects out-of-range, NaN, Infinity, and non-numbers', () => {
    for (const v of [0, 0.999, 5.001, -1, NaN, Infinity, -Infinity, '3', null, undefined, {}]) {
      assert.equal(validators.feedbackValue(v).valid, false, String(v));
    }
  });
});

describe('validators.studentName', () => {
  it('enforces the max length boundary after trimming', () => {
    assert.equal(validators.studentName('a'.repeat(LIMITS.MAX_STUDENT_NAME_LENGTH)).valid, true);
    assert.equal(validators.studentName('a'.repeat(LIMITS.MAX_STUDENT_NAME_LENGTH + 1)).valid, false);
  });

  it('rejects empty and non-string names', () => {
    assert.equal(validators.studentName('   ').valid, false);
    assert.equal(validators.studentName(null).valid, false);
    assert.equal(validators.studentName(7).valid, false);
  });
});

describe('validators.pollOption', () => {
  it('accepts in-range integer indices', () => {
    assert.equal(validators.pollOption(0, 4).valid, true);
    assert.equal(validators.pollOption(3, 4).valid, true);
  });

  it('rejects boundary violations and non-integers', () => {
    assert.equal(validators.pollOption(-1, 4).valid, false);
    assert.equal(validators.pollOption(4, 4).valid, false);
    assert.equal(validators.pollOption(1.5, 4).valid, false);
    assert.equal(validators.pollOption(NaN, 4).valid, false);
    assert.equal(validators.pollOption(Infinity, 4).valid, false);
    assert.equal(validators.pollOption(null, 4).valid, false);
    assert.equal(validators.pollOption(undefined, 4).valid, false);
  });

  it('rejects prototype-polluting string indices', () => {
    for (const idx of ['constructor', '__proto__', 'toString', '0']) {
      assert.equal(validators.pollOption(idx, 4).valid, false, idx);
    }
  });

  it('rejects every index when the poll has no options', () => {
    assert.equal(validators.pollOption(0, 0).valid, false);
  });
});

describe('validators.requestStateData', () => {
  it('validates sessionCode and widgetId together', () => {
    assert.equal(validators.requestStateData({ sessionCode: 'ABCDE', widgetId: 'w-1' }).valid, true);
    assert.equal(validators.requestStateData({ sessionCode: 'bad code', widgetId: 'w-1' }).valid, false);
    assert.equal(validators.requestStateData({ sessionCode: 'ABCDE', widgetId: '' }).valid, false);
  });

  it('rejects null and non-object data', () => {
    for (const data of [null, undefined, 'string', 42]) {
      assert.equal(validators.requestStateData(data).valid, false, String(data));
    }
  });
});

describe('validate()', () => {
  it('dispatches to the named validator', () => {
    assert.equal(validate('sessionCode', 'ABCDE').valid, true);
    assert.equal(validate('pollOption', 2, 4).valid, true);
  });

  it('fails closed for unknown validator names', () => {
    const result = validate('nope', 'x');
    assert.equal(result.valid, false);
    assert.match(result.error, /Unknown validator/);
  });
});
