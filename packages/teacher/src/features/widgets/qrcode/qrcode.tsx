import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WidgetInput } from '@shared/components/WidgetInput';
import { widgetContainer } from '@shared/utils/styles';
import { isDesktopDashboardMode } from '@shared/utils/dashboardMode';
import { isNativeDesktop, postNativeMessage } from '@shared/utils/nativeBridge';
import { useWidgetState } from '@shared/hooks/useWidgetState';
import { useTemporaryState } from '@shared/hooks/useTemporaryState';
import { useLinkShortener } from '@shared/hooks/useWorkspace';
import { shortenUrl, validateShortenerSettings, type ShortenResult } from '@shared/utils/urlShortener';
import { SettingsButton } from '../shared/components/SettingsButton';
import { useModal } from '../../../contexts/ModalContext';
import LinkShortenerSettings from '../../../components/settings/LinkShortenerSettings';

interface QRCodeWidgetState {
  url: string;
  title: string;
  /** Set once a teacher has shortened the link. Optional to stay backward-compatible with saved `{url, title}` state. */
  shortUrl?: string;
}

interface QRCodeWidgetProps {
  savedState?: QRCodeWidgetState;
  onStateChange?: (state: QRCodeWidgetState) => void;
}

type ShortenOutcome =
  | { needsSettings: true; message: string }
  | { needsSettings: false; result: ShortenResult };

const GENERIC_SHORTEN_FAILURE = 'Could not shorten that link. Please try again.';

