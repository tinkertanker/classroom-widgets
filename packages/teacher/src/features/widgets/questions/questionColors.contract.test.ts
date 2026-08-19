import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { getQuestionColor, questionColors } from '@shared/constants/questionColors';
import {
  getStudentQuestionColor,
  studentQuestionColors
} from '@shared/constants/studentQuestionColors';

// Every value in these token tables must be a complete, literal Tailwind class
// string. Raw hex (the old contract) type-checks identically but is inert once
// dropped into a className, so it can only be caught by asserting the shape.
const TAILWIND_CLASS = /^(?:dark:)?(?:bg|border|text)-[a-z]+(?:-[a-z]+)*-(?:50|[1-9]00)(?:\/\d{1,3})?$/;

const TABLES = [
  { name: 'questionColors', table: questionColors as ReadonlyArray<Record<string, unknown>> },
  {
    name: 'studentQuestionColors',
    table: studentQuestionColors as ReadonlyArray<Record<string, unknown>>
  }
];

const readSource = (relativePath: string) =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

const CONSUMERS = [
  { name: 'Questions.tsx', source: readSource('./Questions.tsx') },
  {
    name: 'QuestionsActivity.tsx',
    source: readSource('../../../../../student/components/QuestionsActivity.tsx')
  }
];

describe('question colour token contract', () => {
  it.each(TABLES)('$name exposes only Tailwind class strings', ({ table }) => {
    expect(table.length).toBeGreaterThan(0);

    for (const [index, entry] of table.entries()) {
      for (const [field, value] of Object.entries(entry)) {
        expect(typeof value, `${field} at index ${index}`).toBe('string');
        const classes = (value as string).split(/\s+/).filter(Boolean);
        expect(classes.length, `${field} at index ${index}`).toBeGreaterThan(0);
        for (const className of classes) {
          expect(className, `${field} at index ${index}`).toMatch(TAILWIND_CLASS);
        }
      }
    }
  });

  it.each(TABLES)('$name contains no raw hex or object stringification', ({ table }) => {
    for (const entry of table) {
      for (const value of Object.values(entry)) {
        expect(String(value)).not.toContain('#');
        expect(String(value)).not.toContain('[object Object]');
      }
    }
  });

  it.each(TABLES)('$name uses the same field set for every option index', ({ table }) => {
    const expected = JSON.stringify(Object.keys(table[0]).sort());
    for (const [index, entry] of table.entries()) {
      expect(JSON.stringify(Object.keys(entry).sort()), `index ${index}`).toBe(expected);
    }
  });

  it('wraps the option index past the end of each table', () => {
    expect(getQuestionColor(questionColors.length)).toBe(questionColors[0]);
    expect(getStudentQuestionColor(studentQuestionColors.length)).toBe(studentQuestionColors[0]);
  });
});

describe('question colour consumers', () => {
  // Interpolating the whole token object yields this, which is what the teacher
  // widget used to emit as a className. The source guard below is the real test;
  // this pins down what it is guarding against.
  it('stringifies a whole token object into an unusable class name', () => {
    expect(`${getQuestionColor(0)}`).toBe('[object Object]');
    expect(`${getStudentQuestionColor(0)}`).toBe('[object Object]');
  });

  it.each(CONSUMERS)('$name never interpolates a whole colour object', ({ source }) => {
    const colourVariables = [
      ...source.matchAll(/(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*get(?:Student)?QuestionColor\s*\(/g)
    ].map((match) => match[1]);

    expect(colourVariables.length).toBeGreaterThan(0);

    for (const variable of colourVariables) {
      // `${colour}` is the bug; `${colour.bg}` is the fix.
      const bareInterpolation = new RegExp(`\\$\\{\\s*${variable}\\s*\\}`);
      expect(source, `bare \${${variable}} interpolation`).not.toMatch(bareInterpolation);
    }
  });

  it.each(CONSUMERS)('$name only reads fields that exist on its token table', ({ name, source }) => {
    const table = name === 'Questions.tsx' ? questionColors : studentQuestionColors;
    const known = new Set(Object.keys(table[0]));
    const colourVariables = [
      ...source.matchAll(/(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*get(?:Student)?QuestionColor\s*\(/g)
    ].map((match) => match[1]);

    for (const variable of colourVariables) {
      const accesses = [...source.matchAll(new RegExp(`\\b${variable}\\.([\\w$]+)`, 'g'))].map(
        (match) => match[1]
      );
      expect(accesses.length).toBeGreaterThan(0);
      for (const field of accesses) {
        expect(known, `${variable}.${field}`).toContain(field);
      }
    }
  });
});
