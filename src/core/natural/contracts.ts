import { NATURAL_SCENARIO } from './parameters';
import { naturalScenarioVersionAtLeast } from './versioning';
import { SUPPORTED_NATURAL_SCENARIO_VERSIONS } from '../constants';
import type { NaturalWorldEntity } from './types';

const SOIL_IDS = new Set<string>(NATURAL_SCENARIO.terrain.soilTypes.map((profile) => profile.id));
const PLANT_IDS = new Set<string>(NATURAL_SCENARIO.plants.map((profile) => profile.id));
const MINERAL_IDS = new Set(['stone', ...NATURAL_SCENARIO.minerals.veins.map((vein) => vein.id)]);
const BEDROCK_IDS = new Set(['granite', 'basalt', 'sedimentary']);
const SEASON_IDS = new Set(['spring', 'summer', 'autumn', 'winter']);
const TREE_IDS = new Set(['oak', 'pine', 'birch', 'autumnal', 'willow']);
const MAX_SURFACE_WATER_MM = 1_000_000;

export function isNaturalWorldEntity(value: unknown): value is NaturalWorldEntity {
  if (!isRecord(value) || !hasKeys(value, [
    'id', 'kind', 'scenarioVersion', 'width', 'height', 'cellSizeM', 'boundary', 'ticksPerDay', 'daysPerSeason', 'yearLengthDays',
    'dayOfYear', 'seasonId', 'seasonDay', 'daysSimulated', 'cells', 'totals',
  ])) return false;
  if (value['id'] !== 'world:natural' || value['kind'] !== 'natural-world' || !SUPPORTED_NATURAL_SCENARIO_VERSIONS.includes(value['scenarioVersion'] as typeof SUPPORTED_NATURAL_SCENARIO_VERSIONS[number])) return false;
  const scenarioDimensions = value['scenarioVersion'] === '1.0.0'
    ? { width: 32, height: 24, cellSizeM: 100 }
    : value['scenarioVersion'] === '1.1.0'
      ? { width: 64, height: 48, cellSizeM: 250 }
      : { width: NATURAL_SCENARIO.world.width, height: NATURAL_SCENARIO.world.height, cellSizeM: NATURAL_SCENARIO.world.cellSizeM };
  const { width: expectedWidth, height: expectedHeight, cellSizeM: expectedCellSizeM } = scenarioDimensions;
  const expectedBoundary = naturalScenarioVersionAtLeast(String(value['scenarioVersion']), '1.7.0') ? 'open' : 'closed';
  if (value['width'] !== expectedWidth || value['height'] !== expectedHeight || value['cellSizeM'] !== expectedCellSizeM || value['boundary'] !== expectedBoundary) return false;
  if (value['ticksPerDay'] !== NATURAL_SCENARIO.world.ticksPerDay || value['daysPerSeason'] !== NATURAL_SCENARIO.world.daysPerSeason || value['yearLengthDays'] !== NATURAL_SCENARIO.world.daysPerSeason * 4) return false;
  if (!isIntegerIn(value['dayOfYear'], 0, value['yearLengthDays'] - 1) || !isIntegerIn(value['seasonDay'], 0, value['daysPerSeason'] - 1)) return false;
  if (!isFiniteNonNegative(value['daysSimulated']) || !SEASON_IDS.has(String(value['seasonId']))) return false;
  if (!Array.isArray(value['cells']) || value['cells'].length !== expectedWidth * expectedHeight || !value['cells'].every((cell, index) => isNaturalCell(cell, index, value['cells'] as unknown[], expectedWidth, value['scenarioVersion'] as string))) return false;
  return isTotals(value['totals'], naturalScenarioVersionAtLeast(String(value['scenarioVersion']), '1.6.0'));
}

