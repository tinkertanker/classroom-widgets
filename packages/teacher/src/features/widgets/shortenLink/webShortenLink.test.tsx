import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import ShortenLink from './shortenLink';

vi.mock('../../../store/workspaceUiStore', () => ({
  useWorkspaceUiStore: (selector: (state: { serverStatus: { url: string } }) => unknown) =>
    selector({ serverStatus: { url: 'http://server.test' } })
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

async function submit(url: string) {
  fireEvent.change(screen.getByPlaceholderText('https://example.com'), {
    target: { value: url }
  });
  fireEvent.click(screen.getByRole('button', { name: /shorten link/i }));
}

test('shortens a link through the server proxy without an authorization header', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ success: true, shortUrl: 'https://go.example.edu/abc' })
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<ShortenLink />);

  await submit('https://example.com/path');

  await waitFor(() => {
    expect(screen.getByText('https://go.example.edu/abc')).toBeInTheDocument();
  });
  expect(fetchMock).toHaveBeenCalledWith(
    'http://server.test/api/shorten',
    expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
  );
  expect(fetchMock.mock.calls[0][1].headers.authorization).toBeUndefined();
});

test('shows the server message before its error code', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: false,
    status: 429,
    json: async () => ({
      success: false,
      error: 'RATE_LIMITED',
      message: 'Too many requests. Please try again later.'
    })
  }));
  render(<ShortenLink />);

  await submit('https://example.com');

  expect(await screen.findByText('Too many requests. Please try again later.')).toBeInTheDocument();
  expect(screen.queryByText('RATE_LIMITED')).not.toBeInTheDocument();
});
