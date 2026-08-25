import React, { act } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAudioVolumeStore } from '../../../store/audioVolumeStore';
import VolumeControl from './VolumeControl';

describe('VolumeControl', () => {
  beforeEach(() => {
    localStorage.clear();
    useAudioVolumeStore.setState({ volume: 1, lastAudibleVolume: 1 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the slider on hover and turns red when clicked to mute', () => {
    render(<VolumeControl />);

    const muteButton = screen.getByRole('button', { name: 'Mute app sounds' });
    expect(useAudioVolumeStore.getState().volume).toBe(1);
    fireEvent.mouseEnter(muteButton.parentElement!);

    expect(muteButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('slider', { name: 'App volume' })).toHaveValue('100');

    fireEvent.click(muteButton);

    expect(screen.getByRole('button', { name: 'Unmute app sounds' }))
      .toHaveClass('text-dusty-rose-600');
    expect(screen.getByRole('slider', { name: 'App volume' })).toHaveValue('0');
    expect(useAudioVolumeStore.getState().volume).toBe(0);
  });

  it('keeps the slider open long enough to cross the gap, then hides it', () => {
    vi.useFakeTimers();
    render(<VolumeControl />);

    const control = screen.getByRole('button', { name: 'Mute app sounds' }).parentElement!;
    fireEvent.mouseEnter(control);
    fireEvent.mouseLeave(control);

    expect(screen.getByRole('button', { name: 'Mute app sounds' })).toHaveAttribute('aria-expanded', 'true');

    fireEvent.mouseEnter(control);
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByRole('button', { name: 'Mute app sounds' })).toHaveAttribute('aria-expanded', 'true');

    fireEvent.mouseLeave(control);
    act(() => vi.advanceTimersByTime(499));
    expect(screen.getByRole('button', { name: 'Mute app sounds' })).toHaveAttribute('aria-expanded', 'true');

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole('button', { name: 'Mute app sounds' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('stays open when hover ends while focus remains on the slider', () => {
    vi.useFakeTimers();
    render(<VolumeControl />);

    const control = screen.getByRole('button', { name: 'Mute app sounds' }).parentElement!;
    fireEvent.mouseEnter(control);
    act(() => screen.getByRole('slider', { name: 'App volume' }).focus());
    fireEvent.mouseLeave(control);
    act(() => vi.advanceTimersByTime(500));

    expect(screen.getByRole('button', { name: 'Mute app sounds' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('slider', { name: 'App volume' })).toHaveFocus();
  });

  it('stays open when focus leaves while the pointer remains over the control', () => {
    render(
      <>
        <VolumeControl />
        <button type="button">Outside</button>
      </>
    );

    const muteButton = screen.getByRole('button', { name: 'Mute app sounds' });
    fireEvent.mouseEnter(muteButton.parentElement!);
    act(() => muteButton.focus());
    act(() => screen.getByRole('button', { name: 'Outside' }).focus());

    expect(muteButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('sets volume with the slider and restores the last audible level after muting', () => {
    render(<VolumeControl />);

    const muteButton = screen.getByRole('button', { name: 'Mute app sounds' });
    fireEvent.mouseEnter(muteButton.parentElement!);
    fireEvent.click(muteButton);
    fireEvent.change(screen.getByRole('slider', { name: 'App volume' }), { target: { value: '35' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mute app sounds' }));
    fireEvent.click(screen.getByRole('button', { name: 'Unmute app sounds' }));

    expect(screen.getByRole('slider', { name: 'App volume' })).toHaveValue('35');
    expect(useAudioVolumeStore.getState().volume).toBe(0.35);
  });

  it('closes on Escape and returns focus to the mute button', () => {
    render(<VolumeControl />);

    const muteButton = screen.getByRole('button', { name: 'Mute app sounds' });
    fireEvent.mouseEnter(muteButton.parentElement!);
    fireEvent.click(muteButton);
    fireEvent.keyDown(document, { key: 'Escape' });

    const button = screen.getByRole('button', { name: 'Unmute app sounds' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
  });

  it('consumes Escape before global app shortcuts can handle it', () => {
    const globalEscapeHandler = vi.fn();
    document.addEventListener('keydown', globalEscapeHandler);
    render(<VolumeControl />);

    const muteButton = screen.getByRole('button', { name: 'Mute app sounds' });
    fireEvent.mouseEnter(muteButton.parentElement!);
    fireEvent.click(muteButton);
    fireEvent.keyDown(screen.getByRole('slider', { name: 'App volume' }), { key: 'Escape' });

    expect(globalEscapeHandler).not.toHaveBeenCalled();
    document.removeEventListener('keydown', globalEscapeHandler);
  });

  it('drops below expanded session details on narrow screens', () => {
    render(<VolumeControl avoidSessionBanner />);

    const muteButton = screen.getByRole('button', { name: 'Mute app sounds' });
    fireEvent.mouseEnter(muteButton.parentElement!);

    expect(screen.getByRole('slider', { name: 'App volume' }).parentElement?.parentElement)
      .toHaveClass('max-[540px]:mt-16');
  });
});
