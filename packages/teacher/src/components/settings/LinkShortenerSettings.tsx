// Runtime configuration for the URL shortener used by the QR Code and
// Link Shortener widgets. Opened from the bottom bar menu and from either
// widget, so it is deliberately app-level rather than per-widget.

import React, { useState } from 'react';
import { WidgetInput } from '@shared/components/WidgetInput';
import { useLinkShortener } from '@shared/hooks/useWorkspace';
import {
  SHORTENER_PROVIDERS,
  type ShortenerProvider
} from '@shared/utils/urlShortener';

interface LinkShortenerSettingsProps {
  onClose: () => void;
}

const LinkShortenerSettings: React.FC<LinkShortenerSettingsProps> = ({ onClose }) => {
  const { settings, updateSettings } = useLinkShortener();
  const [provider, setProvider] = useState<ShortenerProvider>(settings.provider);
  const [apiKey, setApiKey] = useState(settings.shortioApiKey);
  const [domain, setDomain] = useState(settings.shortioDomain);

  // Saving Short.io with either field blank leaves the widgets in a "finish
  // setup" state, so say so here rather than letting the teacher discover it.
  const incomplete = provider === 'shortio' && (!apiKey.trim() || !domain.trim());

  const handleSave = () => {
    updateSettings({
      provider,
      shortioApiKey: apiKey.trim(),
      shortioDomain: domain.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '')
    });
    onClose();
  };

  return (
    <div className="w-[460px] max-w-full">
      <div className="px-6 py-4 space-y-4">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-2">
            Shortening service
          </legend>
          {SHORTENER_PROVIDERS.map((option) => (
            <label
              key={option.id}
              className="flex items-start gap-3 p-3 rounded-md border border-warm-gray-200 dark:border-warm-gray-700 hover:bg-warm-gray-50 dark:hover:bg-warm-gray-700/50 cursor-pointer transition-colors"
            >
              <input
                type="radio"
                name="shortener-provider"
                value={option.id}
                checked={provider === option.id}
                onChange={() => setProvider(option.id)}
                className="mt-1 accent-sage-500"
              />
              <span className="flex-1">
                <span className="block text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300">
                  {option.label}
                  <span className="ml-2 font-normal text-warm-gray-500 dark:text-warm-gray-400">
                    {option.domain}
                  </span>
                </span>
                <span className="block text-xs text-warm-gray-500 dark:text-warm-gray-400 mt-0.5">
                  {option.description}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        {provider === 'shortio' && (
          <div className="space-y-3 pl-1">
            <div>
              <label
                htmlFor="shortio-api-key"
                className="block text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-1"
              >
                Public API key
              </label>
              <WidgetInput
                id="shortio-api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="pk_..."
                autoComplete="new-password"
                className="text-sm"
              />
              <p className="text-xs text-warm-gray-500 dark:text-warm-gray-400 mt-1">
                Use the <span className="font-medium">public</span> key from your Short.io
                integrations page — secret keys are rejected by the browser endpoint. The key is
                stored in this browser only.
              </p>
            </div>

            <div>
              <label
                htmlFor="shortio-domain"
                className="block text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-1"
              >
                Domain
              </label>
              <WidgetInput
                id="shortio-domain"
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="go.myschool.edu"
                autoComplete="off"
                className="text-sm"
              />
              <p className="text-xs text-warm-gray-500 dark:text-warm-gray-400 mt-1">
                The branded domain attached to your Short.io account. Required.
              </p>
            </div>
          </div>
        )}

        {incomplete && (
          <p className="text-xs text-dusty-rose-500 dark:text-dusty-rose-400">
            Short.io needs both a key and a domain. You can save now, but the widgets will ask you
            to finish this off before they shorten anything.
          </p>
        )}

        <p className="text-xs text-warm-gray-500 dark:text-warm-gray-400">
          Some school networks block the better-known shortening domains. If links fail to open on
          student devices, try a different service here.
        </p>
      </div>

      <div className="px-6 pb-4 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-sm text-warm-gray-700 dark:text-warm-gray-300 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 rounded transition-colors duration-200"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-3 py-1.5 bg-sage-500 hover:bg-sage-600 text-white text-sm rounded transition-colors duration-200"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default LinkShortenerSettings;
