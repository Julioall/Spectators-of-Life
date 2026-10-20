import { describe, expect, it } from 'vitest';
import { buildWaterRibbon } from '../../src/render/water-mesh';

describe('malha visual de água', () => {
  it('cria margens perpendiculares ao eixo do fluxo e preserva largura', () => {
    const mesh = buildWaterRibbon([
      { x: 0, y: 0, width: 10 },
      { x: 20, y: 0, width: 14 },
      { x: 40, y: 10, width: 18 },
    ]);
    expect(mesh).toHaveLength(6);
    expect(mesh.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
    expect(mesh[0]!.y).toBeGreaterThan(0);
    expect(mesh[mesh.length - 1]!.y).toBeLessThan(0);
  });

  it('é determinística e trata um único ponto como uma pequena piscina', () => {
    const point = [{ x: 12, y: 18, width: 8 }];
    expect(buildWaterRibbon(point)).toEqual(buildWaterRibbon(point));
    expect(buildWaterRibbon(point)).toHaveLength(4);
  });
});
