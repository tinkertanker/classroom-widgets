import React, { useState } from 'react';
import { ViewportCanvas } from './components/ViewportCanvas';
import { WIDGET_TYPES } from './constants/widgetTypes';
import { getWidgetConfig } from './constants/widgetConfigs';
import Background from './components/backgrounds/backgrounds';

export function TestViewportApp() {
  const [scale, setScale] = useState(1);
  const [activeWidgetId, setActiveWidgetId] = useState<string | null>(null);
  const [widgets, setWidgets] = useState(() => {
    // Create a variety of real widgets for testing
    const testWidgets = [
      { type: WIDGET_TYPES.TIMER, row: 0, col: 0 },
      { type: WIDGET_TYPES.LIST, row: 0, col: 1 },
      { type: WIDGET_TYPES.RANDOMISER, row: 0, col: 2 },
      { type: WIDGET_TYPES.TRAFFIC_LIGHT, row: 0, col: 3 },
      { type: WIDGET_TYPES.TEXT_BANNER, row: 1, col: 0 },
      { type: WIDGET_TYPES.TASK_CUE, row: 1, col: 1 },
      { type: WIDGET_TYPES.RT_FEEDBACK, row: 1, col: 2 },
      { type: WIDGET_TYPES.SOUND_EFFECTS, row: 1, col: 3 },
    ];
    
    return testWidgets.map((widget, i) => {
      const config = getWidgetConfig(widget.type);
      return {
        id: `widget-${i}`,
        type: widget.type,
        position: { 
          x: 200 + widget.col * 450, 
          y: 200 + widget.row * 450 
        },
        size: { 
          width: config.defaultWidth, 
          height: config.defaultHeight 
        }
      };
    });
  });
  
  const [widgetStates, setWidgetStates] = useState(() => new Map());
  const [nextId, setNextId] = useState(widgets.length);
  
  const handlePositionChange = (id: string, position: { x: number; y: number }) => {
    setWidgets(prev => prev.map(w => 
      w.id === id ? { ...w, position } : w
    ));
  };
  
  const handleSizeChange = (id: string, size: { width: number; height: number }) => {
    setWidgets(prev => prev.map(w => 
      w.id === id ? { ...w, size } : w
    ));
  };
  
  const handleWidgetStateChange = (id: string, state: any) => {
    setWidgetStates(prev => {
      const newMap = new Map(prev);
      newMap.set(id, state);
      return newMap;
    });
  };
  
  const addWidget = (type: number) => {
    const config = getWidgetConfig(type);
    const newWidget = {
      id: `widget-${nextId}`,
      type,
      position: { x: 500, y: 500 }, // Center of visible area
      size: { width: config.defaultWidth, height: config.defaultHeight }
    };
    setWidgets(prev => [...prev, newWidget]);
    setNextId(prev => prev + 1);
    setActiveWidgetId(newWidget.id);
  };
  
  const removeWidget = (id: string) => {
    setWidgets(prev => prev.filter(w => w.id !== id));
    if (activeWidgetId === id) {
      setActiveWidgetId(null);
    }
  };

  return (
    <div className="w-screen h-screen">
      <ViewportCanvas
        scale={scale}
        onScaleChange={setScale}
        widgets={widgets}
        activeWidgetId={activeWidgetId}
        widgetStates={widgetStates}
        onWidgetStateChange={handleWidgetStateChange}
        onWidgetRemove={removeWidget}
        onWidgetClick={setActiveWidgetId}
        onWidgetPositionChange={handlePositionChange}
        onWidgetSizeChange={handleSizeChange}
        background={<Background type="grid" />}
      >
        {/* Toolbar */}
        <div className="absolute top-10 left-10 bg-white p-4 rounded shadow z-50">
          <h3 className="text-sm font-semibold mb-2">Add Widget:</h3>
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => addWidget(WIDGET_TYPES.TIMER)}
              className="px-3 py-1 text-xs bg-sage-500 hover:bg-sage-600 text-white rounded"
            >
              Timer
            </button>
            <button 
              onClick={() => addWidget(WIDGET_TYPES.LIST)}
              className="px-3 py-1 text-xs bg-sage-500 hover:bg-sage-600 text-white rounded"
            >
              List
            </button>
            <button 
              onClick={() => addWidget(WIDGET_TYPES.RANDOMISER)}
              className="px-3 py-1 text-xs bg-sage-500 hover:bg-sage-600 text-white rounded"
            >
              Randomiser
            </button>
            <button 
              onClick={() => addWidget(WIDGET_TYPES.RT_FEEDBACK)}
              className="px-3 py-1 text-xs bg-sage-500 hover:bg-sage-600 text-white rounded"
            >
              RT Feedback
            </button>
          </div>
          {activeWidgetId && (
            <button 
              onClick={() => removeWidget(activeWidgetId)}
              className="mt-3 w-full px-3 py-1 text-xs bg-dusty-rose-500 hover:bg-dusty-rose-600 text-white rounded"
            >
              Delete Selected
            </button>
          )}
        </div>
        
        {/* Info panel */}
        <div className="absolute top-10 right-10 bg-white p-4 rounded shadow z-50">
          <h1>Viewport Canvas</h1>
          <p>Scale: {scale.toFixed(2)}x</p>
          <p className="text-sm text-gray-600 mt-2">
            • Pinch to zoom<br/>
            • Two-finger swipe to pan<br/>
            • Click widgets to select<br/>
            • Drag to move, handles to resize
          </p>
        </div>
      </ViewportCanvas>
    </div>
  );
}