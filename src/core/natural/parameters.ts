import scenarioJson from '../../../data/scenarios/natural-temperate-valley.v1.10.json';
import { NATURAL_SCENARIO_VERSION } from '../constants';
import type { BedrockId, HabitatId, PlantSpeciesId, SeasonId, SoilTypeId } from './types';

export type SoilProfile = {
  id: SoilTypeId;
  infiltrationMmPerDay: number;
  waterCapacityMm: number;
  runoffFraction: number;
  erosionResistance: number;
};

export type SeasonForcing = {
  id: SeasonId;
  temperatureC: number;
  rainMmPerDay: number;
  solarMjPerM2Day: number;
  relativeHumidity: number;
};

export type MineralVeinProfile = {
  id: Exclude<string, 'stone'>;
  centers: number;
  radiusCells: number;
  reserveKgPerCell: number;
  grade: number;
  depthM: number;
  hostBedrock: BedrockId[];
};

export type PlantSpeciesProfile = {
  id: PlantSpeciesId;
  name: string;
  temperatureMinC: number;
  temperatureOptimumC: number;
  temperatureMaxC: number;
  soilWaterOptimumMm: number;
  soilWaterMinimumMm: number;
  solarOptimumMjPerM2Day: number;
  shadeTolerance: number;
  nitrogenDemandGPerGBiomass: number;
  maximumGrowthRatePerDay: number;
  maximumBiomassGPerM2: number;
  maximumCanopyFraction: number;
  transpirationMmPerDayAtFullCanopy: number;
  maturityDays: number;
  maximumLifespanDays: number;
  seedProductionFraction: number;
  germinationFractionPerDay: number;
  mortalityRatePerDay: number;
  seedNitrogenFraction: number;
  seedlingsPerGramOfSeedMatter: number;
  initialSeedBankGPerM2: number;
  initialBiomassGPerM2: number;
  initialDensityPerM2: number;
  soilPreference: SoilTypeId[];
  habitatPreference: HabitatId[];
};

export type NaturalScenarioParameters = {
  scenarioId: string;
  scenarioVersion: typeof NATURAL_SCENARIO_VERSION;
  title: string;
  description: string;
  world: {
    width: number;
    height: number;
    cellSizeM: number;
    boundary: 'open' | 'closed';
    ticksPerDay: number;
    daysPerSeason: number;
  };
  terrain: {
    minimumElevationM: number;
    maximumElevationM: number;
    initialWaterTableFraction: number;
    lakeSurfaceWaterMm: number;
    riverSurfaceWaterMm: number;
    riverRunoffThreshold: number;
    lakeRunoffThreshold: number;
    riverFormationMinimumCatchmentCells: number;
    riverFormationMinimumIncisionM: number;
    soilTypes: SoilProfile[];
  };
  climate: {
    rainProbability: number;
    temperatureNoiseC: number;
    seasonalForcing: SeasonForcing[];
    surfaceEvaporationMmPerDayAt20C: number;
    soilEvaporationMmPerDayAt20C: number;
    transpirationMmPerDayPerCanopyFraction: number;
  };
  minerals: {
    stoneReserveKgPerCell: number;
    veins: MineralVeinProfile[];
  };
  soil: {
    initialMineralNitrogenGPerM2: [number, number];
    initialOrganicMatterGPerM2: [number, number];
    initialOrganicNitrogenGPerM2: [number, number];
    initialDetritusGPerM2: [number, number];
    initialDetritusNitrogenGPerM2: [number, number];
    decompositionRatePerDay: number;
    humificationFraction: number;
    nitrogenMineralizationFraction: number;
    erosionRateMmPerDay: number;
    sedimentBulkDensityKgPerM3: number;
    bankSeepageMmPerDay: number;
    riparianSlopeThreshold: number;
  };
  plants: PlantSpeciesProfile[];
};

export const NATURAL_SCENARIO = scenarioJson as NaturalScenarioParameters;

