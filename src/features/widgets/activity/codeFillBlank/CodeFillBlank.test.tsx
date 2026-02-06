import { describe, it, expect } from 'vitest';

/**
 * Tests for CodeFillBlank UI recipe generation logic
 */

// Helper function extracted from CodeFillBlank.tsx for testing
function buildCodeActivityDefinition(data: {
  template: string;
  answers: string[];
  distractors: string[];
  title: string;
  instructions: string;
  language: 'python' | 'javascript' | 'text';
}) {
  const { template, answers, distractors, title, instructions, language } = data;
  if (!template || answers.length === 0) {
    return { type: 'code-fill-blank', title, instructions, items: [], targets: [], uiRecipe: [] };
  }

  // Create items
  const items = answers.map((content, i) => ({
    id: `item-${i}`,
    content
  }));

  // Create targets with whitespace-flexible evaluation
  const targets = answers.map((_, i) => ({
    id: `blank-${i}`,
    accepts: [`item-${i}`],
    evaluationMode: 'whitespace-flexible' as const
  }));

  // Generate UI recipe
  const recipe: any[] = [];

  // Parse template into lines
  const lines = template.split('\n');
  const codeLines: any[] = [];
  let blankIndex = 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const parts = line.split(/___[^_]+___/);
    const blankMatches = line.match(/___[^_]+___/g) || [];

    const lineChildren: any[] = [];

    for (let i = 0; i < parts.length; i++) {
      if (parts[i]) {
        lineChildren.push({
          id: `text-${lineIdx}-${i}`,
          type: 'text',
          props: { content: parts[i], variant: 'inline', className: 'font-mono whitespace-pre' }
        });
      }

      if (i < blankMatches.length) {
        lineChildren.push({
          id: `input-${blankIndex}`,
          type: 'text-input',
          props: {
            targetId: `blank-${blankIndex}`,
            placeholder: '___',
            maxLength: 50
          }
        });
        blankIndex++;
      }
    }

    codeLines.push({
      id: `line-${lineIdx}`,
      type: 'container',
      props: { layout: 'inline', className: 'min-h-[24px]' },
      children: lineChildren
    });
  }

  recipe.push({
    id: 'code-container',
    type: 'container',
    props: {
      layout: 'column',
      gap: '0',
      className: `font-mono text-sm bg-warm-gray-900 dark:bg-warm-gray-950 p-4 rounded-lg ${
        language === 'python' ? 'text-blue-300' :
        language === 'javascript' ? 'text-yellow-300' :
        'text-warm-gray-200'
      }`
    },
    children: codeLines
  });

  return {
    type: 'code-fill-blank',
    title,
    instructions,
    items,
    targets,
    uiRecipe: recipe,
    showImmediateFeedback: true,
    allowRetry: true
  };
}

