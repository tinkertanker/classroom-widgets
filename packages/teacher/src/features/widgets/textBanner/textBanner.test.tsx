import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TextBanner from './textBanner';

const workspaceMock = vi.hoisted(() => ({ layoutFormat: 'canvas' }));

vi.mock('./hooks', () => ({
  useAutoFontSize: () => 48
}));

vi.mock('../../../store/workspaceStore.simple', () => ({
  useWorkspaceStore: (selector: (state: { layoutFormat: string }) => unknown) =>
    selector(workspaceMock)
}));

afterEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, '', '/');
});

describe('TextBanner text editor', () => {
  it('keeps the auto-size display node mounted across an editor session', async () => {
    const user = userEvent.setup();
    render(<TextBanner savedState={{ text: 'Keep fitting' }} />);

    const display = screen.getByTestId('text-banner-display');
    await user.click(screen.getByRole('button', { name: 'Edit banner' }));

    expect(display).toBeInTheDocument();
    expect(display).toHaveClass('invisible', 'pointer-events-none');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByTestId('text-banner-display')).toBe(display);
    expect(display).not.toHaveClass('invisible');
  });

  it('cycles preset colours from the displayed banner while editor choices remain transactional', async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    render(
      <TextBanner
        savedState={{ text: 'Do now', colorIndex: 0 }}
        onStateChange={onStateChange}
      />
    );

    const visibleText = screen.getAllByText('Do now').find(element => !element.closest('[aria-hidden="true"]'));
    expect(visibleText).toBeDefined();
    await user.click(visibleText!);
    expect(onStateChange).toHaveBeenCalledTimes(1);
    expect(onStateChange).toHaveBeenCalledWith(expect.objectContaining({
      colorIndex: 1,
      clickToRecolour: true
    }));
    onStateChange.mockClear();

    const displayedSurface = visibleText!.closest('.cursor-pointer');
    expect(displayedSurface).not.toBeNull();
    fireEvent.mouseDown(displayedSurface!, { clientX: 10, clientY: 10 });
    fireEvent.click(displayedSurface!, { clientX: 30, clientY: 30 });
    expect(onStateChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Edit banner' }));
    await user.click(screen.getByRole('button', { name: 'Set banner colour to Sage' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onStateChange).not.toHaveBeenCalled();
  });

  it('cycles a displayed custom colour back to the first preset', async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    render(
      <TextBanner
        savedState={{ text: 'Custom', colorIndex: 6, customColor: '#123456' }}
        onStateChange={onStateChange}
      />
    );

    const visibleText = screen.getAllByText('Custom').find(element => !element.closest('[aria-hidden="true"]'));
    await user.click(visibleText!);

    expect(onStateChange).toHaveBeenCalledTimes(1);
    expect(onStateChange).toHaveBeenCalledWith(expect.objectContaining({ colorIndex: 0 }));
  });

  it('migrates the legacy instructional sentinel to an empty banner', () => {
    render(<TextBanner savedState={{ text: 'Double-click to edit' }} />);

    expect(screen.queryByText('Double-click to edit')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add text' })).toBeInTheDocument();
  });

  it('uses the same bottom bar in the dashboard and applies colours without opening the editor', async () => {
    window.history.replaceState({}, '', '/?dashboard=1');
    const onStateChange = vi.fn();
    render(<TextBanner savedState={{ text: 'Dashboard banner' }} onStateChange={onStateChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Set banner colour to Sage' }));
    expect(onStateChange).toHaveBeenLastCalledWith(expect.objectContaining({ colorIndex: 1 }));
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it.each([
    { start: 32, button: 'Decrease text size', limit: 24 },
    { start: 212, button: 'Increase text size', limit: 220 }
  ])('clamps quick sizing at $limit and disables further changes', async ({ start, button, limit }) => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    render(<TextBanner isCompactPanel savedState={{ text: 'Bounded sizing', fontSizeCap: start }} onStateChange={onStateChange} />);

    await user.click(screen.getByRole('button', { name: button }));
    expect(onStateChange).toHaveBeenLastCalledWith(expect.objectContaining({ fontSizeCap: limit }));
    expect(screen.getByRole('button', { name: button })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: button }));
    expect(onStateChange).toHaveBeenCalledTimes(1);
  });
});
