export type WaterRibbonPoint = { x: number; y: number; width: number };
export type WaterMeshPoint = { x: number; y: number };

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