describe('CodeFillBlank Recipe Generation', () => {
  describe('buildCodeActivityDefinition', () => {
    it('should return empty activity when no template', () => {
      const result = buildCodeActivityDefinition({
        template: '',
        answers: [],
        distractors: [],
        title: 'Test',
        instructions: 'Test instructions',
        language: 'python'
      });

      expect(result.items).toHaveLength(0);
      expect(result.targets).toHaveLength(0);
      expect(result.uiRecipe).toHaveLength(0);
    });

    it('should parse single-line code with one blank', () => {
      const result = buildCodeActivityDefinition({
        template: '___def___ hello():',
        answers: ['def'],
        distractors: [],
        title: 'Python',
        instructions: 'Complete the code',
        language: 'python'
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].content).toBe('def');
      expect(result.targets).toHaveLength(1);
      expect(result.targets[0].evaluationMode).toBe('whitespace-flexible');
    });

    it('should parse multiline code correctly', () => {
      const template = `def ___greet___(name):
    return "Hello, " + ___name___`;

      const result = buildCodeActivityDefinition({
        template,
        answers: ['greet', 'name'],
        distractors: [],
        title: 'Functions',
        instructions: 'Fill in',
        language: 'python'
      });

      expect(result.items).toHaveLength(2);
      expect(result.targets).toHaveLength(2);

      // Should have a container with 2 line containers
      const codeContainer = result.uiRecipe[0];
      expect(codeContainer.type).toBe('container');
      expect(codeContainer.children).toHaveLength(2); // 2 lines
    });

    it('should generate text-input blocks instead of drop-zones', () => {
      const result = buildCodeActivityDefinition({
        template: '___print___("hello")',
        answers: ['print'],
        distractors: [],
        title: 'Test',
        instructions: 'Fill in',
        language: 'python'
      });

      const codeContainer = result.uiRecipe[0];
      const firstLine = codeContainer.children[0];

      // Should have text-input, not drop-zone
      const textInput = firstLine.children.find((c: any) => c.type === 'text-input');
      expect(textInput).toBeDefined();
      expect(textInput.props.targetId).toBe('blank-0');
    });

    it('should preserve code structure with proper indentation', () => {
      const template = `if True:
    ___print___("yes")`;

      const result = buildCodeActivityDefinition({
        template,
        answers: ['print'],
        distractors: [],
        title: 'Conditionals',
        instructions: 'Fill in',
        language: 'python'
      });

      const codeContainer = result.uiRecipe[0];
      const secondLine = codeContainer.children[1];

      // First child should be the indentation text
      const textBlock = secondLine.children[0];
      expect(textBlock.type).toBe('text');
      expect(textBlock.props.content).toBe('    '); // 4 spaces
    });

    it('should apply correct language styling', () => {
      const pythonResult = buildCodeActivityDefinition({
        template: '___x___ = 1',
        answers: ['x'],
        distractors: [],
        title: 'Test',
        instructions: 'Fill in',
        language: 'python'
      });

      const jsResult = buildCodeActivityDefinition({
        template: 'const ___x___ = 1',
        answers: ['x'],
        distractors: [],
        title: 'Test',
        instructions: 'Fill in',
        language: 'javascript'
      });

      expect(pythonResult.uiRecipe[0].props.className).toContain('text-blue-300');
      expect(jsResult.uiRecipe[0].props.className).toContain('text-yellow-300');
    });

    it('should set whitespace-flexible evaluation for all targets', () => {
      const result = buildCodeActivityDefinition({
        template: '___a___ = ___b___',
        answers: ['a', 'b'],
        distractors: [],
        title: 'Test',
        instructions: 'Fill in',
        language: 'python'
      });

      result.targets.forEach(target => {
        expect(target.evaluationMode).toBe('whitespace-flexible');
      });
    });

    it('should handle code with special characters', () => {
      const result = buildCodeActivityDefinition({
        template: 'arr[___0___] = "hello"',
        answers: ['0'],
        distractors: [],
        title: 'Arrays',
        instructions: 'Fill in',
        language: 'javascript'
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].content).toBe('0');
    });

    it('should handle empty lines in code', () => {
      const template = `def foo():

    return 1`;

      const result = buildCodeActivityDefinition({
        template,
        answers: [],
        distractors: [],
        title: 'Test',
        instructions: 'Fill in',
        language: 'python'
      });

      // Even with no blanks, should still parse the structure
      expect(result.type).toBe('code-fill-blank');
    });
  });
});

describe('Code Template Parsing', () => {
  function parseCodeAnswers(text: string): string[] {
    const pattern = /___([^_]+)___/g;
    const matches = [...text.matchAll(pattern)];
    return matches.map(m => m[1].trim());
  }

  it('should extract Python keywords', () => {
    const answers = parseCodeAnswers('___def___ hello(): ___return___ 1');
    expect(answers).toEqual(['def', 'return']);
  });

  it('should handle function names', () => {
    const answers = parseCodeAnswers('def ___greet___(___name___):');
    expect(answers).toEqual(['greet', 'name']);
  });

  it('should handle string literals as blanks', () => {
    const answers = parseCodeAnswers('print(___"hello"___)');
    expect(answers).toEqual(['"hello"']);
  });

  it('should handle numbers as blanks', () => {
    const answers = parseCodeAnswers('for i in range(___10___):');
    expect(answers).toEqual(['10']);
  });

  it('should handle operators as blanks', () => {
    const answers = parseCodeAnswers('result = a ___+___ b');
    expect(answers).toEqual(['+']);
  });

  it('should work with JavaScript code', () => {
    const code = `const ___add___ = (a, b) => {
  ___return___ a + b;
}`;
    const answers = parseCodeAnswers(code);
    expect(answers).toEqual(['add', 'return']);
  });
});