function isNaturalCell(value: unknown, index: number, cells: unknown[], width: number, scenarioVersion: string): boolean {
  if (!isRecord(value) || !hasKeys(value, ['index', 'x', 'y', 'terrain', 'climate', 'water', 'soil', 'minerals', 'plants'])) return false;
  const x = index % width;
  const y = Math.floor(index / width);
  if (value['index'] !== index || value['x'] !== x || value['y'] !== y) return false;

  const terrain = value['terrain'];
  const hasMineralFields = naturalScenarioVersionAtLeast(scenarioVersion, '1.3.0');
  const hasWaterBody = naturalScenarioVersionAtLeast(scenarioVersion, '1.5.0');
  const hasGeomorphology = naturalScenarioVersionAtLeast(scenarioVersion, '1.6.0');
  const terrainKeys = hasGeomorphology
    ? ['elevationM', 'slope', 'flowTo', 'basinId', 'bedrock', 'soilType', 'habitat', 'exposedRock', 'mineralPotential', 'waterBody']
    : hasWaterBody
      ? ['elevationM', 'slope', 'flowTo', 'basinId', 'bedrock', 'soilType', 'habitat', 'exposedRock', 'mineralPotential', 'waterBody']
    : hasMineralFields
      ? ['elevationM', 'slope', 'flowTo', 'basinId', 'bedrock', 'soilType', 'habitat', 'exposedRock', 'mineralPotential']
      : ['elevationM', 'slope', 'flowTo', 'basinId', 'bedrock', 'soilType', 'habitat', 'exposedRock'];
  if (!isRecord(terrain) || (hasGeomorphology
    ? !hasRequiredKeysAndOnlyOptional(terrain, terrainKeys, ['channelIncisionM'])
    : !hasKeys(terrain, terrainKeys))) return false;
  if (!isFiniteNumber(terrain['elevationM']) || terrain['elevationM'] < NATURAL_SCENARIO.terrain.minimumElevationM || terrain['elevationM'] > NATURAL_SCENARIO.terrain.maximumElevationM) return false;
  if (!isFiniteNonNegative(terrain['slope']) || !isIntegerIn(terrain['basinId'], 0, cells.length - 1)) return false;
  if (!isIntegerIn(terrain['flowTo'], -1, cells.length - 1) || terrain['flowTo'] === index) return false;
  if (!BEDROCK_IDS.has(String(terrain['bedrock'])) || !SOIL_IDS.has(String(terrain['soilType']))) return false;
  if (!['upland', 'woodland', 'meadow', 'wetland', 'dryland', 'desert'].includes(String(terrain['habitat'])) || typeof terrain['exposedRock'] !== 'boolean') return false;
  if (hasMineralFields && (!isFiniteNumber(terrain['mineralPotential']) || terrain['mineralPotential'] < 0 || terrain['mineralPotential'] > 1)) return false;
  if (hasWaterBody && !['none', 'lake', 'river'].includes(String(terrain['waterBody']))) return false;
  if (hasGeomorphology && terrain['channelIncisionM'] !== undefined
    && (!isFiniteNonNegative(terrain['channelIncisionM']) || terrain['channelIncisionM'] > NATURAL_SCENARIO.terrain.maximumElevationM)) return false;
  if (typeof terrain['flowTo'] === 'number' && terrain['flowTo'] >= 0) {
    const downstream = cells[terrain['flowTo']];
    if (!isRecord(downstream) || !isRecord(downstream['terrain']) || !isFiniteNumber(downstream['terrain']['elevationM']) || downstream['terrain']['elevationM'] >= terrain['elevationM']) return false;
    const targetX = terrain['flowTo'] % width;
    const targetY = Math.floor(terrain['flowTo'] / width);
    if (Math.abs(targetX - x) > 1 || Math.abs(targetY - y) > 1) return false;
  }

  const climate = value['climate'];
  if (!isRecord(climate)) return false;
  const hasRainfallFactor = naturalScenarioVersionAtLeast(scenarioVersion, '1.2.0');
  const climateKeys = hasRainfallFactor
    ? ['temperatureC', 'relativeHumidity', 'solarMjPerM2Day', 'precipitationMm', 'rainfallFactor']
    : ['temperatureC', 'relativeHumidity', 'solarMjPerM2Day', 'precipitationMm'];
  if (!hasKeys(climate, climateKeys)) return false;
  if (!isFiniteNumber(climate['temperatureC']) || climate['temperatureC'] < -80 || climate['temperatureC'] > 80) return false;
  if (!isFiniteNumber(climate['relativeHumidity']) || climate['relativeHumidity'] < 0 || climate['relativeHumidity'] > 1) return false;
  if (!isFiniteNonNegative(climate['solarMjPerM2Day']) || !isFiniteNonNegative(climate['precipitationMm'])) return false;
  if (hasRainfallFactor
    && (!isFiniteNumber(climate['rainfallFactor']) || climate['rainfallFactor'] < 0.15 || climate['rainfallFactor'] > 1.95)) return false;

  const water = value['water'];
  const hasDynamicFlowField = naturalScenarioVersionAtLeast(scenarioVersion, '1.4.0');
  const waterKeys = hasDynamicFlowField
    ? ['surfaceMm', 'soilMm', 'capacityMm', 'infiltrationMmPerDay', 'lastFlowTo', 'lastFlows']
    : ['surfaceMm', 'soilMm', 'capacityMm', 'infiltrationMmPerDay', 'lastFlows'];
  if (!isRecord(water) || !hasKeys(water, waterKeys)) return false;
  if (hasDynamicFlowField && !isIntegerIn(water['lastFlowTo'], -1, cells.length - 1)) return false;
  if (hasDynamicFlowField && typeof water['lastFlowTo'] === 'number' && water['lastFlowTo'] >= 0) {
    const targetX = water['lastFlowTo'] % width;
    const targetY = Math.floor(water['lastFlowTo'] / width);
    if (water['lastFlowTo'] === index || Math.abs(targetX - x) > 1 || Math.abs(targetY - y) > 1) return false;
  }
  if (!isFiniteNonNegative(water['surfaceMm']) || water['surfaceMm'] > MAX_SURFACE_WATER_MM) return false;
  if (!isFiniteNonNegative(water['capacityMm']) || water['capacityMm'] <= 0 || !isFiniteNonNegative(water['soilMm']) || water['soilMm'] > water['capacityMm'] + 1e-9) return false;
  if (!isFiniteNonNegative(water['infiltrationMmPerDay']) || !isWaterFlows(water['lastFlows'], hasGeomorphology)) return false;

  const soil = value['soil'];
  const soilKeys = ['mineralNitrogenGPerM2', 'organicNitrogenGPerM2', 'organicMatterGPerM2', 'detritusGPerM2', 'detritusNitrogenGPerM2', 'decomposerActivity', 'lastErosionGPerM2', 'lastDepositionGPerM2'];
  const optionalSoilKeys = ['sedimentLoadKgPerM2', 'lastMineralErosionKgPerM2', 'lastMineralDepositionKgPerM2'];
  if (!isRecord(soil) || (hasGeomorphology
    ? !hasRequiredKeysAndOnlyOptional(soil, soilKeys, optionalSoilKeys)
    : !hasKeys(soil, soilKeys))) return false;
  if (!isFiniteNonNegative(soil['mineralNitrogenGPerM2']) || !isFiniteNonNegative(soil['organicNitrogenGPerM2']) || !isFiniteNonNegative(soil['organicMatterGPerM2'])) return false;
  if (!isFiniteNonNegative(soil['detritusGPerM2']) || !isFiniteNonNegative(soil['detritusNitrogenGPerM2']) || soil['detritusNitrogenGPerM2'] > soil['detritusGPerM2'] * 0.1 + 1e-9) return false;
  if (!isFiniteNumber(soil['decomposerActivity']) || soil['decomposerActivity'] < 0 || soil['decomposerActivity'] > 1) return false;
  if (!isFiniteNonNegative(soil['lastErosionGPerM2']) || !isFiniteNonNegative(soil['lastDepositionGPerM2'])) return false;
  if (hasGeomorphology && optionalSoilKeys.some((key) => soil[key] !== undefined && !isFiniteNonNegative(soil[key]))) return false;

  if (!Array.isArray(value['minerals']) || !value['minerals'].every((deposit) => isMineralDeposit(deposit, hasMineralFields))) return false;
  const mineralIds = (value['minerals'] as Array<{ resourceId: string }>).map((deposit) => deposit.resourceId);
  if (new Set(mineralIds).size !== mineralIds.length) return false;
  if (!Array.isArray(value['plants']) || !value['plants'].every(isPlantCohort)) return false;
  if (hasWaterBody && terrain['waterBody'] !== 'none'
    && (value['plants'] as unknown[]).some((plant) => isRecord(plant) && TREE_IDS.has(String(plant['speciesId'])))) return false;
  const plantIds = (value['plants'] as Array<{ speciesId: string }>).map((plant) => plant.speciesId);
  return new Set(plantIds).size === plantIds.length;
}

