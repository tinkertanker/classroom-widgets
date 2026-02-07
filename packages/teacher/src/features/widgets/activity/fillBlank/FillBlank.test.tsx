import { describe, it, expect } from 'vitest';

/**
 * Tests for FillBlank UI recipe generation logic
 * These test the pure functions for building activity definitions
 */

// Helper function extracted from FillBlank.tsx for testing
function buildActivityDefinition(data: {
  template: string;
  answers: string[];
  distractors: string[];
  title: string;
  instructions: string;
}) {
  const { template, answers, distractors, title, instructions } = data;
  if (!template || answers.length === 0) {
    return { type: 'fill-blank', title, instructions, items: [], targets: [], uiRecipe: [] };
  }

  // Create items - shuffle ONCE and use everywhere
  const allWords = [...answers, ...distractors];
  // For testing, use deterministic "shuffle" (no shuffle)
  const shuffled = [...allWords];
  const items = shuffled.map((word, i) => ({
    id: `item-${i}`,
    content: word
  }));

  // Create targets (one per blank)
  const targets = answers.map((answer, i) => {
    const itemIndex = shuffled.indexOf(answer);
    return {
      id: `blank-${i}`,
      accepts: [`item-${itemIndex}`]
    };
  });

  // Generate UI recipe
  const parts = template.split(/___[^_]+___/);
  const recipe: any[] = [];

  // Build inline container for the sentence with blanks
  const inlineChildren: any[] = [];
  parts.forEach((part, index) => {
    if (part) {
      inlineChildren.push({
        id: `text-${index}`,
        type: 'text',
        props: { content: part, variant: 'inline' }
      });
    }
    if (index < parts.length - 1) {
      inlineChildren.push({
        id: `dropzone-${index}`,
        type: 'drop-zone',
        props: {
          targetId: `blank-${index}`,
          accepts: 'single',
          inline: true,
          showFeedback: true
        }
      });
    }
  });

  recipe.push({
    id: 'sentence-container',
    type: 'container',
    props: { layout: 'inline', className: 'text-lg leading-relaxed' },
    children: inlineChildren
  });

  // Word bank
  const wordBankChildren = items.map(item => ({
    id: `draggable-${item.id}`,
    type: 'draggable-item',
    props: { itemId: item.id, content: item.content }
  }));

  recipe.push({
    id: 'word-bank',
    type: 'container',
    props: {
      layout: 'row',
      gap: '8px',
      wrap: true,
      className: 'mt-4 p-4 bg-warm-gray-100 dark:bg-warm-gray-800 rounded-lg'
    },
    children: wordBankChildren
  });

  return {
    type: 'fill-blank',
    title,
    instructions,
    items,
    targets,
    uiRecipe: recipe,
    showImmediateFeedback: true,
    allowRetry: true
  };
}

