import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { isWidgetSpec, type WidgetSpec } from '@classroom-widgets/widget-spec';

import { retrievalPracticeFixture } from './fixtures/retrievalPractice';
import { WidgetPlayer } from './WidgetPlayer';

describe('WidgetPlayer', () => {
  it('runs the accessible retrieval fixture from answers through feedback and retry', async () => {
    const user = userEvent.setup();
    expect(isWidgetSpec(retrievalPracticeFixture)).toBe(true);

    render(<WidgetPlayer spec={retrievalPracticeFixture} />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'How plants make food' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Nothing is sent to your teacher/)).toBeInTheDocument();

    const checkButton = screen.getByRole('button', { name: 'Check answers' });
    expect(checkButton).toBeDisabled();

    await user.click(screen.getByRole('radio', { name: 'Sunlight' }));
    await user.click(screen.getByRole('checkbox', { name: 'Water' }));
    await user.click(screen.getByRole('checkbox', { name: 'Carbon dioxide' }));
    await user.type(
      screen.getByRole('textbox', { name: /Name the gas released/ }),
      '  OXYGEN  ',
    );

    expect(checkButton).toBeEnabled();
    await user.click(checkButton);

    expect(screen.getByText('3 of 3')).toBeInTheDocument();
    expect(screen.getByText(/Everything is correct/)).toBeInTheDocument();
    expect(screen.getAllByRole('status').length).toBeGreaterThanOrEqual(4);
    expect(screen.getByRole('radio', { name: 'Sunlight' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByRole('radio', { name: 'Sunlight' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Check answers' })).toBeDisabled();
  });

  it('supports keyboard-only selection with native controls', async () => {
    const user = userEvent.setup();
    render(<WidgetPlayer spec={retrievalPracticeFixture} />);

    await user.tab();
    const firstChoice = screen.getByRole('radio', { name: 'Sunlight' });
    expect(firstChoice).toHaveFocus();
    await user.keyboard('[Space]');
    expect(firstChoice).toBeChecked();
  });

  it('updates constrained values and plots without executing authored code', () => {
    const spec: WidgetSpec = {
      schemaVersion: '1.0',
      id: 'motion-explorer',
      metadata: {
        title: 'Motion explorer',
        summary: 'Change the distance and inspect the graph.',
      },
      theme: { accent: 'sky', colourScheme: 'light', density: 'comfortable' },
      assets: [],
      variables: [
        {
          id: 'distance',
          kind: 'number',
          label: 'Distance',
          initial: 2,
          minimum: 0,
          maximum: 10,
          step: 1,
          unit: 'm',
        },
      ],
      screens: [
        {
          id: 'explore',
          components: [
            {
              id: 'distance-control',
              kind: 'numberControl',
              variableId: 'distance',
              presentation: 'slider',
            },
            {
              id: 'double-distance',
              kind: 'valueDisplay',
              label: 'Double distance',
              expression: {
                kind: 'binary',
                operator: 'multiply',
                left: { kind: 'variable', variableId: 'distance' },
                right: { kind: 'literal', value: 2 },
              },
              decimalPlaces: 1,
              unit: 'm',
            },
            {
              id: 'distance-plot',
              kind: 'plot',
              title: 'Distance line',
              domain: {
                variableId: 'distance',
                label: 'Time',
                minimum: 0,
                maximum: 10,
                step: 1,
                unit: 's',
              },
              range: { label: 'Distance', minimum: 0, maximum: 20, unit: 'm' },
              series: [
                {
                  id: 'line',
                  label: 'Distance',
                  colour: 'sky',
                  yExpression: {
                    kind: 'binary',
                    operator: 'multiply',
                    left: { kind: 'variable', variableId: 'distance' },
                    right: { kind: 'literal', value: 2 },
                  },
                },
              ],
              showGrid: true,
              showLegend: true,
            },
          ],
        },
      ],
    };

    render(<WidgetPlayer spec={spec} />);
    expect(screen.getByText('4.0 m')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Distance line/ })).toBeInTheDocument();

    const slider = screen.getByRole('slider', { name: /Distance/ });
    fireEvent.change(slider, { target: { value: '3' } });
    expect(screen.getByText('6.0 m')).toBeInTheDocument();
  });

  it('uses only the configured asset API base and encodes the declared asset ID', () => {
    const spec: WidgetSpec = {
      ...retrievalPracticeFixture,
      id: 'image-widget',
      assets: [
        {
          id: 'leaf-image',
          kind: 'image',
          mediaType: 'image/png',
          width: 640,
          height: 480,
          byteLength: 1200,
          sha256: 'a'.repeat(64),
        },
      ],
      screens: [
        {
          id: 'image-screen',
          components: [
            {
              id: 'leaf',
              kind: 'image',
              assetId: 'leaf-image',
              altText: 'A green leaf',
              decorative: false,
              fit: 'contain',
            },
          ],
        },
      ],
    };

    const { rerender } = render(
      <WidgetPlayer spec={spec} assetBaseUrl="https://studio.example/v1/assets/" />,
    );
    expect(screen.getByRole('img', { name: 'A green leaf' })).toHaveAttribute(
      'src',
      'https://studio.example/v1/assets/leaf-image',
    );

    rerender(<WidgetPlayer spec={spec} assetBaseUrl="javascript:alert(1)" />);
    expect(screen.getByRole('img', { name: /Image unavailable/ })).toBeInTheDocument();
    expect(document.querySelector('img')).not.toBeInTheDocument();

    rerender(
      <WidgetPlayer spec={spec} assetBaseUrl="classroom-widget-asset://assets/" />,
    );
    expect(screen.getByRole('img', { name: 'A green leaf' })).toHaveAttribute(
      'src',
      'classroom-widget-asset://assets/leaf-image',
    );

    rerender(
      <WidgetPlayer spec={spec} assetBaseUrl="classroom-widget://studio/assets/" />,
    );
    expect(screen.getByRole('img', { name: 'A green leaf' })).toHaveAttribute(
      'src',
      'classroom-widget://studio/assets/leaf-image',
    );
  });

  it('completes, checks and retries matching and sorting responses', async () => {
    const user = userEvent.setup();
    const spec = matchingAndSortingSpec();
    expect(isWidgetSpec(spec)).toBe(true);

    render(<WidgetPlayer spec={spec} />);

    const checkButton = screen.getByRole('button', { name: 'Check answers' });
    expect(checkButton).toBeDisabled();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sun' }), 'moon-target');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Moon' }), 'moon-target');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Whale' }), 'mammal');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Robin' }), 'bird');

    expect(checkButton).toBeEnabled();
    await user.click(checkButton);
    expect(screen.getByText('1 of 2')).toBeInTheDocument();
    expect(screen.getByText(/Review the matches and try again/)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Sun' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByRole('combobox', { name: 'Sun' })).toHaveValue('');
    expect(screen.getByRole('combobox', { name: 'Whale' })).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Check answers' })).toBeDisabled();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sun' }), 'sun-target');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Moon' }), 'moon-target');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Whale' }), 'mammal');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Robin' }), 'bird');
    await user.click(screen.getByRole('button', { name: 'Check answers' }));

    expect(screen.getByText('2 of 2')).toBeInTheDocument();
    expect(screen.getByText(/Everything is correct/)).toBeInTheDocument();
  });

  it('supports keyboard sequencing, correctness and retry', async () => {
    const user = userEvent.setup();
    const spec = sequencingSpec();
    expect(isWidgetSpec(spec)).toBe(true);

    render(<WidgetPlayer spec={spec} />);

    const moveEarlier = screen.getByRole('button', { name: 'Move First step earlier' });
    moveEarlier.focus();
    expect(moveEarlier).toHaveFocus();
    await user.keyboard('[Enter]');

    const checkButton = screen.getByRole('button', { name: 'Check answers' });
    expect(checkButton).toBeEnabled();
    await user.click(checkButton);
    expect(screen.getByText('1 of 1')).toBeInTheDocument();
    expect(screen.getByText(/Everything is correct/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByRole('button', { name: 'Check answers' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move First step earlier' })).toBeEnabled();
  });

  it('localises student controls and accessibility labels for Malay activities', async () => {
    const user = userEvent.setup();
    const spec = matchingAndSortingSpec();
    spec.metadata = {
      ...spec.metadata,
      locale: 'ms-SG',
      subject: 'languages',
      level: 'secondary',
      learningObjective: 'Gunakan bahasa yang sesuai mengikut khalayak dan situasi.',
    };

    render(<WidgetPlayer spec={spec} reportEndpoint="/v1/reports/example" />);

    expect(screen.getByText('Bahasa')).toBeInTheDocument();
    expect(screen.getByText('Sekolah menengah')).toBeInTheDocument();
    expect(screen.getByText('Matlamat pembelajaran')).toBeInTheDocument();
    expect(screen.getByText(/Pilih padanan bagi setiap item/)).toBeInTheDocument();
    expect(screen.getAllByRole('option', { name: 'Pilih padanan' })).toHaveLength(2);
    expect(screen.getByText('Letakkan setiap item dalam satu kategori.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Semak jawapan' })).toBeDisabled();
    expect(screen.getByText('Laporkan widget ini')).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sun' }), 'sun-target');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Moon' }), 'moon-target');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Whale' }), 'mammal');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Robin' }), 'bird');
    await user.click(screen.getByRole('button', { name: 'Semak jawapan' }));

    expect(screen.getByText('2 daripada 2')).toBeInTheDocument();
    expect(screen.getByText('Semua jawapan betul.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cuba lagi' })).toBeInTheDocument();
  });

  it('marks fallback player chrome as English without changing authored locale', () => {
    const spec = matchingAndSortingSpec();
    spec.metadata.locale = 'fr-FR';

    const { rerender } = render(<WidgetPlayer spec={spec} />);

    expect(document.documentElement).toHaveAttribute('lang', 'fr-FR');
    expect(screen.getByRole('button', { name: 'Check answers' })).toHaveAttribute('lang', 'en');
    expect(screen.getByText(/Choose the match for each item/)).toHaveAttribute('lang', 'en');

    spec.metadata.locale = 'msa';
    rerender(<WidgetPlayer spec={spec} />);
    expect(document.documentElement).toHaveAttribute('lang', 'msa');
    expect(screen.getByRole('button', { name: 'Check answers' })).toHaveAttribute('lang', 'en');

    const sequence = sequencingSpec();
    sequence.metadata.locale = 'fr-FR';
    const firstItem = sequence.screens[0]?.components[0];
    if (firstItem?.kind !== 'sequencing') throw new Error('Expected sequencing fixture');
    firstItem.items[0]!.content = { kind: 'text', text: 'Première étape' };

    rerender(<WidgetPlayer spec={sequence} />);
    const moveEarlier = screen.getByRole('button', { name: 'Move Première étape earlier' });
    const labelledBy = moveEarlier.getAttribute('aria-labelledby')?.split(' ') ?? [];
    expect(document.getElementById(labelledBy[0]!)).toHaveAttribute('lang', 'en');
    expect(document.getElementById(labelledBy[1]!)).toHaveAttribute('lang', 'fr-FR');
    expect(document.getElementById(labelledBy[2]!)).toHaveAttribute('lang', 'en');
  });

  it('exposes hotspots as keyboard-operable labelled buttons', async () => {
    const user = userEvent.setup();
    const spec = hotspotsSpec();
    expect(isWidgetSpec(spec)).toBe(true);

    render(<WidgetPlayer spec={spec} assetBaseUrl="https://studio.example/v1/assets/" />);

    const hotspot = screen.getByRole('button', { name: 'Nucleus' });
    expect(hotspot).toHaveAttribute('aria-pressed', 'false');
    hotspot.focus();
    expect(hotspot).toHaveFocus();
    await user.keyboard('[Space]');

    expect(hotspot).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Nucleus. Controls the activities of the cell.',
    );
  });

  it('fails closed with a clear message for a future component kind', () => {
    const futureSpec = {
      ...retrievalPracticeFixture,
      screens: [
        {
          id: 'future-screen',
          components: [{ id: 'future-component', kind: 'hologram' }],
        },
      ],
    } as unknown as WidgetSpec;

    render(<WidgetPlayer spec={futureSpec} />);

    expect(
      screen.getByRole('heading', { name: 'This part needs a newer player' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/“hologram” component/)).toBeInTheDocument();
  });
});

