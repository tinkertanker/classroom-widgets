import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { createDefaultShortenerSettings, type ShortenerSettings } from '@shared/utils/urlShortener';
import ShortenLink from './DesktopShortenLink';

let currentSettings: ShortenerSettings = createDefaultShortenerSettings();
const updateSettingsMock = vi.fn();
const showModalMock = vi.fn();
const hideModalMock = vi.fn();

vi.mock('@shared/hooks/useWorkspace', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/hooks/useWorkspace')>();
  return {
    ...actual,
    useLinkShortener: () => ({ settings: currentSettings, updateSettings: updateSettingsMock })
  };
});

vi.mock('../../../contexts/ModalContext', () => ({
  useModal: () => ({ showModal: showModalMock, hideModal: hideModalMock, isOpen: false })
}));

async function fillAndSubmit(url: string, alias?: string) {
  const urlInput = screen.getByPlaceholderText('https://example.com');
  fireEvent.change(urlInput, { target: { value: url } });
  if (alias) {
    const aliasInput = screen.getByPlaceholderText(/e\.g\. p5-quiz/i);
    fireEvent.change(aliasInput, { target: { value: alias } });
  }
  await userEvent.click(screen.getByRole('button', { name: /shorten link/i }));
}

beforeEach(() => {
  currentSettings = createDefaultShortenerSettings();
  updateSettingsMock.mockClear();
  showModalMock.mockClear();
  hideModalMock.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('ShortenLink', () => {
  test('shortens a link and renders the short link', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      text: async () => 'https://tinyurl.com/abc123'
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ShortenLink />);

    await fillAndSubmit('https://example.com/very/long/path');

    await waitFor(() => {
      expect(screen.getByText('https://tinyurl.com/abc123')).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('shows a provider error message to the user', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      text: async () => 'Error'
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ShortenLink />);

    await fillAndSubmit('https://example.com');

    await waitFor(() => {
      expect(screen.getByText(/could not shorten that link/i)).toBeInTheDocument();
    });
  });

  test('rejects an invalid custom ending before making a request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<ShortenLink />);

    await fillAndSubmit('https://example.com', '!!');

    await waitFor(() => {
      expect(screen.getByText(/custom endings use 3-40 letters/i)).toBeInTheDocument();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('shows a setup state for Short.io with no key and makes no request', async () => {
    currentSettings = { provider: 'shortio', shortioApiKey: '', shortioDomain: '' };
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<ShortenLink />);

    expect(screen.getByText(/needs a bit more setup/i)).toBeInTheDocument();
    expect(screen.getByText(/add your short\.io public api key/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('https://example.com')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /open settings/i }));
    expect(showModalMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
