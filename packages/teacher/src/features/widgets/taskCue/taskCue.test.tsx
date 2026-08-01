import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TaskCue from './taskCue';

vi.mock('./change.wav', () => ({ default: 'change.wav' }));

const playMock = vi.fn(() => Promise.resolve());

describe('TaskCue', () => {
  beforeEach(() => {
    vi.stubGlobal('Audio', vi.fn(() => ({ play: playMock })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('restores and publishes the selected task mode', async () => {
    const onStateChange = vi.fn();
    render(<TaskCue savedState={{ index: 3 }} onStateChange={onStateChange} />);

    expect(screen.getByText('Work alone')).toBeInTheDocument();

    await userEvent.click(screen.getByTitle('Click to cycle to next state'));

    expect(screen.getByText('Work together')).toBeInTheDocument();
    expect(onStateChange).toHaveBeenCalledWith({ index: 4 });
  });
});
