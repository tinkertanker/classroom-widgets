import React, { useEffect, useLayoutEffect, useState, useRef, useMemo } from 'react';

interface SlotMachineProps {
  items: string[];
  selectedIndex: number;
  isSpinning: boolean;
  duration: number;
  onSpinComplete?: () => void;
}

// Font sizing bounds for slot items (text-3xl = 30px is the original fixed size)
const MAX_FONT_SIZE = 30;
const MIN_FONT_SIZE = 16;
const FONT_WEIGHT = 700; // font-bold on the pill
const LINE_HEIGHT = 1.2;
const MIN_ITEM_HEIGHT = 50;
const ITEM_VERTICAL_PADDING = 16; // py-2 on each item pill
const ITEM_HORIZONTAL_PADDING = 32; // px-4 on each item pill
const ITEMS_CONTAINER_PADDING = 32; // px-4 on the items container
const FIT_MARGIN = 2; // guard against canvas-vs-DOM subpixel differences
// break-words splits long words at character boundaries, leaving slack at
// each line end; assume lines only fill to this fraction when estimating
const CHAR_WRAP_EFFICIENCY = 0.9;
// Multi-line pills must stay within the middle of the reel, clear of the
// top/bottom gradient masks, so the winner is fully readable
const PILL_HEIGHT_BUDGET_RATIO = 0.5;
// Multi-line fallbacks: cap the font a bit lower as line count grows
const MULTI_LINE_STEPS = [
  { lines: 2, maxFontSize: 24 },
  { lines: 3, maxFontSize: 20 }
];

interface ItemLayout {
  fontSize: number;
  lines: number;
}

const DEFAULT_LAYOUT: ItemLayout = { fontSize: MAX_FONT_SIZE, lines: 1 };

const slotFont = (fontSize: number, fontFamily: string) =>
  `${FONT_WEIGHT} ${fontSize}px ${fontFamily}`;

let measureContext: CanvasRenderingContext2D | null = null;

function measureTextWidth(text: string, font: string): number {
  if (!measureContext) {
    measureContext = document.createElement('canvas').getContext('2d');
  }
  if (!measureContext) {
    // Rough fallback if canvas is unavailable
    const fontSize = parseFloat(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? `${MAX_FONT_SIZE}`);
    return text.length * fontSize * 0.55;
  }
  measureContext.font = font;
  return measureContext.measureText(text).width;
}

// Approximate how many lines the browser's greedy word wrap will use.
// NBSP is excluded from the split: the browser does not wrap on it.
function countWrappedLines(text: string, fontSize: number, fontFamily: string, maxWidth: number): number {
  const font = slotFont(fontSize, fontFamily);
  const words = text.split(/[^\S\u00A0]+/).filter(Boolean);
  const spaceWidth = measureTextWidth(' ', font);
  let lines = 1;
  let lineWidth = 0;
  for (const word of words) {
    const wordWidth = measureTextWidth(word, font);
    if (wordWidth > maxWidth) {
      // A word wider than the line wraps mid-word (break-words) across several lines
      const effectiveWidth = maxWidth * CHAR_WRAP_EFFICIENCY;
      const wordLines = Math.ceil(wordWidth / effectiveWidth);
      if (lineWidth > 0) lines++;
      lines += wordLines - 1;
      lineWidth = wordWidth - (wordLines - 1) * effectiveWidth;
      continue;
    }
    const widthWithWord = lineWidth > 0 ? lineWidth + spaceWidth + wordWidth : wordWidth;
    if (widthWithWord > maxWidth) {
      lines++;
      lineWidth = wordWidth;
    } else {
      lineWidth = widthWithWord;
    }
  }
  return lines;
}

