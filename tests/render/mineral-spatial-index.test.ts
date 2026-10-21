import { describe, expect, it } from 'vitest';
import {
  buildMineralSpatialIndex,
  mineralUsesDetailedRaster,
  queryVisibleMineralFormations,
  type MineralSpatialFormation,
} from '../../src/render/mineral-spatial-index';

function formation(
  xCell: number,
  yCell: number,
  source: string,
  tier: string,
): MineralSpatialFormation {
  return {
    xCell,
    yCell,
    source,
    visualScale: 1,
    raster: { width: 128, height: 128, anchorX: 64, anchorY: 128 },
    deposit: { tier },
  };
}

describe('índice espacial de formações minerais', () => {
  it('adia rasterização detalhada até o zoom de inspeção próxima', () => {
    expect(mineralUsesDetailedRaster(1)).toBe(false);
    expect(mineralUsesDetailedRaster(1.24)).toBe(false);
    expect(mineralUsesDetailedRaster(1.25)).toBe(true);
  });

  it('retorna apenas rochas dentro da câmera e reduz detalhes conforme o zoom', () => {
    const formations = [
      formation(8, 9, 'ore', 'normal'),
      formation(20, 12, 'surface', 'small'),
      formation(40, 40, 'ore', 'macro'),
      formation(10, 12, 'scatter', 'small'),
    ];
    const index = buildMineralSpatialIndex(formations, 64, 64, 32);

    expect(queryVisibleMineralFormations(formations, index, 64, 64, {
      left: 0, top: 0, right: 15, bottom: 16,
    }, 0.38, 32)).toEqual(new Set([0]));
    expect(queryVisibleMineralFormations(formations, index, 64, 64, {
      left: 0, top: 0, right: 24, bottom: 20,
    }, 0.6, 32)).toEqual(new Set([0]));
    expect(queryVisibleMineralFormations(formations, index, 64, 64, {
      left: 0, top: 0, right: 24, bottom: 20,
    }, 1, 32)).toEqual(new Set([0, 1, 3]));
  });

  it('indexa uma formação grande em todos os chunks que sua imagem ocupa', () => {
    const formations = [formation(16, 16, 'ore', 'macro')];
    const index = buildMineralSpatialIndex(formations, 64, 64, 32);

    expect([...index.keys()].sort((a, b) => a - b)).toEqual([0, 1, 4, 5]);
  });
});
