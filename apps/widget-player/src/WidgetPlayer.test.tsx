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
