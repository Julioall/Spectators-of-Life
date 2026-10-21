import type {PlantSpeciesId,TreeSpeciesId} from './plant-state';
export const FLORA_TREE_SPECIES:readonly TreeSpeciesId[]=['oak','pine','birch','autumnal','willow'];
export const FLORA_GRASS_SPECIES:PlantSpeciesId='grass';
export const FLORA_SHRUB_SPECIES:PlantSpeciesId='shrub';
const TREES=new Set<PlantSpeciesId>(FLORA_TREE_SPECIES);
export function isFloraTree(species:PlantSpeciesId):species is TreeSpeciesId{return TREES.has(species);}