function QRCodeWidget({ savedState, onStateChange }: QRCodeWidgetProps) {
  const { state, updateState } = useWidgetState<QRCodeWidgetState>({
    initialState: { url: '', title: '' },
    savedState,
    onStateChange
  });
  const isDesktop = isDesktopDashboardMode() || isNativeDesktop();
  const { url, title } = state;
  const shortUrl = isDesktop ? state.shortUrl : undefined;
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(title);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const qrContainerRef = useRef<HTMLDivElement>(null);
  const pendingTitleFallbackRef = useRef('');
  const resizeTimeoutRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  const { settings } = useLinkShortener();
  const { showModal, hideModal } = useModal();

  // Entry-form "shorten before showing the code" checkbox and its busy state.
  const [shortenOnSubmit, setShortenOnSubmit] = useState(false);
  const [isShorteningOnSubmit, setIsShorteningOnSubmit] = useState(false);

  // Shorten failure/settings state, shared by the entry-form submit and the
  // display-state "Shorten" button. A submit-time failure still transitions to
  // the display state (per spec), so its error surfaces there too.
  const [isShortening, setIsShortening] = useState(false);
  const [shortenError, setShortenError] = useState<string | null>(null);
  const [shortenNeedsSettings, setShortenNeedsSettings] = useState(false);
  const { value: copied, setTemporaryValue: showCopied, clear: clearCopiedState } = useTemporaryState(false, 2000);

  // A short link is a much smaller payload than most typed URLs, so it produces
  // a lower-density QR code (fewer modules) that is easier for a phone camera
  // to resolve from the back of a classroom. Prefer it whenever one exists.
  const qrValue = shortUrl || url;

  const renderQRCode = useCallback(() => {
    const canvas = canvasRef.current;
    if (qrValue && canvas) {
      const container = qrContainerRef.current;
      const availableSize = Math.min(container?.clientWidth || 250, container?.clientHeight || 250) - 16;
      const targetWidth = Math.max(120, Math.floor(availableSize));

      void import('qrcode').then(({ default: QRCode }) => {
        if (canvasRef.current !== canvas) return;
        QRCode.toCanvas(canvas, qrValue, {
          width: targetWidth,
          margin: 1,
          color: {
            dark: '#1f2937',  // warm-gray-800
            light: '#ffffff'
          }
        }, (error) => {
          if (error) console.error('Error generating QR code:', error);
        });
      });
    } else if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [qrValue]);

  // Regenerate at the available pixel size whenever the panel is resized.
  useEffect(() => {
    renderQRCode();
    const container = qrContainerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      if (resizeTimeoutRef.current !== null) window.clearTimeout(resizeTimeoutRef.current);
      resizeTimeoutRef.current = window.setTimeout(renderQRCode, 150);
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      if (resizeTimeoutRef.current !== null) window.clearTimeout(resizeTimeoutRef.current);
    };
  }, [renderQRCode]);

  // Abandon any in-flight shorten request once the URL changes or the widget unmounts.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, [url]);

  const openSettings = useCallback(() => {
    if (isNativeDesktop()) {
      postNativeMessage('classroomWidgetPanel', { type: 'open-settings' });
      return;
    }
    showModal({
      title: 'Link Shortener',
      content: <LinkShortenerSettings onClose={hideModal} />
    });
  }, [showModal, hideModal]);

  // Shared core for both the entry-form and display-state shorten actions.
  // Returns null when the request was superseded (URL changed / unmounted) so
  // callers can bail out without touching state.
  const attemptShorten = useCallback(async (targetUrl: string): Promise<ShortenOutcome | null> => {
    const settingsError = validateShortenerSettings(settings);
    if (settingsError) {
      return { needsSettings: true, message: settingsError };
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await shortenUrl(
        { url: targetUrl, settings, title: title || targetUrl },
        { signal: controller.signal }
      );
      if (controller.signal.aborted) return null;
      return { needsSettings: false, result };
    } catch {
      if (controller.signal.aborted) return null;
      return { needsSettings: false, result: { ok: false, message: GENERIC_SHORTEN_FAILURE } };
    }
  }, [settings, title]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const urlInput = urlInputRef.current?.value.trim() ?? '';
    if (!urlInput) return;

    pendingTitleFallbackRef.current = title || urlInput;
    setShortenError(null);
    setShortenNeedsSettings(false);

    if (!shortenOnSubmit) {
      updateState({ url: urlInput, shortUrl: undefined });
      setTempTitle('');
      setIsEditingTitle(true);
      return;
    }

    setIsShorteningOnSubmit(true);
    const outcome = await attemptShorten(urlInput);
    setIsShorteningOnSubmit(false);
    if (outcome === null) return;

    // Never block the teacher from getting a QR code: on any failure fall back to
    // the original URL and surface the reason non-destructively once we land on
    // the display state (the "Shorten" button and its error live there).
    if (outcome.needsSettings) {
      updateState({ url: urlInput, shortUrl: undefined });
      setShortenError(outcome.message);
      setShortenNeedsSettings(true);
    } else if (outcome.result.ok) {
      updateState({ url: urlInput, shortUrl: outcome.result.shortUrl });
    } else {
      updateState({ url: urlInput, shortUrl: undefined });
      setShortenError(outcome.result.message);
      setShortenNeedsSettings(false);
    }
    setTempTitle('');
    setIsEditingTitle(true);
  };

  const handleShortenClick = async () => {
    setShortenError(null);
    setShortenNeedsSettings(false);
    setIsShortening(true);
    const outcome = await attemptShorten(url);
    setIsShortening(false);
    if (outcome === null) return;

    if (outcome.needsSettings) {
      setShortenError(outcome.message);
      setShortenNeedsSettings(true);
    } else if (outcome.result.ok) {
      updateState({ shortUrl: outcome.result.shortUrl });
    } else {
      setShortenError(outcome.result.message);
      setShortenNeedsSettings(false);
    }
  };

  const handleCopyShortUrl = () => {
    if (!shortUrl) return;
    navigator.clipboard.writeText(shortUrl);
    showCopied(true);
  };

  const handleTitleSave = () => {
    const trimmedTitle = tempTitle.trim();
    const nextTitle = trimmedTitle || pendingTitleFallbackRef.current || url;
    updateState({ title: nextTitle });
    setIsEditingTitle(false);
    pendingTitleFallbackRef.current = '';
  };

  const handleTitleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleSave();
    }
    if (e.key === 'Escape') {
      setTempTitle(title);
      setIsEditingTitle(false);
      pendingTitleFallbackRef.current = '';
    }
  };

  return (
    <div className={`${widgetContainer} p-2 relative`}>
      {isDesktop && <div className="absolute top-1 right-1 z-10">
        <SettingsButton onClick={openSettings} title="Link shortener settings" size="sm" />
      </div>}
      {!url ? (
        // Initial state - show input form
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <div className="flex-1 flex flex-col justify-center space-y-4">
            <div>
              <label className="block text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-2">
                Enter URL to generate QR Code
              </label>
              <WidgetInput
                ref={urlInputRef}
                type="url"
                name="url"
                placeholder="https://example.com"
                className="text-sm"
                autoFocus
                required
                disabled={isShorteningOnSubmit}
              />
            </div>
            {isDesktop && <label className="flex items-center gap-2 text-sm text-warm-gray-600 dark:text-warm-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={shortenOnSubmit}
                onChange={(e) => setShortenOnSubmit(e.target.checked)}
                disabled={isShorteningOnSubmit}
                className="accent-sage-500"
              />
              Shorten the link first
            </label>}
          </div>
          <button
            type="submit"
            disabled={isShorteningOnSubmit}
            className="w-full px-3 py-1.5 bg-sage-500 hover:bg-sage-600 text-white text-sm rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isShorteningOnSubmit ? 'Shortening…' : 'Generate QR Code'}
          </button>
        </form>
      ) : (
        // QR code display state
        <>
          <div className="flex-1 flex flex-col items-center justify-center">
            {/* Editable title */}
            <div className="mb-2 w-full text-center px-1">
              {isEditingTitle ? (
                <input
                  type="text"
                  value={tempTitle}
                  onChange={(e) => setTempTitle(e.target.value)}
                  onKeyDown={handleTitleKeyPress}
                  onBlur={handleTitleSave}
                  className="text-lg font-medium text-center w-full px-2 py-1 border-b-2 border-sage-500 bg-transparent focus:outline-none text-warm-gray-700 dark:text-warm-gray-300"
                  placeholder="Title"
                  autoFocus
                />
              ) : (
                <p
                  className="text-lg font-medium text-warm-gray-700 dark:text-warm-gray-300 cursor-pointer hover:text-sage-600 dark:hover:text-sage-400 inline-block"
                  onClick={(_e) => {
                    pendingTitleFallbackRef.current = title || url;
                    setTempTitle(title);
                    setIsEditingTitle(true);
                  }}
                  title="Click to edit"
                >
                  {title || url}
                </p>
              )}
            </div>

            {/* QR Code */}
            <div
              ref={qrContainerRef}
              className="bg-white p-2 rounded-lg shadow-inner cursor-pointer flex-1 flex items-center justify-center"
              onDoubleClick={(_e) => {
                pendingTitleFallbackRef.current = '';
                setShortenError(null);
                setShortenNeedsSettings(false);
                clearCopiedState();
                updateState({ url: '', title: '', shortUrl: undefined });
              }}
              title="Double-click to change URL"
            >
              <canvas ref={canvasRef} className="max-w-full max-h-full" />
            </div>

            {/* URL / short URL display */}
            {shortUrl ? (
              <div className="mt-2 w-full text-center px-1">
                <div className="flex items-center justify-center gap-1.5">
                  <p className="text-sm font-medium text-sage-700 dark:text-sage-400 select-all break-all">
                    {shortUrl}
                  </p>
                  <button
                    type="button"
                    onClick={handleCopyShortUrl}
                    className="p-1 text-warm-gray-500 hover:text-warm-gray-700 dark:text-warm-gray-400 dark:hover:text-warm-gray-200 shrink-0"
                    title="Copy to clipboard"
                  >
                    {copied ? (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="text-xs text-warm-gray-500 dark:text-warm-gray-400 mt-1 text-center break-all max-w-full px-1">
                  {url}
                </p>
              </div>
            ) : (
              <div className="mt-2 w-full text-center px-1">
                <div className="flex items-center justify-center gap-2">
                  <p className="text-xs text-warm-gray-500 dark:text-warm-gray-400 break-all max-w-full">
                    {url}
                  </p>
                  {isDesktop && <button
                    type="button"
                    onClick={handleShortenClick}
                    disabled={isShortening}
                    className="shrink-0 text-xs px-2 py-0.5 rounded border border-sage-500 text-sage-600 dark:text-sage-400 hover:bg-sage-50 dark:hover:bg-sage-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    {isShortening ? 'Shortening…' : 'Shorten'}
                  </button>}
                </div>
                {shortenError && (
                  <p className="text-dusty-rose-500 dark:text-dusty-rose-400 text-xs mt-1">
                    {shortenError}
                    {shortenNeedsSettings && (
                      <>
                        {' '}
                        <button
                          type="button"
                          onClick={openSettings}
                          className="underline hover:text-dusty-rose-600 dark:hover:text-dusty-rose-300"
                        >
                          Open Settings
                        </button>
                      </>
                    )}
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default QRCodeWidget;
