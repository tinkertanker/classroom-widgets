import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAudioVolumeStore } from '../../../store/audioVolumeStore';
import VolumeControl from './VolumeControl';

describe('VolumeControl', () => {
  beforeEach(() => {
    localStorage.clear();
    useAudioVolumeStore.setState({ volume: 1, lastAudibleVolume: 1 });
  });

  it('starts at full volume and mutes while opening the slider on the first click', () => {
    render(<VolumeControl />);

    const muteButton = screen.getByRole('button', { name: 'Mute app sounds' });
    expect(useAudioVolumeStore.getState().volume).toBe(1);

    fireEvent.click(muteButton);

    expect(screen.getByRole('button', { name: 'Unmute app sounds' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('slider', { name: 'App volume' })).toHaveValue('0');
    expect(useAudioVolumeStore.getState().volume).toBe(0);
  });

  it('sets volume with the slider and restores the last audible level after muting', () => {
    render(<VolumeControl />);

    fireEvent.click(screen.getByRole('button', { name: 'Mute app sounds' }));
    fireEvent.change(screen.getByRole('slider', { name: 'App volume' }), { target: { value: '35' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mute app sounds' }));
    fireEvent.click(screen.getByRole('button', { name: 'Unmute app sounds' }));

    expect(screen.getByRole('slider', { name: 'App volume' })).toHaveValue('35');
    expect(useAudioVolumeStore.getState().volume).toBe(0.35);
  });

  it('closes on Escape and returns focus to the mute button', () => {
    render(<VolumeControl />);

    fireEvent.click(screen.getByRole('button', { name: 'Mute app sounds' }));
    fireEvent.keyDown(document, { key: 'Escape' });

    const button = screen.getByRole('button', { name: 'Unmute app sounds' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
  });

  it('consumes Escape before global app shortcuts can handle it', () => {
    const globalEscapeHandler = vi.fn();
    document.addEventListener('keydown', globalEscapeHandler);
    render(<VolumeControl />);

    fireEvent.click(screen.getByRole('button', { name: 'Mute app sounds' }));
    fireEvent.keyDown(screen.getByRole('slider', { name: 'App volume' }), { key: 'Escape' });

    expect(globalEscapeHandler).not.toHaveBeenCalled();
    document.removeEventListener('keydown', globalEscapeHandler);
  });

  it('drops below expanded session details on narrow screens', () => {
    render(<VolumeControl avoidSessionBanner />);

    fireEvent.click(screen.getByRole('button', { name: 'Mute app sounds' }));

    expect(screen.getByRole('slider', { name: 'App volume' }).parentElement?.parentElement)
      .toHaveClass('max-[540px]:mt-16');
  });
});
