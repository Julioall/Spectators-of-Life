export type WaterSurfaceCacheCell = {
  index: number;
  x: number;
  y: number;
  terrain: { waterBody?: string };
  water: {
    surfaceMm: number;
    lastFlows?: { runoffOutMm?: number; runoffInMm?: number };
  };
};

export type WaterSurfaceCache = {
  width: number;
  height: number;
  chunkColumns: number;
  chunkRows: number;
  visualSignatures: Int32Array;
  maskSignatures: Uint8Array;
};

export type WaterSurfaceCacheUpdate = {
  dirtyChunks: number[];
  maskChanged: boolean;
};

export const WATER_SURFACE_CHUNK_CELLS = 8;
const WATER_THRESHOLD_MM = 10;

export function createWaterSurfaceCache(width: number, height: number): WaterSurfaceCache {
  const size = width * height;
  const visualSignatures = new Int32Array(size);
  visualSignatures.fill(-1);
  const maskSignatures = new Uint8Array(size);
  maskSignatures.fill(255);
  return {
    width,
    height,
    chunkColumns: Math.ceil(width / WATER_SURFACE_CHUNK_CELLS),
    chunkRows: Math.ceil(height / WATER_SURFACE_CHUNK_CELLS),
    visualSignatures,
    maskSignatures,
  };
}

/**
 * Tracks only visible water-surface inputs. Depth is quantized to 8 mm, below
 * the perceptible palette step, so tiny hydrology changes do not invalidate a
 * whole texture. Changed cells dirty their chunk and adjacent wet cells because
 * the color field is interpolated between cell centers.
 */
export function updateWaterSurfaceCache(
  cache: WaterSurfaceCache,
  cells: readonly WaterSurfaceCacheCell[],
  waterDepth: ArrayLike<number>,
  lighting: ArrayLike<number>,
  force = false,
): WaterSurfaceCacheUpdate {
  if (cells.length !== cache.width * cache.height) {
    return { dirtyChunks: [], maskChanged: false };
  }

  const changedCells: Array<{ index: number; wasWet: boolean; isWet: boolean; maskChanged: boolean }> = [];
  let maskChanged = false;
  for (const cell of cells) {
    const index = cell.index;
    const mask = waterSurfaceMaskCode(cell);
    const previousMask = cache.maskSignatures[index] ?? 255;
    const wasInitialized = previousMask !== 255;
    const wasWet = previousMask > 0 && previousMask < 255;
    const isWet = mask > 0;
    const depth = finiteOrZero(waterDepth[index] ?? cell.water.surfaceMm);
    const light = finiteOrOne(lighting[index] ?? 1);
    const signature = waterSurfaceVisualSignature(mask, depth, light);
    const changed = force ? (wasWet || isWet) : cache.visualSignatures[index] !== signature;
    const cellMaskChanged = wasInitialized && previousMask !== mask;
    if (cellMaskChanged) maskChanged = true;
    if (changed && (wasWet || isWet)) {
      changedCells.push({ index, wasWet, isWet, maskChanged: cellMaskChanged });
    }
    cache.visualSignatures[index] = signature;
    cache.maskSignatures[index] = mask;
  }

  const dirty = new Set<number>();
  for (const changed of changedCells) {
    const cell = cells[changed.index];
    if (cell === undefined) continue;
    const radius = 1;
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const x = cell.x + dx;
        const y = cell.y + dy;
        if (x < 0 || x >= cache.width || y < 0 || y >= cache.height) continue;
        const neighborIndex = y * cache.width + x;
        const neighbor = cells[neighborIndex];
        if (neighbor === undefined) continue;
        const neighborMask = cache.maskSignatures[neighborIndex] ?? 0;
        if (neighborMask === 0 && !changed.maskChanged && !(neighborIndex === changed.index && changed.wasWet)) continue;
        dirty.add(chunkIndex(x, y, cache.chunkColumns));
      }
    }
  }

  return { dirtyChunks: [...dirty].sort((left, right) => left - right), maskChanged };
}

export function waterSurfaceMaskCode(cell: WaterSurfaceCacheCell): number {
  const body = cell.terrain.waterBody ?? 'none';
  if (body === 'lake') return cell.water.surfaceMm > WATER_THRESHOLD_MM ? 1 : 0;
  if (body === 'river') {
    return cell.water.surfaceMm > WATER_THRESHOLD_MM
      || (cell.water.lastFlows?.runoffOutMm ?? 0) > 0.35
      || (cell.water.lastFlows?.runoffInMm ?? 0) > 0.35
      ? 2
      : 0;
  }
  return cell.water.surfaceMm > WATER_THRESHOLD_MM ? 3 : 0;
}

export function chunkIndex(x: number, y: number, chunkColumns: number): number {
  return Math.floor(y / WATER_SURFACE_CHUNK_CELLS) * chunkColumns
    + Math.floor(x / WATER_SURFACE_CHUNK_CELLS);
}

/** Returns the next bounded batch without changing queue order or contents. */
export function takeWaterSurfaceChunkBatch(pending: ReadonlySet<number>, maximum: number): number[] {
  const limit = Math.max(0, Math.floor(maximum));
  const batch: number[] = [];
  for (const chunk of pending) {
    if (batch.length >= limit) break;
    batch.push(chunk);
  }
  return batch;
}

function waterSurfaceVisualSignature(mask: number, depthMm: number, light: number): number {
  const depthBucket = Math.max(0, Math.min(0x1ffff, Math.round(depthMm / 8)));
  const lightBucket = Math.max(0, Math.min(0xff, Math.round(light * 100)));
  return ((mask << 28) | (depthBucket << 8) | lightBucket) | 0;
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function finiteOrOne(value: number): number {
  return Number.isFinite(value) ? value : 1;
}
