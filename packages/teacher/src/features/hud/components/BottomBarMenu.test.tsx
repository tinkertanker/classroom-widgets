import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BottomBarMenu from './BottomBarMenu';
import { ModalProvider } from '../../../contexts/ModalContext';

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

// The menu opens the link-shortener settings through useModal, which throws
// outside a provider.
function renderMenu() {
  return render(
    <ModalProvider>
      <BottomBarMenu onClose={vi.fn()} onToggleLayout={vi.fn()} />
    </ModalProvider>
  );
}

describe('BottomBarMenu', () => {
  beforeEach(() => {
    isDesktopDashboardMode.mockReturnValue(false);
  });

  it('keeps runtime shortener settings off the web menu', () => {
    renderMenu();
    expect(screen.queryByText('Link Shortener…')).not.toBeInTheDocument();
  });

  it('offers runtime shortener settings in desktop mode', () => {
    isDesktopDashboardMode.mockReturnValue(true);
    renderMenu();
    expect(screen.getByText('Link Shortener…')).toBeInTheDocument();
  });

  it('links to the macOS releases immediately above About', () => {
    renderMenu();

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

    renderMenu();

    expect(screen.queryByRole('link', { name: 'Get macOS app' })).not.toBeInTheDocument();
  });
});
