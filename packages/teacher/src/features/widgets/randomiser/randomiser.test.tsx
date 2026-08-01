import React from 'react';
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Randomiser from './randomiser';
import { useChoiceManager } from './hooks';

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
  useModal: () => ({ showModal: vi.fn(), hideModal: vi.fn() })
}));
vi.mock('../../../contexts/ConfettiContext', () => ({
  useConfetti: () => ({ triggerConfetti: vi.fn() })
}));
vi.mock('../shared/components', () => ({ RandomiserControlBar: () => null }));

describe('Randomiser', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('restores removed choices when opened in a compact panel', () => {
    render(<Randomiser savedState={{
      input: 'Ada\nBea',
      choices: ['Ada', 'Bea'],
      removedChoices: ['Ada']
    }} />);

    expect(vi.mocked(useChoiceManager)).toHaveBeenCalledWith(expect.objectContaining({
      initialRemovedChoices: ['Ada']
    }));
  });
});
