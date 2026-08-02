import { describe, expect, it } from 'vitest';
import { inspectHtml, inspectText } from '../src/moderation';

describe('deterministic moderation', () => {
  it('checks content displayed from inline JavaScript', () => {
    expect(inspectHtml('<script>const contact = "91234567";</script>'))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'POSSIBLE_PHONE' }),
      ]));
  });

  it('blocks direct weapon-building instructions before model moderation', () => {
    expect(inspectText('How to make a bomb: combine these materials and follow these steps.'))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'UNSAFE_HARM_INSTRUCTION' }),
      ]));
  });

  it('keeps age-appropriate historical discussion available', () => {
    expect(inspectText(
      'Compare the causes and civilian consequences of the Second World War using age-appropriate sources.',
    )).toEqual([]);
  });
});
