import { describe, it, expect } from 'vitest';
import { buildFillBlankActivity, parseAnswers } from '../shared/activityBuilders';
import type { FillBlankState } from '../shared/activityBuilders';

/**
 * Tests for the REAL fill-blank activity builder that is sent to the server
 * and drives student scoring (previously these tests exercised an in-file
 * copy that had silently diverged from the shipping code).
 */

function makeState(overrides: Partial<FillBlankState> = {}): FillBlankState {
  return {
    template: 'The {{mitochondria}} is the powerhouse of the {{cell}}.',
    answers: ['mitochondria', 'cell'],
    distractors: ['nucleus'],
    title: 'Biology',
    instructions: 'Drag the words.',
    ...overrides
  };
}

// Map itemId -> content for an activity definition
function itemContent(activity: ReturnType<typeof buildFillBlankActivity>) {
  return new Map((activity.items ?? []).map(item => [item.id, item.content]));
}

describe('buildFillBlankActivity', () => {
  it('returns an empty activity when there is no template', () => {
    const activity = buildFillBlankActivity(makeState({ template: '', answers: [] }));

    expect(activity.type).toBe('fill-blank');
    expect(activity.items).toEqual([]);
    expect(activity.targets).toEqual([]);
    expect(activity.uiRecipe).toEqual([]);
  });

  it('returns an empty activity when there are no answers', () => {
    const activity = buildFillBlankActivity(makeState({ answers: [] }));
    expect(activity.items).toEqual([]);
    expect(activity.targets).toEqual([]);
  });

  it('creates one item per word (answers + distractors)', () => {
    const activity = buildFillBlankActivity(makeState());

    expect(activity.items).toHaveLength(3);
    const contents = (activity.items ?? []).map(i => i.content).sort();
    expect(contents).toEqual(['cell', 'mitochondria', 'nucleus']);
  });

  it('creates one target per blank whose accepts resolve to the answer content', () => {
    const activity = buildFillBlankActivity(makeState());
    const contents = itemContent(activity);

    expect(activity.targets).toHaveLength(2);
    const [first, second] = activity.targets ?? [];

    expect(first.id).toBe('blank-0');
    expect(first.accepts.map(id => contents.get(id))).toEqual(['mitochondria']);
    expect(second.id).toBe('blank-1');
    expect(second.accepts.map(id => contents.get(id))).toEqual(['cell']);
  });

  it('keeps item ids consistent between definition and word bank despite shuffling', () => {
    const activity = buildFillBlankActivity(makeState());
    const wordBank = (activity.uiRecipe ?? []).find(block => block.id === 'word-bank');

    expect(wordBank?.children).toHaveLength(3);
    const contents = itemContent(activity);
    for (const child of wordBank?.children ?? []) {
      expect(child.props.content).toBe(contents.get(child.props.itemId as string));
    }
  });

  it('accepts every copy of a word when the same answer fills multiple blanks', () => {
    // Regression: accepts used shuffled.indexOf(answer), so two blanks with
    // the same answer both pointed at the FIRST copy, marking the second
    // (identical) dragged word wrong.
    const activity = buildFillBlankActivity(makeState({
      template: '{{the}} cat and {{the}} dog',
      answers: ['the', 'the'],
      distractors: []
    }));
    const contents = itemContent(activity);

    for (const target of activity.targets ?? []) {
      const acceptedWords = target.accepts.map((id: string) => contents.get(id));
      expect(acceptedWords).toEqual(['the', 'the']);
    }
  });

  it('accepts the duplicate copy when an answer also appears as a distractor', () => {
    const activity = buildFillBlankActivity(makeState({
      template: 'Water is {{H2O}}',
      answers: ['H2O'],
      distractors: ['H2O', 'CO2']
    }));
    const contents = itemContent(activity);

    const target = (activity.targets ?? [])[0];
    expect(target.accepts).toHaveLength(2);
    for (const id of target.accepts) {
      expect(contents.get(id)).toBe('H2O');
    }
  });

  it('builds an inline sentence recipe with one drop zone per blank', () => {
    const activity = buildFillBlankActivity(makeState());
    const sentence = (activity.uiRecipe ?? []).find(block => block.id === 'sentence-container');

    const dropZones = (sentence?.children ?? []).filter(c => c.type === 'drop-zone');
    expect(dropZones).toHaveLength(2);
    expect(dropZones.map(z => z.props.targetId)).toEqual(['blank-0', 'blank-1']);

    const texts = (sentence?.children ?? []).filter(c => c.type === 'text');
    expect(texts[0].props.content).toBe('The ');
  });

  it('handles a template that starts and ends with blanks', () => {
    const activity = buildFillBlankActivity(makeState({
      template: '{{alpha}} middle {{omega}}',
      answers: ['alpha', 'omega'],
      distractors: []
    }));
    const sentence = (activity.uiRecipe ?? []).find(block => block.id === 'sentence-container');
    const kinds = (sentence?.children ?? []).map(c => c.type);

    expect(kinds).toEqual(['drop-zone', 'text', 'drop-zone']);
  });

  it('enables feedback and retry by default', () => {
    const activity = buildFillBlankActivity(makeState());
    expect(activity.showImmediateFeedback).toBe(true);
    expect(activity.allowRetry).toBe(true);
  });
});

describe('parseAnswers', () => {
  it('extracts answers from {{}} markers in order', () => {
    expect(parseAnswers('The {{mitochondria}} of the {{cell}}')).toEqual(['mitochondria', 'cell']);
  });

  it('trims whitespace inside markers', () => {
    expect(parseAnswers('{{ spaced }} and {{\ttabbed\t}}')).toEqual(['spaced', 'tabbed']);
  });

  it('returns an empty array when there are no markers', () => {
    expect(parseAnswers('no blanks here')).toEqual([]);
    expect(parseAnswers('')).toEqual([]);
  });

  it('ignores unclosed markers', () => {
    expect(parseAnswers('{{open but never closed')).toEqual([]);
  });

  it('keeps duplicate answers (one per blank)', () => {
    expect(parseAnswers('{{the}} cat and {{the}} dog')).toEqual(['the', 'the']);
  });

  it('supports punctuation and unicode inside markers', () => {
    expect(parseAnswers('{{"Hello, "}} {{H₂O}} {{a+b=c}}')).toEqual(['"Hello, "', 'H₂O', 'a+b=c']);
  });
});
