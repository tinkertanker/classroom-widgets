import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Randomiser from './randomiser';
import { useChoiceManager, useSlotMachineAnimation } from './hooks';

const showModal = vi.hoisted(() => vi.fn());
const captureControlBarProps = vi.hoisted(() => vi.fn<(props: { onRandomise: () => void }) => void>());

vi.mock('./hooks', () => ({
  useChoiceManager: vi.fn(() => ({
    input: 'Ada\nBea',
    setInput: vi.fn(),
    choices: ['Ada', 'Bea'],
    removedChoices: ['Ada'],
    processChoices: vi.fn(() => ['Ada', 'Bea']),
    getActiveChoices: vi.fn(() => ['Bea']),
    removeChoice: vi.fn(),
    updateChoices: vi.fn(),
    updateRemovedChoices: vi.fn()
  })),
  useSlotMachineAnimation: vi.fn(() => ({
    selectedItemIndex: 0,
    isSpinning: false,
    isLoading: false,
    displayChoices: [],
    startAnimation: vi.fn(),
    resetAnimation: vi.fn(),
    setDisplayChoices: vi.fn(),
    setIsLoading: vi.fn()
  })),
  useRandomiserAudio: vi.fn(() => ({ playCelebration: vi.fn(), stopSound: vi.fn() })),
  useResponsiveHeight: vi.fn(() => ({
    textHeight: 0,
    boxHeight: 0,
    textRef: { current: null },
    boxRef: { current: null },
    shouldAlignTop: false
  }))
}));

vi.mock('./slotMachine', () => ({ default: () => null }));
vi.mock('./RandomiserSettings', () => ({ default: () => null }));
vi.mock('../../../contexts/ModalContext', () => ({
  useModal: () => ({ showModal, hideModal: vi.fn() })
}));
vi.mock('../../../contexts/ConfettiContext', () => ({
  useConfetti: () => ({ triggerConfetti: vi.fn() })
}));
vi.mock('../shared/components', () => ({
  RandomiserControlBar: (props: { onRandomise: () => void }) => {
    captureControlBarProps(props);
    return null;
  }
}));

describe('Randomiser', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('restores removed choices when opened in a compact panel', () => {
    const updateRemovedChoices = vi.fn();
    vi.mocked(useChoiceManager).mockReturnValueOnce({
      ...vi.mocked(useChoiceManager)({}),
      updateRemovedChoices
    });
    render(<Randomiser savedState={{
      input: 'Ada\nBea',
      choices: ['Ada', 'Bea'],
      removedChoices: ['Ada']
    }} />);

    expect(vi.mocked(useChoiceManager)).toHaveBeenCalledWith(expect.objectContaining({
      initialRemovedChoices: ['Ada']
    }));
    expect(updateRemovedChoices).toHaveBeenCalledWith(['Ada']);
  });

  it('makes settings scrollable inside a compact panel viewport', () => {
    render(<Randomiser />);

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    expect(showModal).toHaveBeenCalledWith(expect.objectContaining({
      className: expect.stringContaining('max-h-[calc(100vh-1rem)] overflow-auto'),
      noPadding: true
    }));
  });

  it('never passes a removed choice to the animation when randomising', () => {
    const startAnimation = vi.fn((_choices: string[]) => null);
    vi.mocked(useSlotMachineAnimation).mockReturnValueOnce({
      ...vi.mocked(useSlotMachineAnimation)({ onAnimationComplete: vi.fn() }),
      startAnimation
    });
    vi.mocked(useChoiceManager).mockReturnValueOnce({
      ...vi.mocked(useChoiceManager)({}),
      processChoices: vi.fn(() => ['Ada', 'Bea']),
      removedChoices: ['Ada'],
      getActiveChoices: vi.fn(() => ['Bea'])
    });

    render(<Randomiser />);

    const lastCall = captureControlBarProps.mock.calls.at(-1);
    const { onRandomise } = lastCall![0];
    onRandomise();

    expect(startAnimation).toHaveBeenCalledWith(['Bea']);
    expect(startAnimation.mock.calls[0][0]).not.toContain('Ada');
  });
});
