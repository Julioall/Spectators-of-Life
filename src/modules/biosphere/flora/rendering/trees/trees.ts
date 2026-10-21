import Phaser from 'phaser';
import treeAtlasUrl from '../../../../../../data/assets/tree/Spritesheets/arvores_atlas_128.png?url';
import {NATURAL_SCENARIO} from '../../../../../core/natural/parameters';
import type {NaturalWorldCellState,NaturalWorldEntity,PlantCohortState} from '../../../../../core/natural/types';
import type {TreeSpeciesId} from '../../domain/plant-state';
import {FLORA_TREE_SPECIES} from '../../domain/species';
import {worldObjectDepth} from '../../../../../render/z-order';

/** One renderer for all trees: visual interpretation only, no biological changes. */
export type TreeSprites=Record<TreeSpeciesId,Phaser.GameObjects.Image|null>;
const TREE_ATLAS_KEY='natural-tree-atlas';
const TREE_MATURE_WIDTH_CELLS=4.4;
const clamp=(v:number,a:number,b:number)=>Math.min(b,Math.max(a,v));
function stress(plant:PlantCohortState):number{
 if(plant.stress!==undefined)return plant.stress;
 const factors=plant.limitingFactors;
 return factors===undefined?1:Math.min(factors.water,factors.nitrogen,factors.temperature,factors.light);
}
export class Trees{
 static preload(scene:Phaser.Scene):void{
   scene.load.spritesheet(TREE_ATLAS_KEY,treeAtlasUrl,{frameWidth:128,frameHeight:128});
 }
 static emptySprites():TreeSprites{
   return {oak:null,pine:null,birch:null,autumnal:null,willow:null};
 }
 static update(
   scene:Phaser.Scene,world:NaturalWorldEntity,sprites:TreeSprites|undefined,
   speciesId:TreeSpeciesId,plant:NaturalWorldCellState['plants'][number]|undefined,
   cell:NaturalWorldCellState,visible:boolean,cellSize:number
 ):void{
   if(!sprites)return;
   if(!plant||!visible||plant.biomassGPerM2<.5){
     sprites[speciesId]?.setVisible(false);return;
   }
   let sprite=sprites[speciesId];
   if(sprite===null){
     sprite=scene.add.image((cell.x+.5)*cellSize,(cell.y+1)*cellSize,TREE_ATLAS_KEY);
     sprite.setOrigin(.5,123/128);
     sprites[speciesId]=sprite;
   }
   const profile=NATURAL_SCENARIO.plants.find(p=>p.id===speciesId)!;
   const growthFrame=clamp(Math.ceil(plant.ageDays/profile.maturityDays*8),1,8);
   const deadStanding=plant.stage==='senescent'
    &&plant.biomassGPerM2<profile.initialBiomassGPerM2*.12&&stress(plant)<.12;
   const row=FLORA_TREE_SPECIES.indexOf(speciesId);
   const frame=row*12+(deadStanding||plant.stage==='senescent'?8:growthFrame-1);
   const scale=cellSize*TREE_MATURE_WIDTH_CELLS/128;
   sprite.setPosition((cell.x+.5)*cellSize,(cell.y+1)*cellSize)
     .setDepth(worldObjectDepth(cell.y+1,world.height))
     .setFrame(frame).setScale(scale).setVisible(true)
     .setAlpha(deadStanding?.92:clamp(.74+Math.sqrt(plant.biomassGPerM2/profile.maximumBiomassGPerM2)*.26,.78,1));
 }
 static shadow(
   graphics:Phaser.GameObjects.Graphics|null,
   plant:NaturalWorldCellState['plants'][number]|undefined,
   cell:NaturalWorldCellState,speciesId:TreeSpeciesId,cellSize:number
 ):void{
   if(!graphics||!plant||plant.biomassGPerM2<.5)return;
   const profile=NATURAL_SCENARIO.plants.find(p=>p.id===speciesId)!;
   const stage=clamp(Math.ceil(plant.ageDays/profile.maturityDays*8),1,8);
   const deadStanding=plant.stage==='senescent'
     &&plant.biomassGPerM2<profile.initialBiomassGPerM2*.12&&stress(plant)<.12;
   const width=cellSize*(deadStanding?.7:.42+(stage/8)*(TREE_MATURE_WIDTH_CELLS-.42));
   graphics.fillStyle(0x18251b,deadStanding?.07:.08+stage*.008);
   graphics.fillEllipse((cell.x+.5)*cellSize,(cell.y+1)*cellSize-4,width,width*.24);
 }
}
