import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import Sticker from './sticker';

vi.mock('../../../store/workspaceStore.simple', () => ({
  useWorkspaceStore: (selector: (state: { theme: string }) => unknown) => selector({ theme: 'light' })
}));

// Stand-ins for the real SVGs so a test can tell which sticker type rendered and
// which colour class it was handed.
vi.mock('./CustomStickerIcons', () => {
  const mockIcon = (testId: string) => ({ className }: { className?: string }) => (
    <div data-testid={testId} className={className} />
  );
  return {
    CustomThumbsUp: mockIcon('icon-thumbsup'),
    CustomHeart: mockIcon('icon-heart'),
    CustomStar: mockIcon('icon-star'),
    CustomSmile: mockIcon('icon-smile'),
    CustomArrowUp: mockIcon('icon-arrow'),
    CustomLocationDot: mockIcon('icon-marker'),
    CustomRainbow: mockIcon('icon-rainbow'),
    CustomCheck: mockIcon('icon-check')
  };
});

const stickerRoot = () => screen.getByTitle('Click to change color and rotation');

afterEach(() => {
  vi.clearAllMocks();
});

describe('Sticker', () => {
  test('renders the sticker type recorded in savedState', () => {
    render(<Sticker savedState={{ colorIndex: 0, stickerType: 'heart', rotation: 10 }} />);

    expect(screen.getByTestId('icon-heart')).toBeInTheDocument();
    expect(stickerRoot()).toHaveStyle({ transform: 'rotate(10deg)' });
  });

  test('falls back to a star when savedState carries no sticker type', () => {
    render(<Sticker savedState={{ colorIndex: 2 }} />);

    expect(screen.getByTestId('icon-star')).toBeInTheDocument();
  });

  test('ignores a legacy stampType value on savedState', () => {
    // A repo-wide grep finds no producer of `stampType` and no storage
    // migration that writes it, so this shape cannot occur in practice; the
    // test pins the behaviour now that the fallback has been removed.
    render(<Sticker savedState={{ colorIndex: 0, stampType: 'heart' } as never} />);

    expect(screen.getByTestId('icon-star')).toBeInTheDocument();
    expect(screen.queryByTestId('icon-heart')).not.toBeInTheDocument();
  });

  test('adopts a savedState changed externally after mount', () => {
    const onStateChange = vi.fn();
    const { rerender } = render(
      <Sticker savedState={{ colorIndex: 0, stickerType: 'heart', rotation: 0 }} onStateChange={onStateChange} />
    );

    expect(screen.getByTestId('icon-heart')).toBeInTheDocument();

    rerender(
      <Sticker savedState={{ colorIndex: 3, stickerType: 'smile', rotation: 20 }} onStateChange={onStateChange} />
    );

    expect(screen.getByTestId('icon-smile')).toBeInTheDocument();
    expect(screen.getByTestId('icon-smile').className).toContain('text-blue-500');
    expect(stickerRoot()).toHaveStyle({ transform: 'rotate(20deg)' });
    // Adopting the parent's value is not an edit, so it must not be echoed back.
    expect(onStateChange).not.toHaveBeenCalled();
  });

  test('keeps a re-rendered savedState from resetting the fallback colour', () => {
    const savedState = { stickerType: 'star' };
    const { rerender } = render(<Sticker savedState={savedState} />);

    const initialColour = screen.getByTestId('icon-star').className;

    // A parent that hands back an equal-but-rebuilt object must not re-roll it.
    rerender(<Sticker savedState={{ ...savedState }} />);

    expect(screen.getByTestId('icon-star').className).toBe(initialColour);
  });

  test('restores the colour and rotation it saved across a remount', () => {
    const onStateChange = vi.fn();
    const { unmount } = render(
      <Sticker savedState={{ colorIndex: 0, stickerType: 'check', rotation: 0 }} onStateChange={onStateChange} />
    );

    fireEvent.click(stickerRoot());

    expect(onStateChange).toHaveBeenCalledTimes(1);
    const saved = onStateChange.mock.calls[0][0];
    expect(saved.stickerType).toBe('check');
    expect(saved.colorIndex).toBe(1);

    const colourClass = screen.getByTestId('icon-check').className;
    const rotationStyle = stickerRoot().style.transform;

    unmount();

    render(<Sticker savedState={saved} />);

    expect(screen.getByTestId('icon-check').className).toBe(colourClass);
    expect(stickerRoot().style.transform).toBe(rotationStyle);
    expect(rotationStyle).toBe(`rotate(${saved.rotation}deg)`);
  });
});
