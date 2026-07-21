import { useEffect, useState } from 'react';
import type { TrafficLightComponent } from '@classroom-widgets/widget-spec';
import type { PlayerCopy } from '../localisation';

interface TrafficLightRendererProps {
  component: TrafficLightComponent;
  copy: PlayerCopy;
}

type TrafficLightState = TrafficLightComponent['initialState'];

export function TrafficLightRenderer({ component, copy }: TrafficLightRendererProps) {
  const [state, setState] = useState<TrafficLightState>(component.initialState);

  useEffect(() => {
    setState(component.initialState);
  }, [component]);

  const options: Array<{ state: TrafficLightState; label: string }> = [
    { state: 'red', label: component.redLabel },
    { state: 'amber', label: component.amberLabel },
    { state: 'green', label: component.greenLabel },
  ];

  return (
    <fieldset className="ready-tool traffic-light-tool">
      <legend>{component.title}</legend>
      <div className="traffic-light-options">
        {options.map((option) => (
          <button
            className="traffic-light-option"
            data-light={option.state}
            type="button"
            key={option.state}
            aria-pressed={state === option.state}
            onClick={() => setState(option.state)}
          >
            <span className="traffic-light-lamp" aria-hidden="true" />
            <span>{option.label}</span>
          </button>
        ))}
      </div>
      <p className="ready-tool-message" role="status" aria-live="polite">
        <span lang={copy.locale}>{copy.currentSignalBefore} </span>
        <span>{options.find((option) => option.state === state)?.label}</span>
      </p>
    </fieldset>
  );
}
