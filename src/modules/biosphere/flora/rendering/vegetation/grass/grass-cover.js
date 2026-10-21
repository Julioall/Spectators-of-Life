/**  G5.3 coverage, without Canvas or browser dependencies. Deterministic presentation field.
 *  IMPORTANT: This is NOT authoritative ecology. Your game's core owns biomass, water, nutrients, seeds.
 *  Use `projectCohortsToCover()` for snapshot-driven displays; advance only in standalone labs.
 */
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:a));
export function hash32(...args){let h=2166136261>>>0;for(const x of args){const s=String(x);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}h^=255;h=Math.imul(h,16777619)>>>0;}return h>>>0;}
const rand=(...args)=>hash32(...args)/4294967295;
const smooth=v=>(v=clamp(v))*v*(3-2*v);
function noise(seed,x,y,scale){const fx=x/scale,fy=y/scale,ix=Math.floor(fx),iy=Math.floor(fy),tx=smooth(fx-ix),ty=smooth(fy-iy);
 const r=(a,b)=>rand(seed,'patch',a,b);return(r(ix,iy)*(1-tx)+r(ix+1,iy)*tx)*(1-ty)+(r(ix,iy+1)*(1-tx)+r(ix+1,iy+1)*tx)*ty;}
const BASE={meadow:.78,forest:.66,wetland:.83,savanna:.61,alpine:.72};
export function grassTileState(cover,type=1,density=1){const value=clamp(cover*density);if(value<=.655)return 0;if(type===2)return 4;if(type===3)return 5;return value<.74?1:value<.86?2:3;}
/** Mask order: N, NE, E, SE, S, SW, W, NW; a diagonal requires both cardinals. */
export function grassMaskAt(field,x,y,{density=1,threshold=.655}={}){const {cols,rows,cover}=field;const at=(a,b)=>a>=0&&b>=0&&a<cols&&b<rows&&cover[b*cols+a]/255*density>threshold;
 const n=at(x,y-1),e=at(x+1,y),s=at(x,y+1),w=at(x-1,y);
 return (n?1:0)|((n&&e&&at(x+1,y-1))?2:0)|(e?4:0)|((e&&s&&at(x+1,y+1))?8:0)|(s?16:0)|((s&&w&&at(x-1,y+1))?32:0)|(w?64:0)|((w&&n&&at(x-1,y-1))?128:0);
}
/** Spatial grid with 10px tiles by default; seed-bank is a VISUAL reservoir, not ecological seeds. */
export class GrassCoverField {
 constructor({width,height,tileSize=10,seed=1947,biome='meadow',sample=()=>({}),initialise=true}={}){
  if(!Number.isInteger(width)||width<=0||!Number.isInteger(height)||height<=0||!Number.isInteger(tileSize)||tileSize<2)throw Error('GrassCover: invalid dimensions');
  this.width=width;this.height=height;this.tileSize=tileSize;this.cols=Math.ceil(width/tileSize);this.rows=Math.ceil(height/tileSize);this.seed=seed>>>0;this.biome=biome;this.tick=0;this.epoch=0;
  const length=this.cols*this.rows;this.cover=new Uint8Array(length);this.type=new Uint8Array(length);this.seedBank=new Uint8Array(length);this.patch=new Float32Array(length);
  if(initialise)this.initialise(sample);
 }
 cellAt(x,y){const cx=Math.max(0,Math.min(this.cols-1,Math.floor(x/this.tileSize))),cy=Math.max(0,Math.min(this.rows-1,Math.floor(y/this.tileSize)));return cy*this.cols+cx;}
 initialise(sample){const t=this.tileSize;for(let y=0;y<this.rows;y++)for(let x=0;x<this.cols;x++){
  const i=y*this.cols+x,px=(x+.5)*t,py=(y+.5)*t,e=sample(px,py,x,y)||{},n0=noise(this.seed+111,px,py,174),n1=noise(this.seed+654,px,py,73),n2=noise(this.seed+1305,px+72,py-17,215);
  const water=clamp(e.moisture??.67),nitrogen=clamp(e.nutrients??.70),light=clamp(e.light??.83),shade=clamp(e.shade??0);
  const suitability=clamp((BASE[this.biome]??.75)*(.48+.52*water)*(.52+.48*nitrogen)*(.72+.28*light)*(1-shade*.48),.02,1);
  this.patch[i]=clamp(.58+n0*.62+n1*.28+n2*.18,0,1.4);
  const source=clamp(.58*suitability+.42*clamp(.31+n0*.64+n1*.24,0,1.12)+(rand(this.seed,'pore',x,y)-.5)*.12);
  this.cover[i]=Math.round(source*.98*255);this.seedBank[i]=this.cover[i];
  this.type[i]=this.biome==='wetland'&&water>.69?2:(n1>.76&&light>.5?3:1);
 }
 for(let pass=0;pass<2;pass++){const previous=this.cover.slice();for(let y=1;y<this.rows-1;y++)for(let x=1;x<this.cols-1;x++){const i=y*this.cols+x;this.cover[i]=Math.round(previous[i]*.72+(previous[i-1]+previous[i+1]+previous[i-this.cols]+previous[i+this.cols])*.07);}}
 this.seedBank.set(this.cover);return this;
 }
 get(x,y,{density=1}={}){const i=this.cellAt(x,y);return {cover:this.cover[i]/255,type:this.type[i],state:grassTileState(this.cover[i]/255,this.type[i],density),x:Math.floor(x/this.tileSize),y:Math.floor(y/this.tileSize)};}
 mask(x,y,opts={}){return grassMaskAt(this,x,y,opts);}
 /** Standalone ecology preview, non-authoritative. One tick per call; does not change external game state. */
 advance({sample=()=>({}),steps=1}={}){if(!Number.isInteger(steps)||steps<1||steps>1000)throw Error('Invalid step count');const ts=this.tileSize,base=BASE[this.biome]??.75;
 for(let z=0;z<steps;z++){const previous=this.cover.slice();for(let y=1;y<this.rows-1;y++)for(let x=1;x<this.cols-1;x++){
  const i=y*this.cols+x,env=sample((x+.5)*ts,(y+.5)*ts,x,y)||{},water=clamp(env.moisture??.67),nut=clamp(env.nutrients??.7),light=clamp(env.light??.83),shade=clamp(env.shade??0);
  const neighbors=(previous[i-1]+previous[i+1]+previous[i-this.cols]+previous[i+this.cols])/(4*255);
  const fit=clamp(base*(.48+.52*water)*(.52+.48*nut)*(.72+.28*light)*(1-shade*.48)*this.patch[i],.02,1);
  const current=previous[i]/255,target=clamp(fit*.32+neighbors*.43+(this.seedBank[i]/255)*.25+(rand(this.seed,'expansion',x,y,this.tick+1)-.5)*.012);
  const rate=target>current?.0028:.00135;this.cover[i]=Math.round(clamp(current+clamp(target-current,-rate,rate))*255);
 }this.tick++;if(this.tick%4===0)this.epoch++;}return this;
 }
 /** When core owns biomass, project coverage into this layer; no independent reproduction. */
 applyCoverage(values){if(values.length!==this.cover.length)throw Error('Coverage length mismatch');for(let i=0;i<values.length;i++)this.cover[i]=Math.round(clamp(values[i])*255);this.epoch++;return this;}
 toJSON(){return {schema:'grass-cover/1',version:'0.2.0',width:this.width,height:this.height,tileSize:this.tileSize,seed:this.seed,biome:this.biome,tick:this.tick,epoch:this.epoch,cover:Array.from(this.cover),type:Array.from(this.type),seedBank:Array.from(this.seedBank),patch:Array.from(this.patch)};}
 static fromJSON(value){if(value?.schema!=='grass-cover/1')throw Error('Unknown grass-cover schema');const f=new GrassCoverField({...value,initialise:false});const n=f.cols*f.rows;for(const key of ['cover','type','seedBank','patch']){if(!Array.isArray(value[key])||value[key].length!==n)throw Error('Invalid '+key);f[key].set(value[key]);}f.tick=value.tick;f.epoch=value.epoch;return f;}
}
export const createGrassCover=options=>new GrassCoverField(options);
export const updateGrassCover=(field,options)=>field.advance(options);
export const coverageAt=(field,x,y,options)=>field.get(x,y,options);
export const serializeGrassCover=field=>field.toJSON();
export const restoreGrassCover=value=>GrassCoverField.fromJSON(value);
