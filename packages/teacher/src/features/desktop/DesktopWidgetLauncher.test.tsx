import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DesktopWidgetLauncher from './DesktopWidgetLauncher';
import { postNativeMessage } from '@shared/utils/nativeBridge';

vi.mock('../../app/App.css', () => ({}));
vi.mock('@shared/utils/nativeBridge', async () => {
  const actual = await vi.importActual<typeof import('@shared/utils/nativeBridge')>('@shared/utils/nativeBridge');
  return { ...actual, postNativeMessage: vi.fn() };
});

describe('DesktopWidgetLauncher', () => {
  beforeEach(() => {
    vi.mocked(postNativeMessage).mockClear();
  });

  it('shows only native-panel widgets and requests creation before closing', () => {
    render(<DesktopWidgetLauncher />);

    expect(screen.getByRole('button', { name: 'Timer' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Volume Monitor' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Networked' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Timer' }));

    expect(postNativeMessage).toHaveBeenNthCalledWith(1, 'classroomDashboard', {
      type: 'desktop-launcher-add-widget',
      schemaVersion: 1,
      widgetType: 1
    });
    expect(postNativeMessage).toHaveBeenNthCalledWith(2, 'classroomDashboard', {
      type: 'desktop-launcher-close',
      schemaVersion: 1
    });
  });

  it('closes without requesting a widget', () => {
    render(<DesktopWidgetLauncher />);
    fireEvent.click(screen.getByRole('button', { name: 'Close widget launcher' }));

    expect(postNativeMessage).toHaveBeenCalledWith('classroomDashboard', {
      type: 'desktop-launcher-close',
      schemaVersion: 1
    });
  });
});