function baseSpec(overrides: Pick<WidgetSpec, 'id' | 'screens'>): WidgetSpec {
  return {
    schemaVersion: '1.0',
    id: overrides.id,
    metadata: {
      title: 'Renderer behaviour check',
      summary: 'Exercise one supported student interaction from start to finish.',
    },
    theme: { accent: 'sage', colourScheme: 'light', density: 'comfortable' },
    assets: [],
    variables: [],
    screens: overrides.screens,
  };
}

function matchingAndSortingSpec(): WidgetSpec {
  return baseSpec({
    id: 'matching-sorting-check',
    screens: [
      {
        id: 'main',
        components: [
          {
            id: 'space-match',
            kind: 'matching',
            prompt: 'Match each object to its description.',
            items: [
              { id: 'sun', content: { kind: 'text', text: 'Sun' } },
              { id: 'moon', content: { kind: 'text', text: 'Moon' } },
            ],
            targets: [
              { id: 'sun-target', content: { kind: 'text', text: 'A star' } },
              { id: 'moon-target', content: { kind: 'text', text: 'A satellite' } },
            ],
            correctMatches: [
              { itemId: 'sun', targetId: 'sun-target' },
              { itemId: 'moon', targetId: 'moon-target' },
            ],
            shuffleItems: false,
            feedback: {
              correct: 'Every object has the correct description.',
              incorrect: 'Review the matches and try again.',
            },
          },
          {
            id: 'animal-sort',
            kind: 'sorting',
            prompt: 'Sort each animal into its group.',
            items: [
              { id: 'whale', content: { kind: 'text', text: 'Whale' } },
              { id: 'robin', content: { kind: 'text', text: 'Robin' } },
            ],
            categories: [
              { id: 'mammal', label: 'Mammal' },
              { id: 'bird', label: 'Bird' },
            ],
            correctPlacements: [
              { itemId: 'whale', categoryId: 'mammal' },
              { itemId: 'robin', categoryId: 'bird' },
            ],
            shuffleItems: false,
            feedback: {
              correct: 'Both animals are in the correct group.',
              incorrect: 'Review the animal groups and try again.',
            },
          },
        ],
      },
    ],
  });
}

