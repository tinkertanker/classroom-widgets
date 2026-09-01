import React, { useState, useEffect, useRef, useMemo, useCallback, useId } from 'react';
import { FaCheck, FaMinus, FaPencil, FaPlus } from 'react-icons/fa6';
import {
  FloatingArrow,
  FloatingFocusManager,
  FloatingPortal,
  arrow,
  autoUpdate,
  flip,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useRole
} from '@floating-ui/react';
import { RgbColorPicker, type RgbColor } from 'react-colorful';
import { useAutoFontSize } from './hooks';
import {
  FONT_FAMILY_STACK,
  FONT_FAMILY_LABEL,
  FONT_FAMILY_ORDER,
  TextBannerFontFamily
} from './fonts';
import { findCodeBlock, highlightCode, normaliseCode, type HighlightedCode } from './highlight';
import { cn, widgetContainer } from '@shared/utils/styles';
import { useWidgetState } from '@shared/hooks/useWidgetState';
import { useWorkspaceStore } from '../../../store/workspaceStore.simple';

interface TextBannerState {
  text: string;
  colorIndex: number;
  customColor: string;
  fontFamily: TextBannerFontFamily;
  fontSizeCap: number;
  /** Retained for rollback compatibility; displayed-banner cycling is always enabled. */
  clickToRecolour: boolean;
  columnHeight?: number;
}

type TextBannerDraft = Pick<TextBannerState, 'text' | 'colorIndex' | 'customColor' | 'fontFamily' | 'fontSizeCap'>;

const DEFAULT_COLUMN_HEIGHT = 160;
const MIN_COLUMN_HEIGHT = 60;
const MAX_COLUMN_HEIGHT = 1200;
const EDITOR_MIN_HEIGHT = 260;

interface TextBannerProps {
  savedState?: Partial<TextBannerState> & { text: string };
  onStateChange?: (state: TextBannerState) => void;
  isCompactPanel?: boolean;
}

const colorCombinations = [
  { name: 'Terracotta', bg: 'bg-terracotta-500 dark:bg-terracotta-600', text: 'text-soft-white dark:text-white', swatch: '#d97757' },
  { name: 'Sage', bg: 'bg-sage-600 dark:bg-sage-700', text: 'text-soft-white dark:text-white', swatch: '#5c7560' },
  { name: 'Charcoal', bg: 'bg-warm-gray-800 dark:bg-warm-gray-900', text: 'text-soft-white dark:text-warm-gray-100', swatch: '#3f3a36' },
  { name: 'Rose', bg: 'bg-dusty-rose-600 dark:bg-dusty-rose-700', text: 'text-soft-white dark:text-white', swatch: '#b96370' },
  { name: 'Cream', bg: 'bg-soft-white dark:bg-warm-gray-200', text: 'text-warm-gray-900 dark:text-warm-gray-900', swatch: '#f8f5f0' },
  { name: 'Blue', bg: 'bg-blue-600 dark:bg-blue-700', text: 'text-soft-white dark:text-white', swatch: '#2563eb' }
];

const LEGACY_PLACEHOLDER_TEXT = 'Double-click to edit';
const DEFAULT_FONT_SIZE_CAP = 48;
const MIN_FONT_SIZE_CAP = 24;
const MAX_FONT_SIZE_CAP = 220;
const FONT_SIZE_STEP = 16;
const DEFAULT_CUSTOM_COLOR = '#7c3aed';

const normaliseSavedText = (value: string) => value === LEGACY_PLACEHOLDER_TEXT ? '' : value;
const normaliseCustomColor = (value?: string) =>
  value && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : DEFAULT_CUSTOM_COLOR;

const getCustomTextColor = (hex: string) => {
  const channels = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)]
    .map(channel => Number.parseInt(channel, 16) / 255)
    .map(channel => channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return luminance > 0.179 ? '#1c1917' : '#ffffff';
};