export function validateNaturalScenarioParameters(parameters: NaturalScenarioParameters = NATURAL_SCENARIO): void {
  const { world, terrain, climate, minerals, soil, plants } = parameters;
  if (parameters.scenarioId !== 'natural:temperate-valley' || parameters.scenarioVersion !== NATURAL_SCENARIO_VERSION) throw new Error('ID/versão do cenário natural incompatível.');
  if (!Number.isInteger(world.width) || world.width < 8 || !Number.isInteger(world.height) || world.height < 8 || world.width * world.height > 8192) throw new Error('Dimensões do cenário natural inválidas.');
  if (!(world.cellSizeM > 0) || !Number.isInteger(world.ticksPerDay) || world.ticksPerDay < 1 || !Number.isInteger(world.daysPerSeason) || world.daysPerSeason < 1) throw new Error('Escala espacial ou calendário do cenário inválido.');
  if (world.boundary !== 'open' || !(terrain.maximumElevationM > terrain.minimumElevationM)) throw new Error('Condição de borda ou faixa de elevação inválida.');
  if (!(terrain.lakeSurfaceWaterMm > 0) || !(terrain.riverSurfaceWaterMm > 0) || !(terrain.riverRunoffThreshold > 0) || !(terrain.lakeRunoffThreshold > 0)) throw new Error('Parâmetros de retenção e formação de corpos d\'água inválidos.');
  if (!Number.isInteger(terrain.riverFormationMinimumCatchmentCells) || terrain.riverFormationMinimumCatchmentCells < 2 || !(terrain.riverFormationMinimumIncisionM > 0)) throw new Error('Critérios de formação fluvial inválidos.');
  if (!(climate.rainProbability > 0 && climate.rainProbability <= 1) || climate.seasonalForcing.length !== 4) throw new Error('Forçantes climáticas inválidas.');
  if (terrain.soilTypes.length < 2 || new Set(terrain.soilTypes.map((profile) => profile.id)).size !== terrain.soilTypes.length) throw new Error('Perfis de solo ausentes ou duplicados.');
  if (plants.length < 2 || new Set(plants.map((profile) => profile.id)).size !== plants.length) throw new Error('Perfis vegetais ausentes ou duplicados.');
  for (const profile of plants) {
    if (!(profile.temperatureMinC < profile.temperatureOptimumC && profile.temperatureOptimumC < profile.temperatureMaxC)) throw new Error(`Faixa térmica inválida para ${profile.id}.`);
    if (!(profile.maximumLifespanDays > profile.maturityDays)) throw new Error(`Longevidade inválida para ${profile.id}.`);
    if (!(profile.maximumGrowthRatePerDay >= 0 && profile.maximumGrowthRatePerDay <= 1) || !(profile.mortalityRatePerDay >= 0 && profile.mortalityRatePerDay < 1)) throw new Error(`Taxa inválida para ${profile.id}.`);
  }
  for (const vein of minerals.veins) {
    if (!Number.isInteger(vein.centers) || vein.centers < 1 || !(vein.radiusCells > 0) || !(vein.grade > 0 && vein.grade <= 1)) throw new Error(`Veio mineral inválido: ${vein.id}.`);
  }
  for (const [minimum, maximum] of [soil.initialMineralNitrogenGPerM2, soil.initialOrganicMatterGPerM2, soil.initialOrganicNitrogenGPerM2, soil.initialDetritusGPerM2, soil.initialDetritusNitrogenGPerM2]) {
    if (!(Number.isFinite(minimum) && Number.isFinite(maximum) && minimum >= 0 && maximum >= minimum)) throw new Error('Faixa de estoque inicial do solo inválida.');
  }
  if (!(soil.erosionRateMmPerDay > 0) || !(soil.sedimentBulkDensityKgPerM3 > 0) || !(soil.bankSeepageMmPerDay >= 0) || !(soil.riparianSlopeThreshold > 0 && soil.riparianSlopeThreshold < 1)) throw new Error('Parâmetros de erosão e margens fluviais inválidos.');
}