const SlotMachine: React.FC<SlotMachineProps> = ({ 
  items, 
  selectedIndex, 
  isSpinning, 
  duration,
  onSpinComplete 
}) => {
  const [displayIndex, setDisplayIndex] = useState(0);
  const [displayOffset, setDisplayOffset] = useState(0);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const startIndexRef = useRef<number>(0);
  const targetStepsRef = useRef<number>(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const [slotAreaWidth, setSlotAreaWidth] = useState(0);
  const [rootHeight, setRootHeight] = useState(0);
  const [fontFamily, setFontFamily] = useState('sans-serif');
  const [fontsLoaded, setFontsLoaded] = useState(false);

  // Layout effect + synchronous initial read so the first painted frame
  // already has real metrics (the parent remount-keys this component on
  // every spin, so a post-paint effect would flash wrong sizes each time)
  useLayoutEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    setFontFamily(getComputedStyle(element).fontFamily);
    const applySize = (width: number, height: number) => {
      // Rounded to suppress sub-pixel churn during live widget resizes
      setSlotAreaWidth(Math.round(width) - ITEMS_CONTAINER_PADDING);
      setRootHeight(Math.round(height));
    };
    // clientWidth/Height are CSS layout pixels, consistent with the observer's
    // contentRect; getBoundingClientRect would bake in the board's zoom scale
    applySize(element.clientWidth, element.clientHeight);
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      applySize(width, height);
    });
    observer.observe(element);
    // Canvas metrics taken before the webfont (Poppins) finishes loading use
    // fallback-font widths; re-measure once fonts are ready
    let cancelled = false;
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (!cancelled) setFontsLoaded(true);
      });
    }
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  // Shrink long items to fit the widget width; when even the minimum font size
  // can't fit one line, wrap onto two then three lines (sacrificing slot height,
  // within a budget that keeps the pill clear of the gradient masks) before
  // finally truncating with an ellipsis.
  const itemLayouts = useMemo(() => {
    const layouts = new Map<string, ItemLayout>();
    // max-w-[80%] of the slot area, minus the pill's own padding
    const availableWidth = slotAreaWidth * 0.8 - ITEM_HORIZONTAL_PADDING - FIT_MARGIN;
    const pillHeightBudget = rootHeight > 0 ? rootHeight * PILL_HEIGHT_BUDGET_RATIO : Infinity;
    const pillFits = (lines: number, fontSize: number) =>
      lines * fontSize * LINE_HEIGHT + ITEM_VERTICAL_PADDING <= pillHeightBudget;
    for (const item of items) {
      if (availableWidth <= 0 || !item) {
        layouts.set(item, DEFAULT_LAYOUT);
        continue;
      }
      const fullWidth = measureTextWidth(item, slotFont(MAX_FONT_SIZE, fontFamily));
      const singleLineFit = (MAX_FONT_SIZE * availableWidth) / fullWidth;
      if (singleLineFit >= MIN_FONT_SIZE) {
        layouts.set(item, { fontSize: Math.min(MAX_FONT_SIZE, singleLineFit), lines: 1 });
        continue;
      }
      const linesAtMinFont = countWrappedLines(item, MIN_FONT_SIZE, fontFamily, availableWidth);
      let layout: ItemLayout | null = null;
      let tallestAllowedStep: { lines: number; maxFontSize: number } | null = null;
      for (const step of MULTI_LINE_STEPS) {
        if (!pillFits(step.lines, MIN_FONT_SIZE)) break; // taller steps won't fit either
        tallestAllowedStep = step;
        if (linesAtMinFont <= step.lines) {
          // Binary search for the largest font size that still wraps within
          // step.lines and keeps the pill within the height budget
          let low = MIN_FONT_SIZE;
          let high = step.maxFontSize;
          for (let i = 0; i < 7; i++) {
            const mid = (low + high) / 2;
            if (
              pillFits(step.lines, mid) &&
              countWrappedLines(item, mid, fontFamily, availableWidth) <= step.lines
            ) {
              low = mid;
            } else {
              high = mid;
            }
          }
          layout = { fontSize: low, lines: step.lines };
          break;
        }
      }
      // Extreme cases: clamp at the tallest step the widget height allows
      // (the clamp adds an ellipsis), or a single ellipsized line on very
      // short widgets — the pre-existing behavior
      layouts.set(
        item,
        layout ?? { fontSize: MIN_FONT_SIZE, lines: tallestAllowedStep?.lines ?? 1 }
      );
    }
    return layouts;
    // fontsLoaded re-runs the measurement after the webfont swap
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, slotAreaWidth, rootHeight, fontFamily, fontsLoaded]);

  // Multi-line pills stretch the shared row height so the reel stays evenly
  // spaced; single-line pills keep the original 50px rows
  const maxMultiLinePillHeight = useMemo(() => {
    let max = 0;
    for (const layout of itemLayouts.values()) {
      if (layout.lines > 1) {
        max = Math.max(max, layout.lines * layout.fontSize * LINE_HEIGHT + ITEM_VERTICAL_PADDING);
      }
    }
    return max;
  }, [itemLayouts]);

  useEffect(() => {
    if (isSpinning && items.length > 0) {
      // Cancel any ongoing animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      
      
      // Store current position as starting point
      startIndexRef.current = displayIndex;
      
      // Calculate how many steps to take to reach selectedIndex
      // Adjust rotations based on number of items - fewer rotations for more items
      const baseRotations = items.length <= 10 ? 8 : items.length <= 20 ? 6 : 4;
      const rotations = baseRotations + Math.random() * 2; // Add some randomness
      const fullRotationSteps = Math.floor(rotations) * items.length;
      
      // Calculate shortest path to selected index
      let stepsToTarget = selectedIndex - startIndexRef.current;
      if (stepsToTarget < 0) {
        stepsToTarget += items.length;
      }
      
      targetStepsRef.current = fullRotationSteps + stepsToTarget;
      
      // Start animation
      startTimeRef.current = performance.now();
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTimeRef.current;
        const progress = Math.min(elapsed / duration, 1);
        
        // Use a more aggressive easing function for smoother deceleration
        // This creates a longer deceleration phase at the end
        let easedProgress;
        if (progress < 0.7) {
          // First 70% - maintain good speed
          easedProgress = progress / 0.7 * 0.85;
        } else {
          // Last 30% - strong deceleration
          const slowPhase = (progress - 0.7) / 0.3;
          const eased = 1 - Math.pow(1 - slowPhase, 4);
          easedProgress = 0.85 + eased * 0.15;
        }
        
        // Calculate current position
        const totalProgress = easedProgress * targetStepsRef.current;
        const currentStep = Math.floor(totalProgress);
        const offsetProgress = totalProgress - currentStep;
        
        // Update display
        const newIndex = (startIndexRef.current + currentStep) % items.length;
        setDisplayIndex(newIndex);
        setDisplayOffset(offsetProgress);
        
        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          // Ensure we end exactly at selected index
          setDisplayIndex(selectedIndex);
          setDisplayOffset(0);
          if (onSpinComplete) {
            onSpinComplete();
          }
        }
      };
      
      animationRef.current = requestAnimationFrame(animate);
      
      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
  }, [isSpinning, selectedIndex, items.length, duration, onSpinComplete]);
  
  const getItemAtPosition = (position: number) => {
    if (items.length === 0) return '';
    const index = (displayIndex + position + items.length) % items.length;
    return items[index];
  };
  
  const getOpacity = (yPosition: number) => {
    // yPosition is -1 to 1, where 0 is center
    const distance = Math.abs(yPosition);
    return Math.max(0, 1 - distance);
  };
  
  const getScale = (yPosition: number) => {
    // Scale from 0.7 at edges to 1 at center
    const distance = Math.abs(yPosition);
    return 1 - (distance * 0.3);
  };
  
  if (items.length === 0) {
    return <div className="text-warm-gray-500 dark:text-warm-gray-400">No items to display</div>;
  }
  
  // Calculate positions for visible items; multi-line items need taller slots
  // (+4 breathing room between rows)
  const itemHeight = Math.max(MIN_ITEM_HEIGHT, Math.ceil(maxMultiLinePillHeight) + 4);

  return (
    <div ref={rootRef} className="relative w-full h-full overflow-hidden bg-gradient-to-br from-purple-400 via-pink-400 to-yellow-400 dark:from-purple-600 dark:via-pink-600 dark:to-yellow-600 rounded-lg">
      {/* Colorful background overlay for slot machine effect */}
      <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/20 to-transparent animate-pulse" />
      
      {/* Gradient masks for fade effect */}
      <div className="absolute inset-0 pointer-events-none z-10">
        <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/40 dark:from-black/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-white/40 dark:from-black/40 to-transparent" />
      </div>
      
      
      {/* Items container */}
      <div className="absolute inset-0 flex items-center justify-center px-4">
        <div className="relative w-full" style={{ height: `${itemHeight * 2.5}px` }}>
          {[-2, -1, 0, 1, 2].map((position) => {
            const yOffset = (position - displayOffset) * itemHeight;
            const yPosition = (position - displayOffset) / 1.5; // Normalize to -1 to 1 range for center item
            const opacity = getOpacity(yPosition);
            const scale = getScale(yPosition);
            const item = getItemAtPosition(position);
            const layout = itemLayouts.get(item) ?? DEFAULT_LAYOUT;

            return (
              <div
                key={position}
                className="absolute flex items-center justify-center w-full"
                style={{
                  transform: `translateY(${yOffset}px) scale(${scale})`,
                  opacity: opacity,
                  top: '50%',
                  marginTop: `-${itemHeight / 2}px`,
                  height: `${itemHeight}px`,
                  left: 0,
                }}
              >
                <div className="px-4 py-2 text-gray-900 font-bold bg-white/80 backdrop-blur-sm rounded-lg shadow-md max-w-[80%] text-center">
                  {/* Line clamping lives on this inner padding-free element:
                      overflow clipping on the padded pill would let a clipped
                      extra line show through the bottom padding */}
                  <div
                    className={
                      layout.lines === 1
                        ? 'whitespace-nowrap overflow-hidden text-ellipsis'
                        : layout.lines === 2
                          ? 'line-clamp-2 break-words'
                          : 'line-clamp-3 break-words'
                    }
                    style={{ fontSize: `${layout.fontSize}px`, lineHeight: LINE_HEIGHT }}
                  >
                    {item}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SlotMachine;