describe('FillBlank Recipe Generation', () => {
  describe('buildActivityDefinition', () => {
    it('should return empty activity when no template', () => {
      const result = buildActivityDefinition({
        template: '',
        answers: [],
        distractors: [],
        title: 'Test',
        instructions: 'Test instructions'
      });

      expect(result.items).toHaveLength(0);
      expect(result.targets).toHaveLength(0);
      expect(result.uiRecipe).toHaveLength(0);
    });

    it('should parse single blank correctly', () => {
      const result = buildActivityDefinition({
        template: 'The ___sun___ is bright.',
        answers: ['sun'],
        distractors: [],
        title: 'Test',
        instructions: 'Fill in'
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].content).toBe('sun');
      expect(result.targets).toHaveLength(1);
      expect(result.targets[0].accepts).toContain('item-0');
    });

    it('should parse multiple blanks correctly', () => {
      const result = buildActivityDefinition({
        template: 'The ___mitochondria___ is the powerhouse of the ___cell___.',
        answers: ['mitochondria', 'cell'],
        distractors: [],
        title: 'Biology',
        instructions: 'Fill in the blanks'
      });

      expect(result.items).toHaveLength(2);
      expect(result.targets).toHaveLength(2);

      // First blank accepts first item
      expect(result.targets[0].id).toBe('blank-0');
      expect(result.targets[0].accepts).toContain('item-0');

      // Second blank accepts second item
      expect(result.targets[1].id).toBe('blank-1');
      expect(result.targets[1].accepts).toContain('item-1');
    });

    it('should include distractors in items', () => {
      const result = buildActivityDefinition({
        template: 'The ___cat___ sat on the mat.',
        answers: ['cat'],
        distractors: ['dog', 'bird'],
        title: 'Test',
        instructions: 'Fill in'
      });

      expect(result.items).toHaveLength(3);
      expect(result.items.map(i => i.content)).toContain('cat');
      expect(result.items.map(i => i.content)).toContain('dog');
      expect(result.items.map(i => i.content)).toContain('bird');
    });

    it('should generate correct UI recipe structure', () => {
      const result = buildActivityDefinition({
        template: 'Hello ___world___!',
        answers: ['world'],
        distractors: [],
        title: 'Greeting',
        instructions: 'Complete'
      });

      expect(result.uiRecipe).toHaveLength(2);

      // First element is sentence container
      const sentenceContainer = result.uiRecipe[0];
      expect(sentenceContainer.type).toBe('container');
      expect(sentenceContainer.props.layout).toBe('inline');

      // Should have text, drop-zone, text children
      expect(sentenceContainer.children).toHaveLength(3);
      expect(sentenceContainer.children[0].type).toBe('text');
      expect(sentenceContainer.children[0].props.content).toBe('Hello ');
      expect(sentenceContainer.children[1].type).toBe('drop-zone');
      expect(sentenceContainer.children[1].props.targetId).toBe('blank-0');
      expect(sentenceContainer.children[2].type).toBe('text');
      expect(sentenceContainer.children[2].props.content).toBe('!');

      // Second element is word bank
      const wordBank = result.uiRecipe[1];
      expect(wordBank.type).toBe('container');
      expect(wordBank.children).toHaveLength(1);
      expect(wordBank.children[0].type).toBe('draggable-item');
    });

    it('should handle consecutive blanks', () => {
      const result = buildActivityDefinition({
        template: '___Hello___ ___world___',
        answers: ['Hello', 'world'],
        distractors: [],
        title: 'Test',
        instructions: 'Fill in'
      });

      expect(result.targets).toHaveLength(2);

      const sentenceContainer = result.uiRecipe[0];
      // Should have: dropzone, text(" "), dropzone
      expect(sentenceContainer.children).toHaveLength(3);
      expect(sentenceContainer.children[0].type).toBe('drop-zone');
      expect(sentenceContainer.children[1].type).toBe('text');
      expect(sentenceContainer.children[1].props.content).toBe(' ');
      expect(sentenceContainer.children[2].type).toBe('drop-zone');
    });

    it('should set correct metadata', () => {
      const result = buildActivityDefinition({
        template: 'Test ___answer___',
        answers: ['answer'],
        distractors: [],
        title: 'My Title',
        instructions: 'My Instructions'
      });

      expect(result.type).toBe('fill-blank');
      expect(result.title).toBe('My Title');
      expect(result.instructions).toBe('My Instructions');
      expect(result.showImmediateFeedback).toBe(true);
      expect(result.allowRetry).toBe(true);
    });
  });
});

describe('Template Parsing', () => {
  // Helper to parse template like the editor does
  function parseAnswers(text: string): string[] {
    const pattern = /___([^_]+)___/g;
    const matches = [...text.matchAll(pattern)];
    return matches.map(m => m[1].trim());
  }

  it('should extract single answer', () => {
    const answers = parseAnswers('The ___quick___ brown fox');
    expect(answers).toEqual(['quick']);
  });

  it('should extract multiple answers', () => {
    const answers = parseAnswers('The ___quick___ brown ___fox___ jumps');
    expect(answers).toEqual(['quick', 'fox']);
  });

  it('should handle answers with spaces', () => {
    const answers = parseAnswers('Say ___hello world___!');
    expect(answers).toEqual(['hello world']);
  });

  it('should trim whitespace from answers', () => {
    const answers = parseAnswers('The ___ quick ___ fox');
    expect(answers).toEqual(['quick']);
  });

  it('should return empty array for no blanks', () => {
    const answers = parseAnswers('No blanks here');
    expect(answers).toEqual([]);
  });

  it('should handle multiline templates', () => {
    const template = `Line 1 ___answer1___
Line 2 ___answer2___`;
    const answers = parseAnswers(template);
    expect(answers).toEqual(['answer1', 'answer2']);
  });
});
