export type RainCell = {
  climate: { precipitationMm: number };
};

export type RainStreak = {
  x: number;
  y: number;
  endX: number;
  endY: number;
  opacityBand: 0 | 1 | 2;
};

export const RAIN_VISUAL_THRESHOLD_MM = 0.01;

export function meanPrecipitationMm(cells: readonly RainCell[]): number {
  if (cells.length === 0) return 0;
  let total = 0;
  for (const cell of cells) {
    const precipitation = cell.climate.precipitationMm;
    if (Number.isFinite(precipitation) && precipitation > 0) total += precipitation;
  }
  return total / cells.length;
}

export function buildRainStreaks(
  width: number,
  height: number,
  cellSize: number,
  visualSeed: number,
  timeMs: number,
  meanRainMm: number,
): RainStreak[] {
  if (!Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(cellSize)
    || !Number.isFinite(timeMs) || !Number.isFinite(meanRainMm)
    || width <= 0 || height <= 0 || cellSize <= 0 || meanRainMm <= RAIN_VISUAL_THRESHOLD_MM) return [];

  const intensity = Math.min(1, Math.max(0, meanRainMm / 5));
  const density = 0.06 + intensity * 0.15;
  const count = Math.ceil((width * height) / (cellSize * cellSize) * density);
  const safeTime = Math.max(0, timeMs);
  const streaks: RainStreak[] = [];

  for (let index = 0; index < count; index += 1) {
    const xSeed = unitNoise(visualSeed, index, 1);
    const ySeed = unitNoise(visualSeed, index, 2);
    const speed = 320 + unitNoise(visualSeed, index, 3) * 260;
    const length = 10 + unitNoise(visualSeed, index, 4) * (8 + intensity * 8);
    const baseY = ySeed * height;
    const y = positiveModulo(baseY + safeTime * speed / 1_000, height + length) - length;
    const x = xSeed * width;
    const dx = 1.5 + unitNoise(visualSeed, index, 5) * 2.5;
    const opacityBand = Math.floor(unitNoise(visualSeed, index, 6) * 3) as 0 | 1 | 2;
    streaks.push({ x, y, endX: x + dx, endY: y + length, opacityBand });
  }

  return streaks;
}

export function rainOpacity(meanRainMm: number, opacityBand: 0 | 1 | 2): number {
  const intensity = Math.min(1, Math.max(0, meanRainMm / 5));
  return Math.min(0.68, 0.24 + opacityBand * 0.11 + intensity * 0.16);
}

function unitNoise(seed: number, index: number, salt: number): number {
  let value = (seed ^ Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca6b)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 0x1_0000_0000;
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
