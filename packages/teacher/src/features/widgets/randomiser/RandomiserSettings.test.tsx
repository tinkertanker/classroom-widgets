import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RandomiserSettings from './RandomiserSettings';

describe('RandomiserSettings', () => {
  afterEach(() => {
    cleanup();
    delete window.classroomWidgetPanel;
  });

  it('reads saved lists from the compact panel bridge when it is available', () => {
    const list = {
      id: 'saved-1',
      name: 'Class names',
      type: 'randomiser' as const,
      choices: ['Ada'],
      createdAt: 1,
      updatedAt: 1
    };
    const getRandomiserLists = vi.fn(() => [list]);
    let notifyListsChanged: (lists: typeof list[]) => void = () => undefined;
    window.classroomWidgetPanel = {
      receiveSnapshot: vi.fn(),
      getRandomiserLists,
      subscribeRandomiserLists: (listener) => {
        notifyListsChanged = listener;
        listener([list]);
        return () => undefined;
      },
      saveRandomiserList: vi.fn(),
      deleteRandomiserList: vi.fn(),
      takePendingState: vi.fn(() => null)
    };

    render(
      <RandomiserSettings
        choices={['Ada']}
        removedChoices={[]}
        onUpdateChoices={vi.fn()}
        onUpdateRemovedChoices={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Saved Lists' }));

    expect(getRandomiserLists).toHaveBeenCalled();
    expect(screen.getByText('Class names')).toBeInTheDocument();

    act(() => notifyListsChanged([]));
    expect(screen.queryByText('Class names')).not.toBeInTheDocument();
  });
});
