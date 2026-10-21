/** Shared procedural leaf geometry, phenology and raster generation. */
export { LeafEngine } from './leaf-engine.js';
export { LeafProductionRuntime, ByteLRU } from './leaf-production.js';
export * as LeafGenetics from './leaf-genetics.js';
export * as LeafLifecycle from './leaf-lifecycle.js';
export { createCanvas, setCanvasFactory } from './canvas.js';
export { WindField, createWindField } from '../../../../atmosphere/wind/index.js';
