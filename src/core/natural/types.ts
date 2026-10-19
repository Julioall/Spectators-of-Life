import type { EntityState, NaturalScenarioVersion, WorldState } from '../types';

export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter';
export type SoilTypeId = 'sand' | 'loam' | 'clay' | 'rock';
export type BedrockId = 'granite' | 'basalt' | 'sedimentary';
export type HabitatId = 'upland' | 'woodland' | 'meadow' | 'wetland' | 'dryland' | 'desert';
export type TreeSpeciesId = 'oak' | 'pine' | 'birch' | 'autumnal' | 'willow';
export type PlantSpeciesId = 'grass' | 'shrub' | TreeSpeciesId;
export type PlantStageId = 'seedling' | 'sapling' | 'juvenile' | 'mature' | 'senescent';
export type MineralId = 'stone' | 'copper' | 'iron' | 'silver' | 'gold';
export type MineralSizeClass = 'trace' | 'small' | 'medium' | 'large';
export type WaterBodyId = 'none' | 'lake' | 'river';

export type PlantCohortState = {
  speciesId: PlantSpeciesId;
  stage: PlantStageId;
  densityPerM2: number;
  biomassGPerM2: number;
  nitrogenGPerM2: number;
  seedBankMatterGPerM2: number;
  seedBankNitrogenGPerM2: number;
  ageDays: number;
  /** Menor fator de crescimento do último dia, usado apenas pela renderização. */
  stress?: number;
  /** Forma de save legada, aceita durante a migração para o campo compacto `stress`. */
  limitingFactors?: {
    water: number;
    nitrogen: number;
    temperature: number;
    light: number;
  };
};

export type MineralDepositState = {
  resourceId: MineralId;
  reserveKg: number;
  grade: number;
  depthM: number;
  exposed: boolean;
  /** Opcionais apenas ao ler saves de cenários anteriores a 1.3.0. */
  sizeClass?: MineralSizeClass;
};

export type NaturalWorldCellState = {
  index: number;
  x: number;
  y: number;
  terrain: {
    elevationM: number;
    slope: number;
    flowTo: number;
    basinId: number;
    bedrock: BedrockId;
    soilType: SoilTypeId;
    habitat: HabitatId;
    exposedRock: boolean;
    /** Potencial geológico regional entre 0 e 1, presente desde o cenário 1.3.0. */
    mineralPotential?: number;
    /** Corpo d'água permanente gerado para o cenário 1.5.0. */
    waterBody?: WaterBodyId;
    /** Incisão líquida desde 1.6.0; omitida quando ainda é zero. */
    channelIncisionM?: number;
  };
  climate: {
    temperatureC: number;
    relativeHumidity: number;
    solarMjPerM2Day: number;
    precipitationMm: number;
    rainfallFactor?: number;
  };
  water: {
    surfaceMm: number;
    soilMm: number;
    capacityMm: number;
    infiltrationMmPerDay: number;
      /** Última direção hidráulica desde o cenário 1.4; versões anteriores mantêm a drenagem do relevo. */
    lastFlowTo?: number;
    lastFlows: {
      precipitationMm?: number;
      infiltrationMm?: number;
      runoffOutMm?: number;
      runoffInMm?: number;
      surfaceEvaporationMm?: number;
      soilEvaporationMm?: number;
      transpirationMm?: number;
      boundaryOutflowMm?: number;
      /** Transferências das margens em 1.6.0; omitidas quando são zero. */
      bankSeepageInMm?: number;
      bankSeepageOutMm?: number;
    };
  };
  soil: {
    mineralNitrogenGPerM2: number;
    organicNitrogenGPerM2: number;
    organicMatterGPerM2: number;
    detritusGPerM2: number;
    detritusNitrogenGPerM2: number;
    decomposerActivity: number;
    lastErosionGPerM2: number;
    lastDepositionGPerM2: number;
    /** Valores de erosão 1.6.0; zeros são omitidos para reduzir saves. */
    /** Carga mineral móvel que será transportada no próximo intervalo. */
    sedimentLoadKgPerM2?: number;
    lastMineralErosionKgPerM2?: number;
    lastMineralDepositionKgPerM2?: number;
  };
  minerals: MineralDepositState[];
  plants: PlantCohortState[];
};

export type NaturalWorldEntity = {
  id: 'world:natural';
  kind: 'natural-world';
  scenarioVersion: NaturalScenarioVersion;
  width: number;
  height: number;
  cellSizeM: number;
  boundary: 'closed';
  ticksPerDay: number;
  daysPerSeason: number;
  yearLengthDays: number;
  dayOfYear: number;
  seasonId: SeasonId;
  seasonDay: number;
  daysSimulated: number;
  cells: NaturalWorldCellState[];
  totals: {
    precipitationMmM2: number;
    surfaceEvaporationMmM2: number;
    soilEvaporationMmM2: number;
    transpirationMmM2: number;
    runoffBoundaryMmM2: number;
    erosionG: number;
    depositionG: number;
    mineralErosionKg?: number;
    mineralDepositionKg?: number;
    photosynthesisG: number;
    plantRespirationG: number;
    decompositionRespirationG: number;
    nitrogenMineralizedG: number;
  };
};

export function getNaturalWorld(world: WorldState): NaturalWorldEntity {
  const entity = world.entities.find((candidate) => candidate.id === 'world:natural' && candidate.kind === 'natural-world');
  if (entity === undefined) throw new Error('O cenário natural não contém o mapa persistido.');
  return entity as unknown as NaturalWorldEntity;
}

export function toNaturalWorldEntity(world: NaturalWorldEntity): EntityState {
  return world as unknown as EntityState;
}