function isMineralDeposit(value: unknown, currentScenario: boolean): boolean {
  const depositKeys = currentScenario
    ? ['resourceId', 'reserveKg', 'grade', 'depthM', 'exposed', 'sizeClass']
    : ['resourceId', 'reserveKg', 'grade', 'depthM', 'exposed'];
  if (!isRecord(value) || !hasKeys(value, depositKeys)) return false;
  return MINERAL_IDS.has(String(value['resourceId']))
    && isFiniteNonNegative(value['reserveKg'])
    && isFiniteNumber(value['grade']) && value['grade'] >= 0 && value['grade'] <= 1
    && isFiniteNonNegative(value['depthM'])
    && typeof value['exposed'] === 'boolean'
    && (!currentScenario || ['trace', 'small', 'medium', 'large'].includes(String(value['sizeClass'])));
}

function isPlantCohort(value: unknown): boolean {
  const requiredKeys = ['speciesId', 'stage', 'densityPerM2', 'biomassGPerM2', 'nitrogenGPerM2', 'seedBankMatterGPerM2', 'seedBankNitrogenGPerM2', 'ageDays'];
  if (!isRecord(value) || !hasRequiredKeysAndOnlyOptional(value, requiredKeys, ['stress', 'limitingFactors'])) return false;
  const hasCompactStress = Object.hasOwn(value, 'stress');
  const hasLegacyFactors = Object.hasOwn(value, 'limitingFactors');
  if (hasCompactStress === hasLegacyFactors) return false;
  if (!PLANT_IDS.has(String(value['speciesId'])) || !['seedling', 'sapling', 'juvenile', 'mature', 'senescent'].includes(String(value['stage']))) return false;
  for (const key of ['densityPerM2', 'biomassGPerM2', 'nitrogenGPerM2', 'seedBankMatterGPerM2', 'seedBankNitrogenGPerM2', 'ageDays']) {
    if (!isFiniteNonNegative(value[key])) return false;
  }
  const biomass = value['biomassGPerM2'] as number;
  const nitrogen = value['nitrogenGPerM2'] as number;
  const seedBankMatter = value['seedBankMatterGPerM2'] as number;
  const seedBankNitrogen = value['seedBankNitrogenGPerM2'] as number;
  if (nitrogen > biomass * 0.1 + 1e-9 || seedBankNitrogen > seedBankMatter * 0.1 + 1e-9) return false;
  if (hasCompactStress) return isFiniteNumber(value['stress']) && value['stress'] >= 0 && value['stress'] <= 1;
  const factors = value['limitingFactors'];
  return isRecord(factors) && hasKeys(factors, ['water', 'nitrogen', 'temperature', 'light'])
    && Object.values(factors).every((factor) => typeof factor === 'number' && Number.isFinite(factor) && factor >= 0 && factor <= 1);
}

