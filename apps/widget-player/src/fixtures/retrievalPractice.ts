import type { WidgetSpec } from '@classroom-widgets/widget-spec';

export const retrievalPracticeFixture: WidgetSpec = {
  schemaVersion: '1.0',
  id: 'photosynthesis-retrieval',
  metadata: {
    title: 'How plants make food',
    summary:
      'A short retrieval check on the ingredients and products of photosynthesis.',
    subject: 'science',
    level: 'upper-primary',
    learningObjective:
      'Recall what plants need for photosynthesis and identify the gas they release.',
    estimatedMinutes: 4,
    tags: ['photosynthesis', 'retrieval-practice'],
  },
  theme: {
    accent: 'sage',
    colourScheme: 'light',
    density: 'comfortable',
  },
  assets: [],
  variables: [],
  screens: [
    {
      id: 'retrieval-check',
      title: 'Quick check',
      components: [
        {
          id: 'instructions',
          kind: 'text',
          role: 'instruction',
          text: 'Answer all three questions, then check your work. Nothing is sent to your teacher.',
        },
        {
          id: 'sunlight-question',
          kind: 'choiceQuestion',
          prompt: 'Which source provides the energy a plant needs for photosynthesis?',
          selectionMode: 'single',
          options: [
            {
              id: 'sunlight',
              content: { kind: 'text', text: 'Sunlight' },
            },
            {
              id: 'soil',
              content: { kind: 'text', text: 'Soil' },
            },
            {
              id: 'oxygen',
              content: { kind: 'text', text: 'Oxygen' },
            },
          ],
          correctOptionIds: ['sunlight'],
          shuffleOptions: false,
          feedback: {
            correct: 'Correct — sunlight supplies the energy.',
            incorrect: 'Not quite. Look for the source of energy.',
            explanation: 'Chlorophyll absorbs light energy from the Sun.',
          },
        },
        {
          id: 'ingredients-question',
          kind: 'choiceQuestion',
          prompt: 'Which two substances are used to make glucose?',
          selectionMode: 'multiple',
          options: [
            {
              id: 'water',
              content: { kind: 'text', text: 'Water' },
            },
            {
              id: 'carbon-dioxide',
              content: { kind: 'text', text: 'Carbon dioxide' },
            },
            {
              id: 'oxygen',
              content: { kind: 'text', text: 'Oxygen' },
            },
            {
              id: 'glucose',
              content: { kind: 'text', text: 'Glucose' },
            },
          ],
          correctOptionIds: ['water', 'carbon-dioxide'],
          shuffleOptions: false,
          feedback: {
            correct: 'That is right — water and carbon dioxide are the raw materials.',
            incorrect: 'Choose the two substances the plant takes in.',
          },
        },
        {
          id: 'gas-question',
          kind: 'shortAnswerQuestion',
          prompt: 'Name the gas released during photosynthesis.',
          acceptedAnswers: ['oxygen', 'oxygen gas'],
          placeholder: 'Type the gas here',
          normalisation: {
            trimWhitespace: true,
            collapseWhitespace: true,
            caseSensitive: false,
          },
          feedback: {
            correct: 'Yes — the gas released is oxygen.',
            incorrect: 'Try again. It is the gas humans need for respiration.',
          },
        },
      ],
    },
  ],
};
