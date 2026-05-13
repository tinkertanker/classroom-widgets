import { describe, it, expect } from 'vitest';
import { normaliseCode, findCodeBlock } from './highlight';

describe('normaliseCode', () => {
  it('replaces curly single quotes with straight single quotes', () => {
    expect(normaliseCode("it’s a test")).toBe("it's a test");
    expect(normaliseCode("‘hello’")).toBe("'hello'");
  });

  it('replaces curly double quotes with straight double quotes', () => {
    expect(normaliseCode('“Hello”')).toBe('"Hello"');
    expect(normaliseCode('„Low quote‟')).toBe('"Low quote"');
  });

  it('replaces en dash with single hyphen and em dash with double hyphen', () => {
    expect(normaliseCode('a – b')).toBe('a - b');
    expect(normaliseCode('a — b')).toBe('a -- b');
  });

  it('replaces ellipsis with three dots', () => {
    expect(normaliseCode('wait…')).toBe('wait...');
  });

  it('leaves already-ascii code untouched', () => {
    const src = "function greet() { return 'hi'; }";
    expect(normaliseCode(src)).toBe(src);
  });

  it('handles a mix of smart punctuation in one string', () => {
    expect(normaliseCode('“it’s—done…”')).toBe('"it\'s--done..."');
  });
});

describe('findCodeBlock', () => {
  it('finds a fenced block with a language tag', () => {
    const block = findCodeBlock('```python\nprint("hi")\n```');
    expect(block).not.toBeNull();
    expect(block?.language).toBe('python');
    expect(block?.code).toBe('print("hi")');
  });

  it('finds a fenced block with no language tag', () => {
    const block = findCodeBlock('```\nplain text\n```');
    expect(block).not.toBeNull();
    expect(block?.language).toBe('');
    expect(block?.code).toBe('plain text');
  });

  it('returns null when there is no fence', () => {
    expect(findCodeBlock('just a regular sentence')).toBeNull();
  });

  it('returns null when only one fence is present', () => {
    expect(findCodeBlock('```python\nstill open')).toBeNull();
  });

  it('preserves indentation inside the block', () => {
    const block = findCodeBlock('```ts\n  const x = 1;\n  const y = 2;\n```');
    expect(block?.code).toBe('  const x = 1;\n  const y = 2;');
  });

  it('tolerates leading whitespace on fence lines', () => {
    const block = findCodeBlock('  ```rust\nfn main() {}\n  ```');
    expect(block).not.toBeNull();
    expect(block?.language).toBe('rust');
    expect(block?.code).toBe('fn main() {}');
  });

  it('exposes the match span via .match and .index', () => {
    const src = '```js\nx\n```';
    const block = findCodeBlock(src);
    expect(block?.match).toBe(src);
    expect(block?.index).toBe(0);
  });

  it('accepts language tags with hyphens, underscores, and digits', () => {
    expect(findCodeBlock('```c++\nint x;\n```')?.language).toBe('c++');
    expect(findCodeBlock('```html5\n<p></p>\n```')?.language).toBe('html5');
    expect(findCodeBlock('```objective_c\nNSLog(@"");\n```')?.language).toBe('objective_c');
  });
});
