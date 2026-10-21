import { describe, expect, it } from 'vitest';
import { grassCoverFromCohorts, grassStandLayout } from '../../src/modules/biosphere/flora/rendering/grass/grass-stands';
import { shrubStandForCell } from '../../src/modules/biosphere/flora/rendering/shrubs/shrubs';
import { TREE_GROWTH_STOPS, treeGrowthVisual } from '../../src/modules/biosphere/flora/rendering/trees/tree-art';

describe('procedural vegetation projection', () => {
  it('uses stable clump geometry for the same world cell and visual seed', () => {
    const options = { seed: 1947, x: 12, y: 8, biomassGPerM2: 280, densityPerM2: 1, light: 0.82, cellSize: 40 };
    expect(grassStandLayout(options)).toEqual(grassStandLayout(options));
    expect(grassStandLayout(options).every((stand) => stand.scale > 0 && stand.alpha <= 1)).toBe(true);
  });

  it('increases grass coverage with cohort biomass without inventing cover at zero biomass', () => {
    const cover = (biomassGPerM2: number) => grassCoverFromCohorts({ biomassGPerM2, densityPerM2: 1, light: 0.8 });
    expect(cover(0)).toBe(0);
    expect(cover(260)).toBeGreaterThan(cover(80));
    expect(grassStandLayout({ seed: 1, x: 0, y: 0, biomassGPerM2: 0, densityPerM2: 1, light: 1, cellSize: 40 })).toEqual([]);
  });

  it('interpolates tree size continuously between cached growth frames', () => {
    const earlier = treeGrowthVisual(300, 900, 1000, 1000);
    const later = treeGrowthVisual(380, 900, 1000, 1000);
    expect(later.growth).toBeGreaterThan(earlier.growth);
    expect(later.scaleFactor).toBeGreaterThan(earlier.scaleFactor);
    expect(later.frame).toBe(earlier.frame);
  });

  it('uses the same growth thresholds for tree art frames as the laboratory atlas', () => {
    const frameAt = (growth: number) => treeGrowthVisual(growth * 1000, 1000, 1000, 1000).frame;
    expect(frameAt(TREE_GROWTH_STOPS[0] - 0.001)).toBe(0);
    expect(frameAt(TREE_GROWTH_STOPS[0] + 0.001)).toBe(1);
    expect(frameAt(TREE_GROWTH_STOPS[4] + 0.001)).toBe(5);
  });

  it('caps visible tree growth by both age and living biomass', () => {
    const growth = treeGrowthVisual(900, 100, 1000, 1000);
    expect(growth.growth).toBeCloseTo(Math.sqrt(0.1));
    expect(growth.frame).toBe(2);
  });

  it('projects one stable shrub clump and interpolates its size with growth', () => {
    const createCell = (ageDays: number, biomassGPerM2: number) => ({
      index: 18,
      x: 3,
      y: 4,
      water: { surfaceMm: 0 },
      terrain: { habitat: 'woodland' },
      plants: [{ speciesId: 'shrub', stage: 'juvenile', ageDays, biomassGPerM2, densityPerM2: 1, limitingFactors: { water: 0.8 } }],
    } as Parameters<typeof shrubStandForCell>[1]);
    const early = shrubStandForCell(1947, createCell(250, 40), 40);
    const repeated = shrubStandForCell(1947, createCell(250, 40), 40);
    const later = shrubStandForCell(1947, createCell(500, 150), 40);
    expect(early).toEqual(repeated);
    expect(later?.scale).toBeGreaterThan(early?.scale ?? 0);
    expect(shrubStandForCell(1947, createCell(500, 0), 40)).toBeNull();
  });
});
