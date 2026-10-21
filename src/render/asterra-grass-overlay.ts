import Phaser from 'phaser';
import type {NaturalWorldEntity} from '../core/natural/types';
import {generateGrassAutotile,grassHash,type GrassSample} from '../lib/asterra/vegetation/grass-autotile';

const TEXTURE_KEY='asterra-vegetation-autotile';
const DETAIL=4,PIXELS_PER_TILE=3;
const PALETTE=[0x596f38,0x6f8448,0x819451,0x9bab66] as const;
const WET_PALETTE=[0x425e39,0x567746,0x698b50,0x8aa56a] as const;
const css=(color:number)=>'#'+color.toString(16).padStart(6,'0');

/** Visual-only Phaser bridge. Never advances or mutates the ecological simulation. */
export class AsterraGrassOverlay {
 private image:Phaser.GameObjects.Image|null=null;
 private texture:Phaser.Textures.CanvasTexture|null=null;
 private lastWorld:NaturalWorldEntity|null=null;
 private lastBlocked:Set<number>|null=null;
 private lastSeed=-1;
 constructor(private readonly scene:Phaser.Scene,private readonly cellSize:number){}
 sync(world:NaturalWorldEntity,seed:number,blocked:Set<number>,visible:boolean):void{
   if(!visible){this.image?.setVisible(false);return;}
   const w=world.width*DETAIL*PIXELS_PER_TILE,h=world.height*DETAIL*PIXELS_PER_TILE;
   if(this.texture===null||this.texture.width!==w||this.texture.height!==h){
     this.dispose();
     this.texture=this.scene.textures.createCanvas(TEXTURE_KEY,w,h);
     if(this.texture===null)return;
     this.image=this.scene.add.image(0,0,TEXTURE_KEY).setOrigin(0,0).setDepth(1.99)
       .setScale(this.cellSize/(DETAIL*PIXELS_PER_TILE));
   }
   this.image?.setVisible(true);
   if(this.lastWorld===world&&this.lastBlocked===blocked&&this.lastSeed===seed)return;
   const samples:GrassSample[]=world.cells.map(cell=>{
     const grass=cell.plants.find(p=>p.speciesId==='grass');
     const water=cell.terrain.waterBody??'none';
     return {biomassGPerM2:Math.max(0,grass?.biomassGPerM2??0),
       wetland:cell.terrain.habitat==='wetland',
       blocked:blocked.has(cell.index)||cell.terrain.exposedRock||
         ((water==='lake'||water==='river')&&cell.water.surfaceMm>=8)};
   });
   const grid=generateGrassAutotile(samples,world.width,world.height,seed,DETAIL);
   const ctx=this.texture!.getContext();
   ctx.clearRect(0,0,w,h);ctx.imageSmoothingEnabled=false;
   for(let y=0;y<grid.height;y++)for(let x=0;x<grid.width;x++){
     const i=y*grid.width+x,state=grid.states[i]!;
     if(!state)continue;
     const palette=state===3?WET_PALETTE:PALETTE;
     const tone=Math.floor(grassHash(seed^0x10f0,x,y)*palette.length);
     const px=x*PIXELS_PER_TILE,py=y*PIXELS_PER_TILE;
     ctx.fillStyle=css(palette[tone]!);
     const mask=grid.masks[i]!,exposed=mask!==255;
     ctx.globalAlpha=exposed?.66:.82;
     ctx.fillRect(px,py,PIXELS_PER_TILE,PIXELS_PER_TILE);
     if(exposed)ctx.clearRect(px+((mask&4)?0:2),py+((mask&16)?0:2),1,1);
     if(state>=2&&grassHash(seed^0x51ac,x,y)>.62){
       ctx.globalAlpha=.88;
       ctx.fillStyle=css(palette[Math.min(tone+1,palette.length-1)]!);
       ctx.fillRect(px+1,py,1,1);
     }
   }
   ctx.globalAlpha=1;
   this.texture!.refresh();
   this.lastWorld=world;this.lastBlocked=blocked;this.lastSeed=seed;
 }
 dispose():void{
   this.image?.destroy();this.image=null;this.texture=null;
   this.lastWorld=null;this.lastBlocked=null;this.lastSeed=-1;
   if(this.scene.textures.exists(TEXTURE_KEY))this.scene.textures.remove(TEXTURE_KEY);
 }
}
