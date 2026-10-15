import React, { Profiler } from 'react';
import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const animationMock = vi.hoisted(() => ({
  callback: null as ((deltaTime: number, timestamp: number) => void) | null
}));

vi.mock('@shared/hooks/useAnimationFrame', () => ({
  useAnimationFrame: (callback: (deltaTime: number, timestamp: number) => void) => {
    animationMock.callback = callback;
  }
}));

import { CreatureAnimation, isCreatureOnColoredArc } from './CreatureAnimation';

describe('CreatureAnimation', () => {
  beforeEach(() => {
    animationMock.callback = null;
  });

  it('maps the runner position to the coloured timer arc', () => {
    expect(isCreatureOnColoredArc(0, 0)).toBe(false);
    expect(isCreatureOnColoredArc(0, 0.5)).toBe(true);
    expect(isCreatureOnColoredArc(-1, 0.5)).toBe(false);
    expect(isCreatureOnColoredArc(-1, 1)).toBe(true);
  });

  it('turns the runner each frame without repeatedly rendering the creature art', () => {
    let renderCount = 0;

    const { container } = render(
      <Profiler id="creature" onRender={() => { renderCount += 1; }}>
        <CreatureAnimation isRunning progress={0.5} creature="hamster" />
      </Profiler>
    );

    const initialRenderCount = renderCount;
    const runner = container.querySelector('svg') as SVGSVGElement;
    expect(runner.style.transform).toBe('rotate(0deg)');

    act(() => {
      animationMock.callback?.(16, 16);
    });
    const renderCountAfterBoundaryChange = renderCount;

    act(() => {
      animationMock.callback?.(16, 32);
      animationMock.callback?.(16, 48);
      animationMock.callback?.(16, 64);
    });

    expect(runner.style.transform).not.toBe('rotate(0deg)');
    expect(renderCountAfterBoundaryChange).toBe(initialRenderCount + 1);
    expect(renderCount).toBe(renderCountAfterBoundaryChange);
  });

});
