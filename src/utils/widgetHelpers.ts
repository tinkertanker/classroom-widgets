import { WidgetPosition, WidgetPositionsMap } from '../types/app.types';

// Find a non-overlapping position for a new widget
export const findAvailablePosition = (widgetWidth: number, widgetHeight: number, widgetPositions: WidgetPositionsMap, scale: number = 1): WidgetPosition => {
  const padding = 20; // Minimum space between widgets
  const scrollContainer = document.querySelector('.board-scroll-container');
  
  // Get current viewport bounds (accounting for scale)
  const scrollLeft = scrollContainer ? scrollContainer.scrollLeft / scale : 0;
  const scrollTop = scrollContainer ? scrollContainer.scrollTop / scale : 0;
  const viewportWidth = window.innerWidth / scale;
  const viewportHeight = window.innerHeight / scale;
  
  // Define the bounds for placing new widgets (within current viewport)
  const minX = scrollLeft + padding;
  const maxX = scrollLeft + viewportWidth - widgetWidth - padding;
  const minY = scrollTop + padding;
  const maxY = scrollTop + viewportHeight - widgetHeight - padding - 60; // Account for toolbar
  
  // Center of current viewport
  const viewportCenterX = scrollLeft + viewportWidth / 2;
  const viewportCenterY = scrollTop + viewportHeight / 2;
  
  const maxAttempts = 50;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Try positions in a spiral pattern from viewport center
    const angle = attempt * 0.5;
    const radius = attempt * 15;
    
    // Calculate position but constrain to viewport bounds
    const x = Math.max(minX, Math.min(
      viewportCenterX + Math.cos(angle) * radius - widgetWidth / 2,
      maxX
    ));
    const y = Math.max(minY, Math.min(
      viewportCenterY + Math.sin(angle) * radius - widgetHeight / 2,
      maxY
    ));
    
    // Check if this position overlaps with any existing widget
    let overlaps = false;
    widgetPositions.forEach((pos, id) => {
      if (!overlaps) {
        const posWidth = pos.width || widgetWidth;
        const posHeight = pos.height || widgetHeight;
        if (
          x < pos.x + posWidth + padding &&
          x + widgetWidth + padding > pos.x &&
          y < pos.y + posHeight + padding &&
          y + widgetHeight + padding > pos.y
        ) {
          overlaps = true;
        }
      }
    });
    
    if (!overlaps) {
      return { x: Math.round(x), y: Math.round(y) };
    }
  }
  
  // If no position found, place at a random position within viewport
  return {
    x: Math.round(minX + Math.random() * (maxX - minX)),
    y: Math.round(minY + Math.random() * (maxY - minY))
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