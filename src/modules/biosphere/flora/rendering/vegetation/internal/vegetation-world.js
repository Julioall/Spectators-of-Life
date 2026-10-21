/* Generated from the G9  procedural engines; modular ESM edition. */
import * as VegetationApi from './vegetation-engine.js';
import { createCanvas } from '../../leaves/index.js';

const V=VegetationApi;
const hash=s=>V.hash32(s);
class VegetationWorld {
 constructor({renderer,cellSize=220,spriteBudgetMB=28,variantCount=5,season='verao'}={}){
  if(!renderer)throw Error('VegetationWorld requer PlantRenderer');
  this.renderer=renderer;this.cellSize=cellSize;this.variantCount=Math.max(1,variantCount);
  this.season=season;this.items=new Map();this.grid=new Map();this.spriteCache=new Map();this.bytes=0;
  this.budget=spriteBudgetMB*1048576;this.pending=new Set();this.counters={drawn:0,visible:0,culled:0,lowDetail:0,cacheHits:0,cacheMisses:0};
 }
 keyCell(x,y){return Math.floor(x/this.cellSize)+','+Math.floor(y/this.cellSize)}
 insert({id,preset,x,y,worldSize=125,seed=2026,age=1,density=1,drought=0}={}){
  if(!id)throw Error('id obrigatório');if(!V.PRESETS.some(p=>p.id===preset))throw Error('Preset desconhecido: '+preset);
  if(this.items.has(id))this.remove(id);
  const item={id,preset,x:Number(x)||0,y:Number(y)||0,worldSize,seed,age,density,drought};
  this.items.set(id,item);const k=this.keyCell(item.x,item.y);if(!this.grid.has(k))this.grid.set(k,new Set());this.grid.get(k).add(id);return item;
 }
 remove(id){const p=this.items.get(id);if(!p)return false;const k=this.keyCell(p.x,p.y);this.grid.get(k)?.delete(id);if(!this.grid.get(k)?.size)this.grid.delete(k);this.items.delete(id);return true;}
 clear(){this.items.clear();this.grid.clear();this.spriteCache.clear();this.bytes=0;this.pending.clear()}
 setSeason(season){this.season=season;this.spriteCache.clear();this.bytes=0;this.pending.clear()}
 query({x,y,width,height,zoom=1},overscan=150){
  const minX=x-width/(2*zoom)-overscan,maxX=x+width/(2*zoom)+overscan,
   minY=y-height/(2*zoom)-overscan,maxY=y+height/(2*zoom)+overscan;
  const out=[];
  for(let a=Math.floor(minX/this.cellSize);a<=Math.floor(maxX/this.cellSize);a++)for(let b=Math.floor(minY/this.cellSize);b<=Math.floor(maxY/this.cellSize);b++){
   const ids=this.grid.get(a+','+b);if(!ids)continue;
   for(const id of ids){const p=this.items.get(id);if(p.x>=minX&&p.x<=maxX&&p.y>=minY&&p.y<=maxY)out.push(p)}
  }
  return out.sort((a,b)=>a.y-b.y);
 }
 visualKey(item,lod){return [this.season,item.preset,hash(item.seed)%this.variantCount,
    Math.round(item.age*5),Math.round(item.density*4),Math.round(item.drought*4),lod].join('|')}
 sharedPlant(item){return V.makePlant({preset:item.preset,seed:hash(item.preset+':'+(hash(item.seed)%this.variantCount)),
  season:this.season,age:Math.max(.08,Math.round(item.age*5)/5),density:Math.max(.3,Math.round(item.density*4)/4),drought:Math.round(item.drought*4)/4});}
 sprite(item,lod=1){const key=this.visualKey(item,lod),entry=this.spriteCache.get(key);
  if(entry){this.spriteCache.delete(key);this.spriteCache.set(key,entry);this.counters.cacheHits++;return entry.canvas;}
  this.counters.cacheMisses++;
  const plant=this.sharedPlant(item);this.renderer.prepare(plant);
  const width=lod===2?112:256,height=lod===2?84:192;
  const canvas=createCanvas(width,height);
  const result=this.renderer.draw(canvas.getContext('2d'),plant,{x:width/2,y:height*.9,scale:width/320,wind:0,time:0});
  if(result.pending){this.pending.add(key);return null}
  this.pending.delete(key);
  const bytes=width*height*4;
  for(const [k,v] of this.spriteCache){if(this.bytes+bytes<=this.budget)break;this.spriteCache.delete(k);this.bytes-=v.bytes}
  if(bytes<=this.budget){this.spriteCache.set(key,{canvas,bytes});this.bytes+=bytes}
  return canvas;
 }
 draw(ctx,camera,phase=0,{windStrength=.5}={}){
  const zoom=camera.zoom||1,visible=this.query(camera),m={visible:visible.length,drawn:0,queued:0,lowDetail:0};
  ctx.imageSmoothingEnabled=false;
  for(const item of visible){
   const screenW=item.worldSize*zoom,px=(item.x-camera.x)*zoom+camera.width*.5,
    py=(item.y-camera.y)*zoom+camera.height*.5;
   if(screenW<8)continue;
   const lod=screenW>=135?0:screenW>=45?1:2;
   const field=this.renderer.windField?.sample(item.x,item.y,phase)||{vx:0,vy:0};
   const sway=windStrength*field.vx*5;
   if(lod===0){
    const p=this.sharedPlant(item);p.worldX=item.x;p.worldY=item.y;
    const s=screenW/256,draw=this.renderer.draw(ctx,p,{x:px+sway,y:py,scale:s,wind:windStrength,time:phase});
    if(draw.pending)m.queued++;m.drawn++;continue;
   }
   const sprite=this.sprite(item,lod);if(!sprite){m.queued++;continue}
   if(lod===2)m.lowDetail++;
   const w=screenW*1.25,h=w*3/4;
   ctx.save();ctx.translate(px+sway,py);ctx.rotate(windStrength*field.vx*.012);
   ctx.drawImage(sprite,-w/2,-h*.90,w,h);ctx.restore();m.drawn++;
  }
  this.counters.drawn=m.drawn;this.counters.visible=m.visible;this.counters.lowDetail=m.lowDetail;return m;
 }
 tick({timeBudgetMs=4,maxJobs=4}={}){return this.renderer.runtime.tick({timeBudgetMs,maxJobs})}
 stats(){return {...this.counters,plantCount:this.items.size,cellCount:this.grid.size,sprites:this.spriteCache.size,
  spriteMemoryBytes:this.bytes,leafRuntime:this.renderer.runtime.stats()}}
}
export { VegetationWorld };
