import '@testing-library/jest-dom'

// jsdom has no canvas implementation; widgets such as the QR code and slot
// machine call getContext during render.
global.HTMLCanvasElement.prototype.getContext = (() => ({
  fillRect: () => {},
  clearRect: () => {},
  drawImage: () => {},
})) as any
