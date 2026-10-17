import React, { useState, useRef, useMemo, useCallback } from 'react';
import { FaCheck, FaMinus, FaPencil, FaPlus } from 'react-icons/fa6';
import { useAutoFontSize } from './hooks';
import { useColumnResize } from './hooks/useColumnResize';
import { FONT_FAMILY_STACK } from './fonts';
import { findCodeBlock, normaliseCode } from './highlight';
import { cn, widgetContainer, widgetWrapper } from '@shared/utils/styles';
import { WidgetControlBar } from '../shared/components/WidgetControlBar';
import { useWidgetState } from '@shared/hooks/useWidgetState';
import { useWorkspaceStore } from '../../../store/workspaceStore';
import {
  DEFAULT_COLUMN_HEIGHT,
  DEFAULT_CUSTOM_COLOR,
  DEFAULT_FONT_SIZE_CAP,
  FONT_SIZE_STEP,
  MAX_COLUMN_HEIGHT,
  MAX_FONT_SIZE_CAP,
  MIN_COLUMN_HEIGHT,
  MIN_FONT_SIZE_CAP,
  SMART_PUNCT_RE,
  colorCombinations,
  getCustomTextColor,
  hasCodeFence,
  normaliseCustomColor,
  normaliseSavedText,
  type TextBannerDraft,
  type TextBannerState
} from './textBannerTheme';
import { renderFormattedText } from './formatText';
import { CustomColourPicker } from './CustomColourPicker';
import { TextBannerEditor } from './TextBannerEditor';
import { CodeBlockRender } from './CodeBlockRender';

interface TextBannerProps {
  savedState?: Partial<TextBannerState> & { text: string };
  onStateChange?: (state: TextBannerState) => void;
  isCompactPanel?: boolean;
}

