import { describe, expect, it } from 'vitest';
import type { ValidationIssue, WidgetSpec } from '@classroom-widgets/widget-spec';
import retrievalFixture from '../../../packages/widget-spec/fixtures/retrieval-practice.widget.json';
import projectileFixture from '../../../packages/widget-spec/fixtures/projectile-motion.widget.json';
import { FixtureModelProvider } from '../src/ai/fixtureProvider';
import type { ModelProvider, ModerationDecision, TeacherBrief } from '../src/ai/provider';
import {
  generateWidgetSpec,
  patchWidgetSpec,
} from '../src/generation';

const brief: TeacherBrief = {
  level: 'Secondary 1',
  subject: 'Science',
  learningObjective: 'Explain balanced forces.',
  studentAction: 'Choose an answer and read feedback.',
};

class FixedProvider implements ModelProvider {
  readonly name = 'fixed';

  constructor(private readonly candidate: unknown) {}

  generate(): Promise<unknown> {
    return Promise.resolve(structuredClone(this.candidate));
  }

  patch(): Promise<unknown> {
    return Promise.resolve(structuredClone(this.candidate));
  }

  repair(_candidate: unknown, _issues: ValidationIssue[]): Promise<unknown> {
    return Promise.resolve(structuredClone(this.candidate));
  }

  moderate(): Promise<ModerationDecision> {
    return Promise.resolve({ safe: true, categories: [] });
  }
}

describe('model output gates', () => {
  it('allows a focused revision that preserves widget identity and structure', async () => {
    const current = retrievalFixture as WidgetSpec;
    const revised = await patchWidgetSpec(
      new FixtureModelProvider(),
      current,
      'Make the summary more explicit.',
    );
    expect(revised.id).toBe(current.id);
    expect(revised.metadata.summary).toContain('Make the summary more explicit.');
  });

  it('rejects a valid but unrelated replacement for a prompted revision', async () => {
    await expect(
      patchWidgetSpec(
        new FixedProvider(projectileFixture),
        retrievalFixture as WidgetSpec,
        'Make one explanation clearer.',
      ),
    ).rejects.toMatchObject({
      issues: expect.arrayContaining([expect.objectContaining({ code: 'patch.identity' })]),
    });
  });

  it('rejects personal data hallucinated by a model before saving', async () => {
    const candidate = structuredClone(retrievalFixture) as WidgetSpec;
    candidate.metadata.summary = 'Ask pupil@example.com for the answers.';
    await expect(generateWidgetSpec(new FixedProvider(candidate), brief)).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({ code: 'moderation.possible_email' }),
      ]),
    });
  });

  it('rejects image assets invented during initial generation', async () => {
    const candidate = structuredClone(retrievalFixture) as WidgetSpec;
    candidate.assets = [
      {
        id: 'asset-0123456789abcdef0123456789abcdef',
        kind: 'image',
        mediaType: 'image/jpeg',
        width: 640,
        height: 480,
        byteLength: 12_000,
        sha256: 'a'.repeat(64),
      },
    ];

    await expect(generateWidgetSpec(new FixedProvider(candidate), brief)).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({ code: 'generation.assets' }),
      ]),
    });
  });
});
