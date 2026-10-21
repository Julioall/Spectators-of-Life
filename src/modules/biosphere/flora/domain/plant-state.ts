export type TreeSpeciesId = 'oak' | 'pine' | 'birch' | 'autumnal' | 'willow';

export type PlantSpeciesId = 'grass' | 'shrub' | TreeSpeciesId;

export type PlantStageId = 'seedling' | 'sapling' | 'juvenile' | 'mature' | 'senescent';

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
