import React, { useEffect, useState, useRef, useMemo } from 'react';

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
const LINE_HEIGHT = 1.2;
const MIN_ITEM_HEIGHT = 50;
const ITEM_VERTICAL_PADDING = 16; // py-2 on each item pill
const ITEM_HORIZONTAL_PADDING = 32; // px-4 on each item pill
// Multi-line fallbacks: cap the font a bit lower as line count grows
const MULTI_LINE_STEPS = [
  { lines: 2, maxFontSize: 24 },
  { lines: 3, maxFontSize: 20 }
];

interface ItemLayout {
  fontSize: number;
  lines: number;
}

let measureContext: CanvasRenderingContext2D | null = null;

function measureTextWidth(text: string, font: string): number {
  if (!measureContext) {
    measureContext = document.createElement('canvas').getContext('2d');
  }
  if (!measureContext) {
    // Rough fallback if canvas is unavailable
    return text.length * MAX_FONT_SIZE * 0.55;
  }
  measureContext.font = font;
  return measureContext.measureText(text).width;
}

// Approximate how many lines the browser's greedy word wrap will use
function countWrappedLines(text: string, fontSize: number, fontFamily: string, maxWidth: number): number {
  const font = `700 ${fontSize}px ${fontFamily}`;
  const words = text.split(/\s+/).filter(Boolean);
  const spaceWidth = measureTextWidth(' ', font);
  let lines = 1;
  let lineWidth = 0;
  for (const word of words) {
    const wordWidth = measureTextWidth(word, font);
    if (wordWidth > maxWidth) {
      // A word wider than the line wraps mid-word (break-words) across several lines
      if (lineWidth > 0) lines++;
      lines += Math.ceil(wordWidth / maxWidth) - 1;
      lineWidth = wordWidth % maxWidth;
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
  const slotAreaRef = useRef<HTMLDivElement>(null);
  const [slotAreaWidth, setSlotAreaWidth] = useState(0);
  const [fontFamily, setFontFamily] = useState('sans-serif');

  useEffect(() => {
    const element = slotAreaRef.current;
    if (!element) return;
    setFontFamily(getComputedStyle(element).fontFamily);
    const observer = new ResizeObserver((entries) => {
      setSlotAreaWidth(entries[0].contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Shrink long items to fit the widget width; when even the minimum font size
  // can't fit one line, wrap onto two then three lines (sacrificing slot height)
  // before finally truncating with an ellipsis.
  const itemLayouts = useMemo(() => {
    const layouts = new Map<string, ItemLayout>();
    // max-w-[80%] of the slot area, minus the pill's own padding
    const availableWidth = slotAreaWidth * 0.8 - ITEM_HORIZONTAL_PADDING;
    for (const item of items) {
      if (availableWidth <= 0 || !item) {
        layouts.set(item, { fontSize: MAX_FONT_SIZE, lines: 1 });
        continue;
      }
      const fullWidth = measureTextWidth(item, `700 ${MAX_FONT_SIZE}px ${fontFamily}`);
      const singleLineFit = (MAX_FONT_SIZE * availableWidth) / fullWidth;
      if (singleLineFit >= MIN_FONT_SIZE) {
        layouts.set(item, { fontSize: Math.min(MAX_FONT_SIZE, singleLineFit), lines: 1 });
        continue;
      }
      let layout: ItemLayout | null = null;
      for (const step of MULTI_LINE_STEPS) {
        if (countWrappedLines(item, MIN_FONT_SIZE, fontFamily, availableWidth) <= step.lines) {
          // Binary search for the largest font size that still wraps within step.lines
          let low = MIN_FONT_SIZE;
          let high = step.maxFontSize;
          for (let i = 0; i < 7; i++) {
            const mid = (low + high) / 2;
            if (countWrappedLines(item, mid, fontFamily, availableWidth) <= step.lines) {
              low = mid;
            } else {
              high = mid;
            }
          }
          layout = { fontSize: low, lines: step.lines };
          break;
        }
      }
      // Extremely long item: keep minimum size at 3 lines; the clamp adds an ellipsis
      layouts.set(item, layout ?? { fontSize: MIN_FONT_SIZE, lines: 3 });
    }
    return layouts;
  }, [items, slotAreaWidth, fontFamily]);

  // All slot rows share one height (the tallest pill) so the reel stays evenly spaced
  const maxPillHeight = useMemo(() => {
    let max = 0;
    for (const layout of itemLayouts.values()) {
      max = Math.max(max, layout.lines * layout.fontSize * LINE_HEIGHT + ITEM_VERTICAL_PADDING);
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
  const itemHeight = Math.max(MIN_ITEM_HEIGHT, Math.ceil(maxPillHeight) + 4);

  return (
    <div className="relative w-full h-full overflow-hidden bg-gradient-to-br from-purple-400 via-pink-400 to-yellow-400 dark:from-purple-600 dark:via-pink-600 dark:to-yellow-600 rounded-lg">
      {/* Colorful background overlay for slot machine effect */}
      <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/20 to-transparent animate-pulse" />
      
      {/* Gradient masks for fade effect */}
      <div className="absolute inset-0 pointer-events-none z-10">
        <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/40 dark:from-black/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-white/40 dark:from-black/40 to-transparent" />
      </div>
      
      
      {/* Items container */}
      <div className="absolute inset-0 flex items-center justify-center px-4">
        <div ref={slotAreaRef} className="relative w-full" style={{ height: `${itemHeight * 2.5}px` }}>
          {[-2, -1, 0, 1, 2].map((position) => {
            const yOffset = (position - displayOffset) * itemHeight;
            const yPosition = (position - displayOffset) / 1.5; // Normalize to -1 to 1 range for center item
            const opacity = getOpacity(yPosition);
            const scale = getScale(yPosition);
            const item = getItemAtPosition(position);
            const layout = itemLayouts.get(item) ?? { fontSize: MAX_FONT_SIZE, lines: 1 };

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
                    className={layout.lines > 1 ? 'break-words' : 'whitespace-nowrap overflow-hidden text-ellipsis'}
                    style={{
                      fontSize: `${layout.fontSize}px`,
                      lineHeight: LINE_HEIGHT,
                      ...(layout.lines > 1
                        ? {
                            display: '-webkit-box',
                            WebkitBoxOrient: 'vertical' as const,
                            WebkitLineClamp: layout.lines,
                            overflow: 'hidden'
                          }
                        : {})
                    }}
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