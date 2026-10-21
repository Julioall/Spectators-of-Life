/** Public headless API for the Flora domain. Suitable for Web Workers and tests. */
export { FLORA_SYSTEM } from './simulation/flora-system';
export { FLORA_TREE_SPECIES, FLORA_GRASS_SPECIES, FLORA_SHRUB_SPECIES, isFloraTree } from './domain/species';
export type { PlantCohortState, PlantStageId, PlantSpeciesId, TreeSpeciesId } from './domain/plant-state';
export type { FloraEnvironment } from './contracts/flora-environment';
export type { FloraSnapshot } from './contracts/flora-snapshot';
export type { FloraEvent } from './contracts/flora-events';
