import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { FaMinus, FaPlus, FaLock, FaLockOpen, FaXmark } from 'react-icons/fa6';
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
  fontFamily: TextBannerFontFamily;
  fontSizeCap: number;
  clickToRecolour: boolean;
  columnHeight?: number;
}

const DEFAULT_COLUMN_HEIGHT = 160;
const MIN_COLUMN_HEIGHT = 60;
const MAX_COLUMN_HEIGHT = 1200;

interface TextBannerProps {
  savedState?: Partial<TextBannerState> & { text: string };
  onStateChange?: (state: TextBannerState) => void;
}

const colorCombinations = [
  { bg: 'bg-terracotta-500 dark:bg-terracotta-600', text: 'text-soft-white dark:text-white', swatch: '#d97757' },
  { bg: 'bg-sage-600 dark:bg-sage-700', text: 'text-soft-white dark:text-white', swatch: '#5c7560' },
  { bg: 'bg-warm-gray-800 dark:bg-warm-gray-900', text: 'text-soft-white dark:text-warm-gray-100', swatch: '#3f3a36' },
  { bg: 'bg-dusty-rose-600 dark:bg-dusty-rose-700', text: 'text-soft-white dark:text-white', swatch: '#b96370' },
  { bg: 'bg-soft-white dark:bg-warm-gray-200', text: 'text-warm-gray-900 dark:text-warm-gray-900', swatch: '#f8f5f0' },
  { bg: 'bg-blue-600 dark:bg-blue-700', text: 'text-soft-white dark:text-white', swatch: '#2563eb' }
];

const PLACEHOLDER_TEXT = 'Double-click to edit';
const DEFAULT_FONT_SIZE_CAP = 96;
const MIN_FONT_SIZE_CAP = 24;
const MAX_FONT_SIZE_CAP = 220;
const FONT_SIZE_STEP = 16;

const normaliseText = (value: string) => (value.length > 0 ? value : PLACEHOLDER_TEXT);

const SMART_PUNCT_RE = /[‘’‚‛“”„‟–—…]/;
const hasCodeFence = (value: string) => /```/.test(value);

// Returns true when the caret is between an opening and closing ``` fence.
const isCursorInsideFence = (text: string, cursor: number) => {
  let count = 0;
  let i = 0;
  while (true) {
    const next = text.indexOf('```', i);
    if (next === -1 || next >= cursor) break;
    count++;
    i = next + 3;
  }
  return count % 2 === 1;
};

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

