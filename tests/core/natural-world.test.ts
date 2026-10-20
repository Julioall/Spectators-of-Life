import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canonicalStringify, utf8ByteLength } from '../../src/core/canonical-json';
import { MAX_WORLD_BYTES, MAX_WORLD_STATE_BYTES, NATURAL_SCENARIO_ID } from '../../src/core/constants';
import { createNaturalWorld, NATURAL_SYSTEMS } from '../../src/core/natural/scenario';
import { buildLandformElevationField } from '../../src/core/natural/topography';
import { getNaturalWorld } from '../../src/core/natural/types';
import { validateSaveDocument, validateWorldState, worldFromSave, toSaveDocument, stepWorld } from '../../src/core/world';

const FIXED_SEED = '0123456789abcdef';

describe('cenário natural do vale temperado', () => {
  it('gera relevo, bacias, solo, minerais e coortes vegetais reproduzíveis por seed', () => {
    const first = createNaturalWorld(FIXED_SEED);
    const second = createNaturalWorld(FIXED_SEED);
    const natural = getNaturalWorld(first);
    expect(canonicalStringify(first)).toBe(canonicalStringify(second));
    expect(first.scenarioId).toBe(NATURAL_SCENARIO_ID);
    expect(first.scenarioVersion).toBe('1.11.0');
    expect(natural.cells).toHaveLength(natural.width * natural.height);
    expect(new Set(natural.cells.map((cell) => cell.terrain.soilType)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(natural.cells.map((cell) => cell.terrain.bedrock)).size).toBeGreaterThanOrEqual(2);
    expect(natural.cells.every((cell) => cell.terrain.flowTo < 0 || natural.cells[cell.terrain.flowTo]!.terrain.elevationM < cell.terrain.elevationM)).toBe(true);
    const elevationSorted = [...natural.cells].sort((left, right) => left.terrain.elevationM - right.terrain.elevationM || left.index - right.index);
    const quartileSize = Math.floor(elevationSorted.length / 4);
    const lowland = elevationSorted.slice(0, quartileSize);
    const highland = elevationSorted.slice(-quartileSize);
    const meanMineralPotential = (cells: typeof natural.cells): number =>
      sum(cells.map((cell) => cell.terrain.mineralPotential ?? 0)) / cells.length;
    expect(natural.cells.every((cell) => Number.isFinite(cell.terrain.mineralPotential)
      && (cell.terrain.mineralPotential ?? -1) >= 0 && (cell.terrain.mineralPotential ?? 2) <= 1)).toBe(true);
    expect(meanMineralPotential(highland)).toBeGreaterThan(meanMineralPotential(lowland) + 0.05);
    const landformElevations = buildLandformElevationField(natural.width, natural.height, natural.cells.map((cell) => cell.terrain.elevationM));
    const landformOrder = natural.cells.map((cell) => ({ cell, elevation: landformElevations[cell.index] as number }))
      .sort((left, right) => left.elevation - right.elevation || left.cell.index - right.cell.index);
    const lowlandByForm = landformOrder.slice(0, quartileSize).map(({ cell }) => cell);
    const highlandByForm = landformOrder.slice(-quartileSize).map(({ cell }) => cell);
    const uplandShare = (cells: typeof natural.cells): number => cells.filter((cell) => cell.terrain.habitat === 'upland').length / cells.length;
    expect(uplandShare(highlandByForm)).toBeGreaterThan(uplandShare(lowlandByForm));
    expect(natural.cells.filter((cell) => cell.water.surfaceMm >= 18).length).toBeGreaterThanOrEqual(3);
    for (const speciesId of ['grass', 'shrub', 'oak', 'pine', 'birch', 'autumnal', 'willow']) {
      expect(natural.cells.some((cell) => cell.plants.some((plant) => plant.speciesId === speciesId))).toBe(true);
    }
    for (const resourceId of ['copper', 'iron', 'silver', 'gold']) {
      expect(natural.cells.some((cell) => cell.minerals.some((deposit) => deposit.resourceId === resourceId && deposit.reserveKg > 0))).toBe(true);
    }
    expect(utf8ByteLength(canonicalStringify(toSaveDocument(first)))).toBeLessThan(MAX_WORLD_BYTES);
  }, 15_000);

  it('não estabelece árvores em células de rocha exposta', () => {
    const seeds = ['0000000000000000', '0000000000000004', '0123456789abcdef', 'ffffffffffffffff'];
    const treeSpecies = new Set(['oak', 'pine', 'birch', 'autumnal', 'willow']);

    for (const seed of seeds) {
      const world = getNaturalWorld(createNaturalWorld(seed));
      for (const cell of world.cells) {
        if (!cell.terrain.exposedRock) continue;
        expect(cell.plants.some((plant) => treeSpecies.has(plant.speciesId) && (plant.biomassGPerM2 > 0 || plant.seedBankMatterGPerM2 > 0))).toBe(false);
      }
    }
  }, 30_000);

  it('segue a drenagem do relevo, conecta cursos aos lagos e alarga rios a jusante', () => {
    const natural = getNaturalWorld(createNaturalWorld(FIXED_SEED));
    const rivers = natural.cells.filter((cell) => cell.terrain.waterBody === 'river');
    const isLakeAdjacent = (cell: (typeof natural.cells)[number]): boolean => {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const x = cell.x + dx;
          const y = cell.y + dy;
          if (x >= 0 && x < natural.width && y >= 0 && y < natural.height
            && natural.cells[y * natural.width + x]!.terrain.waterBody === 'lake') return true;
        }
      }
      return false;
    };
    const lakeOutlets = rivers.filter(isLakeAdjacent);
    expect(lakeOutlets.length).toBeGreaterThan(0);
    const connectedRiverComponentSize = (outlet: (typeof natural.cells)[number]): number => {
      const connectedRiverCells = new Set<number>([outlet.index]);
      const queue = [outlet.index];
      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const cell = natural.cells[queue[cursor] as number]!;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const x = cell.x + dx;
            const y = cell.y + dy;
            if (x < 0 || x >= natural.width || y < 0 || y >= natural.height) continue;
            const neighbor = y * natural.width + x;
            if (natural.cells[neighbor]!.terrain.waterBody !== 'river' || connectedRiverCells.has(neighbor)) continue;
            connectedRiverCells.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
      return connectedRiverCells.size;
    };
    const lakeOutletReachSizes = lakeOutlets.map(connectedRiverComponentSize);
    expect(Math.max(...lakeOutletReachSizes)).toBeGreaterThanOrEqual(6);
    for (const cell of rivers) {
      const downstream = cell.terrain.flowTo;
      if (downstream < 0) continue;
      expect(natural.cells[downstream]!.terrain.elevationM).toBeLessThan(cell.terrain.elevationM);
      expect(['river', 'lake']).toContain(natural.cells[downstream]!.terrain.waterBody);
    }

    const contributing = catchmentCellsForTest(natural);
    const nearbyRiverCells = (cell: (typeof natural.cells)[number]): number => natural.cells.filter((other) =>
      other.terrain.waterBody === 'river' && Math.hypot(other.x - cell.x, other.y - cell.y) <= 1.5).length;
    const byCatchment = [...rivers].sort((left, right) => (contributing[left.index] as number) - (contributing[right.index] as number));
    const quartile = Math.max(1, Math.floor(byCatchment.length / 4));
    const headwaterWidth = mean(byCatchment.slice(0, quartile).map(nearbyRiverCells));
    const downstreamWidth = mean(byCatchment.slice(-quartile).map(nearbyRiverCells));
    expect(downstreamWidth).toBeGreaterThan(headwaterWidth);

    const riverUpstreamCount = new Uint8Array(natural.cells.length);
    for (const cell of rivers) {
      const downstream = cell.terrain.flowTo;
      if (downstream >= 0 && natural.cells[downstream]!.terrain.waterBody === 'river') riverUpstreamCount[downstream] = (riverUpstreamCount[downstream] ?? 0) + 1;
    }
    const junction = rivers.find((cell) => (riverUpstreamCount[cell.index] ?? 0) >= 2);
    expect(junction).toBeDefined();
    if (junction !== undefined) expect(nearbyRiverCells(junction)).toBeGreaterThanOrEqual(4);
  }, 15_000);

  it('preserva a incisão reforçada das margens de rios em versões 1.10 ou posteriores', () => {
    const current = createNaturalWorld(FIXED_SEED);
    const legacy = structuredClone(current);
    legacy.scenarioVersion = '1.9.0';
    getNaturalWorld(legacy).scenarioVersion = '1.9.0';
    const initialNatural = getNaturalWorld(current);
    const riverBankIndices = initialNatural.cells.filter((cell) => {
      if (cell.terrain.waterBody !== 'none') return false;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const x = cell.x + dx;
          const y = cell.y + dy;
          if (x >= 0 && x < initialNatural.width && y >= 0 && y < initialNatural.height
            && initialNatural.cells[y * initialNatural.width + x]!.terrain.waterBody === 'river') return true;
        }
      }
      return false;
    }).map((cell) => cell.index);
    const currentAfterRain = getNaturalWorld(stepWorld(current, 4, NATURAL_SYSTEMS).state);
    const legacyAfterRain = getNaturalWorld(stepWorld(legacy, 4, NATURAL_SYSTEMS).state);
    expect(riverBankIndices.some((index) =>
      (currentAfterRain.cells[index]!.soil.lastMineralErosionKgPerM2 ?? 0)
        > (legacyAfterRain.cells[index]!.soil.lastMineralErosionKgPerM2 ?? 0))).toBe(true);
  }, 30_000);

  it('mantém as capacidades de estado das versões anteriores após versionar a geração', () => {
    const current = createNaturalWorld(FIXED_SEED);
    for (const version of ['1.7.0', '1.8.0', '1.9.0'] as const) {
      const legacyWorld = structuredClone(current);
      legacyWorld.scenarioVersion = version;
      getNaturalWorld(legacyWorld).scenarioVersion = version;
      expect(validateWorldState(legacyWorld)).toBe(true);
    }
  });

  it('avança clima, água, decomposição e plantas em passos diários com saída fluvial auditada', () => {
    const initial = createNaturalWorld(FIXED_SEED);
    const initialNatural = getNaturalWorld(initial);
    const initialStateString = canonicalStringify(initial);
    const waterBefore = totalWater(initialNatural);
    const result = stepWorld(initial, 4, NATURAL_SYSTEMS);
    const natural = getNaturalWorld(result.state);
    const precipitation = sum(natural.cells.map((cell) => cell.water.lastFlows.precipitationMm ?? 0));
    const evaporation = sum(natural.cells.map((cell) => (cell.water.lastFlows.surfaceEvaporationMm ?? 0) + (cell.water.lastFlows.soilEvaporationMm ?? 0)));
    const transpiration = sum(natural.cells.map((cell) => cell.water.lastFlows.transpirationMm ?? 0));
    const boundaryOutflow = sum(natural.cells.map((cell) => cell.water.lastFlows.boundaryOutflowMm ?? 0));
    const expectedWater = waterBefore + precipitation - evaporation - transpiration - boundaryOutflow;
    expect(result.state.tick).toBe(4);
    expect(canonicalStringify(initial)).toBe(initialStateString);
    expect(natural.daysSimulated).toBe(1);
    expect(precipitation).toBeGreaterThan(0);
    expect(Math.abs(totalWater(natural) - expectedWater)).toBeLessThan(0.5);
    expect(result.state.metrics['soil.meanMineralNitrogenGPerM2']).toBeGreaterThan(0);
    expect(result.state.metrics['vegetation.totalBiomassGPerM2']).toBeGreaterThan(0);
    expect(natural.totals.photosynthesisG).toBeGreaterThan(0);
    expect(natural.totals.decompositionRespirationG).toBeGreaterThan(0);
    expect(result.events.some((event) => event.eventType === 'vegetation:growth')).toBe(true);
    expect(result.state.metrics['hydrology.meanRunoffMm']).toBeGreaterThanOrEqual(0);
    expect(result.state.metrics['hydrology.boundaryOutflowMmM2']).toBeGreaterThan(0);
    expect(natural.cells.every((cell) => Object.values(cell.water.lastFlows).every((flow) => flow > 0))).toBe(true);
    expect(natural.cells.every((cell) => cell.plants.every((plant) => plant.stress !== undefined && plant.limitingFactors === undefined))).toBe(true);
  });

  it('encaminha chuva em cascata pelo relevo e forma lago em depressão fechada sem perder água', () => {
    const state = createNaturalWorld(FIXED_SEED);
    const natural = getNaturalWorld(state);
    natural.boundary = 'closed';
    for (const cell of natural.cells) {
      cell.terrain.elevationM = 200;
      cell.terrain.slope = 0;
      cell.terrain.flowTo = -1;
      cell.terrain.waterBody = 'none';
      cell.water.surfaceMm = 0;
      cell.water.soilMm = cell.water.capacityMm;
      cell.climate.precipitationMm = 0;
    }

    const centerX = 12;
    const centerY = 12;
    const basinCells: typeof natural.cells = [];
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        const x = centerX + dx;
        const y = centerY + dy;
        const cell = natural.cells[y * natural.width + x]!;
        const radius = Math.max(Math.abs(dx), Math.abs(dy));
        cell.terrain.elevationM = 90 + radius * 2;
        cell.climate.precipitationMm = 5_000;
        if (radius > 0) {
          const nextX = x - Math.sign(dx);
          const nextY = y - Math.sign(dy);
          cell.terrain.flowTo = nextY * natural.width + nextX;
        }
        basinCells.push(cell);
      }
    }

    const waterBefore = totalWater(natural);
    const hydrology = NATURAL_SYSTEMS.find((system) => system.id === 'hydrology:surface-and-soil-water');
    expect(hydrology).toBeDefined();
    const events = hydrology!.run(state, 4, { periodTicks: 4, phaseOffsetTicks: 0, elapsedTicks: 4 }) ?? [];
    const runoff = basinCells.filter((cell) => (cell.water.lastFlows.runoffOutMm ?? 0) > 0.35);
    const cascadedCell = basinCells.find((cell) => (cell.water.lastFlows.runoffInMm ?? 0) > 0.35
      && (cell.water.lastFlows.runoffOutMm ?? 0) > 0.35);
    const precipitation = sum(natural.cells.map((cell) => cell.water.lastFlows.precipitationMm ?? 0));
    const evaporation = sum(natural.cells.map((cell) => (cell.water.lastFlows.surfaceEvaporationMm ?? 0)
      + (cell.water.lastFlows.soilEvaporationMm ?? 0)));
    const boundaryOutflow = sum(natural.cells.map((cell) => cell.water.lastFlows.boundaryOutflowMm ?? 0));

    expect(runoff.length).toBeGreaterThan(0);
    expect(cascadedCell).toBeDefined();
    expect(runoff.some((cell) => (cell.water.lastFlows.precipitationMm ?? 0) > 0
      && (cell.water.lastFlows.runoffOutMm ?? 0) / ((cell.water.lastFlows.precipitationMm ?? 0)
        + (cell.water.lastFlows.runoffInMm ?? 0)) > 0.78)).toBe(true);
    expect(basinCells.filter((cell) => cell.terrain.waterBody === 'lake').length).toBeGreaterThanOrEqual(3);
    expect(events.some((event) => event.eventType === 'hydrology:lake-formed')).toBe(true);
    expect(Math.abs(totalWater(natural) - (waterBefore + precipitation - evaporation - boundaryOutflow))).toBeLessThan(1);
    for (const cell of runoff) {
      const downstream = cell.water.lastFlowTo ?? -1;
      expect(downstream).toBeGreaterThanOrEqual(0);
      expect(Math.hypot(natural.cells[downstream]!.x - cell.x, natural.cells[downstream]!.y - cell.y)).toBeLessThanOrEqual(Math.SQRT2);
      expect(natural.cells[downstream]!.terrain.elevationM).toBeLessThan(cell.terrain.elevationM);
    }

    const lakeWaterBefore = totalWater(natural);
    const continuedRainEvents = hydrology!.run(state, 8, { periodTicks: 4, phaseOffsetTicks: 0, elapsedTicks: 4 }) ?? [];
    const secondPrecipitation = sum(natural.cells.map((cell) => cell.water.lastFlows.precipitationMm ?? 0));
    const secondEvaporation = sum(natural.cells.map((cell) => (cell.water.lastFlows.surfaceEvaporationMm ?? 0)
      + (cell.water.lastFlows.soilEvaporationMm ?? 0)));
    const secondBoundaryOutflow = sum(natural.cells.map((cell) => cell.water.lastFlows.boundaryOutflowMm ?? 0));
    expect(basinCells.filter((cell) => cell.terrain.waterBody === 'lake').length).toBeGreaterThanOrEqual(3);
    expect(Math.abs(totalWater(natural) - (lakeWaterBefore + secondPrecipitation - secondEvaporation - secondBoundaryOutflow))).toBeLessThan(1);
    expect(continuedRainEvents.some((event) => event.eventType === 'hydrology:runoff')).toBe(true);
  });

  it('mantém válidos lagos com mais de 100 m de coluna d’água e o orçamento de estado após o primeiro dia', () => {
    const deepLakeWorld = stepWorld(createNaturalWorld('0000000000000000'), 4, NATURAL_SYSTEMS).state;
    const maximumLakeDepth = Math.max(...getNaturalWorld(deepLakeWorld).cells.map((cell) => cell.water.surfaceMm));
    expect(maximumLakeDepth).toBeGreaterThan(100_000);
    expect(validateWorldState(deepLakeWorld)).toBe(true);

    const compactWorld = stepWorld(createNaturalWorld('0000000000000004'), 12, NATURAL_SYSTEMS).state;
    expect(compactWorld.tick).toBe(12);
    expect(validateWorldState(compactWorld)).toBe(true);
    expect(utf8ByteLength(canonicalStringify(compactWorld))).toBeLessThanOrEqual(MAX_WORLD_STATE_BYTES);
  }, 15_000);

  it('mantém o orçamento de estado em uma seed densa durante 31 dias', () => {
    const advanced = stepWorld(createNaturalWorld('0000000000000006'), 124, NATURAL_SYSTEMS).state;
    expect(advanced.tick).toBe(124);
    expect(validateWorldState(advanced)).toBe(true);
    expect(utf8ByteLength(canonicalStringify(advanced))).toBeLessThanOrEqual(MAX_WORLD_STATE_BYTES);
  }, 180_000);

  it('salva e retoma o calendário e as dinâmicas; migra o save legado do mundo vazio', () => {
    const initial = createNaturalWorld(FIXED_SEED);
    const advanced = stepWorld(initial, 124, NATURAL_SYSTEMS).state;
    expect(getNaturalWorld(advanced).seasonId).toBe('summer');
    const save = toSaveDocument(advanced);
    const validation = validateSaveDocument(save);
    expect(validation.ok).toBe(true);
    if (!validation.ok) throw new Error(validation.message);
    const resumed = worldFromSave(validation.save);
    expect(canonicalStringify(resumed)).toBe(canonicalStringify(advanced));
    expect(canonicalStringify(stepWorld(resumed, 4, NATURAL_SYSTEMS).state))
      .toBe(canonicalStringify(stepWorld(advanced, 4, NATURAL_SYSTEMS).state));

    const legacy = JSON.parse(readFileSync(new URL('../../data/fixtures/spec-000/valid-save.json', import.meta.url), 'utf8')) as unknown;
    const migrated = validateSaveDocument(legacy);
    expect(migrated.ok).toBe(true);
    if (migrated.ok) expect(migrated.save.simulationVersion).toBe('0.2.0');
  }, 60_000);
});

function totalWater(world: ReturnType<typeof getNaturalWorld>): number {
  return sum(world.cells.map((cell) => cell.water.surfaceMm + cell.water.soilMm));
}

function catchmentCellsForTest(world: ReturnType<typeof getNaturalWorld>): number[] {
  const contributing = new Array<number>(world.cells.length).fill(1);
  const downhill = world.cells.map((cell) => cell.index)
    .sort((left, right) => world.cells[right]!.terrain.elevationM - world.cells[left]!.terrain.elevationM || left - right);
  for (const index of downhill) {
    const cell = world.cells[index]!;
    const downstream = cell.terrain.flowTo;
    if (downstream >= 0 && cell.terrain.elevationM > world.cells[downstream]!.terrain.elevationM) {
      contributing[downstream] = (contributing[downstream] as number) + (contributing[index] as number);
    }
  }
  return contributing;
}

function mean(values: number[]): number {
  return sum(values) / Math.max(1, values.length);
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
