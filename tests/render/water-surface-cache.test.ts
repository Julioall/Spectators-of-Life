import { describe, expect, it } from 'vitest';
import {
  createWaterSurfaceCache,
  takeWaterSurfaceChunkBatch,
  updateWaterSurfaceCache,
  type WaterSurfaceCacheCell,
} from '../../src/render/water-surface-cache';

function createDryWorld(width: number, height: number): WaterSurfaceCacheCell[] {
  return Array.from({ length: width * height }, (_, index) => ({
    index,
    x: index % width,
    y: Math.floor(index / width),
    terrain: { waterBody: 'none' },
    water: { surfaceMm: 0, lastFlows: { runoffInMm: 0, runoffOutMm: 0 } },
  }));
}

describe('water surface chunk cache', () => {
  it('schedules dirty chunks in stable insertion order and caps each batch', () => {
    const pending = new Set([7, 2, 11, 4, 9]);

    expect(takeWaterSurfaceChunkBatch(pending, 3)).toEqual([7, 2, 11]);
    expect([...pending]).toEqual([7, 2, 11, 4, 9]);
    expect(takeWaterSurfaceChunkBatch(pending, 0)).toEqual([]);
  });

  it('marks only chunks whose visible depth changed and reuses stable chunks', () => {
    const width = 16;
    const height = 16;
    const cells = createDryWorld(width, height);
    const depth = new Float32Array(width * height);
    const lighting = new Float32Array(width * height).fill(1);
    const cache = createWaterSurfaceCache(width, height);

    expect(updateWaterSurfaceCache(cache, cells, depth, lighting).dirtyChunks).toEqual([]);

    const lakeIndex = 8 * width + 8;
    cells[lakeIndex]!.terrain.waterBody = 'lake';
    cells[lakeIndex]!.water.surfaceMm = 30;
    depth[lakeIndex] = 80;
    const wet = updateWaterSurfaceCache(cache, cells, depth, lighting);
    expect(wet.maskChanged).toBe(true);
    expect(wet.dirtyChunks).toEqual([0, 1, 2, 3]);

    expect(updateWaterSurfaceCache(cache, cells, depth, lighting).dirtyChunks).toEqual([]);

    depth[lakeIndex] = 160;
    const deeper = updateWaterSurfaceCache(cache, cells, depth, lighting);
    expect(deeper.maskChanged).toBe(false);
    expect(deeper.dirtyChunks).toEqual([3]);
  });

  it('tracks flowing rivers without standing water and dirties adjacent chunks when the mask disappears', () => {
    const width = 16;
    const height = 16;
    const cells = createDryWorld(width, height);
    const depth = new Float32Array(width * height);
    const lighting = new Float32Array(width * height).fill(1);
    const cache = createWaterSurfaceCache(width, height);
    updateWaterSurfaceCache(cache, cells, depth, lighting);

    const riverIndex = 7 * width + 7;
    cells[riverIndex]!.terrain.waterBody = 'river';
    cells[riverIndex]!.water.lastFlows!.runoffOutMm = 1;
    const flowing = updateWaterSurfaceCache(cache, cells, depth, lighting);
    expect(flowing.maskChanged).toBe(true);
    expect(flowing.dirtyChunks).toEqual([0, 1, 2, 3]);

    cells[riverIndex]!.water.lastFlows!.runoffOutMm = 0;
    const dry = updateWaterSurfaceCache(cache, cells, depth, lighting);
    expect(dry.maskChanged).toBe(true);
    expect(dry.dirtyChunks).toEqual([0, 1, 2, 3]);
  });

  it('does not project surface runoff as standing water outside a defined river', () => {
    const width = 8;
    const height = 8;
    const cells = createDryWorld(width, height);
    const depth = new Float32Array(width * height);
    const lighting = new Float32Array(width * height).fill(1);
    const cache = createWaterSurfaceCache(width, height);
    updateWaterSurfaceCache(cache, cells, depth, lighting);

    cells[10]!.water.lastFlows!.runoffOutMm = 5;
    expect(updateWaterSurfaceCache(cache, cells, depth, lighting).dirtyChunks).toEqual([]);

    cells[10]!.terrain.waterBody = 'lake';
    expect(updateWaterSurfaceCache(cache, cells, depth, lighting).dirtyChunks).toEqual([]);
  });
});
