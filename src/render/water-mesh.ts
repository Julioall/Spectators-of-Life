export type WaterRibbonPoint = { x: number; y: number; width: number };
export type WaterMeshPoint = { x: number; y: number };

/**
 * Converts a cell-boundary contour into a stable organic shoreline. The
 * smoothing is purely visual and uses a separate seed so it cannot affect the
 * simulation or save data.
 */
export function organicWaterContour(
  points: readonly WaterMeshPoint[],
  visualSeed: number,
  amplitude = 1.6,
  iterations = 3,
): WaterMeshPoint[] {
  if (points.length < 3) return points.map((point) => ({ ...point }));
  let smoothed = points.map((point) => ({ ...point }));
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const next: WaterMeshPoint[] = [];
    for (let index = 0; index < smoothed.length; index += 1) {
      const current = smoothed[index]!;
      const following = smoothed[(index + 1) % smoothed.length]!;
      next.push({
        x: current.x * 0.75 + following.x * 0.25,
        y: current.y * 0.75 + following.y * 0.25,
      });
      next.push({
        x: current.x * 0.25 + following.x * 0.75,
        y: current.y * 0.25 + following.y * 0.75,
      });
    }
    smoothed = next;
  }

  return smoothed.map((point, index) => {
    const previous = smoothed[(index - 1 + smoothed.length) % smoothed.length]!;
    const following = smoothed[(index + 1) % smoothed.length]!;
    let tangentX = following.x - previous.x;
    let tangentY = following.y - previous.y;
    const length = Math.hypot(tangentX, tangentY);
    if (length < 1e-6) return point;
    tangentX /= length;
    tangentY /= length;
    const coarseNoise = deterministicNoise(visualSeed, Math.floor(index / 4), 19);
    const fineNoise = deterministicNoise(visualSeed, index, 37);
    const offset = (coarseNoise * 0.72 + fineNoise * 0.28) * amplitude;
    return {
      x: point.x - tangentY * offset,
      y: point.y + tangentX * offset,
    };
  });
}

/** Builds a filled, flow-aligned ribbon from a smoothed river centerline. */
export function buildWaterRibbon(points: readonly WaterRibbonPoint[], edgePadding = 0): WaterMeshPoint[] {
  if (points.length === 0) return [];
  if (points.length === 1) {
    const point = points[0]!;
    const radius = Math.max(0.5, point.width * 0.5 + edgePadding);
    return [
      { x: point.x - radius, y: point.y },
      { x: point.x, y: point.y - radius },
      { x: point.x + radius, y: point.y },
      { x: point.x, y: point.y + radius },
    ];
  }

  const left: WaterMeshPoint[] = [];
  const right: WaterMeshPoint[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const previous = points[Math.max(0, index - 1)]!;
    const next = points[Math.min(points.length - 1, index + 1)]!;
    let dx = next.x - previous.x;
    let dy = next.y - previous.y;
    const length = Math.hypot(dx, dy);
    if (length < 1e-6) {
      dx = 1;
      dy = 0;
    } else {
      dx /= length;
      dy /= length;
    }
    const radius = Math.max(0.5, current.width * 0.5 + edgePadding);
    const normalX = -dy * radius;
    const normalY = dx * radius;
    left.push({ x: current.x + normalX, y: current.y + normalY });
    right.push({ x: current.x - normalX, y: current.y - normalY });
  }
  return [...left, ...right.reverse()];
}

function deterministicNoise(seed: number, index: number, salt: number): number {
  let value = (seed ^ Math.imul(index + salt * 17, 0x45d9f3b) ^ Math.imul(salt - index * 11, 0x27d4eb2d)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 0x1_0000_0000 * 2 - 1;
}