const hexToRgb = (hex: string): RgbColor => ({
  r: Number.parseInt(hex.slice(1, 3), 16),
  g: Number.parseInt(hex.slice(3, 5), 16),
  b: Number.parseInt(hex.slice(5, 7), 16)
});

const rgbToHex = ({ r, g, b }: RgbColor) => `#${[r, g, b]
  .map(channel => Math.round(channel).toString(16).padStart(2, '0'))
  .join('')}`;

const SMART_PUNCT_RE = /[‘’‚‛“”„‟–—…]/;
const hasCodeFence = (value: string) => /```/.test(value);

const formatInlineText = (line: string) => {
  const tokens = line.split(/(\*_[^_]+_\*|\*[^*]+\*|_[^_]+_|~[^~]+~|`[^`]+`)/g);
  return tokens.map((token, index) => {
    if (token.startsWith('*_') && token.endsWith('_*')) {
      return (
        <strong key={`bold-italic-${index}`}><em>{token.slice(2, -2)}</em></strong>
      );
    }
    if (token.startsWith('*') && token.endsWith('*')) {
      return (
        <strong key={`bold-${index}`}>{token.slice(1, -1)}</strong>
      );
    }
    if (token.startsWith('_') && token.endsWith('_')) {
      return (
        <em key={`italic-${index}`}>{token.slice(1, -1)}</em>
      );
    }
    if (token.startsWith('~') && token.endsWith('~')) {
      return (
        <span key={`strike-${index}`} className="line-through">{token.slice(1, -1)}</span>
      );
    }
    if (token.startsWith('`') && token.endsWith('`')) {
      return (
        <span key={`mono-${index}`} className="font-mono">{token.slice(1, -1)}</span>
      );
    }
    return <span key={`text-${index}`}>{token}</span>;
  });
};