const TextBanner: React.FC<TextBannerProps> = ({ savedState, onStateChange, isCompactPanel = false }) => {
  const workspaceIsColumnLayout = useWorkspaceStore((state) => state.layoutFormat === 'column');
  const isColumnLayout = workspaceIsColumnLayout && !isCompactPanel;

  const initialState: TextBannerState = {
    text: '',
    colorIndex: 0,
    customColor: DEFAULT_CUSTOM_COLOR,
    fontFamily: 'sans',
    fontSizeCap: DEFAULT_FONT_SIZE_CAP,
    clickToRecolour: true
  };

  const normalisedSavedState: TextBannerState | undefined = savedState
    ? {
        text: normaliseSavedText(savedState.text),
        colorIndex: savedState.colorIndex ?? 0,
        customColor: normaliseCustomColor(savedState.customColor),
        fontFamily: savedState.fontFamily ?? 'sans',
        fontSizeCap: savedState.fontSizeCap ?? DEFAULT_FONT_SIZE_CAP,
        clickToRecolour: savedState.clickToRecolour ?? true,
        columnHeight: savedState.columnHeight
      }
    : undefined;

  const { state, updateState } = useWidgetState<TextBannerState>({
    initialState,
    savedState: normalisedSavedState,
    onStateChange
  });

  const { text, colorIndex, customColor, fontFamily, fontSizeCap, columnHeight }: TextBannerState = state;

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [draft, setDraft] = useState<TextBannerDraft>({ text, colorIndex, customColor, fontFamily, fontSizeCap });

  const widgetRef = useRef<HTMLDivElement>(null);
  const textAreaContainerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const editorTriggerRef = useRef<HTMLButtonElement>(null);
  const surfacePointerStartRef = useRef<{ x: number; y: number } | null>(null);

  const codeBlock = useMemo(() => findCodeBlock(text), [text]);
  const isCodeBlockOnly = codeBlock?.match.trim() === text.trim();

  const hasManualColumnHeight = isColumnLayout && columnHeight !== undefined;
  const fontSize = useAutoFontSize({
    text,
    containerRef: textAreaContainerRef,
    textRef,
    maxSize: fontSizeCap,
    minSize: isColumnLayout ? 18 : 12,
    padding: 32,
    widthOnly: isColumnLayout && !hasManualColumnHeight,
    fontFamily
  });

  const handleDraftTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const raw = e.target.value;
    const value = hasCodeFence(raw) && SMART_PUNCT_RE.test(raw)
      ? normaliseCode(raw)
      : raw;
    if (value !== raw) {
      const ta = e.target;
      // Some replacements change length (— → --, … → ...). Adjust the cursor
      // by normalising the prefix up to the original cursor so it lands at the
      // same logical position rather than mid-insertion.
      const rawCursor = ta.selectionStart;
      const adjustedCursor = normaliseCode(raw.slice(0, rawCursor)).length;
      setDraft(current => ({ ...current, text: value }));
      requestAnimationFrame(() => {
        if (ta.isConnected) {
          ta.selectionStart = ta.selectionEnd = adjustedCursor;
        }
      });
    } else {
      setDraft(current => ({ ...current, text: value }));
    }
  };

  const openEditor = () => {
    setDraft({ text, colorIndex, customColor, fontFamily, fontSizeCap });
    setIsEditorOpen(true);
  };

  const closeEditor = useCallback(() => {
    setIsEditorOpen(false);
    window.setTimeout(() => editorTriggerRef.current?.focus(), 0);
  }, []);

  const saveDraft = useCallback(() => {
    if (!draft.text.trim() && !text) return;
    const value = draft.text.trim()
      ? (hasCodeFence(draft.text) ? normaliseCode(draft.text) : draft.text)
      : '';
    updateState({ ...draft, text: value, clickToRecolour: true });
    closeEditor();
  }, [closeEditor, draft, text, updateState]);

  const isCustomColor = colorIndex === colorCombinations.length;
  const currentColors = colorCombinations[colorIndex] ?? colorCombinations[0];
  const customTextColor = isCustomColor ? getCustomTextColor(customColor) : undefined;

  const cycleDisplayedColor = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!text) return;

    const start = surfacePointerStartRef.current;
    surfacePointerStartRef.current = null;
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return;

    const nextColorIndex = colorIndex >= colorCombinations.length
      ? 0
      : (colorIndex + 1) % colorCombinations.length;
    updateState({ colorIndex: nextColorIndex, clickToRecolour: true });
  };

  const {
    pendingHeight,
    effectiveColumnHeight,
    columnStyle,
    handleResizeKeyDown,
    handleResizeMouseDown
  } = useColumnResize({
    isColumnLayout,
    isEditorOpen,
    columnHeight,
    widgetRef,
    onColumnHeightChange: (height) => updateState({ columnHeight: height })
  });

  return (
    <div
      ref={widgetRef}
      className={cn(
        widgetWrapper,
        'widget-container-custom-surface',
        '@container overflow-hidden rounded-lg group/banner'
      )}
      style={columnStyle}
    >
      {isEditorOpen && (
        <div className="absolute inset-0 z-20">
          <TextBannerEditor
            draft={draft}
            isNew={!text}
            onDraftChange={setDraft}
            onTextChange={handleDraftTextChange}
            onCancel={closeEditor}
            onSave={saveDraft}
          />
        </div>
      )}

      <div
        ref={textAreaContainerRef}
        data-testid="text-banner-display"
        aria-hidden={isEditorOpen || undefined}
        onMouseDown={event => {
          surfacePointerStartRef.current = { x: event.clientX, y: event.clientY };
        }}
        onClick={cycleDisplayedColor}
        style={isCustomColor ? { backgroundColor: customColor } : undefined}
        className={cn(
          widgetContainer,
          'widget-container-custom-surface',
          !isCustomColor && currentColors.bg,
          'h-auto flex-1 items-center justify-center relative transition-colors duration-300',
          text ? 'cursor-pointer p-4' : 'p-1',
          // Only constrain the content pane when the widget itself has a bounded height
          // (canvas mode is always bounded via react-rnd; column mode only when columnHeight is set).
          (!isColumnLayout || hasManualColumnHeight) && 'min-h-0 overflow-hidden',
          isEditorOpen && 'invisible pointer-events-none'
        )}
      >
        {text && (
          <div
            ref={textRef}
            aria-hidden="true"
            className={cn(
              'absolute left-4 right-4 top-4 pointer-events-none select-none opacity-0',
              isCodeBlockOnly && codeBlock
                ? 'max-w-full'
                : cn(!isCustomColor && currentColors.text, 'text-center leading-tight')
            )}
            style={{
              fontSize: `${fontSize}px`,
              fontFamily: isCodeBlockOnly && codeBlock
                ? FONT_FAMILY_STACK.mono
                : FONT_FAMILY_STACK[fontFamily],
              color: customTextColor
            }}
          >
            {isCodeBlockOnly && codeBlock ? (
              <pre className="text-banner-code">
                <code>{normaliseCode(codeBlock.code)}</code>
              </pre>
            ) : (
              renderFormattedText(text)
            )}
          </div>
        )}

        {!text ? (
          <button
            ref={editorTriggerRef}
            type="button"
            onClick={openEditor}
            className="no-drag inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-soft-white px-4 py-2.5 text-sm font-semibold text-warm-gray-900 shadow-lg transition-colors hover:bg-warm-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-soft-white focus-visible:ring-offset-2 focus-visible:ring-offset-terracotta-600"
          >
            <FaPlus aria-hidden="true" />
            Add text
          </button>
        ) : isCodeBlockOnly && codeBlock ? (
          <CodeBlockRender
            code={codeBlock.code}
            language={codeBlock.language}
            fontSize={fontSize}
          />
        ) : (
          <div
            className={cn(!isCustomColor && currentColors.text, 'text-center leading-tight select-none')}
            style={{
              fontSize: `${fontSize}px`,
              fontFamily: FONT_FAMILY_STACK[fontFamily],
              color: customTextColor
            }}
          >
            {renderFormattedText(text)}
          </div>
        )}
      </div>

      {text && !isEditorOpen && (
        <WidgetControlBar className="no-drag flex-shrink-0 flex-nowrap gap-1 px-2 text-warm-gray-900 dark:text-warm-gray-100">
          <button
            ref={editorTriggerRef}
            type="button"
            onClick={openEditor}
            className="inline-flex min-h-8 items-center gap-2 rounded-lg px-2 text-sm font-medium hover:bg-warm-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 dark:hover:bg-warm-gray-700"
            aria-label="Edit banner"
            title="Edit banner"
          >
            <FaPencil aria-hidden="true" />
            <span className="hidden @[360px]:inline">Edit</span>
          </button>
          <div role="group" aria-label="Banner text size" className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => updateState({ fontSizeCap: Math.max(MIN_FONT_SIZE_CAP, fontSizeCap - FONT_SIZE_STEP) })}
              disabled={fontSizeCap <= MIN_FONT_SIZE_CAP}
              aria-label="Decrease text size"
              title={`Decrease text size (maximum ${fontSizeCap}px)`}
              className="inline-flex h-8 w-7 items-center justify-center rounded-md border border-warm-gray-300 text-xs hover:bg-warm-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-warm-gray-600 dark:hover:bg-warm-gray-700"
            >
              <FaMinus aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => updateState({ fontSizeCap: Math.min(MAX_FONT_SIZE_CAP, fontSizeCap + FONT_SIZE_STEP) })}
              disabled={fontSizeCap >= MAX_FONT_SIZE_CAP}
              aria-label="Increase text size"
              title={`Increase text size (maximum ${fontSizeCap}px)`}
              className="inline-flex h-8 w-7 items-center justify-center rounded-md border border-warm-gray-300 text-xs hover:bg-warm-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-warm-gray-600 dark:hover:bg-warm-gray-700"
            >
              <FaPlus aria-hidden="true" />
            </button>
          </div>
          <div role="group" aria-label="Banner colour" className="flex items-center gap-1">
            {colorCombinations.map((combo, index) => (
              <button
                key={combo.name}
                type="button"
                onClick={() => updateState({ colorIndex: index })}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-black/30 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-1"
                style={{ backgroundColor: combo.swatch, color: getCustomTextColor(combo.swatch) }}
                aria-label={`Set banner colour to ${combo.name}`}
                aria-pressed={index === colorIndex}
                title={combo.name}
              >
                {index === colorIndex && <FaCheck className="h-2.5 w-2.5" aria-hidden="true" />}
              </button>
            ))}
            <CustomColourPicker
              color={customColor}
              selected={isCustomColor}
              onChange={nextColor => updateState({ colorIndex: colorCombinations.length, customColor: nextColor })}
            />
          </div>
        </WidgetControlBar>
      )}

      {isColumnLayout && (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize banner height (use arrow keys)"
          aria-valuenow={Math.round(effectiveColumnHeight ?? widgetRef.current?.offsetHeight ?? DEFAULT_COLUMN_HEIGHT)}
          aria-valuemin={MIN_COLUMN_HEIGHT}
          aria-valuemax={MAX_COLUMN_HEIGHT}
          aria-valuetext={`${Math.round(effectiveColumnHeight ?? widgetRef.current?.offsetHeight ?? DEFAULT_COLUMN_HEIGHT)} pixels`}
          aria-hidden={isEditorOpen || undefined}
          tabIndex={isEditorOpen ? -1 : 0}
          onMouseDown={handleResizeMouseDown}
          onKeyDown={handleResizeKeyDown}
          className={cn(
            'absolute bottom-0 left-0 right-0 h-2 flex items-center justify-center cursor-ns-resize select-none',
            'opacity-0 group-hover/banner:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-soft-white/70 transition-opacity',
            pendingHeight !== null && 'opacity-100',
            isEditorOpen && 'invisible pointer-events-none'
          )}
        >
          <div className="w-10 h-1 rounded-full bg-soft-white/60" />
        </div>
      )}
    </div>
  );
};

export default TextBanner;
