import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WidgetType } from '@shared/types';
import {
  VOICE_WIDGET_DEFINITIONS,
  VOICE_WIDGET_TARGET_MAP
} from '@shared/constants/voiceCommandDefinitions';

const addWidget = vi.fn((_type: WidgetType, _pos: { x: number; y: number }) => 'widget-id');

vi.mock('../../../store/workspaceStore.simple', () => ({
  useWorkspaceStore: {
    getState: () => ({
      scale: 1,
      addWidget,
      widgets: new Map()
    })
  }
}));

vi.mock('../../../services/WidgetRegistry', () => ({
  widgetRegistry: {
    get: () => ({ defaultSize: { width: 350, height: 350 } })
  }
}));

import { VoiceCommandExecutor } from './VoiceCommandExecutor';

const launch = (target: string) =>
  new VoiceCommandExecutor().executeCommand({
    command: { action: 'LAUNCH_WIDGET', target, parameters: {} }
  } as any);

describe('executeLaunchWidget target resolution', () => {
  beforeEach(() => {
    addWidget.mockClear();
  });

  it('resolves every target name and alias in VOICE_WIDGET_TARGET_MAP to a real WidgetType', async () => {
    const entries = Object.entries(VOICE_WIDGET_TARGET_MAP);
    expect(entries.length).toBeGreaterThan(0);

    for (const [name, expectedType] of entries) {
      expect(typeof expectedType).toBe('number');
      expect(WidgetType[expectedType]).toBeDefined();

      addWidget.mockClear();
      const result = await launch(name);

      expect(result.success, `launching '${name}' should succeed: ${result.error}`).toBe(true);
      expect(result.action).toBe('LAUNCH_WIDGET');
      expect(addWidget).toHaveBeenCalledTimes(1);
      expect(addWidget.mock.calls[0][0]).toBe(expectedType);
    }
  });

  it('covers every widget declared in the shared definitions', async () => {
    for (const widget of Object.values(VOICE_WIDGET_DEFINITIONS)) {
      const target = widget.targetName.toLowerCase();
      expect(VOICE_WIDGET_TARGET_MAP[target]).toBe(
        WidgetType[widget.widgetType as keyof typeof WidgetType]
      );

      addWidget.mockClear();
      const result = await launch(target);
      expect(result.success, `launching '${target}' should succeed: ${result.error}`).toBe(true);
    }
  });

  // Regression guard for P2-A: RANDOMISER is enum value 0, so a falsy check on the
  // resolved widget type rejected it as "not found" and the generic launcher could
  // never open the randomiser.
  it('launches the randomiser even though WidgetType.RANDOMISER === 0', async () => {
    expect(WidgetType.RANDOMISER).toBe(0);
    expect(VOICE_WIDGET_TARGET_MAP['randomiser']).toBe(0);

    for (const target of ['randomiser', 'randomizer', 'Randomiser']) {
      addWidget.mockClear();
      const result = await launch(target);

      expect(result.success, `launching '${target}' should succeed: ${result.error}`).toBe(true);
      expect(result.error).toBeUndefined();
      expect(addWidget).toHaveBeenCalledTimes(1);
      expect(addWidget.mock.calls[0][0]).toBe(WidgetType.RANDOMISER);
    }
  });

  it('still rejects a target that is not in the map', async () => {
    const result = await launch('definitelynotawidget');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown widget type');
    expect(addWidget).not.toHaveBeenCalled();
  });
});