const TextBanner: React.FC<TextBannerProps> = ({ savedState, onStateChange }) => {
  const isColumnLayout = useWorkspaceStore((state) => state.layoutFormat === 'column');

  const initialState: TextBannerState = {
    text: PLACEHOLDER_TEXT,
    colorIndex: 0,
    fontFamily: 'sans',
    fontSizeCap: DEFAULT_FONT_SIZE_CAP,
    clickToRecolour: true
  };

  const normalisedSavedState: TextBannerState | undefined = savedState
    ? {
        text: normaliseText(savedState.text),
        colorIndex: savedState.colorIndex ?? 0,
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

  const { text, colorIndex, fontFamily, fontSizeCap, clickToRecolour, columnHeight } = state;

  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(text);
  const [controlsVisible, setControlsVisible] = useState(() => !savedState);
  const [pendingHeight, setPendingHeight] = useState<number | null>(null);

  const widgetRef = useRef<HTMLDivElement>(null);
  const textAreaContainerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resizeStartRef = useRef<{ y: number; startHeight: number } | null>(null);
  const clickTimerRef = useRef<number | null>(null);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);

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

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    return () => {
      if (clickTimerRef.current !== null) {
        window.clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
    };
  }, []);

  // Dismiss controls on outside click (when not editing)
  useEffect(() => {
    if (!controlsVisible || isEditing) return;
    const handler = (event: MouseEvent) => {
      if (!widgetRef.current) return;
      if (!widgetRef.current.contains(event.target as Node)) {
        setControlsVisible(false);
      }
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [controlsVisible, isEditing]);

  const commitText = useCallback((nextText: string) => {
    const value = hasCodeFence(nextText) ? normaliseCode(nextText) : nextText;
    updateState({ text: normaliseText(value) });
  }, [updateState]);

  const handleEditChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
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
      setEditText(value);
      requestAnimationFrame(() => {
        if (ta.isConnected) {
          ta.selectionStart = ta.selectionEnd = adjustedCursor;
        }
      });
    } else {
      setEditText(value);
    }
  };

  const handleBlur = () => {
    commitText(editText);
    setIsEditing(false);
    setControlsVisible(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      commitText(editText);
      setIsEditing(false);
      setControlsVisible(false);
      return;
    }
    if (e.key === 'Tab' && isCursorInsideFence(editText, e.currentTarget.selectionStart)) {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const next = editText.slice(0, start) + '  ' + editText.slice(end);
      setEditText(next);
      requestAnimationFrame(() => {
        if (ta.isConnected) {
          ta.selectionStart = ta.selectionEnd = start + 2;
        }
      });
    }
  };

  const wasDrag = (e: React.MouseEvent) => {
    if (!mouseDownPosRef.current) return false;
    const dx = e.clientX - mouseDownPosRef.current.x;
    const dy = e.clientY - mouseDownPosRef.current.y;
    return Math.sqrt(dx * dx + dy * dy) > 5;
  };

  const handleTextAreaClick = (e: React.MouseEvent) => {
    if (isEditing || e.detail !== 1 || wasDrag(e)) return;
    if (!clickToRecolour) return;
    if (clickTimerRef.current) {
      window.clearTimeout(clickTimerRef.current);
    }
    clickTimerRef.current = window.setTimeout(() => {
      updateState({ colorIndex: (colorIndex + 1) % colorCombinations.length });
      clickTimerRef.current = null;
    }, 500);
  };

  const enterEditMode = () => {
    if (clickTimerRef.current) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    setIsEditing(true);
    setEditText(text === PLACEHOLDER_TEXT ? '' : text);
    setControlsVisible(true);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (wasDrag(e)) return;
    enterEditMode();
  };

  const currentColors = colorCombinations[colorIndex];

  const stopAll = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  // Prevent the textarea from losing focus when the toolbar is clicked.
  const preventToolbarBlur = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const adjustFontCap = (delta: number) => {
    const next = Math.min(MAX_FONT_SIZE_CAP, Math.max(MIN_FONT_SIZE_CAP, fontSizeCap + delta));
    updateState({ fontSizeCap: next });
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

  return (
    <div
      ref={widgetRef}
      className={cn(
        widgetContainer,
        currentColors.bg,
        'relative overflow-hidden transition-colors duration-300 flex flex-col group/banner'
      )}
      style={isColumnLayout && effectiveColumnHeight ? { height: `${effectiveColumnHeight}px` } : undefined}
      onDoubleClick={handleDoubleClick}
    >
      {controlsVisible && (
        <div
          className="flex-shrink-0 z-20 flex flex-col items-center gap-1.5 px-3 py-2 bg-warm-gray-900/85 dark:bg-black/80 text-soft-white backdrop-blur-sm text-xs select-none"
          onMouseDown={preventToolbarBlur}
          onClick={stopAll}
          onDoubleClick={stopAll}
        >
          {/* Row 1: colours + lock | dismiss */}
          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            <div className="flex items-center gap-1">
              {colorCombinations.map((combo, idx) => (
                <button
                  key={combo.swatch}
                  type="button"
                  onClick={() => updateState({ colorIndex: idx })}
                  className={cn(
                    'w-5 h-5 rounded-full border transition-transform hover:scale-110',
                    idx === colorIndex ? 'border-soft-white ring-2 ring-soft-white/40' : 'border-warm-gray-500'
                  )}
                  style={{ backgroundColor: combo.swatch }}
                  aria-label={`Use colour ${idx + 1}`}
                />
              ))}
              <button
                type="button"
                onClick={() => updateState({ clickToRecolour: !clickToRecolour })}
                className={cn(
                  'w-7 h-7 ml-1 flex items-center justify-center rounded-full transition-colors',
                  clickToRecolour ? 'hover:bg-warm-gray-700/60' : 'bg-soft-white text-warm-gray-900'
                )}
                aria-label={clickToRecolour ? 'Disable click-to-recolour' : 'Enable click-to-recolour'}
                title={clickToRecolour ? 'Click cycles colour — click to lock' : 'Colour locked — click to unlock'}
              >
                {clickToRecolour ? <FaLockOpen className="w-3 h-3" /> : <FaLock className="w-3 h-3" />}
              </button>
            </div>

            <span className="w-px h-5 bg-warm-gray-500/60 mx-0.5" aria-hidden />

            <button
              type="button"
              onClick={() => setControlsVisible(false)}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-warm-gray-700/60"
              aria-label="Hide controls"
              title="Hide controls"
            >
              <FaXmark className="w-3 h-3" />
            </button>
          </div>

          {/* Row 2: font family | font size */}
          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            <div className="flex items-center gap-1">
              {FONT_FAMILY_ORDER.map((family) => (
                <button
                  key={family}
                  type="button"
                  onClick={() => updateState({ fontFamily: family })}
                  className={cn(
                    'px-2 py-1 rounded-md text-[11px] leading-none transition-colors',
                    fontFamily === family
                      ? 'bg-soft-white text-warm-gray-900'
                      : 'hover:bg-warm-gray-700/60'
                  )}
                  style={{ fontFamily: FONT_FAMILY_STACK[family] }}
                  title={FONT_FAMILY_LABEL[family]}
                  aria-label={`Use ${FONT_FAMILY_LABEL[family]} font`}
                >
                  Aa
                </button>
              ))}
            </div>

            <span className="w-px h-5 bg-warm-gray-500/60 mx-0.5" aria-hidden />

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => adjustFontCap(-FONT_SIZE_STEP)}
                disabled={fontSizeCap <= MIN_FONT_SIZE_CAP}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-warm-gray-700/60 disabled:opacity-40"
                aria-label="Decrease maximum font size"
                title="Decrease size"
              >
                <FaMinus className="w-3 h-3" />
              </button>
              <span className="text-[10px] tabular-nums w-8 text-center opacity-80">{fontSizeCap}px</span>
              <button
                type="button"
                onClick={() => adjustFontCap(FONT_SIZE_STEP)}
                disabled={fontSizeCap >= MAX_FONT_SIZE_CAP}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-warm-gray-700/60 disabled:opacity-40"
                aria-label="Increase maximum font size"
                title="Increase size"
              >
                <FaPlus className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        ref={textAreaContainerRef}
        className={cn(
          'flex-1 flex items-center justify-center p-4 relative',
          // Only constrain the content pane when the widget itself has a bounded height
          // (canvas mode is always bounded via react-rnd; column mode only when columnHeight is set).
          (!isColumnLayout || hasManualColumnHeight) && 'min-h-0 overflow-hidden',
          clickToRecolour && !isEditing ? 'cursor-pointer' : ''
        )}
        onMouseDown={(e) => {
          mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
        }}
        onClick={handleTextAreaClick}
      >
        {isEditing ? (
          <div className="flex flex-col w-full h-full gap-1">
            <textarea
              ref={textareaRef}
              value={editText}
              onChange={handleEditChange}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              spellCheck={!hasCodeFence(editText)}
              autoCorrect="off"
              autoCapitalize="off"
              autoComplete="off"
              data-gramm="false"
              data-enable-grammarly="false"
              style={{
                fontFamily: hasCodeFence(editText) ? FONT_FAMILY_STACK.mono : FONT_FAMILY_STACK[fontFamily]
              }}
              className="flex-1 min-h-0 w-full p-4 text-base bg-soft-white dark:bg-warm-gray-700 text-warm-gray-800 dark:text-warm-gray-200 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-terracotta-600 dark:focus:ring-terracotta-500"
              placeholder="Enter your message... (use ```language for code blocks)"
              autoFocus
            />
            <div className={cn('text-[11px] text-center opacity-70 select-none', currentColors.text)}>
              <a
                href="https://commonmark.org/help/"
                target="_blank"
                rel="noopener noreferrer"
                onMouseDown={(e) => e.preventDefault()}
                className="underline hover:opacity-100"
              >
                Markdown
              </a>{' '}
              supported (subset)
            </div>
          </div>
        ) : isCodeBlockOnly && codeBlock ? (
          <CodeBlockRender
            ref={textRef}
            code={codeBlock.code}
            language={codeBlock.language}
            fontSize={fontSize}
          />
        ) : (
          <div
            ref={textRef}
            className={cn(currentColors.text, 'text-center leading-tight select-none')}
            style={{
              fontSize: `${fontSize}px`,
              fontFamily: FONT_FAMILY_STACK[fontFamily]
            }}
            title="Double-click to edit"
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
          tabIndex={0}
          onMouseDown={handleResizeMouseDown}
          onKeyDown={handleResizeKeyDown}
          className={cn(
            'absolute bottom-0 left-0 right-0 h-2 flex items-center justify-center cursor-ns-resize select-none',
            'opacity-0 group-hover/banner:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-soft-white/70 transition-opacity',
            pendingHeight !== null && 'opacity-100'
          )}
        >
          <div className="w-10 h-1 rounded-full bg-soft-white/60" />
        </div>
      )}
    </div>
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
