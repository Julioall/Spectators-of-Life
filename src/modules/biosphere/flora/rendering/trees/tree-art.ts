import type {TreeSpeciesId} from '../../domain/plant-state';

export const TREE_FRAME_SIZE=256;
export const TREE_VARIANT_COUNT=2;
export const TREE_GROWTH_STOPS=Object.freeze([.12,.26,.42,.61,.79,.98] as const);
export const TREE_GROWTH_FRAME_COUNT=TREE_GROWTH_STOPS.length;
export const TREE_SENESCENT_FRAME=TREE_GROWTH_FRAME_COUNT;
export const TREE_FRAME_COUNT=TREE_GROWTH_FRAME_COUNT+1;
export const TREE_SPECIES:readonly TreeSpeciesId[]=['oak','pine','birch','autumnal','willow'];
const clamp=(value:number,minimum:number,maximum:number):number=>Math.min(maximum,Math.max(minimum,value));

const hash=(seed:number,x:number,y:number):number=>{
 let value=(seed^Math.imul(x,0x9e3779b1)^Math.imul(y,0x85ebca6b))|0;
 value=Math.imul(value^(value>>>16),0x7feb352d);
 value=Math.imul(value^(value>>>15),0x846ca68b);
 return ((value^(value>>>16))>>>0)/0x1_0000_0000;
};

export function treeEngineSpecies(species:TreeSpeciesId):string{
 return ({oak:'carvalho',pine:'pinheiro',birch:'bétula',autumnal:'acer',willow:'salgueiro'} as const)[species];
}
export function treeFrameIndex(species:TreeSpeciesId,growthFrame:number,variant:number):number{
 if(!TREE_SPECIES.includes(species)||!Number.isInteger(growthFrame)||growthFrame<0||growthFrame>=TREE_FRAME_COUNT||!Number.isInteger(variant)||variant<0||variant>=TREE_VARIANT_COUNT){
  throw new RangeError('Invalid procedural tree frame');
 }
 return (TREE_SPECIES.indexOf(species)*TREE_FRAME_COUNT+growthFrame)*TREE_VARIANT_COUNT+variant;
}
export function treeVariant(seed:number,x:number,y:number,species:TreeSpeciesId):number{
 return Math.floor(hash(seed^Math.imul(TREE_SPECIES.indexOf(species),0x9e3779b1),x,y)*TREE_VARIANT_COUNT);
}

export type TreeGrowthVisual={growth:number;frame:number;scaleFactor:number};

/** Keeps atlas detail changes discrete while interpolating the tree's perceived size continuously. */
export function treeGrowthVisual(ageDays:number,biomassGPerM2:number,maturityDays:number,maximumBiomassGPerM2:number):TreeGrowthVisual{
 const age=clamp(ageDays/Math.max(1,maturityDays),0,1);
 const biomass=clamp(Math.sqrt(Math.max(0,biomassGPerM2)/Math.max(1,maximumBiomassGPerM2)),0,1);
 const growth=Math.min(age,biomass);
 const frame=Math.max(0,TREE_GROWTH_STOPS.findIndex((stop)=>growth<stop));
 return {growth,frame:frame<0?TREE_GROWTH_FRAME_COUNT-1:frame,scaleFactor:(.54+growth*.35)/.89};
}