function isWaterFlows(value: unknown, hasBankSeepage: boolean): boolean {
  const keys = ['precipitationMm', 'infiltrationMm', 'runoffOutMm', 'runoffInMm', 'surfaceEvaporationMm', 'soilEvaporationMm', 'transpirationMm', 'boundaryOutflowMm'];
  const bankKeys = ['bankSeepageInMm', 'bankSeepageOutMm'];
  if (!isRecord(value)) return false;
  if (hasBankSeepage) {
    const allowedKeys = new Set([...keys, ...bankKeys]);
    if (Object.keys(value).some((key) => !allowedKeys.has(key))) return false;
  } else if (!hasKeys(value, keys)) return false;
  return Object.values(value).every(isFiniteNonNegative);
}

function isTotals(value: unknown, hasMineralSediment: boolean): boolean {
  const keys = ['precipitationMmM2', 'surfaceEvaporationMmM2', 'soilEvaporationMmM2', 'transpirationMmM2', 'runoffBoundaryMmM2', 'erosionG', 'depositionG', 'photosynthesisG', 'plantRespirationG', 'decompositionRespirationG', 'nitrogenMineralizedG'];
  const expectedKeys = hasMineralSediment ? [...keys, 'mineralErosionKg', 'mineralDepositionKg'] : keys;
  if (!isRecord(value) || !hasKeys(value, expectedKeys)) return false;
  return Object.values(value).every(isFiniteNonNegative);
}

function hasKeys(value: Record<string, unknown>, expected: string[]): boolean {
  return Object.keys(value).sort().join(',') === [...expected].sort().join(',');
}

function hasRequiredKeysAndOnlyOptional(value: Record<string, unknown>, required: string[], optional: string[]): boolean {
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.hasOwn(value, key))
    && Object.keys(value).every((key) => allowed.has(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isFiniteNonNegative(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isIntegerIn(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum && (value as number) <= maximum;
}
