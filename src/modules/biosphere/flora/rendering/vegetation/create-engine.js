import { setCanvasFactory, createCanvas } from '../leaves/index.js';
import { WindField } from '../../../../atmosphere/wind/index.js';
import { LeafProductionRuntime } from '../leaves/index.js';
import { makePlant, PlantRenderer, PRESETS } from './internal/vegetation-engine.js';
import { VegetationWorld } from './internal/vegetation-world.js';

/**
 * Compose G3-G9 into a game-ready service. No UI, no game-loop ownership.
 * Geometry is deterministic; sprite generation is budgeted by tick().
 */
export function createVegetationEngine({
  canvasFactory,
  wind = { strength: .5, direction: 90 },
  windField,
  memoryMB = 48,
  spriteSize = 96,
  variantCount = 4,
  windFrames = 1,
  ...runtimeOptions
} = {}) {
  if (canvasFactory !== undefined) setCanvasFactory(canvasFactory);
  const field = windField || new WindField(wind);
  const runtime = new LeafProductionRuntime({
    windField: field, memoryMB, spriteSize, variantCount, windFrames, ...runtimeOptions
  });
  const renderer = new PlantRenderer({ runtime, windField: field });
  let closed = false;
  const requireOpen = () => { if (closed) throw new Error('Vegetation engine is disposed'); };

  const api = {
    windField: field,
    runtime,
    renderer,
    presets: PRESETS,
    createPlant(options = {}) { requireOpen(); return makePlant(options); },
    prepare(plant) { requireOpen(); renderer.prepare(plant); },
    tick(options = {}) { requireOpen(); return runtime.tick(options); },
    draw(ctx, plant, options = {}) { requireOpen(); return renderer.draw(ctx, plant, options); },
    createWorld(options = {}) {
      requireOpen();
      return new VegetationWorld({ renderer, ...options });
    },
    /** Synchronous preprocessing for loading screens or unit tests; do not run every frame. */
    flush({ timeBudgetMs = 5000, maxJobs = 100, maxIterations = 500 } = {}) {
      requireOpen();
      let generated = 0, iterations = 0;
      while (runtime.queue.length && iterations++ < maxIterations) {
        const result = runtime.tick({ timeBudgetMs, maxJobs });
        generated += result.generated;
        if (!result.generated) break;
      }
      return { generated, iterations, pending: runtime.queue.length, stats: runtime.stats() };
    },
    /** Render a complete plant to a Canvas. Convenience for offline asset generation. */
    renderPlant(plant, { width = 320, height = 240, wind = 0, time = 0 } = {}) {
      requireOpen();
      renderer.prepare(plant);
      api.flush();
      const canvas = createCanvas(width, height);
      const result = renderer.draw(canvas.getContext('2d'), plant, {
        x: width * .5, y: height * .9,
        scale: Math.min(width / 290, height / 235), wind, time
      });
      return { canvas, result };
    },
    stats() { requireOpen(); return runtime.stats(); },
    clearCache() { requireOpen(); runtime.clear(); },
    dispose() { if (!closed) { runtime.clear(); closed = true; } }
  };
  return api;
}
