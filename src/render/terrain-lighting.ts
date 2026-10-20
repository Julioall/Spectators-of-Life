export type TerrainLightingSettings = {
  enabled: boolean;
  sunAngle: number;
  reliefStrength: number;
};

export type DirectionalLight = { x: number; y: number };
export type TerrainGradient = { dx: number; dy: number; slope: number };

export const DEFAULT_TERRAIN_LIGHTING_SETTINGS: Readonly<TerrainLightingSettings> = Object.freeze({
  enabled: true,
  sunAngle: 315,
  reliefStrength: 3,
});

const MAX_OCCLUSION = 0.17;
const MIN_LIGHT_FACTOR = 0.62;
const MAX_LIGHT_FACTOR = 1.38;
const LIGHTING_SMOOTHING_WEIGHTS = [1, 2, 3, 2, 1] as const;
export const TERRAIN_LIGHTING_DIRTY_RADIUS_CELLS = 7;

export function sanitizeTerrainLightingSettings(settings: TerrainLightingSettings): TerrainLightingSettings {
  const sunAngle = Number.isFinite(settings.sunAngle) ? clamp(settings.sunAngle, 0, 345) : 315;
  const reliefStrength = Number.isFinite(settings.reliefStrength) ? clamp(settings.reliefStrength, 0, 8) : 3;
  return {
    enabled: settings.enabled,
    sunAngle: Math.round(sunAngle / 15) * 15,
    reliefStrength: Math.round(reliefStrength * 2) / 2,
  };
}

/** Solar direction in map coordinates: north is -Y and east is +X. */
export function calculateDirectionalLight(sunAngle: number): DirectionalLight {
  if (!Number.isFinite(sunAngle)) return { x: -Math.SQRT1_2, y: -Math.SQRT1_2 };
  const angle = (sunAngle * Math.PI) / 180;
  return { x: Math.sin(angle), y: -Math.cos(angle) };
}

/** Central differences inside the map and one-sided differences at its edges. */
export function calculateTerrainGradient(
  westM: number,
  eastM: number,
  northM: number,
  southM: number,
  cellSizeM: number,
  horizontalSpanCells = 2,
  verticalSpanCells = 2,
): TerrainGradient {
  if (![westM, eastM, northM, southM, cellSizeM, horizontalSpanCells, verticalSpanCells].every(Number.isFinite)
    || cellSizeM <= 0 || horizontalSpanCells < 0 || verticalSpanCells < 0) {
    return { dx: 0, dy: 0, slope: 0 };
  }
  const dx = horizontalSpanCells === 0 ? 0 : (eastM - westM) / (horizontalSpanCells * cellSizeM);
  const dy = verticalSpanCells === 0 ? 0 : (southM - northM) / (verticalSpanCells * cellSizeM);
  return { dx, dy, slope: Math.hypot(dx, dy) };
}

export function calculateHillshade(dx: number, dy: number, light: DirectionalLight, reliefStrength: number): number {
  if (![dx, dy, light.x, light.y, reliefStrength].every(Number.isFinite)) return 0;
  return clamp(-(dx * light.x + dy * light.y) * clamp(reliefStrength, 0, 8) * 2.2, -0.52, 0.48);
}

/** Approximate horizon occlusion along up to four cells toward the light source. */
export function calculateTerrainOcclusion(
  x: number,
  y: number,
  width: number,
  height: number,
  elevationsM: ArrayLike<number>,
  cellSizeM: number,
  light: DirectionalLight,
  reliefStrength: number,
  raySteps = 4,
): number {
  if (![x, y, width, height, cellSizeM, light.x, light.y, reliefStrength, raySteps].every(Number.isFinite)
    || width < 1 || height < 1 || cellSizeM <= 0 || raySteps < 1) return 0;

  const currentHeight = elevationsM[y * width + x];
  if (currentHeight === undefined || !Number.isFinite(currentHeight)) return 0;
  let occlusion = 0;
  let lastIndex = y * width + x;
  for (let step = 1; step <= Math.min(4, Math.floor(raySteps)); step += 1) {
    const sampleX = Math.round(x + light.x * step);
    const sampleY = Math.round(y + light.y * step);
    if (sampleX < 0 || sampleX >= width || sampleY < 0 || sampleY >= height) continue;
    const sampleIndex = sampleY * width + sampleX;
    if (sampleIndex === lastIndex) continue;
    lastIndex = sampleIndex;
    const neighborHeight = elevationsM[sampleIndex];
    if (neighborHeight === undefined || !Number.isFinite(neighborHeight)) continue;
    const distance = Math.max(1, Math.hypot(sampleX - x, sampleY - y));
    const horizon = neighborHeight - currentHeight;
    const contribution = clamp((horizon / (cellSizeM * distance)) * clamp(reliefStrength, 0, 8) * 0.37, 0, MAX_OCCLUSION);
    occlusion = Math.max(occlusion, contribution);
  }
  return occlusion;
}

