import type { WidgetSpec } from '@classroom-widgets/widget-spec';
import type { ModelProvider, ModerationDecision, TeacherBrief } from './provider';

function fixtureSpec(brief: TeacherBrief): WidgetSpec {
  const subject = brief.subject.toLowerCase();
  const allowedSubjects = [
    'science',
    'mathematics',
    'english',
    'humanities',
    'languages',
    'other',
  ] as const;
  const canonicalSubject = allowedSubjects.find((value) => subject.includes(value)) ?? 'other';

  return {
    schemaVersion: '1.0',
    id: 'balanced-forces-check',
    metadata: {
      title: 'Balanced forces check',
      summary: 'Decide what happens when forces are balanced.',
      subject: canonicalSubject,
      level: brief.level.toLowerCase().includes('primary') ? 'upper-primary' : 'secondary',
      learningObjective: brief.learningObjective,
      estimatedMinutes: brief.durationMinutes ?? 5,
      tags: ['retrieval', 'forces'],
    },
    theme: { accent: 'sage', colourScheme: 'system', density: 'comfortable' },
    assets: [],
    variables: [],
    screens: [
      {
        id: 'main',
        components: [
          {
            id: 'instructions',
            kind: 'text',
            role: 'instruction',
            text: 'Choose the best answer, then check your thinking.',
          },
          {
            id: 'forces-question',
            kind: 'choiceQuestion',
            prompt: 'Two equal forces act on a stationary object in opposite directions. What happens?',
            selectionMode: 'single',
            options: [
              { id: 'stays-still', content: { kind: 'text', text: 'It remains stationary.' } },
              { id: 'moves-left', content: { kind: 'text', text: 'It accelerates to the left.' } },
              { id: 'moves-right', content: { kind: 'text', text: 'It accelerates to the right.' } },
            ],
            correctOptionIds: ['stays-still'],
            shuffleOptions: false,
            feedback: {
              correct: 'Exactly. The resultant force is zero.',
              incorrect: 'Look again at the size and direction of both forces.',
              explanation: 'Equal forces in opposite directions balance, so a stationary object remains stationary.',
            },
          },
        ],
      },
    ],
  };
}

export class FixtureModelProvider implements ModelProvider {
  readonly name = 'fixture';

  async generate(brief: TeacherBrief): Promise<unknown> {
    return fixtureSpec(brief);
  }

  async patch(current: WidgetSpec, instruction: string): Promise<unknown> {
    return {
      ...current,
      metadata: {
        ...current.metadata,
        summary: `${current.metadata.summary} Revision: ${instruction.slice(0, 120)}`,
      },
    } satisfies WidgetSpec;
  }

  async repair(candidate: unknown): Promise<unknown> {
    return candidate;
  }

  async moderate(): Promise<ModerationDecision> {
    return { safe: true, categories: [], reason: 'Fixture content is safe.' };
  }
}
