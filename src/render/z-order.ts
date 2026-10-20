const WORLD_OBJECT_DEPTH_BASE = 2.7;
const WORLD_OBJECT_DEPTH_RANGE = 2;

/**
 * Returns a stable Phaser depth from the object's ground contact point.
 * Objects whose base is lower on the map are drawn in front of higher ones.
 */
export function worldObjectDepth(baseY: number, worldHeight: number, bias = 0): number {
  const normalizedBase = Math.max(0, Math.min(1, baseY / Math.max(1, worldHeight)));
  return WORLD_OBJECT_DEPTH_BASE + normalizedBase * WORLD_OBJECT_DEPTH_RANGE + bias;
}