export function calculateLightFactor(intensity: number, occlusion: number): number {
  if (!Number.isFinite(intensity) || !Number.isFinite(occlusion)) return 1;
  return clamp(1.02 + intensity - occlusion, MIN_LIGHT_FACTOR, MAX_LIGHT_FACTOR);
}

export function calculateTerrainLightingFactors(
  width: number,
  height: number,
  cellSizeM: number,
  elevationsM: ArrayLike<number>,
  settings: TerrainLightingSettings,
): Float32Array {
  const factors = new Float32Array(Math.max(0, width * height));
  if (width < 1 || height < 1 || elevationsM.length !== width * height || !Number.isFinite(cellSizeM) || cellSizeM <= 0) {
    factors.fill(1);
    return factors;
  }
  if (!settings.enabled) {
    factors.fill(1);
    return factors;
  }

  const light = calculateDirectionalLight(settings.sunAngle);
  const strength = clamp(Number.isFinite(settings.reliefStrength) ? settings.reliefStrength : 3, 0, 8);
  for (let y = 0; y < height; y += 1) {
    const northY = Math.max(0, y - 1);
    const southY = Math.min(height - 1, y + 1);
    for (let x = 0; x < width; x += 1) {
      const westX = Math.max(0, x - 1);
      const eastX = Math.min(width - 1, x + 1);
      const index = y * width + x;
      const center = elevationsM[index] ?? 0;
      const west = elevationsM[y * width + westX] ?? center;
      const east = elevationsM[y * width + eastX] ?? center;
      const north = elevationsM[northY * width + x] ?? center;
      const south = elevationsM[southY * width + x] ?? center;
      const gradient = calculateTerrainGradient(west, east, north, south, cellSizeM, eastX - westX, southY - northY);
      const intensity = calculateHillshade(gradient.dx, gradient.dy, light, strength);
      const occlusion = calculateTerrainOcclusion(x, y, width, height, elevationsM, cellSizeM, light, strength);
      factors[index] = calculateLightFactor(intensity, occlusion);
    }
  }
  return smoothTerrainLightingFactors(width, height, factors);
}

/** Softens cell boundaries while retaining some local contrast for pixel-art relief. */
export function smoothTerrainLightingFactors(width: number, height: number, factors: ArrayLike<number>): Float32Array {
  const smoothed = new Float32Array(Math.max(0, width * height));
  if (width < 1 || height < 1 || factors.length !== width * height) return smoothed;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let weighted = 0;
      let totalWeight = 0;
      for (let offsetY = -2; offsetY <= 2; offsetY += 1) {
        const sampleY = y + offsetY;
        if (sampleY < 0 || sampleY >= height) continue;
        const weightY = LIGHTING_SMOOTHING_WEIGHTS[offsetY + 2]!;
        for (let offsetX = -2; offsetX <= 2; offsetX += 1) {
          const sampleX = x + offsetX;
          if (sampleX < 0 || sampleX >= width) continue;
          const factor = factors[sampleY * width + sampleX] ?? 1;
          const weight = weightY * LIGHTING_SMOOTHING_WEIGHTS[offsetX + 2]!;
          weighted += (Number.isFinite(factor) ? factor : 1) * weight;
          totalWeight += weight;
        }
      }
      const index = y * width + x;
      const local = factors[index] ?? 1;
      const average = totalWeight === 0 ? local : weighted / totalWeight;
      smoothed[index] = (Number.isFinite(local) ? local : 1) * 0.25 + average * 0.75;
    }
  }
  return smoothed;
}

