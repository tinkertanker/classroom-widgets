import { describe, it, expect } from 'vitest';
import { normaliseChoiceList, stringifyChoiceList } from './choiceList';

describe('normaliseChoiceList', () => {
  it('splits lines and trims whitespace', () => {
    expect(normaliseChoiceList('  alice \n bob\t\ncarol')).toEqual(['alice', 'bob', 'carol']);
  });

  it('drops empty and whitespace-only lines', () => {
    expect(normaliseChoiceList('a\n\n   \n\t\nb')).toEqual(['a', 'b']);
  });

  it('deduplicates repeated entries, keeping first occurrence order', () => {
    expect(normaliseChoiceList('bob\nalice\nbob\nalice\nbob')).toEqual(['bob', 'alice']);
  });

  it('deduplicates entries that only differ by surrounding whitespace', () => {
    expect(normaliseChoiceList('bob\n  bob  \nbob\t')).toEqual(['bob']);
  });

  it('treats different case as distinct entries', () => {
    expect(normaliseChoiceList('Bob\nbob')).toEqual(['Bob', 'bob']);
  });

  it('handles Windows line endings', () => {
    expect(normaliseChoiceList('a\r\nb\r\nc')).toEqual(['a', 'b', 'c']);
  });

  it('returns an empty list for empty and whitespace-only input', () => {
    expect(normaliseChoiceList('')).toEqual([]);
    expect(normaliseChoiceList('   \n \n\t')).toEqual([]);
  });

  it('preserves internal whitespace and unicode', () => {
    expect(normaliseChoiceList('Ana María\n木村 拓哉\n🦄 team')).toEqual([
      'Ana María',
      '木村 拓哉',
      '🦄 team'
    ]);
  });
});

describe('stringifyChoiceList', () => {
  it('joins choices with newlines', () => {
    expect(stringifyChoiceList(['a', 'b'])).toBe('a\nb');
    expect(stringifyChoiceList([])).toBe('');
  });

  it('round-trips through normaliseChoiceList', () => {
    const choices = ['alice', 'bob', 'carol'];
    expect(normaliseChoiceList(stringifyChoiceList(choices))).toEqual(choices);
  });
});