function sequencingSpec(): WidgetSpec {
  return baseSpec({
    id: 'sequencing-check',
    screens: [
      {
        id: 'main',
        components: [
          {
            id: 'two-step-sequence',
            kind: 'sequencing',
            prompt: 'Put the two steps in order.',
            items: [
              { id: 'first', content: { kind: 'text', text: 'First step' } },
              { id: 'second', content: { kind: 'text', text: 'Second step' } },
            ],
            correctOrder: ['first', 'second'],
            feedback: {
              correct: 'The steps are in the correct order.',
              incorrect: 'Move the steps and try again.',
            },
          },
        ],
      },
    ],
  });
}

function hotspotsSpec(): WidgetSpec {
  const spec = baseSpec({
    id: 'hotspots-check',
    screens: [
      {
        id: 'main',
        components: [
          {
            id: 'cell-hotspots',
            kind: 'hotspots',
            prompt: 'Choose a cell structure.',
            imageAssetId: 'cell-image',
            altText: 'A labelled plant cell diagram viewed through a microscope.',
            hotspots: [
              {
                id: 'nucleus',
                label: 'Nucleus',
                reveal: 'Controls the activities of the cell.',
                shape: { kind: 'circle', centreX: 0.5, centreY: 0.5, radius: 0.1 },
              },
            ],
          },
        ],
      },
    ],
  });
  spec.assets = [
    {
      id: 'cell-image',
      kind: 'image',
      mediaType: 'image/png',
      width: 800,
      height: 600,
      byteLength: 1_024,
      sha256: 'a'.repeat(64),
    },
  ];
  return spec;
}
