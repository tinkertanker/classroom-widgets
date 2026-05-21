import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import TrafficLight from './trafficLight';

vi.mock('../../../sounds/action_click.mp3', () => ({ default: 'action_click.mp3' }));

class ResizeObserverMock {
  observe = vi.fn();
  disconnect = vi.fn();
}

const playMock = vi.fn(() => Promise.resolve());

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  vi.stubGlobal('Audio', vi.fn(() => ({ play: playMock })));
});

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('TrafficLight', () => {
  test('lets keyboard users focus and activate each light', async () => {
    const user = userEvent.setup();
    render(<TrafficLight />);

    const redLight = screen.getByRole('button', { name: /set traffic light to red/i });
    const orangeLight = screen.getByRole('button', { name: /set traffic light to orange/i });
    const greenLight = screen.getByRole('button', { name: /set traffic light to green/i });

    await user.tab();
    expect(redLight).toHaveFocus();

    await user.tab();
    expect(orangeLight).toHaveFocus();
    await user.keyboard('{enter}');
    expect(screen.getByText(/work quietly on your own/i)).toBeInTheDocument();
    expect(orangeLight).toHaveAttribute('aria-pressed', 'true');

    await user.tab();
    expect(greenLight).toHaveFocus();
    await user.keyboard(' ');
    expect(screen.getByText(/discuss/i)).toBeInTheDocument();
    expect(greenLight).toHaveAttribute('aria-pressed', 'true');

    redLight.focus();
    await user.keyboard('{enter}');
    expect(screen.getByText(/teacher's turn/i)).toBeInTheDocument();
    expect(redLight).toHaveAttribute('aria-pressed', 'true');
  });

  test('keeps updating the light when audio playback is rejected', async () => {
    const user = userEvent.setup();
    playMock.mockRejectedValueOnce(new Error('blocked'));

    render(<TrafficLight />);

    await user.click(screen.getByRole('button', { name: /set traffic light to green/i }));

    expect(screen.getByText(/discuss/i)).toBeInTheDocument();
    expect(playMock).toHaveBeenCalledTimes(1);
  });
});
