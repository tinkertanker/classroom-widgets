import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RandomiserSettings from './RandomiserSettings';

describe('RandomiserSettings', () => {
  afterEach(() => {
    cleanup();
    delete window.classroomWidgetPanel;
  });

  it('reads saved lists from the compact panel bridge when it is available', () => {
    const getRandomiserLists = vi.fn(() => []);
    window.classroomWidgetPanel = {
      receiveSnapshot: vi.fn(),
      getRandomiserLists,
      saveRandomiserList: vi.fn(),
      deleteRandomiserList: vi.fn()
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
  });
});
