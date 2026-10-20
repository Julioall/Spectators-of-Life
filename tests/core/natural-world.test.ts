import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canonicalStringify, utf8ByteLength } from '../../src/core/canonical-json';
import { MAX_WORLD_BYTES, MAX_WORLD_STATE_BYTES, NATURAL_SCENARIO_ID } from '../../src/core/constants';
import { createNaturalWorld, NATURAL_SYSTEMS } from '../../src/core/natural/scenario';
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
    expect(natural.cells).toHaveLength(natural.width * natural.height);
    expect(new Set(natural.cells.map((cell) => cell.terrain.soilType)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(natural.cells.map((cell) => cell.terrain.bedrock)).size).toBeGreaterThanOrEqual(2);
    expect(natural.cells.every((cell) => cell.terrain.flowTo < 0 || natural.cells[cell.terrain.flowTo]!.terrain.elevationM < cell.terrain.elevationM)).toBe(true);
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

  it('avança clima, água, decomposição e plantas em passos diários com saída fluvial auditada', () => {
    const initial = createNaturalWorld(FIXED_SEED);
    const initialNatural = getNaturalWorld(initial);
    const waterBefore = totalWater(initialNatural);
    const result = stepWorld(initial, 4, NATURAL_SYSTEMS);
    const natural = getNaturalWorld(result.state);
    const precipitation = sum(natural.cells.map((cell) => cell.water.lastFlows.precipitationMm ?? 0));
    const evaporation = sum(natural.cells.map((cell) => (cell.water.lastFlows.surfaceEvaporationMm ?? 0) + (cell.water.lastFlows.soilEvaporationMm ?? 0)));
    const transpiration = sum(natural.cells.map((cell) => cell.water.lastFlows.transpirationMm ?? 0));
    const boundaryOutflow = sum(natural.cells.map((cell) => cell.water.lastFlows.boundaryOutflowMm ?? 0));
    const expectedWater = waterBefore + precipitation - evaporation - transpiration - boundaryOutflow;
    expect(result.state.tick).toBe(4);
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

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
