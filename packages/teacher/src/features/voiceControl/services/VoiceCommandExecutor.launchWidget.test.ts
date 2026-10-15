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

    // 'Randomiser' also checks case folding and that WidgetType.RANDOMISER === 0
    // is not rejected by a falsy check (P2-A).
    for (const [name, expectedType] of [...entries, ['Randomiser', WidgetType.RANDOMISER] as const]) {
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

  it('covers every widget declared in the shared definitions', () => {
    for (const widget of Object.values(VOICE_WIDGET_DEFINITIONS)) {
      const target = widget.targetName.toLowerCase();
      expect(VOICE_WIDGET_TARGET_MAP[target]).toBe(
        WidgetType[widget.widgetType as keyof typeof WidgetType]
      );
    }
  });

  it('still rejects a target that is not in the map', async () => {
    const result = await launch('definitelynotawidget');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown widget type');
    expect(addWidget).not.toHaveBeenCalled();
  });
});
