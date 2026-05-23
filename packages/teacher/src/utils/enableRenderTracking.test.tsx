import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
  });

  afterEach(() => {
    cleanup();
    process.env.NODE_ENV = originalNodeEnv;
    reactWithMutableCreateElement.createElement = originalCreateElement;
  });

  it('enables render tracking in development without CommonJS require', () => {
    expect(() => enableRenderTracking()).not.toThrow();
  });

  it('tracks component renders without CommonJS require', () => {
    function TrackedComponent(props: { label: string }) {
      useRenderTracker('TrackedComponent', props);
      return <div>{props.label}</div>;
    }

    expect(() => {
      const { rerender } = render(<TrackedComponent label="one" />);

      rerender(<TrackedComponent label="two" />);
    }).not.toThrow();
  });
});
