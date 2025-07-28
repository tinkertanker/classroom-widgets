import { useEffect, useRef } from 'react';

type Props = Record<string, any>;

/**
 * Custom hook to help identify why a component re-rendered
 * Logs changed props to the console
 * 
 * Usage:
 * useWhyDidYouUpdate('ComponentName', props);
 */
export function useWhyDidYouUpdate(name: string, props: Props) {
  const previousProps = useRef<Props>();

  useEffect(() => {
    if (previousProps.current) {
      const allKeys = Object.keys({ ...previousProps.current, ...props });
      const changedProps: Props = {};

      allKeys.forEach((key) => {
        if (previousProps.current![key] !== props[key]) {
          changedProps[key] = {
            from: previousProps.current![key],
            to: props[key],
          };
        }
      });

      if (Object.keys(changedProps).length > 0) {
        console.log('[why-did-you-update]', name, changedProps);
      }
    }

    previousProps.current = props;
  });
}