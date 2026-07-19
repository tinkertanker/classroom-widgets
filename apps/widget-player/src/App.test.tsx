import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { vi } from 'vitest';

import { App } from './App';
import { retrievalPracticeFixture } from './fixtures/retrievalPractice';

describe('public player entry', () => {
  it('loads a validated publication from a slug URL without credentials', async () => {
    window.history.replaceState({}, '', '/Abc123xyz');
    window.__CLASSROOM_WIDGET_API_BASE_URL__ = 'https://studio.example/';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ spec: retrievalPracticeFixture }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(<App />);
    expect(screen.getByRole('status')).toHaveTextContent('Opening your widget');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'How plants make food' }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://studio.example/v1/publications/Abc123xyz',
      expect.objectContaining({ credentials: 'omit', method: 'GET' }),
    );
  });

  it.each([
    [404, 'Widget not found', 'typed incorrectly'],
    [410, 'This widget is no longer available', 'expired or the teacher has unpublished it'],
    [503, 'This widget is temporarily unavailable', 'try again'],
  ])('shows a friendly %s publication state', async (status, heading, message) => {
    window.history.replaceState({}, '', '/Unavailable123');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status }));

    render(<App />);

    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(message, 'i'))).toBeInTheDocument();
  });

  it('accepts a validated widget through the WKWebView event contract', async () => {
    window.history.replaceState({}, '', '/index.html');
    const postMessage = vi.fn();
    window.webkit = { messageHandlers: { studioBridge: { postMessage } } };

    render(<App />);
    expect(screen.getByRole('heading', { name: 'Waiting for a widget' })).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(
        new CustomEvent('classroom-widgets:load', {
          detail: retrievalPracticeFixture,
        }),
      );
    });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'How plants make food' }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith({ type: 'ready', schemaVersion: '1.0' }),
    );
    expect(postMessage).toHaveBeenCalledWith({ type: 'loaded' });
  });

  it('offers an anonymous fixed-choice report on published widgets', async () => {
    window.history.replaceState({}, '', '/ReportableWidget123');
    window.__CLASSROOM_WIDGET_API_BASE_URL__ = 'https://studio.example/';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      if (init?.method === 'POST') return new Response(null, { status: 204 });
      return new Response(JSON.stringify({ spec: retrievalPracticeFixture }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    render(<App />);
    await screen.findByRole('heading', { level: 1, name: 'How plants make food' });
    fireEvent.click(screen.getByText('Report this widget'));
    fireEvent.change(screen.getByLabelText('What is the concern?'), {
      target: { value: 'personal-data' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));

    expect(await screen.findByRole('status')).toHaveTextContent('flagged for review');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://studio.example/v1/publications/ReportableWidget123/reports',
      expect.objectContaining({
        method: 'POST',
        credentials: 'omit',
        body: JSON.stringify({ reason: 'personal-data' }),
      }),
    );
  });

  it.each([
    ['/privacy', 'Privacy notice'],
    ['/terms', 'Terms of use'],
  ])('serves %s without starting the publication loader', (path, heading) => {
    window.history.replaceState({}, '', path);
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    render(<App />);

    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps hooks stable and starts loading when the same app moves from a legal route to a publication', async () => {
    window.history.replaceState({}, '', '/privacy');
    window.__CLASSROOM_WIDGET_API_BASE_URL__ = 'https://studio.example/';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ spec: retrievalPracticeFixture }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const { rerender } = render(<App />);

    expect(screen.getByRole('heading', { name: 'Privacy notice' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    window.history.replaceState({}, '', '/RerenderedWidget123');
    rerender(<App />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'How plants make food' }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://studio.example/v1/publications/RerenderedWidget123',
      expect.objectContaining({ credentials: 'omit', method: 'GET' }),
    );
  });
});
