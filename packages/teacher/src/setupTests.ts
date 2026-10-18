import '@testing-library/jest-dom'

// Node 25 and later define their own localStorage and sessionStorage, and
// Vitest keeps a global that already exists instead of installing jsdom's.
// Node's localStorage fails without --localstorage-file, and tests spy on
// jsdom's Storage.prototype, so use jsdom's storage for both.
const jsdomWindow = (globalThis as typeof globalThis & { jsdom?: { window: Window } }).jsdom?.window
if (jsdomWindow) {
  for (const key of ['localStorage', 'sessionStorage'] as const) {
    Object.defineProperty(globalThis, key, { value: jsdomWindow[key], configurable: true, writable: true })
  }
}

// jsdom has no canvas implementation; widgets such as the QR code and slot
// machine call getContext during render.
global.HTMLCanvasElement.prototype.getContext = (() => ({
  fillRect: () => {},
  clearRect: () => {},
  drawImage: () => {},
})) as any
