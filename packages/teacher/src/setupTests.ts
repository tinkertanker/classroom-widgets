import '@testing-library/jest-dom'

// Mock Canvas API for face-api.js
const mockCanvas = {
  getContext: () => ({
    fillRect: () => {},
    clearRect: () => {},
    drawImage: () => {},
    // Add other canvas methods as needed
  }),
  width: 640,
  height: 480,
}

global.HTMLCanvasElement.prototype.getContext = mockCanvas.getContext as any

// Mock WebGL for face-api.js
global.WebGLRenderingContext = (() => ({
  canvas: mockCanvas,
  drawingBufferWidth: 640,
  drawingBufferHeight: 480,
})) as any