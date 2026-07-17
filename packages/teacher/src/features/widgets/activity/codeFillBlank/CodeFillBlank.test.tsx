import { describe, it, expect } from 'vitest';
import { buildCodeFillBlankActivity, parseAnswers } from '../shared/activityBuilders';
import type { CodeFillBlankState } from '../shared/activityBuilders';

/**
 * Tests for the REAL code-fill-blank activity builder that is sent to the
 * server (previously these tests exercised an in-file copy that used a
 * different blank-marker syntax than the shipping code).
 */

function makeState(overrides: Partial<CodeFillBlankState> = {}): CodeFillBlankState {
  return {
    template: 'def {{greet}}(name):\n    return {{"Hello, "}} + name',
    answers: ['greet', '"Hello, "'],
    distractors: [],
    title: 'Python Functions',
    instructions: 'Fill in the code.',
    language: 'python',
    ...overrides
  };
}

describe('buildCodeFillBlankActivity', () => {
  it('returns an empty activity when there is no template or no answers', () => {
    for (const state of [makeState({ template: '' }), makeState({ answers: [] })]) {
      const activity = buildCodeFillBlankActivity(state);
      expect(activity.type).toBe('code-fill-blank');
      expect(activity.items).toEqual([]);
      expect(activity.targets).toEqual([]);
      expect(activity.uiRecipe).toEqual([]);
    }
  });

  it('creates one item per answer in blank order (no shuffling for typed input)', () => {
    const activity = buildCodeFillBlankActivity(makeState());

    expect(activity.items).toEqual([
      { id: 'item-0', content: 'greet' },
      { id: 'item-1', content: '"Hello, "' }
    ]);
  });

  it('creates targets with whitespace-flexible evaluation pointing at their item', () => {
    const activity = buildCodeFillBlankActivity(makeState());

    expect(activity.targets).toEqual([
      { id: 'blank-0', accepts: ['item-0'], evaluationMode: 'whitespace-flexible' },
      { id: 'blank-1', accepts: ['item-1'], evaluationMode: 'whitespace-flexible' }
    ]);
  });

  it('renders one container line per template line with inline text inputs', () => {
    const activity = buildCodeFillBlankActivity(makeState());
    const codeContainer = (activity.uiRecipe ?? [])[0];

    expect(codeContainer.children).toHaveLength(2);

    const firstLine = codeContainer.children?.[0];
    const inputBlocks = (firstLine?.children ?? []).filter(c => c.type === 'text-input');
    expect(inputBlocks).toHaveLength(1);
    expect(inputBlocks[0].props.targetId).toBe('blank-0');

    const secondLine = codeContainer.children?.[1];
    const secondInputs = (secondLine?.children ?? []).filter(c => c.type === 'text-input');
    expect(secondInputs[0].props.targetId).toBe('blank-1');
  });

  it('numbers blanks continuously across lines', () => {
    const activity = buildCodeFillBlankActivity(makeState({
      template: '{{a}} {{b}}\n{{c}}',
      answers: ['a', 'b', 'c']
    }));
    const codeContainer = (activity.uiRecipe ?? [])[0];

    const targetIds = (codeContainer.children ?? []).flatMap(line =>
      (line.children ?? []).filter(c => c.type === 'text-input').map(c => c.props.targetId)
    );
    expect(targetIds).toEqual(['blank-0', 'blank-1', 'blank-2']);
  });

  it('preserves code indentation as whitespace-pre text blocks', () => {
    const activity = buildCodeFillBlankActivity(makeState({
      template: 'def foo():\n    return {{1}}',
      answers: ['1']
    }));
    const codeContainer = (activity.uiRecipe ?? [])[0];
    const secondLine = codeContainer.children?.[1];
    const textBlock = secondLine?.children?.[0];

    expect(textBlock?.type).toBe('text');
    expect(textBlock?.props.content).toBe('    return ');
    expect(textBlock?.props.className).toContain('whitespace-pre');
  });

  it('keeps empty template lines as empty containers so line numbers align', () => {
    const activity = buildCodeFillBlankActivity(makeState({
      template: 'def foo():\n\n    return {{1}}',
      answers: ['1']
    }));
    const codeContainer = (activity.uiRecipe ?? [])[0];

    expect(codeContainer.children).toHaveLength(3);
    expect(codeContainer.children?.[1].children).toEqual([]);
  });

  it('applies language-specific styling', () => {
    const python = buildCodeFillBlankActivity(makeState({ language: 'python' }));
    const js = buildCodeFillBlankActivity(makeState({ language: 'javascript' }));
    const text = buildCodeFillBlankActivity(makeState({ language: 'text' }));

    expect((python.uiRecipe ?? [])[0].props.className).toContain('text-blue-300');
    expect((js.uiRecipe ?? [])[0].props.className).toContain('text-yellow-300');
    expect((text.uiRecipe ?? [])[0].props.className).toContain('text-warm-gray-200');
  });

  it('handles answers containing underscores', () => {
    // The old ___marker___ syntax could not express snake_case answers;
    // {{}} markers must.
    const activity = buildCodeFillBlankActivity(makeState({
      template: '{{my_var}} = compute()',
      answers: ['my_var']
    }));

    expect(activity.items).toEqual([{ id: 'item-0', content: 'my_var' }]);
    const codeContainer = (activity.uiRecipe ?? [])[0];
    const inputs = (codeContainer.children?.[0].children ?? []).filter(c => c.type === 'text-input');
    expect(inputs).toHaveLength(1);
  });

  it('enables feedback and retry by default', () => {
    const activity = buildCodeFillBlankActivity(makeState());
    expect(activity.showImmediateFeedback).toBe(true);
    expect(activity.allowRetry).toBe(true);
  });
});

describe('parseAnswers on code templates', () => {
  it('extracts keywords, identifiers, literals, and operators', () => {
    expect(parseAnswers('{{def}} hello(): {{return}} 1')).toEqual(['def', 'return']);
    expect(parseAnswers('def {{greet}}({{name}}):')).toEqual(['greet', 'name']);
    expect(parseAnswers('print({{"hello"}})')).toEqual(['"hello"']);
    expect(parseAnswers('for i in range({{10}}):')).toEqual(['10']);
    expect(parseAnswers('result = a {{+}} b')).toEqual(['+']);
  });

  it('extracts snake_case answers that the legacy ___ syntax could not express', () => {
    expect(parseAnswers('{{my_var}} = {{some_func}}()')).toEqual(['my_var', 'some_func']);
  });

  it('works across multiple lines', () => {
    const code = 'const {{add}} = (a, b) => {\n  {{return}} a + b;\n}';
    expect(parseAnswers(code)).toEqual(['add', 'return']);
  });
});
