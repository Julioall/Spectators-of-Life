import { describe, expect, it } from 'vitest';
import { canonicalStringify } from '../../src/core/canonical-json';
import { createNaturalWorld } from '../../src/core/natural/scenario';
import { getNaturalWorld } from '../../src/core/natural/types';
import { ambientRockColor, generateProceduralRocks, gravelAffinityForCell, mossMultiplierForHabitat, rockRegionAffinityForCell, rockTouchesWater } from '../../src/render/procedural-rocks';
import { createAsterraSettings } from '../../src/render/asterra/settings';
import { footprintAt, outcropSize } from '../../src/render/asterra/engine.js';
import { asterraTerrainForSurface } from '../../src/render/terrain-palette';

describe('geração procedural de rochas', () => {
  it('repete formas e footprints com a mesma seed visual sem alterar a simulação', () => {
    const world = getNaturalWorld(createNaturalWorld('0123456789abcdef'));
    const stateBefore = canonicalStringify(world);

    const first = generateProceduralRocks(world, 1947);
    const second = generateProceduralRocks(world, 1947);

    expect(first.length).toBeGreaterThan(0);
    expect(first).toEqual(second);
    expect(first.some((rock) => rock.source === 'ore')).toBe(true);
    expect(first.some((rock) => rock.source === 'surface')).toBe(true);
    expect(first.every((rock) => rock.footprint.width >= 2)).toBe(true);
    for (const rock of first) {
      const native = footprintAt(0, 0, rock.deposit);
      expect(rock.footprint.width).toBe(native.w);
      expect(rock.footprint.height).toBe(native.h);
      expect(outcropSize(rock.deposit).w).toBeGreaterThan(16);
    }
    expect(canonicalStringify(world)).toBe(stateBefore);
  }, 30_000);

  it('mantém footprints dentro do mapa e sem sobreposição', () => {
    const world = getNaturalWorld(createNaturalWorld('0123456789abcdef'));
    const rocks = generateProceduralRocks(world, 1947);
    const occupied = new Set<number>();

    for (const rock of rocks) {
      const { x, y, width, height } = rock.footprint;
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + width).toBeLessThanOrEqual(world.width);
      expect(y + height).toBeLessThanOrEqual(world.height);
      for (let row = y; row < y + height; row += 1) {
        for (let column = x; column < x + width; column += 1) {
          const index = row * world.width + column;
          expect(occupied.has(index)).toBe(false);
          occupied.add(index);
        }
      }
    }
  });

  it('varia as escolhas visuais com a seed visual sem tocar na seed do mundo', () => {
    const world = getNaturalWorld(createNaturalWorld('0123456789abcdef'));
    const first = generateProceduralRocks(world, 1947);
    const second = generateProceduralRocks(world, 1948);

    expect(first.map(({ xCell, yCell, deposit }) => [xCell, yCell, deposit.family, deposit.variant]))
      .not.toEqual(second.map(({ xCell, yCell, deposit }) => [xCell, yCell, deposit.family, deposit.variant]));
  });

  it('mantém uma cadência local e escolhe a família de paleta do terreno do projeto', () => {
    const world = getNaturalWorld(createNaturalWorld('0123456789abcdef'));
    const rocks = generateProceduralRocks(world, 1947);
    const clustered = rocks.filter((rock, index) => rocks.some((other, otherIndex) => {
      if (index === otherIndex) return false;
      return Math.max(Math.abs(rock.xCell - other.xCell), Math.abs(rock.yCell - other.yCell)) <= 4;
    }));

    expect(clustered.length / rocks.length).toBeGreaterThan(0.7);
    const closeClustered = rocks.filter((rock, index) => rocks.some((other, otherIndex) => {
      if (index === otherIndex) return false;
      return Math.max(Math.abs(rock.xCell - other.xCell), Math.abs(rock.yCell - other.yCell)) <= 3;
    }));
    expect(closeClustered.length / rocks.length).toBeGreaterThan(0.5);
    expect(rocks.some((rock) => rock.deposit.tier === 'small')).toBe(true);
    expect(rocks.some((rock) => rock.visualScale < 0.6)).toBe(true);
    expect(rocks.some((rock) => rock.deposit.tier === 'normal')).toBe(true);
    expect(rocks.some((rock) => rock.settings.terrain === 'mountain' || rock.settings.terrain === 'volcanic')).toBe(true);
    expect(asterraTerrainForSurface('desert', 'granite')).toBe('dry');
    expect(asterraTerrainForSurface('wetland', 'granite')).toBe('coast');
    expect(asterraTerrainForSurface('rock', 'basalt')).toBe('volcanic');
    expect(asterraTerrainForSurface('meadow', 'granite')).toBe('grass');
  });

  it('espalha pedregulhos pequenos e reserva pontas para zonas secas', () => {
    const world = getNaturalWorld(createNaturalWorld('0123456789abcdef'));
    const rocks = generateProceduralRocks(world, 1947);
    const scatter = rocks.filter((rock) => rock.source === 'scatter');
    const pointed = rocks.filter((rock) => rock.deposit.family === 'shard' || rock.deposit.family === 'column');
    expect(scatter.length).toBeGreaterThan(10);
    expect(scatter.every((rock) => rock.deposit.tier === 'small' && rock.visualScale <= 0.6)).toBe(true);
    expect(pointed.every((rock) => rock.deposit.biome === 'desert' || rock.deposit.biome === 'volcanic')).toBe(true);
    const large = rocks.filter((rock) => rock.deposit.tier === 'large' || rock.deposit.tier === 'macro');
    expect(large.length).toBeGreaterThan(0);
    expect(large.some((anchor) => rocks.some((other) => other !== anchor
      && (other.deposit.tier === 'small' || other.deposit.tier === 'normal')
      && Math.max(Math.abs(anchor.xCell - other.xCell), Math.abs(anchor.yCell - other.yCell)) <= 4))).toBe(true);
  });

  it('ambienta somente a base da rocha e preserva veios e musgo', () => {
    const base = [93, 55, 38] as const;
    const goldVein = [185, 147, 31] as const;
    const moss = [74, 112, 54] as const;

    const ambientBase = ambientRockColor(base, 'mountain', 'ouro');
    expect(ambientBase).not.toEqual(base);
    expect(Math.abs(ambientBase[0] - ambientBase[1])).toBeLessThan(Math.abs(base[0] - base[1]));
    expect(ambientRockColor(goldVein, 'mountain', 'ouro')).toEqual(goldVein);
    expect(ambientRockColor(moss, 'mountain', 'ouro')).toEqual(moss);
    expect(ambientRockColor(base, 'grass', 'ouro')).toEqual(base);
  });

  it('aumenta o musgo em floresta sem alterar a paleta dos veios', () => {
    expect(mossMultiplierForHabitat('woodland')).toBeGreaterThan(2);
    expect(mossMultiplierForHabitat('woodland')).toBeGreaterThan(mossMultiplierForHabitat('meadow'));
    const forest = createAsterraSettings('temperate', 'ouro', 'granite', 1947, 'grass', mossMultiplierForHabitat('woodland'));
    const meadow = createAsterraSettings('temperate', 'ouro', 'granite', 1947, 'grass', mossMultiplierForHabitat('meadow'));
    expect(forest.moss).toBeGreaterThan(meadow.moss);
    expect(forest.moss).toBeLessThanOrEqual(1);
  });

  it('prioriza cascalho em células com caminho, escoamento e erosão', () => {
    const world = getNaturalWorld(createNaturalWorld('0123456789abcdef'));
    const cell = world.cells.find((candidate) => candidate.terrain.waterBody === 'none' && candidate.water.surfaceMm === 0);
    expect(cell).toBeDefined();
    const baseline = gravelAffinityForCell(world, cell!);
    cell!.water.lastFlows.runoffOutMm = 3.2;
    cell!.water.lastFlows.runoffInMm = 1.4;
    cell!.soil.lastMineralErosionKgPerM2 = 0.32;
    cell!.soil.sedimentLoadKgPerM2 = 0.6;
    cell!.terrain.channelIncisionM = 0.1;
    expect(gravelAffinityForCell(world, cell!)).toBeGreaterThan(baseline);
    expect(gravelAffinityForCell(world, cell!)).toBeGreaterThan(0.85);
  });

  it('concentra a afinidade em regiões rochosas e não em terreno isolado', () => {
    const world = getNaturalWorld(createNaturalWorld('0123456789abcdef'));
    const core = world.cells.find((candidate) => candidate.terrain.exposedRock
      && world.cells.filter((neighbor) => Math.abs(neighbor.x - candidate.x) <= 1
        && Math.abs(neighbor.y - candidate.y) <= 1
        && neighbor !== candidate
        && neighbor.terrain.exposedRock).length >= 3);
    const plain = world.cells.find((candidate) => !candidate.terrain.exposedRock
      && gravelAffinityForCell(world, candidate) < 0.52
      && !world.cells.some((neighbor) => Math.abs(neighbor.x - candidate.x) <= 1
        && Math.abs(neighbor.y - candidate.y) <= 1
        && neighbor !== candidate
        && neighbor.terrain.exposedRock));

    expect(core).toBeDefined();
    expect(plain).toBeDefined();
    expect(rockRegionAffinityForCell(world, core!, 1947)).toBeGreaterThan(0.6);
    expect(rockRegionAffinityForCell(world, plain!, 1947)).toBe(0);
  });

  it('mantém a pegada e o envelope visual das rochas fora do leito', () => {
    const world = getNaturalWorld(createNaturalWorld('0123456789abcdef'));
    const rocks = generateProceduralRocks(world, 1947);
    expect(rocks.every((rock) => !rockTouchesWater(world, rock))).toBe(true);
    expect(world.cells.some((cell) => cell.terrain.waterBody === 'river')).toBe(true);
  });

  it('mantém a geração determinística e fora da água em várias seeds fixas', () => {
    const seeds = [
      '0000000000000000',
      '0000000000000004',
      '0000000000000006',
      '0123456789abcdef',
      'b3bfa23c2b15d7c7',
      'ffffffffffffffff',
    ];

    for (const seed of seeds) {
      const world = getNaturalWorld(createNaturalWorld(seed));
      const first = generateProceduralRocks(world, 1947);
      const second = generateProceduralRocks(world, 1947);
      const occupied = new Set<number>();

      expect(first).toEqual(second);
      expect(first.length).toBeGreaterThan(0);
      expect(first.every((rock) => !rockTouchesWater(world, rock))).toBe(true);
      for (const rock of first) {
        expect(rock.footprint.x).toBeGreaterThanOrEqual(0);
        expect(rock.footprint.y).toBeGreaterThanOrEqual(0);
        expect(rock.footprint.x + rock.footprint.width).toBeLessThanOrEqual(world.width);
        expect(rock.footprint.y + rock.footprint.height).toBeLessThanOrEqual(world.height);
        for (let y = rock.footprint.y; y < rock.footprint.y + rock.footprint.height; y += 1) {
          for (let x = rock.footprint.x; x < rock.footprint.x + rock.footprint.width; x += 1) {
            const index = y * world.width + x;
            expect(occupied.has(index)).toBe(false);
            occupied.add(index);
          }
        }
      }
    }
  }, 30_000);
});
