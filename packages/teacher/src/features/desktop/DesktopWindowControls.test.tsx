import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesktopWindowControls from './DesktopWindowControls';

describe('DesktopWindowControls', () => {
  it('expands the compact overlay into the canvas', () => {
    const onModeChange = vi.fn();

    render(
      <DesktopWindowControls
        mode="compact"
        onModeChange={onModeChange}
        compactLayout="row"
        onCompactLayoutChange={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open canvas' }));

    expect(onModeChange).toHaveBeenCalledWith('canvas');
    expect(screen.queryByText('Canvas')).not.toBeInTheDocument();
    expect(screen.queryByText('Row')).not.toBeInTheDocument();
  });

  it('returns the canvas to the compact overlay', () => {
    const onModeChange = vi.fn();

    render(
      <DesktopWindowControls
        mode="canvas"
        onModeChange={onModeChange}
        compactLayout="row"
        onCompactLayoutChange={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Switch to compact overlay' }));

    expect(onModeChange).toHaveBeenCalledWith('compact');
  });

  it('switches the compact widget tray between row and column', () => {
    const onCompactLayoutChange = vi.fn();

    render(
      <DesktopWindowControls
        mode="compact"
        onModeChange={vi.fn()}
        compactLayout="row"
        onCompactLayoutChange={onCompactLayoutChange}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Arrange widgets in a column' }));

    expect(onCompactLayoutChange).toHaveBeenCalledWith('column');
  });
});
