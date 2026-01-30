import { WidgetPosition, WidgetPositionsMap } from '../types/app.types';

// Simple position type for function returns (just x, y coordinates)
type Point = { x: number; y: number };

// Find a non-overlapping position for a new widget
export const findAvailablePosition = (
  widgetWidth: number,
  widgetHeight: number,
  widgetPositions: WidgetPositionsMap,
  scale: number = 1,
  viewport?: { x: number; y: number; width: number; height: number }
): Point => {
  const padding = 20; // Minimum space between widgets
  
  // The canvas is always 3000x2000 in logical coordinates
  const CANVAS_WIDTH = 3000;
  const CANVAS_HEIGHT = 2000;
  
  // Use provided viewport or estimate from window size
  let viewportWidth: number;
  let viewportHeight: number;
  let visibleLeft: number;
  let visibleTop: number;
  let visibleRight: number;
  let visibleBottom: number;
  
  if (viewport) {
    // Use the actual viewport from ViewportCanvas
    viewportWidth = viewport.width;
    viewportHeight = viewport.height;
    visibleLeft = viewport.x;
    visibleTop = viewport.y;
    visibleRight = Math.min(CANVAS_WIDTH, viewport.x + viewport.width);
    visibleBottom = Math.min(CANVAS_HEIGHT, viewport.y + viewport.height);
    
    // Using actual viewport from ViewportCanvas
  } else {
    // Fallback: estimate viewport based on window size and scale
    viewportWidth = Math.min(window.innerWidth / scale, CANVAS_WIDTH);
    viewportHeight = Math.min(window.innerHeight / scale, CANVAS_HEIGHT);
    
    // Default to top-left corner for fallback
    visibleLeft = 0;
    visibleTop = 0;
    visibleRight = Math.min(CANVAS_WIDTH, viewportWidth);
    visibleBottom = Math.min(CANVAS_HEIGHT, viewportHeight);
    
    // Using estimated viewport based on window size
  }
  
  // Define safe placement area with margins
  const margin = 50; // Reduced margin for more placement area
  const toolbarHeight = 80;
  
  const placementArea = {
    left: Math.max(margin, visibleLeft + margin),
    top: Math.max(margin + toolbarHeight, visibleTop + margin + toolbarHeight),
    right: Math.min(CANVAS_WIDTH - margin, visibleRight - margin),
    bottom: Math.min(CANVAS_HEIGHT - margin, visibleBottom - margin)
  };
  
  // Ensure widget can fit - expand placement area if needed
  if (placementArea.right - placementArea.left < widgetWidth + margin * 2) {
    const viewportCenterX = visibleLeft + viewportWidth / 2;
    placementArea.left = Math.max(0, viewportCenterX - widgetWidth - 200);
    placementArea.right = Math.min(CANVAS_WIDTH, viewportCenterX + widgetWidth + 200);
  }
  if (placementArea.bottom - placementArea.top < widgetHeight + margin * 2) {
    const viewportCenterY = visibleTop + viewportHeight / 2;
    placementArea.top = Math.max(0, viewportCenterY - widgetHeight - 200);
    placementArea.bottom = Math.min(CANVAS_HEIGHT, viewportCenterY + widgetHeight + 200);
  }
  
  // Widget placement configuration ready
  
  // Collect all existing widgets (check ALL widgets, not just those in viewport)
  const existingWidgets: Array<{id: string, pos: WidgetPosition, width: number, height: number}> = [];
  widgetPositions.forEach((pos, id) => {
    // Width and height are now required fields in WidgetPosition
    existingWidgets.push({ id, pos, width: pos.width, height: pos.height });
  });
  
  // Collect existing widgets for overlap checking
  
  // Helper function to check overlap
  const checkOverlap = (x: number, y: number): boolean => {
    for (const widget of existingWidgets) {
      const overlapsX = x < widget.pos.x + widget.width + padding &&
                       x + widgetWidth + padding > widget.pos.x;
      const overlapsY = y < widget.pos.y + widget.height + padding &&
                       y + widgetHeight + padding > widget.pos.y;
      
      if (overlapsX && overlapsY) {
        return true;
      }
    }
    return false;
  };
  
  // Helper function to calculate overlap area
  const calculateOverlapArea = (x: number, y: number): number => {
    let totalOverlapArea = 0;
    
    for (const widget of existingWidgets) {
      // Calculate overlap rectangle
      const overlapLeft = Math.max(x, widget.pos.x);
      const overlapRight = Math.min(x + widgetWidth, widget.pos.x + widget.width);
      const overlapTop = Math.max(y, widget.pos.y);
      const overlapBottom = Math.min(y + widgetHeight, widget.pos.y + widget.height);
      
      // If there's an overlap, calculate the area
      if (overlapLeft < overlapRight && overlapTop < overlapBottom) {
        const overlapWidth = overlapRight - overlapLeft;
        const overlapHeight = overlapBottom - overlapTop;
        totalOverlapArea += overlapWidth * overlapHeight;
      }
    }
    
    return totalOverlapArea;
  };
  
  // Strategy 1: Try center of placement area
  const centerX = (placementArea.left + placementArea.right) / 2 - widgetWidth / 2;
  const centerY = (placementArea.top + placementArea.bottom) / 2 - widgetHeight / 2;
  
  if (!checkOverlap(centerX, centerY)) {
    return { x: Math.round(centerX), y: Math.round(centerY) };
  }
  
  // Strategy 2: Spiral pattern from center with tighter spacing
  const maxRadius = Math.max(
    placementArea.right - placementArea.left,
    placementArea.bottom - placementArea.top
  ) / 2;
  const radiusStep = 30; // Smaller steps for tighter spiral
  const angleStepBase = Math.PI / 8; // Start with 22.5 degrees
  
  for (let radius = 0; radius <= maxRadius; radius += radiusStep) {
    // More angles at larger radii for better coverage
    const numAngles = radius === 0 ? 1 : Math.max(8, Math.floor(radius / 20));
    const angleStep = (2 * Math.PI) / numAngles;
    
    for (let i = 0; i < numAngles; i++) {
      const angle = i * angleStep;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      
      // Check bounds
      if (x >= placementArea.left && 
          x + widgetWidth <= placementArea.right &&
          y >= placementArea.top && 
          y + widgetHeight <= placementArea.bottom) {
        
        if (!checkOverlap(x, y)) {
          return { x: Math.round(x), y: Math.round(y) };
        }
      }
    }
  }
  // Spiral strategy completed
  
  // Strategy 3: Dense grid pattern
  const gridSpacing = Math.max(50, Math.min(widgetWidth, widgetHeight) / 4);
  const gridWidth = placementArea.right - placementArea.left - widgetWidth;
  const gridHeight = placementArea.bottom - placementArea.top - widgetHeight;
  const gridCols = Math.max(1, Math.floor(gridWidth / gridSpacing));
  const gridRows = Math.max(1, Math.floor(gridHeight / gridSpacing));
  
  // Try grid positions in a randomized order to avoid always filling from top-left
  const positions: Array<{x: number, y: number}> = [];
  for (let i = 0; i <= gridCols; i++) {
    for (let j = 0; j <= gridRows; j++) {
      positions.push({
        x: placementArea.left + (i / gridCols) * gridWidth,
        y: placementArea.top + (j / gridRows) * gridHeight
      });
    }
  }
  
  // Shuffle positions for more varied placement
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  
  for (const pos of positions) {
    if (!checkOverlap(pos.x, pos.y)) {
      return { x: Math.round(pos.x), y: Math.round(pos.y) };
    }
  }
  
  // Strategy 4: Try edges of existing widgets
  for (const widget of existingWidgets) {
    // Try positions around each existing widget
    const positions = [
      // Right of widget
      { x: widget.pos.x + widget.width + padding, y: widget.pos.y },
      // Below widget
      { x: widget.pos.x, y: widget.pos.y + widget.height + padding },
      // Left of widget
      { x: widget.pos.x - widgetWidth - padding, y: widget.pos.y },
      // Above widget
      { x: widget.pos.x, y: widget.pos.y - widgetHeight - padding },
      // Diagonal positions
      { x: widget.pos.x + widget.width + padding, y: widget.pos.y + widget.height + padding },
      { x: widget.pos.x - widgetWidth - padding, y: widget.pos.y - widgetHeight - padding }
    ];
    
    for (const pos of positions) {
      if (pos.x >= placementArea.left && 
          pos.x + widgetWidth <= placementArea.right &&
          pos.y >= placementArea.top && 
          pos.y + widgetHeight <= placementArea.bottom &&
          !checkOverlap(pos.x, pos.y)) {
        return { x: Math.round(pos.x), y: Math.round(pos.y) };
      }
    }
  }
  
  // Strategy 5: Cascade offset based on widget count
  const cascadeOffset = 40;
  const cascadeX = placementArea.left + (existingWidgets.length * cascadeOffset) % (placementArea.right - placementArea.left - widgetWidth);
  const cascadeY = placementArea.top + (existingWidgets.length * cascadeOffset) % (placementArea.bottom - placementArea.top - widgetHeight);
  
  if (!checkOverlap(cascadeX, cascadeY)) {
    return { x: Math.round(cascadeX), y: Math.round(cascadeY) };
  }
  
  // Final fallback: find position with minimum overlap
  
  // Generate candidate positions to test
  const candidatePositions: Array<{x: number, y: number}> = [];
  
  // Add center position
  candidatePositions.push({ x: centerX, y: centerY });
  
  // Add grid of positions across the placement area
  const testGridSize = 10;
  for (let i = 0; i <= testGridSize; i++) {
    for (let j = 0; j <= testGridSize; j++) {
      const x = placementArea.left + (i / testGridSize) * (placementArea.right - placementArea.left - widgetWidth);
      const y = placementArea.top + (j / testGridSize) * (placementArea.bottom - placementArea.top - widgetHeight);
      if (x >= 0 && y >= 0 && x + widgetWidth <= CANVAS_WIDTH && y + widgetHeight <= CANVAS_HEIGHT) {
        candidatePositions.push({ x, y });
      }
    }
  }
  
  // Find position with minimum overlap
  let bestPosition = { x: centerX, y: centerY };
  let minOverlapArea = calculateOverlapArea(centerX, centerY);
  
  for (const pos of candidatePositions) {
    const overlapArea = calculateOverlapArea(pos.x, pos.y);
    if (overlapArea < minOverlapArea) {
      minOverlapArea = overlapArea;
      bestPosition = pos;
    }
  }
  
  // Return position with minimal overlap
  
  return { 
    x: Math.round(bestPosition.x), 
    y: Math.round(bestPosition.y)
  };
};

// Check if position is over trash
export const isOverTrash = (x: number, y: number): boolean => {
  const trashElement = document.getElementById("trash");
  if (!trashElement) return false;
  
  const trashLocation = trashElement.getBoundingClientRect();
  // Create a larger hitbox that extends upward
  const extendedTop = trashLocation.y - trashLocation.height; // Extend upward by one trash height
  
  // x and y are already in viewport coordinates from the drag event
  return (
    x >= trashLocation.x &&
    x <= trashLocation.x + trashLocation.width &&
    y >= extendedTop &&
    y <= trashLocation.y + trashLocation.height
  );
};