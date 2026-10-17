import React, { useEffect, useId, useRef } from 'react';
import { FaCheck, FaMinus, FaPlus } from 'react-icons/fa6';
import { cn } from '@shared/utils/styles';
import { FONT_FAMILY_LABEL, FONT_FAMILY_ORDER, FONT_FAMILY_STACK } from './fonts';
import { CustomColourPicker } from './CustomColourPicker';
import {
  FONT_SIZE_STEP,
  MAX_FONT_SIZE_CAP,
  MIN_FONT_SIZE_CAP,
  colorCombinations,
  getCustomTextColor,
  hasCodeFence,
  type TextBannerDraft
} from './textBannerTheme';

interface TextBannerEditorProps {
  draft: TextBannerDraft;
  isNew: boolean;
  onDraftChange: React.Dispatch<React.SetStateAction<TextBannerDraft>>;
  onTextChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onCancel: () => void;
  onSave: () => void;
}

export const TextBannerEditor: React.FC<TextBannerEditorProps> = ({
  draft,
  isNew,
  onDraftChange,
  onTextChange,
  onCancel,
  onSave
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const hintId = useId();
  const draftColors = colorCombinations[draft.colorIndex] ?? colorCombinations[0];
  const draftIsCustomColor = draft.colorIndex === colorCombinations.length;
  const draftCustomTextColor = draftIsCustomColor
    ? getCustomTextColor(draft.customColor)
    : undefined;
  const canSave = !isNew || draft.text.trim().length > 0;

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }, []);

  const adjustFontCap = (delta: number) => {
    onDraftChange(current => ({
      ...current,
      fontSizeCap: Math.min(
        MAX_FONT_SIZE_CAP,
        Math.max(MIN_FONT_SIZE_CAP, current.fontSizeCap + delta)
      )
    }));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && canSave) {
      event.preventDefault();
      event.stopPropagation();
      onSave();
    }
  };

  return (
    <section
      role="region"
      aria-labelledby={titleId}
      onKeyDown={handleKeyDown}
      className="no-drag flex h-full min-h-0 w-full flex-col overflow-hidden bg-soft-white text-warm-gray-900 dark:bg-warm-gray-800 dark:text-warm-gray-100"
      data-dashboard-interactive="true"
    >
      <div className="flex min-h-9 flex-shrink-0 items-center border-b border-warm-gray-200 px-3 py-1.5 dark:border-warm-gray-700">
        <h2 id={titleId} className="truncate text-sm font-semibold">
          {isNew ? 'Add banner text' : 'Edit banner'}
        </h2>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-1">
        <div>
          <label htmlFor={`${titleId}-text`} className="sr-only">
            Banner text
          </label>
          <textarea
            ref={textareaRef}
            id={`${titleId}-text`}
            value={draft.text}
            onChange={onTextChange}
            spellCheck={!hasCodeFence(draft.text)}
            autoCorrect="off"
            autoCapitalize="off"
            autoComplete="off"
            data-gramm="false"
            data-enable-grammarly="false"
            aria-describedby={hintId}
            style={{
              fontFamily: hasCodeFence(draft.text)
                ? FONT_FAMILY_STACK.mono
                : FONT_FAMILY_STACK[draft.fontFamily],
              backgroundColor: draftIsCustomColor ? draft.customColor : undefined,
              color: draftCustomTextColor
            }}
            className={cn(
              'h-14 w-full resize-none rounded-lg border border-black/15 px-3 py-2 text-sm leading-relaxed shadow-inner placeholder:text-current placeholder:opacity-80',
              'focus:outline-none focus:ring-2 focus:ring-sage-500 focus:ring-offset-1',
              !draftIsCustomColor && draftColors.bg,
              !draftIsCustomColor && draftColors.text
            )}
            placeholder="Type a message…"
          />
          <div id={hintId} className="mt-1 flex items-baseline gap-1 text-[10px] leading-4 text-warm-gray-600 dark:text-warm-gray-300">
            <span>Enter ↵ · Ctrl/⌘+Enter saves ·</span>
            <a
              href="https://commonmark.org/help/"
              target="_blank"
              rel="noopener noreferrer"
              className="whitespace-nowrap underline hover:text-warm-gray-800 dark:hover:text-warm-gray-100"
            >
              Markdown help
            </a>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div role="group" aria-label="Banner colour" className="flex items-center gap-1">
              {colorCombinations.map((combo, index) => (
                <button
                  key={combo.name}
                  type="button"
                  onClick={() => onDraftChange(current => ({ ...current, colorIndex: index }))}
                  className={cn(
                    'inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border shadow-sm ring-1 ring-inset ring-black/30 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-1 dark:ring-white/50',
                    index === draft.colorIndex
                      ? 'border-warm-gray-900 ring-1 ring-warm-gray-900 dark:border-white dark:ring-white'
                      : 'border-warm-gray-300 dark:border-warm-gray-600',
                    index === 4 ? 'text-warm-gray-900' : 'text-white'
                  )}
                  style={{ backgroundColor: combo.swatch }}
                  aria-label={`Set banner colour to ${combo.name}`}
                  aria-pressed={index === draft.colorIndex}
                  title={combo.name}
                >
                  {index === draft.colorIndex && <FaCheck className="h-2.5 w-2.5" aria-hidden="true" />}
                </button>
              ))}
              <CustomColourPicker
                color={draft.customColor}
                selected={draftIsCustomColor}
                onChange={nextCustomColor => onDraftChange(current => ({
                  ...current,
                  colorIndex: colorCombinations.length,
                  customColor: nextCustomColor
                }))}
              />
            </div>

            <div role="group" aria-label="Maximum text size" className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => adjustFontCap(-FONT_SIZE_STEP)}
                disabled={draft.fontSizeCap <= MIN_FONT_SIZE_CAP}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-warm-gray-300 text-xs transition-colors hover:bg-warm-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-warm-gray-600 dark:hover:bg-warm-gray-700"
                aria-label="Decrease maximum font size"
              >
                <FaMinus aria-hidden="true" />
              </button>
              <output
                className="w-7 text-center text-[10px] tabular-nums"
                aria-label={`Maximum text size: ${draft.fontSizeCap} pixels`}
                aria-live="polite"
              >
                {draft.fontSizeCap}
              </output>
              <button
                type="button"
                onClick={() => adjustFontCap(FONT_SIZE_STEP)}
                disabled={draft.fontSizeCap >= MAX_FONT_SIZE_CAP}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-warm-gray-300 text-xs transition-colors hover:bg-warm-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-warm-gray-600 dark:hover:bg-warm-gray-700"
                aria-label="Increase maximum font size"
              >
                <FaPlus aria-hidden="true" />
              </button>
            </div>
          </div>

          <div role="group" aria-label="Banner font" className="grid grid-cols-4 gap-1">
            {FONT_FAMILY_ORDER.map((family) => (
              <button
                key={family}
                type="button"
                onClick={() => onDraftChange(current => ({ ...current, fontFamily: family }))}
                className={cn(
                  'h-8 min-w-0 rounded-md border px-1 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500',
                  family === draft.fontFamily
                    ? 'border-sage-600 bg-sage-100 text-sage-800 dark:border-sage-400 dark:bg-sage-900/40 dark:text-sage-200'
                    : 'border-warm-gray-300 hover:bg-warm-gray-100 dark:border-warm-gray-600 dark:hover:bg-warm-gray-700'
                )}
                style={{ fontFamily: FONT_FAMILY_STACK[family] }}
                aria-pressed={family === draft.fontFamily}
              >
                {FONT_FAMILY_LABEL[family]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid flex-shrink-0 grid-cols-2 gap-2 border-t border-warm-gray-200 px-3 py-1.5 dark:border-warm-gray-700">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-10 rounded-lg border border-warm-gray-300 px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-warm-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 dark:border-warm-gray-600 dark:hover:bg-warm-gray-700"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="min-h-10 rounded-lg bg-sage-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-sage-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-sage-500 dark:text-warm-gray-900 dark:hover:bg-sage-400"
        >
          {isNew ? 'Add text' : 'Save changes'}
        </button>
      </div>
    </section>
  );
};
