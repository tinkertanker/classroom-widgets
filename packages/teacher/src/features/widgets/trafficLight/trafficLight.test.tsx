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

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  vi.stubGlobal('Audio', vi.fn(() => ({ play: playMock })));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('TrafficLight', () => {
  test('keeps updating the light when audio playback is rejected', async () => {
    playMock.mockRejectedValueOnce(new Error('blocked'));

    render(<TrafficLight />);

    await userEvent.click(screen.getByRole('button', { name: /set traffic light to green/i }));

    expect(screen.getByText(/discuss/i)).toBeInTheDocument();
    expect(playMock).toHaveBeenCalledTimes(1);
  });

  test('restores and publishes the selected light', async () => {
    const onStateChange = vi.fn();
    render(<TrafficLight savedState={{ activeLight: '#ffa500' }} onStateChange={onStateChange} />);

    expect(screen.getByRole('button', { name: /set traffic light to orange/i })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: /set traffic light to green/i }));

    expect(onStateChange).toHaveBeenCalledWith({ activeLight: '#008000' });
  });
});
