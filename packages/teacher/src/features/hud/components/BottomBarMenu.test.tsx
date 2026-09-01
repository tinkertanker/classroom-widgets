import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BottomBarMenu from './BottomBarMenu';

const { isDesktopDashboardMode } = vi.hoisted(() => ({
  isDesktopDashboardMode: vi.fn()
}));

vi.mock('@shared/hooks/useWorkspace', () => ({
  useWorkspace: () => ({ setBackground: vi.fn() }),
  useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }),
  useBottomBar: () => ({})
}));

vi.mock('../../../store/workspaceStore.simple', () => ({
  useWorkspaceStore: (selector: (state: {
    bottomBar: { voiceControlEnabled: boolean };
    updateBottomBar: ReturnType<typeof vi.fn>;
    layoutFormat: 'canvas';
  }) => unknown) => selector({
    bottomBar: { voiceControlEnabled: false },
    updateBottomBar: vi.fn(),
    layoutFormat: 'canvas'
  })
}));

vi.mock('@shared/hooks/useWidget', () => ({
  useWidgets: () => ({ removeAll: vi.fn() })
}));

vi.mock('@shared/utils/dashboardMode', () => ({ isDesktopDashboardMode }));

describe('BottomBarMenu', () => {
  beforeEach(() => {
    isDesktopDashboardMode.mockReturnValue(false);
  });

  it('links to the macOS releases immediately above About', () => {
    render(<BottomBarMenu onClose={vi.fn()} onToggleLayout={vi.fn()} />);

    const downloadLink = screen.getByRole('link', { name: 'Get macOS app' });
    const aboutLink = screen.getByRole('link', { name: 'About' });

    expect(downloadLink).toHaveAttribute(
      'href',
      'https://github.com/tinkertanker/classroom-widgets/releases'
    );
    expect(downloadLink).toHaveAttribute('target', '_blank');
    expect(downloadLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(downloadLink.nextElementSibling).toBe(aboutLink);
  });

  it('omits the download link inside the installed macOS app', () => {
    isDesktopDashboardMode.mockReturnValue(true);

    render(<BottomBarMenu onClose={vi.fn()} onToggleLayout={vi.fn()} />);

    expect(screen.queryByRole('link', { name: 'Get macOS app' })).not.toBeInTheDocument();
  });
});
