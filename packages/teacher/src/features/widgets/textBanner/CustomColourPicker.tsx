import React, { useRef, useState } from 'react';
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
import { RgbColorPicker } from 'react-colorful';
import { cn } from '@shared/utils/styles';
import { hexToRgb, rgbToHex } from './textBannerTheme';

interface CustomColourPickerProps {
  color: string;
  selected: boolean;
  onChange: (color: string) => void;
}

export const CustomColourPicker: React.FC<CustomColourPickerProps> = ({ color, selected, onChange }) => {
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
