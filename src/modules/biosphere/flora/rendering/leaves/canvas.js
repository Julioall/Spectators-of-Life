/** Canvas adapter: no document or DOM access at import-time. */
let explicitFactory = null;

export function setCanvasFactory(factory) {
  if (factory !== null && typeof factory !== 'function') {
    throw new TypeError('canvasFactory must be a function or null');
  }
  explicitFactory = factory;
}

export function createCanvas(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new RangeError('Canvas dimensions must be positive integers');
  }
  let canvas;
  if (explicitFactory) canvas = explicitFactory(width, height);
  else if (typeof OffscreenCanvas !== 'undefined') canvas = new OffscreenCanvas(width, height);
  else if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    canvas = document.createElement('canvas');
  } else {
    throw new Error('No Canvas 2D implementation found. Call setCanvasFactory((w,h) => ...), or provide OffscreenCanvas/document. For Node.js you may use @napi-rs/canvas.');
  }
  if (!canvas || typeof canvas.getContext !== 'function') throw new TypeError('canvasFactory did not return a Canvas-like object');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}
