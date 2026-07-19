import { useEffect, useState } from 'react';
import type {
  RandomiserComponent,
  RandomiserItemSpec,
} from '@classroom-widgets/widget-spec';

interface RandomiserRendererProps {
  component: RandomiserComponent;
}

export function RandomiserRenderer({ component }: RandomiserRendererProps) {
  const [selected, setSelected] = useState<RandomiserItemSpec>();
  const [drawnIds, setDrawnIds] = useState<Set<string>>(() => new Set());
  const available = component.allowRepeats
    ? component.items
    : component.items.filter((item) => !drawnIds.has(item.id));

  useEffect(() => {
    setSelected(undefined);
    setDrawnIds(new Set());
  }, [component]);

  function draw() {
    if (available.length === 0) return;
    const choice = available[randomIndex(available.length)];
    if (!choice) return;
    setSelected(choice);
    if (!component.allowRepeats) {
      setDrawnIds((current) => new Set(current).add(choice.id));
    }
  }

  function reset() {
    setSelected(undefined);
    setDrawnIds(new Set());
  }

  return (
    <section className="ready-tool randomiser-tool" aria-labelledby={`${component.id}-title`}>
      <h2 id={`${component.id}-title`}>{component.prompt}</h2>
      <div className="randomiser-result" role="status" aria-live="polite">
        {selected ? (
          <>
            <span>Chosen</span>
            <strong>{selected.label}</strong>
          </>
        ) : (
          <span>Ready to choose from {component.items.length} options.</span>
        )}
      </div>
      <div className="ready-tool-actions">
        <button
          className="primary-action"
          type="button"
          disabled={available.length === 0}
          onClick={draw}
        >
          Choose
        </button>
        <button
          className="secondary-action"
          type="button"
          disabled={!selected && drawnIds.size === 0}
          onClick={reset}
        >
          Reset choices
        </button>
      </div>
      {!component.allowRepeats && available.length === 0 ? (
        <p className="ready-tool-note">Every option has been chosen. Reset to begin again.</p>
      ) : null}
    </section>
  );
}

function randomIndex(length: number): number {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return Math.floor(((value[0] ?? 0) / 2 ** 32) * length);
}
