import { EMPTY_SCENARIO_ID, EMPTY_SCENARIO_VERSION, NATURAL_SCENARIO_ID, NATURAL_SCENARIO_VERSION } from '../constants';
import { assertWorldState, createEmptyWorld } from '../world';
import type { TickSystem, WorldState } from '../types';
import { generateNaturalWorld } from './generation';
import { ENVIRONMENT_SYSTEMS, updateMineralMetrics, updateVegetationMetrics } from './environment-systems';
import { NATURAL_SCENARIO } from './parameters';
import { FLORA_SYSTEM } from '../../modules/biosphere/flora';
import { toNaturalWorldEntity } from './types';

export const NATURAL_SYSTEMS: readonly TickSystem[] = [...ENVIRONMENT_SYSTEMS, FLORA_SYSTEM];

export function createNaturalWorld(seed: string, systems: readonly TickSystem[] = NATURAL_SYSTEMS): WorldState {
  const world = createEmptyWorld({
    scenarioId: EMPTY_SCENARIO_ID,
    scenarioVersion: EMPTY_SCENARIO_VERSION,
    seed,
    config: {},
    systems,
  });
  world.scenarioId = NATURAL_SCENARIO_ID;
  world.scenarioVersion = NATURAL_SCENARIO_VERSION;
  const natural = generateNaturalWorld(seed, world.rng);
  world.entities = [toNaturalWorldEntity(natural)];
  world.metrics['climate.seasonIndex'] = 0;
  world.metrics['climate.meanTemperatureC'] = round3(mean(natural.cells.map((cell) => cell.climate.temperatureC)));
  world.metrics['climate.meanRelativeHumidity'] = round4(mean(natural.cells.map((cell) => cell.climate.relativeHumidity)));
  world.metrics['climate.meanPrecipitationMmPerDay'] = 0;
  world.metrics['hydrology.surfaceWaterMmM2'] = round3(sum(natural.cells.map((cell) => cell.water.surfaceMm)) * NATURAL_SCENARIO.world.cellSizeM ** 2);
  world.metrics['hydrology.soilWaterMmM2'] = round3(sum(natural.cells.map((cell) => cell.water.soilMm)) * NATURAL_SCENARIO.world.cellSizeM ** 2);
  world.metrics['hydrology.meanSurfaceWaterMm'] = round4(mean(natural.cells.map((cell) => cell.water.surfaceMm)));
  world.metrics['hydrology.meanSoilWaterMm'] = round4(mean(natural.cells.map((cell) => cell.water.soilMm)));
  world.metrics['hydrology.bankSeepageMmM2'] = 0;
  world.metrics['hydrology.meanBankSeepageMm'] = 0;
  world.metrics['geology.meanElevationM'] = round2(mean(natural.cells.map((cell) => cell.terrain.elevationM)));
  world.metrics['geology.meanSlope'] = round4(mean(natural.cells.map((cell) => cell.terrain.slope)));
  world.metrics['geology.exposedRockCells'] = natural.cells.filter((cell) => cell.terrain.exposedRock).length;
  world.metrics['geology.mineralErosionKg'] = 0;
  world.metrics['geology.mineralDepositionKg'] = 0;
  world.metrics['geology.sedimentStoredKg'] = 0;
  world.metrics['geology.permanentRiverCells'] = natural.cells.filter((cell) => cell.terrain.waterBody === 'river').length;
  world.metrics['geology.riparianWetlandCells'] = natural.cells.filter((cell) => cell.terrain.habitat === 'wetland' && cell.terrain.waterBody === 'none').length;
  updateMineralMetrics(world, natural);
  updateVegetationMetrics(world, natural);
  assertWorldState(world);
  return world;
}

export function systemsForScenario(scenarioId: string): readonly TickSystem[] | null {
  if (scenarioId === EMPTY_SCENARIO_ID) return [];
  if (scenarioId === NATURAL_SCENARIO.scenarioId) return NATURAL_SYSTEMS;
  return null;
}

function mean(values: number[]): number { return values.reduce((total, value) => total + value, 0) / values.length; }
function sum(values: number[]): number { return values.reduce((total, value) => total + value, 0); }
function round2(value: number): number { return Math.round(value * 100) / 100; }
function round3(value: number): number { return Math.round(value * 1000) / 1000; }
function round4(value: number): number { return Math.round(value * 10_000) / 10_000; }
