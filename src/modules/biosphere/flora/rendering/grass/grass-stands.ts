const clamp = (value: number, minimum = 0, maximum = 1): number =>
  Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));

function hash(seed: number, x: number, y: number, tuft: number): number {
  let value = (seed ^ Math.imul(x, 0x9e3779b1) ^ Math.imul(y, 0x85ebca6b) ^ Math.imul(tuft, 0xc2b2ae35)) | 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return (value ^ (value >>> 16)) >>> 0;
}

export type GrassStand = {
  preset: 'grama_fina' | 'capim_ornamental';
  seed: number;
  offsetX: number;
  offsetY: number;
  scale: number;
  alpha: number;
};

/** Deterministic clump layout for the renderer; it never creates or advances plant cohorts. */
export function grassStandLayout(options: {
  seed: number;
  x: number;
  y: number;
  biomassGPerM2: number;
  densityPerM2: number;
  light: number;
  cellSize: number;
}): GrassStand[] {
  const amount = Math.max(0, options.biomassGPerM2) * clamp(options.densityPerM2, 0.1, 1.5);
  const cover = clamp(amount / 350) * clamp(0.75 + clamp(options.light, 0, 1) * 0.25);
  if (cover < 0.035) return [];

  const count = cover >= 0.68 ? 3 : cover >= 0.34 ? 2 : 1;
  const size = Math.max(1, options.cellSize);
  return Array.from({ length: count }, (_, index) => {
    const value = hash(options.seed, options.x, options.y, index);
    const randomA = value / 0x1_0000_0000;
    const randomB = hash(value, options.x + 17, options.y - 31, index + 7) / 0x1_0000_0000;
    const preset = value % 5 === 0 ? 'capim_ornamental' : 'grama_fina';
    return {
      preset,
      seed: value,
      offsetX: (randomA - 0.5) * size * 0.38,
      offsetY: (randomB - 0.5) * size * 0.12,
      scale: (size / 224) * (0.32 + cover * 0.6) * (0.9 + randomB * 0.18),
      alpha: clamp(0.32 + cover * 0.68, 0.32, 1),
    };
  });
}

export function grassCoverFromCohorts(options: {
  biomassGPerM2: number;
  densityPerM2: number;
  light: number;
}): number {
  const amount = Math.max(0, options.biomassGPerM2) * clamp(options.densityPerM2, 0.1, 1.5);
  return clamp(amount / 350) * clamp(0.75 + clamp(options.light, 0, 1) * 0.25);
}
