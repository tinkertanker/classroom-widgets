import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import QRCodeWidget from './qrcode';
import { createDefaultShortenerSettings } from '@shared/utils/urlShortener';

class ResizeObserverMock {
  observe = vi.fn();
  disconnect = vi.fn();
}

const toCanvasMock = vi.fn((_canvas: unknown, _value: string, _options: unknown, callback: (error: Error | null) => void) => {
  callback(null);
});

vi.mock('qrcode', () => ({
  default: {
    toCanvas: (...args: Parameters<typeof toCanvasMock>) => toCanvasMock(...args)
  }
}));

const showModalMock = vi.fn();
const hideModalMock = vi.fn();

vi.mock('../../../contexts/ModalContext', () => ({
  useModal: () => ({ showModal: showModalMock, hideModal: hideModalMock })
}));

const useLinkShortenerMock = vi.fn();

vi.mock('@shared/hooks/useWorkspace', () => ({
  useLinkShortener: () => useLinkShortenerMock()
}));

beforeEach(() => {
  window.history.replaceState({}, '', '/?desktop=1');
  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  useLinkShortenerMock.mockReturnValue({
    settings: createDefaultShortenerSettings(),
    updateSettings: vi.fn()
  });
});

afterEach(() => {
  window.history.replaceState({}, '', '/');
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('QRCodeWidget', () => {
  test('web QR codes have no shortening controls and encode the original URL', async () => {
    window.history.replaceState({}, '', '/');
    const { rerender } = render(<QRCodeWidget />);
    expect(screen.queryByLabelText(/shorten the link first/i)).not.toBeInTheDocument();
    expect(screen.queryByTitle(/link shortener settings/i)).not.toBeInTheDocument();
    rerender(<QRCodeWidget savedState={{ url: 'https://example.com/original', title: 'Lesson', shortUrl: 'https://tinyurl.com/old' }} />);
    expect(screen.queryByRole('button', { name: /^shorten$/i })).not.toBeInTheDocument();
    await waitFor(() => expect(toCanvasMock.mock.calls.at(-1)?.[1]).toBe('https://example.com/original'));
  });

  test('renders a QR for a plain URL and publishes {url, title} through onStateChange', async () => {
    const onStateChange = vi.fn();
    render(<QRCodeWidget onStateChange={onStateChange} />);

    await userEvent.type(screen.getByPlaceholderText('https://example.com'), 'https://example.com/lesson');
    await userEvent.click(screen.getByRole('button', { name: /generate qr code/i }));

    await waitFor(() => {
      expect(onStateChange).toHaveBeenCalledWith({ url: 'https://example.com/lesson', title: '' });
    });

    await waitFor(() => {
      expect(toCanvasMock).toHaveBeenCalled();
    });
    expect(toCanvasMock.mock.calls[0][1]).toBe('https://example.com/lesson');

    // Original URL shown small, with a compact Shorten button since no shortUrl yet.
    expect(screen.getByText('https://example.com/lesson')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^shorten$/i })).toBeInTheDocument();
  });

  test('restores saved state that has no shortUrl (backward compatibility)', async () => {
    const onStateChange = vi.fn();
    render(
      <QRCodeWidget
        savedState={{ url: 'https://example.com/saved', title: 'My Link' }}
        onStateChange={onStateChange}
      />
    );

    expect(screen.getByText('My Link')).toBeInTheDocument();
    expect(screen.getByText('https://example.com/saved')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^shorten$/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(toCanvasMock).toHaveBeenCalled();
    });
    expect(toCanvasMock.mock.calls[0][1]).toBe('https://example.com/saved');
  });

  test('with "Shorten the link first" ticked, a successful shorten stores shortUrl and displays it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        text: async () => 'https://tinyurl.com/abc123'
      })
    );
    const onStateChange = vi.fn();
    render(<QRCodeWidget onStateChange={onStateChange} />);

    await userEvent.type(screen.getByPlaceholderText('https://example.com'), 'https://example.com/lesson');
    await userEvent.click(screen.getByLabelText(/shorten the link first/i));
    await userEvent.click(screen.getByRole('button', { name: /generate qr code/i }));

    await waitFor(() => {
      expect(screen.getByText('https://tinyurl.com/abc123')).toBeInTheDocument();
    });

    expect(screen.getByText('https://example.com/lesson')).toBeInTheDocument();
    expect(onStateChange).toHaveBeenCalledWith({
      url: 'https://example.com/lesson',
      title: '',
      shortUrl: 'https://tinyurl.com/abc123'
    });

    await waitFor(() => {
      expect(toCanvasMock.mock.calls.at(-1)?.[1]).toBe('https://tinyurl.com/abc123');
    });
  });

  test('a failed shorten still renders the QR code and shows the error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        text: async () => 'Error'
      })
    );
    render(<QRCodeWidget />);

    await userEvent.type(screen.getByPlaceholderText('https://example.com'), 'https://example.com/lesson');
    await userEvent.click(screen.getByLabelText(/shorten the link first/i));
    await userEvent.click(screen.getByRole('button', { name: /generate qr code/i }));

    await waitFor(() => {
      expect(screen.getByText(/could not shorten that link/i)).toBeInTheDocument();
    });

    // Falls back to the original URL for the QR code rather than blocking the teacher.
    expect(screen.getByText('https://example.com/lesson')).toBeInTheDocument();
    await waitFor(() => {
      expect(toCanvasMock.mock.calls.at(-1)?.[1]).toBe('https://example.com/lesson');
    });
  });

  test('Short.io selected without a key shows the "add a key in Settings" message and makes no fetch call', async () => {
    useLinkShortenerMock.mockReturnValue({
      settings: { provider: 'shortio', shortioApiKey: '', shortioDomain: '' },
      updateSettings: vi.fn()
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<QRCodeWidget />);

    await userEvent.type(screen.getByPlaceholderText('https://example.com'), 'https://example.com/lesson');
    await userEvent.click(screen.getByLabelText(/shorten the link first/i));
    await userEvent.click(screen.getByRole('button', { name: /generate qr code/i }));

    await waitFor(() => {
      expect(screen.getByText(/add your short\.io public api key in settings/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /open settings/i })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
