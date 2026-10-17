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

vi.mock('../../../store/workspaceStore', () => ({
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

  it.each([false, true])('offers runtime shortener settings only in desktop mode (desktop: %s)', (desktop) => {
    isDesktopDashboardMode.mockReturnValue(desktop);
    renderMenu();
    expect(screen.queryByText('Link Shortener…') !== null).toBe(desktop);
  });

  it('omits the download link inside the installed desktop app', () => {
    isDesktopDashboardMode.mockReturnValue(true);

    renderMenu();

    expect(screen.queryByRole('link', { name: 'Get desktop apps' })).not.toBeInTheDocument();
  });
});
