import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const debugMock = vi.hoisted(() => {
  const fn = vi.fn() as ReturnType<typeof vi.fn> & { error: ReturnType<typeof vi.fn> };
  fn.error = vi.fn();
  return fn;
});

vi.mock('@shared/utils/debug', () => ({ debug: debugMock }));

import { enableRenderTracking, useRenderTracker } from './enableRenderTracking';

const originalNodeEnv = process.env.NODE_ENV;
const originalCreateElement = React.createElement;
const reactWithMutableCreateElement = React as typeof React & {
  createElement: typeof React.createElement;
};

describe('render tracking utilities', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    reactWithMutableCreateElement.createElement = originalCreateElement;
    debugMock.mockClear();
  });

  afterEach(() => {
    cleanup();
    process.env.NODE_ENV = originalNodeEnv;
    reactWithMutableCreateElement.createElement = originalCreateElement;
  });

  it('patches createElement in development and logs tracked renders', () => {
    enableRenderTracking();

    expect(reactWithMutableCreateElement.createElement).not.toBe(originalCreateElement);
    expect(debugMock).toHaveBeenCalledWith(
      expect.stringContaining('Render tracking enabled'),
      expect.any(String)
    );

    function NamedComponent() {
      return <div>tracked</div>;
    }
    render(React.createElement(NamedComponent));

    expect(debugMock).toHaveBeenCalledWith('[Render] NamedComponent');
  });

  it('is a no-op outside development', () => {
    process.env.NODE_ENV = 'production';

    enableRenderTracking();

    expect(reactWithMutableCreateElement.createElement).toBe(originalCreateElement);
    expect(debugMock).not.toHaveBeenCalled();
  });

  it('useRenderTracker logs which props changed between renders', () => {
    function TrackedComponent(props: { label: string; count: number }) {
      useRenderTracker('TrackedComponent', props);
      return <div>{props.label}</div>;
    }

    const { rerender } = render(<TrackedComponent label="one" count={1} />);
    debugMock.mockClear();

    rerender(<TrackedComponent label="two" count={1} />);

    expect(debugMock).toHaveBeenCalledWith(
      expect.stringContaining('[TrackedComponent] Re-rendered'),
      expect.any(String),
      { label: { from: 'one', to: 'two' } }
    );
  });

  it('useRenderTracker stays silent when props are unchanged', () => {
    function TrackedComponent(props: { label: string }) {
      useRenderTracker('TrackedComponent', props);
      return <div>{props.label}</div>;
    }

    const props = { label: 'same' };
    const { rerender } = render(<TrackedComponent {...props} />);
    debugMock.mockClear();

    rerender(<TrackedComponent {...props} />);

    expect(debugMock).not.toHaveBeenCalled();
  });
});
