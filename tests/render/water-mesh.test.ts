import { describe, expect, it } from 'vitest';
import { buildWaterRibbon, organicWaterContour, smoothOpenWaterPath } from '../../src/render/water-mesh';

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

  it('suaviza uma margem em grade sem alterar sua forma entre execuções', () => {
    const contour = [
      { x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }, { x: 0, y: 40 },
    ];
    const first = organicWaterContour(contour, 1234, 2, 3);
    const second = organicWaterContour(contour, 1234, 2, 3);
    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(contour.length);
    expect(first.some((point) => point.x !== 0 && point.x !== 40 && point.y !== 0 && point.y !== 40)).toBe(true);
    expect(organicWaterContour(contour, 1234, 6, 3)).not.toEqual(first);
  });

  it('suaviza o caminho aberto do rio sem perder o progresso', () => {
    const path = smoothOpenWaterPath([
      { x: 0, y: 0, progress: 0 },
      { x: 20, y: 40, progress: 1 },
      { x: 60, y: 30, progress: 2 },
    ], 2);
    expect(path[0]).toEqual({ x: 0, y: 0, progress: 0 });
    expect(path.at(-1)).toEqual({ x: 60, y: 30, progress: 2 });
    expect(path.length).toBeGreaterThan(3);
    expect(path.every((point, index) => index === 0 || point.progress >= path[index - 1]!.progress)).toBe(true);
  });
});
