/** Optional Canvas 2D renderer for G5.3 coverage. Cached 16x16 tile chunks; no procedural raster work on every frame. */
import {grassTileState,grassMaskAt} from './grass-cover.js';
import {createCanvas} from '../../leaves/index.js';
const pal={meadow:['#40552f','#526a38','#637943','#788a4d','#96a469','#b1b57d'],forest:['#2d422b','#3c5430','#4d6537','#617c46','#80945c','#9eaa78'],wetland:['#304a30','#3b5e38','#4e7345','#658b54','#88a36c','#a8bb82'],savanna:['#585336','#746c3d','#897b43','#a09651','#b7aa66','#d2c08a'],alpine:['#42543a','#536845','#637b50','#819260','#9ead77','#b7bd92']};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class GrassCoverRenderer {
 constructor({chunkTiles=16,maxChunks=96,windSampler=null}={}){this.chunkTiles=chunkTiles;this.maxChunks=maxChunks;this.windSampler=windSampler;this.cache=new Map();}
 clear(){this.cache.clear();}
 /* G5.3 mask shape in local tile space; diagonal requires adjacent cardinal edges. */
 static paintMask(ctx,x,y,size,mask){const edge=Math.max(1,size*.23),m=size-2*edge;ctx.fillRect(x+edge,y+edge,m,m);
  if(mask&1)ctx.fillRect(x+edge,y,m,edge+1);if(mask&16)ctx.fillRect(x+edge,y+size-edge,m,edge);
  if(mask&4)ctx.fillRect(x+size-edge,y+edge,edge,m);if(mask&64)ctx.fillRect(x,y+edge,edge,m);
  if(mask&2)ctx.fillRect(x+size-edge,y,edge,edge);if(mask&8)ctx.fillRect(x+size-edge,y+size-edge,edge,edge);
  if(mask&32)ctx.fillRect(x,y+size-edge,edge,edge);if(mask&128)ctx.fillRect(x,y,edge,edge);
 }
 _signature(field,cx,cy,density){let h=2166136261;for(let y=cy*this.chunkTiles-1;y<(cy+1)*this.chunkTiles+1;y++)for(let x=cx*this.chunkTiles-1;x<(cx+1)*this.chunkTiles+1;x++){
 const c=x>=0&&y>=0&&x<field.cols&&y<field.rows?field.cover[y*field.cols+x]:0;const state=grassTileState(c/255,x>=0&&y>=0&&x<field.cols&&y<field.rows?field.type[y*field.cols+x]:1,density);h=Math.imul(h^state,16777619)>>>0;}return h.toString(16);
 }
 _chunk(field,cx,cy,density){const key=[field.seed,field.biome,field.cols,field.rows,field.tileSize,cx,cy,Math.round(density*100),this._signature(field,cx,cy,density)].join(':');const cached=this.cache.get(key);if(cached){this.cache.delete(key);this.cache.set(key,cached);return cached;}
 const ts=field.tileSize,w=this.chunkTiles*ts,canvas=createCanvas(w,w),ctx=canvas.getContext('2d'),colors=pal[field.biome]||pal.meadow;ctx.imageSmoothingEnabled=false;
 for(let j=0;j<this.chunkTiles;j++)for(let i=0;i<this.chunkTiles;i++){
 const x=cx*this.chunkTiles+i,y=cy*this.chunkTiles+j;if(x>=field.cols||y>=field.rows)continue;const k=y*field.cols+x,state=grassTileState(field.cover[k]/255,field.type[k],density);if(!state)continue;
 const mask=grassMaskAt(field,x,y,{density}),tone=(x*19+y*47+field.seed)%7,idx=clamp((field.type[k]===2?3:2)+(tone===0?1:tone===6?-1:0),0,5);ctx.globalAlpha=.38+(field.cover[k]/255)*.23;ctx.fillStyle=colors[idx];GrassCoverRenderer.paintMask(ctx,i*ts,j*ts,ts,mask);ctx.globalAlpha=1;
 if(state>=2){ctx.strokeStyle=colors[clamp(idx+1,0,5)];ctx.lineWidth=.7;for(let z=0;z<(state>=3?3:2);z++){const px=i*ts+2+(x*3+y*7+z*5)%Math.max(3,ts-3),py=j*ts+ts-1,dx=(z%2?1:-1)*1.8;ctx.beginPath();ctx.moveTo(px,py);ctx.quadraticCurveTo(px+dx,py-2.8,px+dx,py-4.5);ctx.stroke();}}
 }
 this.cache.set(key,canvas);while(this.cache.size>this.maxChunks)this.cache.delete(this.cache.keys().next().value);return canvas;
 }
 draw(ctx,field,{cameraX=0,cameraY=0,zoom=1,viewportWidth=ctx.canvas.width,viewportHeight=ctx.canvas.height,density=1,time=0,wind=0,quality='balanced'}={}){
  const ts=field.tileSize,cpx=this.chunkTiles*ts,minX=Math.max(0,Math.floor(cameraX/cpx)),minY=Math.max(0,Math.floor(cameraY/cpx)),maxX=Math.min(Math.ceil(field.cols/this.chunkTiles)-1,Math.floor((cameraX+viewportWidth/zoom)/cpx)),maxY=Math.min(Math.ceil(field.rows/this.chunkTiles)-1,Math.floor((cameraY+viewportHeight/zoom)/cpx));
  ctx.save();ctx.imageSmoothingEnabled=false;let drawn=0;
  for(let cy=minY;cy<=maxY;cy++)for(let cx=minX;cx<=maxX;cx++){
   const tile=this._chunk(field,cx,cy,density);let offset=0;
   if(quality!=='base'&&wind&&this.windSampler){const w=this.windSampler((cx+.5)*cpx,(cy+.5)*cpx,time)||{};offset=clamp((w.vx??w.dx??0)*wind*1.7,-3,3);}
   ctx.drawImage(tile,(cx*cpx-cameraX)*zoom+offset,(cy*cpx-cameraY)*zoom,cpx*zoom,cpx*zoom);drawn++;
  }
  ctx.restore();return {chunks:drawn,cacheEntries:this.cache.size};
 }
}
