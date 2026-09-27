import { describe, it, expect } from 'vitest';
import {
  formatSubmissionsAsText,
  formatSubmissionsAsCsv,
  getSubmissionsCsvFilename,
  ExportableSubmission
} from './submissionExport';

// Failure modes covered here:
// - student text containing commas, quotes or line breaks splits or shifts CSV columns
// - student text starting with = + - @ runs as a formula when a teacher opens the CSV in Excel
// - missing name / legacy `link`-only submissions export as "undefined"
// - a missing or invalid timestamp throws (toISOString) or prints "Invalid Date"
// - multi-line text breaks the "one submission per line" clipboard format
// - the filename date uses UTC, so a teacher in UTC+8 before 8am gets yesterday's date

const at = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0) =>
  new Date(y, mo - 1, d, h, mi, s).getTime();

function sub(overrides: Partial<ExportableSubmission> = {}): ExportableSubmission {
  return {
    studentName: 'Ada',
    content: 'hello',
    isLink: false,
    timestamp: at(2026, 9, 27, 10, 5, 9),
    ...overrides
  };
}

describe('formatSubmissionsAsCsv', () => {
  it('writes a header and one CRLF-terminated row per submission, in order', () => {
    const csv = formatSubmissionsAsCsv([
      sub({ studentName: 'Ada', content: 'https://a.example', isLink: true }),
      sub({ studentName: 'Bo', content: 'my answer' })
    ]);
    expect(csv).toBe(
      'Name,Content,Type,Submitted at\r\n' +
      'Ada,https://a.example,Link,2026-09-27 10:05:09\r\n' +
      'Bo,my answer,Text,2026-09-27 10:05:09\r\n'
    );
  });

  it('returns only the header for no submissions', () => {
    expect(formatSubmissionsAsCsv([])).toBe('Name,Content,Type,Submitted at\r\n');
  });

  it('quotes fields containing commas', () => {
    const csv = formatSubmissionsAsCsv([sub({ content: 'red, green' })]);
    expect(csv.split('\r\n')[1]).toBe('Ada,"red, green",Text,2026-09-27 10:05:09');
  });

  it('doubles embedded quotes and wraps the field in quotes', () => {
    const csv = formatSubmissionsAsCsv([sub({ studentName: 'Al "Ace" Lee', content: 'say "hi"' })]);
    expect(csv.split('\r\n')[1]).toBe('"Al ""Ace"" Lee","say ""hi""",Text,2026-09-27 10:05:09');
  });

  it('keeps line breaks inside a quoted field', () => {
    const csv = formatSubmissionsAsCsv([sub({ content: 'line one\nline two\r\nline three' })]);
    expect(csv).toContain('Ada,"line one\nline two\r\nline three",Text,');
  });

  it.each(['=1+1', '+65 9123', '-cmd', '@SUM(A1)', '\tx', '\rx'])(
    'neutralises spreadsheet formula prefix in %j',
    (content) => {
      const row = formatSubmissionsAsCsv([sub({ content })]).split('\r\n').slice(1).join('\r\n');
      expect(row.startsWith('Ada,')).toBe(true);
      const field = row.slice('Ada,'.length);
      expect(field.replace(/^"/, '').startsWith("'")).toBe(true);
    }
  );

  it('neutralises a formula in the student name too', () => {
    const csv = formatSubmissionsAsCsv([sub({ studentName: '=HYPERLINK("x")' })]);
    expect(csv.split('\r\n')[1].startsWith(`"'=HYPERLINK(""x"")"`)).toBe(true);
  });

  it('uses Anonymous for a missing name and the legacy link field for missing content', () => {
    const csv = formatSubmissionsAsCsv([
      sub({ studentName: '', content: 'x' }),
      sub({ studentName: undefined, content: undefined, link: 'https://legacy.example', isLink: true })
    ]);
    const rows = csv.split('\r\n');
    expect(rows[1]).toBe('Anonymous,x,Text,2026-09-27 10:05:09');
    expect(rows[2]).toBe('Anonymous,https://legacy.example,Link,2026-09-27 10:05:09');
    expect(csv).not.toContain('undefined');
  });

  it('leaves the time blank for missing or invalid timestamps instead of throwing', () => {
    const csv = formatSubmissionsAsCsv([
      sub({ timestamp: undefined }),
      sub({ timestamp: Number.NaN })
    ]);
    const rows = csv.split('\r\n');
    expect(rows[1]).toBe('Ada,hello,Text,');
    expect(rows[2]).toBe('Ada,hello,Text,');
  });
});

describe('formatSubmissionsAsText', () => {
  it('writes one "Name: content" line per submission, in order', () => {
    expect(formatSubmissionsAsText([
      sub({ studentName: 'Ada', content: 'https://a.example', isLink: true }),
      sub({ studentName: 'Bo', content: 'my answer' })
    ])).toBe('Ada: https://a.example\nBo: my answer');
  });

  it('returns an empty string for no submissions', () => {
    expect(formatSubmissionsAsText([])).toBe('');
  });

  it('keeps each multi-line submission on a single line', () => {
    expect(formatSubmissionsAsText([
      sub({ content: 'first\nsecond\r\n\r\nthird' }),
      sub({ studentName: 'Bo', content: 'x' })
    ])).toBe('Ada: first second third\nBo: x');
  });

  it('uses Anonymous for a missing name and the legacy link field for missing content', () => {
    expect(formatSubmissionsAsText([
      sub({ studentName: undefined, content: undefined, link: 'https://legacy.example' })
    ])).toBe('Anonymous: https://legacy.example');
  });
});

describe('getSubmissionsCsvFilename', () => {
  it('uses the local calendar date, zero-padded', () => {
    expect(getSubmissionsCsvFilename(new Date(2026, 0, 5, 0, 30))).toBe('drop-box-2026-01-05.csv');
  });

  it('does not roll back to the previous UTC day just after local midnight', () => {
    expect(getSubmissionsCsvFilename(new Date(2026, 11, 31, 0, 1))).toBe('drop-box-2026-12-31.csv');
  });
});