/** Expands changed elevation cells to cover gradient, horizon, brush, and pixel interpolation neighbors. */
export function createTerrainLightingDirtyMask(
  width: number,
  height: number,
  changedCellIndices: readonly number[],
  radius = TERRAIN_LIGHTING_DIRTY_RADIUS_CELLS,
  fullRebuildThreshold = 0.6,
): Uint8Array | undefined {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1
    || !Number.isInteger(radius) || radius < 0 || !Number.isFinite(fullRebuildThreshold)) return undefined;
  const dirty = new Uint8Array(width * height);
  let marked = 0;
  for (const index of changedCellIndices) {
    if (!Number.isInteger(index) || index < 0 || index >= width * height) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
      const cellY = y + offsetY;
      if (cellY < 0 || cellY >= height) continue;
      for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
        const cellX = x + offsetX;
        if (cellX < 0 || cellX >= width) continue;
        const dirtyIndex = cellY * width + cellX;
        if (dirty[dirtyIndex] === 1) continue;
        dirty[dirtyIndex] = 1;
        marked += 1;
      }
    }
  }
  return marked > width * height * clamp(fullRebuildThreshold, 0, 1) ? undefined : dirty;
}

/** Multiplies only RGB; alpha and the source palette remain untouched. */
export function applyTerrainLightingToImageData(
  imageData: ImageData,
  worldWidth: number,
  worldHeight: number,
  cellSizePixels: number,
  factors: ArrayLike<number>,
  dirtyCells?: ArrayLike<number>,
): void {
  if (![worldWidth, worldHeight, cellSizePixels].every(Number.isInteger)
    || worldWidth < 1 || worldHeight < 1 || cellSizePixels < 1 || factors.length !== worldWidth * worldHeight
    || imageData.width < worldWidth * cellSizePixels || imageData.height < worldHeight * cellSizePixels
    || (dirtyCells !== undefined && dirtyCells.length !== worldWidth * worldHeight)) return;

  const pixels = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const x0 = new Uint16Array(width);
  const x1 = new Uint16Array(width);
  const xBlend = new Float32Array(width);
  for (let x = 0; x < width; x += 1) {
    const sample = clamp((x + 0.5) / cellSizePixels - 0.5, 0, worldWidth - 1);
    x0[x] = Math.floor(sample);
    x1[x] = Math.min(worldWidth - 1, x0[x]! + 1);
    xBlend[x] = sample - x0[x]!;
  }
  for (let cellY = 0; cellY < worldHeight; cellY += 1) {
    const yStart = cellY * cellSizePixels;
    const yEnd = Math.min(height, yStart + cellSizePixels);
    for (let cellX = 0; cellX < worldWidth; cellX += 1) {
      if (dirtyCells !== undefined && dirtyCells[cellY * worldWidth + cellX] !== 1) continue;
      const xStart = cellX * cellSizePixels;
      const xEnd = Math.min(width, xStart + cellSizePixels);
      for (let y = yStart; y < yEnd; y += 1) {
        const ySample = clamp((y + 0.5) / cellSizePixels - 0.5, 0, worldHeight - 1);
        const y0 = Math.floor(ySample);
        const y1 = Math.min(worldHeight - 1, y0 + 1);
        const yAmount = ySample - y0;
        const topRow = y0 * worldWidth;
        const bottomRow = y1 * worldWidth;
        let pixelIndex = (y * width + xStart) * 4;
        for (let x = xStart; x < xEnd; x += 1) {
          const leftX = x0[x]!;
          const rightX = x1[x]!;
          const xAmount = xBlend[x]!;
          const top = interpolate(factors[topRow + leftX] ?? 1, factors[topRow + rightX] ?? 1, xAmount);
          const bottom = interpolate(factors[bottomRow + leftX] ?? 1, factors[bottomRow + rightX] ?? 1, xAmount);
          const factor = interpolate(top, bottom, yAmount);
          if (pixels[pixelIndex + 3] !== 0 && Number.isFinite(factor) && Math.abs(factor - 1) >= 0.0001) {
            pixels[pixelIndex] = clamp((pixels[pixelIndex] ?? 0) * factor, 0, 255);
            pixels[pixelIndex + 1] = clamp((pixels[pixelIndex + 1] ?? 0) * factor, 0, 255);
            pixels[pixelIndex + 2] = clamp((pixels[pixelIndex + 2] ?? 0) * factor, 0, 255);
          }
          pixelIndex += 4;
        }
      }
    }
  }
}

function interpolate(left: number, right: number, amount: number): number {
  return left + (right - left) * amount;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
