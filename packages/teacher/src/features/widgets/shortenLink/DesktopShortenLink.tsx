import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'react-qr-code';
import { WidgetInput } from '@shared/components/WidgetInput';
import { widgetContainer } from '@shared/utils/styles';
import { isNativeDesktop, postNativeMessage } from '@shared/utils/nativeBridge';
import { useTemporaryState } from '@shared/hooks/useTemporaryState';
import { useLinkShortener } from '@shared/hooks/useWorkspace';
import {
  getProviderInfo,
  shortenUrl,
  validateAlias,
  validateShortenerSettings,
  validateTargetUrl
} from '@shared/utils/urlShortener';
import { SettingsButton } from '../shared/components/SettingsButton';
import { useModal } from '../../../contexts/ModalContext';
import LinkShortenerSettings from '../../../components/settings/LinkShortenerSettings';

interface ShortenLinkProps {
}

const ShortenLink: React.FC<ShortenLinkProps> = () => {
  const { settings } = useLinkShortener();
  const { showModal, hideModal } = useModal();

  const [link, setLink] = useState<string>('');
  const [alias, setAlias] = useState<string>('');
  const [shortenedLink, setShortenedLink] = useState<string>('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [aliasError, setAliasError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { value: copied, setTemporaryValue: showCopied, clear: clearCopied } = useTemporaryState(false, 2000);

  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  const openSettings = () => {
    if (isNativeDesktop()) {
      postNativeMessage('classroomWidgetPanel', { type: 'open-settings' });
      return;
    }
    showModal({
      title: 'Link Shortener',
      content: <LinkShortenerSettings onClose={hideModal} />
    });
  };

  const setupMessage = validateShortenerSettings(settings);
  const providerLabel = getProviderInfo(settings.provider).label;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const urlError = validateTargetUrl(link);
    if (urlError) {
      setLinkError(urlError);
      return;
    }

    const trimmedAlias = alias.trim();
    const aliasValidationError = validateAlias(trimmedAlias || undefined);
    if (aliasValidationError) {
      setAliasError(aliasValidationError);
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setIsLoading(true);
    setLinkError(null);
    setAliasError(null);
    setShortenedLink('');

    const result = await shortenUrl(
      { url: link, settings, alias: trimmedAlias || undefined },
      { signal: controller.signal }
    );

    if (controller.signal.aborted) {
      return;
    }

    setIsLoading(false);

    if (result.ok) {
      setShortenedLink(result.shortUrl);
    } else {
      setLinkError(result.message);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shortenedLink);
    showCopied(true);
  };

  const resetForm = () => {
    setLink('');
    setAlias('');
    setShortenedLink('');
    setLinkError(null);
    setAliasError(null);
    clearCopied();
  };

  const header = (
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs text-warm-gray-500 dark:text-warm-gray-400">
        via {providerLabel}
      </span>
      <SettingsButton onClick={openSettings} title="Link Shortener settings" />
    </div>
  );

  if (setupMessage) {
    return (
      <div className={`${widgetContainer} p-4`}>
        {header}
        <div className="flex-1 flex flex-col items-center justify-center space-y-4 text-center">
          <p className="text-sm text-warm-gray-600 dark:text-warm-gray-400">
            {providerLabel} needs a bit more setup.
          </p>
          <p className="text-xs text-warm-gray-500 dark:text-warm-gray-500 px-2">
            {setupMessage}
          </p>
          <button
            onClick={openSettings}
            className="px-3 py-1.5 bg-sage-500 hover:bg-sage-600 text-white text-sm rounded transition-colors duration-200"
          >
            Open Settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${widgetContainer} p-4`}>
      {header}
      {!shortenedLink ? (
        // Input state
        <form onSubmit={handleSubmit} noValidate className="flex flex-col flex-1">
          <div className="flex-1 flex flex-col justify-center space-y-3">
            <div>
              <h2 className="text-lg font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-4 text-center">
                Shorten Your Link
              </h2>
              <WidgetInput
                type="text"
                inputMode="url"
                value={link}
                onChange={(e) => {
                  setLink(e.target.value);
                  setLinkError(null);
                }}
                placeholder="https://example.com"
                className="text-sm"
                autoFocus
                disabled={isLoading}
              />
              {linkError && (
                <p className="text-dusty-rose-500 dark:text-dusty-rose-400 text-xs mt-2">
                  {linkError}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs text-warm-gray-500 dark:text-warm-gray-400 mb-1">
                Custom ending (optional)
              </label>
              <WidgetInput
                type="text"
                value={alias}
                onChange={(e) => {
                  setAlias(e.target.value);
                  setAliasError(null);
                }}
                placeholder="e.g. p5-quiz"
                className="text-sm"
                disabled={isLoading}
              />
              {aliasError && (
                <p className="text-dusty-rose-500 dark:text-dusty-rose-400 text-xs mt-2">
                  {aliasError}
                </p>
              )}
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading || !link.trim()}
            className="w-full px-3 py-1.5 bg-sage-500 hover:bg-sage-600 text-white text-sm rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Shortening...' : 'Shorten Link'}
          </button>
        </form>
      ) : (
        // Result state
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pb-3">
            <div className="text-center space-y-2">
              <p className="text-sm text-warm-gray-600 dark:text-warm-gray-400">
                Original URL:
              </p>
              <p className="text-xs text-warm-gray-500 dark:text-warm-gray-500 break-all px-2">
                {link}
              </p>
            </div>

            <div className="bg-white p-3 rounded-lg shadow-inner w-fit mx-auto">
              <QRCode
                value={shortenedLink}
                size={150}
                fgColor="#1f2937"
                bgColor="#ffffff"
              />
            </div>

            <div className="text-center space-y-2">
              <p className="text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300">
                Shortened Link:
              </p>
              <div className="flex items-center gap-2 justify-center">
                <a
                  href={shortenedLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sage-600 dark:text-sage-400 hover:text-sage-700 dark:hover:text-sage-300 text-sm"
                >
                  {shortenedLink}
                </a>
                <button
                  onClick={(_e) => {
                    copyToClipboard();
                  }}
                  className="p-1 text-warm-gray-500 hover:text-warm-gray-700 dark:text-warm-gray-400 dark:hover:text-warm-gray-200"
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
            </div>
          </div>

          <button
            onClick={(e) => {
              resetForm();
            }}
            className="shrink-0 w-full px-3 py-1.5 bg-sage-500 hover:bg-sage-600 text-white text-sm rounded transition-colors duration-200"
          >
            Shorten Another Link
          </button>
        </div>
      )}
    </div>
  );
};

export default ShortenLink;