const renderFormattedText = (value: string) => {
  const lines = value.split('\n');
  return lines.map((line, index) => (
    <React.Fragment key={`line-${index}`}>
      {(() => {
        const headingMatch = line.match(/^\s*#{1,3}\s+(.*)$/);
        const content = headingMatch ? headingMatch[1] : line;
        const isHeading = Boolean(headingMatch);
        const headingClass = isHeading ? 'font-semibold' : undefined;
        return (
          <span className={headingClass}>
            {formatInlineText(content)}
          </span>
        );
      })()}
      {index < lines.length - 1 ? <br /> : null}
    </React.Fragment>
  ));
};

const TextBanner: React.FC<TextBannerProps> = ({ savedState, onStateChange, isCompactPanel = false }) => {
  const workspaceIsColumnLayout = useWorkspaceStore((state) => state.layoutFormat === 'column');
  const isColumnLayout = workspaceIsColumnLayout && !isCompactPanel;
  const isTouchDevice = typeof window !== 'undefined' && window.matchMedia?.('(hover: none)')?.matches;

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

  const { text, colorIndex, customColor, fontFamily, fontSizeCap, columnHeight } = state;

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [draft, setDraft] = useState<TextBannerDraft>({ text, colorIndex, customColor, fontFamily, fontSizeCap });
  const [pendingHeight, setPendingHeight] = useState<number | null>(null);

  const widgetRef = useRef<HTMLDivElement>(null);
  const textAreaContainerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const editorTriggerRef = useRef<HTMLButtonElement>(null);
  const resizeStartRef = useRef<{ y: number; startHeight: number } | null>(null);
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

  const adjustColumnHeight = (delta: number) => {
    if (!isColumnLayout) return;
    const current = columnHeight ?? widgetRef.current?.offsetHeight ?? DEFAULT_COLUMN_HEIGHT;
    const next = Math.min(MAX_COLUMN_HEIGHT, Math.max(MIN_COLUMN_HEIGHT, current + delta));
    updateState({ columnHeight: next });
  };

  const handleResizeKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 32 : 8;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      adjustColumnHeight(step);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      adjustColumnHeight(-step);
    }
  };

  const pendingHeightRef = useRef<number | null>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);

  // Make sure any in-progress drag listeners are torn down on unmount.
  useEffect(() => {
    return () => {
      resizeCleanupRef.current?.();
      resizeCleanupRef.current = null;
    };
  }, []);

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    if (!isColumnLayout) return;
    e.preventDefault();
    e.stopPropagation();
    const startHeight = widgetRef.current?.offsetHeight ?? columnHeight ?? DEFAULT_COLUMN_HEIGHT;
    resizeStartRef.current = { y: e.clientY, startHeight };
    pendingHeightRef.current = startHeight;
    setPendingHeight(startHeight);

    const handleMove = (ev: MouseEvent) => {
      if (!resizeStartRef.current) return;
      const delta = ev.clientY - resizeStartRef.current.y;
      const next = Math.min(
        MAX_COLUMN_HEIGHT,
        Math.max(MIN_COLUMN_HEIGHT, resizeStartRef.current.startHeight + delta)
      );
      pendingHeightRef.current = next;
      setPendingHeight(next);
    };

    const detach = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      resizeCleanupRef.current = null;
    };

    const handleUp = () => {
      detach();
      const final = pendingHeightRef.current;
      resizeStartRef.current = null;
      pendingHeightRef.current = null;
      setPendingHeight(null);
      if (final !== null) {
        updateState({ columnHeight: final });
      }
    };

    resizeCleanupRef.current = detach;
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  };

  const effectiveColumnHeight = pendingHeight ?? columnHeight;
  const columnStyle = isColumnLayout
    ? isEditorOpen
      ? { height: `${Math.max(effectiveColumnHeight ?? 0, EDITOR_MIN_HEIGHT)}px` }
      : effectiveColumnHeight
        ? { height: `${effectiveColumnHeight}px` }
        : undefined
    : undefined;
  const widgetStyle: React.CSSProperties = {
    ...(columnStyle ?? {}),
    ...(isCustomColor ? { backgroundColor: customColor } : {})
  };

  return (
    <div
      ref={widgetRef}
      className={cn(
        widgetContainer,
        'widget-container-custom-surface',
        !isCustomColor && currentColors.bg,
        'relative overflow-hidden transition-colors duration-300 flex flex-col group/banner'
      )}
      style={widgetStyle}
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

      {text && (
        <button
          ref={editorTriggerRef}
          type="button"
          onClick={openEditor}
          className={cn(
            'no-drag absolute top-2 z-10 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-warm-gray-900/70 px-3 py-2 text-sm font-medium text-white shadow-lg transition-all hover:bg-warm-gray-900/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
            isCompactPanel ? 'right-12' : 'right-2',
            isTouchDevice
              ? 'opacity-100'
              : 'pointer-events-none opacity-0 group-hover/banner:pointer-events-auto group-hover/banner:opacity-100 focus:pointer-events-auto focus:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100',
            isEditorOpen && 'invisible pointer-events-none'
          )}
          aria-label="Edit banner"
          aria-hidden={isEditorOpen || undefined}
        >
          <FaPencil aria-hidden="true" />
          <span>Edit</span>
        </button>
      )}

      <div
        ref={textAreaContainerRef}
        data-testid="text-banner-display"
        aria-hidden={isEditorOpen || undefined}
        onMouseDown={event => {
          surfacePointerStartRef.current = { x: event.clientX, y: event.clientY };
        }}
        onClick={cycleDisplayedColor}
        className={cn(
          'flex-1 flex items-center justify-center relative',
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

interface TextBannerEditorProps {
  draft: TextBannerDraft;
  isNew: boolean;
  onDraftChange: React.Dispatch<React.SetStateAction<TextBannerDraft>>;
  onTextChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onCancel: () => void;
  onSave: () => void;
}

interface CustomColourPickerProps {
  color: string;
  selected: boolean;
  onChange: (color: string) => void;
}

const CustomColourPicker: React.FC<CustomColourPickerProps> = ({ color, selected, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const arrowRef = useRef<SVGSVGElement>(null);
  const {
    refs,
    floatingStyles,
    context
  } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: 'bottom',
    middleware: [
      offset(8),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      arrow({ element: arrowRef })
    ],
    whileElementsMounted: autoUpdate
  });
  const click = useClick(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'dialog' });
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss, role]);

  return (
    <>
      <button
        ref={refs.setReference}
        {...getReferenceProps({
          type: 'button',
          'aria-label': 'Choose custom banner colour',
          'aria-pressed': selected,
          title: 'Custom colour',
          className: cn(
            'inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border p-0 shadow-sm ring-1 ring-inset ring-black/30 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-1 dark:ring-white/50',
            selected
              ? 'border-warm-gray-900 ring-1 ring-warm-gray-900 dark:border-white dark:ring-white'
              : 'border-warm-gray-300 dark:border-warm-gray-600'
          )
        })}
      >
        <span
          data-testid="custom-colour-wheel"
          data-visual="rainbow-ring"
          aria-hidden="true"
          className="h-full w-full rounded-full p-0.5"
          style={{
            backgroundImage: 'conic-gradient(#ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #ef4444)'
          }}
        >
          <span
            className="block h-full w-full rounded-full border border-white/80"
            style={{ backgroundColor: color }}
          />
        </span>
      </button>

      {isOpen && (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false}>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              {...getFloatingProps({
                'aria-label': 'Custom banner colour',
                onPointerDown: event => event.stopPropagation(),
                onMouseDown: event => event.stopPropagation(),
                onTouchStart: event => event.stopPropagation(),
                onKeyDown: event => {
                  if (event.key === 'Escape') event.stopPropagation();
                }
              })}
              className="no-drag no-resize z-[2000] rounded-xl border border-warm-gray-300 bg-soft-white p-2 shadow-xl dark:border-warm-gray-600 dark:bg-warm-gray-800"
              data-dashboard-interactive="true"
            >
              <FloatingArrow
                ref={arrowRef}
                context={context}
                width={14}
                height={7}
                className="fill-soft-white stroke-warm-gray-300 dark:fill-warm-gray-800 dark:stroke-warm-gray-600"
              />
              <RgbColorPicker
                color={hexToRgb(color)}
                onChange={nextColor => onChange(rgbToHex(nextColor))}
                aria-label="Custom banner RGB colour"
                style={{ width: 176, height: 144 }}
              />
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
};

const TextBannerEditor: React.FC<TextBannerEditorProps> = ({
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

interface CodeBlockRenderProps {
  code: string;
  language: string;
  fontSize: number;
}

const CodeBlockRender = React.forwardRef<HTMLDivElement, CodeBlockRenderProps>(
  ({ code, language, fontSize }, ref) => {
    const [highlighted, setHighlighted] = useState<HighlightedCode | null>(null);

    const normalised = useMemo(() => normaliseCode(code), [code]);

    useEffect(() => {
      let cancelled = false;
      highlightCode(normalised, language)
        .then((result) => {
          if (!cancelled) setHighlighted(result);
        })
        .catch(() => {
          if (!cancelled) setHighlighted({ html: escapeHtml(normalised), language: 'plaintext' });
        });
      return () => {
        cancelled = true;
      };
    }, [normalised, language]);

    return (
      <div
        ref={ref}
        className="max-w-full"
        style={{ fontSize: `${fontSize}px` }}
      >
        <pre className="text-banner-code">
          <code
            dangerouslySetInnerHTML={{
              __html: highlighted?.html ?? escapeHtml(normalised)
            }}
          />
        </pre>
      </div>
    );
  }
);
CodeBlockRender.displayName = 'CodeBlockRender';

const escapeHtml = (input: string) =>
  input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export default TextBanner;
