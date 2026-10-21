import test from 'node:test';
import assert from 'node:assert/strict';
import {createGrassCover,restoreGrassCover,grassMaskAt,GrassCoverRenderer,
 projectCohortsToCover,updateCohortsInCover} from '../../src/modules/biosphere/flora/rendering/vegetation/grass/index.js';
const opts={width:160,height:120,tileSize:10,seed:1947,biome:'meadow',sample:(x,y)=>({moisture:.55+.2*Math.sin(x/43),nutrients:.7,light:.88,shade:y>80?.3:0})};
test('G5.3 cover deterministically generated and serialized',()=>{
 const a=createGrassCover(opts),b=createGrassCover(opts);
 assert.deepEqual(a.toJSON(),b.toJSON());
 assert.equal(a.cover.length,192);assert.deepEqual(restoreGrassCover(a.toJSON()).toJSON(),a.toJSON());
});
test('8-bit mask uses cardinals to prevent diagonal leaks',()=>{
 const f=createGrassCover({width:30,height:30,tileSize:10,initialise:false});
 f.cover.fill(0);f.cover[0]=255;f.cover[4]=255;
 assert.equal(grassMaskAt(f,1,1),0);
 f.cover[1]=255;f.cover[3]=255;
 assert.equal(grassMaskAt(f,1,1)&128,128);
 assert.equal(grassMaskAt(f,1,1)&2,0);
});
test('advance in batches and single steps identical (deterministic)',()=>{
 const a=createGrassCover(opts),b=createGrassCover(opts);
 a.advance({sample:opts.sample,steps:17});for(let i=0;i<17;i++)b.advance({sample:opts.sample});
 assert.deepEqual(a.toJSON(),b.toJSON());
});
test('shade and drought affect coverage in standalone model',()=>{
 const a=createGrassCover(opts),b=createGrassCover(opts);
 a.advance({sample:()=>({moisture:.9,nutrients:.9,light:1,shade:0}),steps:30});
 b.advance({sample:()=>({moisture:.05,nutrients:.15,light:.4,shade:.9}),steps:30});
 assert.ok(a.cover.reduce((x,y)=>x+y,0)>b.cover.reduce((x,y)=>x+y,0));
});
test('game bridge reads coortes without modifying them',()=>{
 const cells=[{water:{soilMm:60,capacityMm:100},soil:{mineralNitrogenGPerM2:1.5},climate:{solarMjPerM2Day:18},terrain:{habitat:'meadow',waterBody:'none',exposedRock:false},plants:[{speciesId:'grass',biomassGPerM2:360,densityPerM2:1}]}];
 const before=JSON.stringify(cells);const f=projectCohortsToCover({width:1,height:1,cellSize:40,tileSize:10,cells});
 assert.equal(JSON.stringify(cells),before);assert.equal(f.cols,4);assert.ok(f.cover[0]>200);
});
test('game bridge hides ground cover on blocked source cells',()=>{
 const cells=[0,1].map(index=>({index,water:{soilMm:60,capacityMm:100},soil:{mineralNitrogenGPerM2:1.5},climate:{solarMjPerM2Day:18},terrain:{habitat:'meadow',waterBody:'none',exposedRock:false},plants:[{speciesId:'grass',biomassGPerM2:360,densityPerM2:1}]}));
 const field=projectCohortsToCover({width:2,height:1,cellSize:10,tileSize:10,cells,blockedCells:new Set([1])});
 assert.ok(field.cover[0]>0);
 assert.equal(field.cover[1],0);
});
test('incremental grass projection matches a full projection after one cell changes',()=>{
 const cells=[0,1].map(index=>({index,water:{soilMm:60,capacityMm:100},soil:{mineralNitrogenGPerM2:1.5},climate:{solarMjPerM2Day:18},terrain:{habitat:'meadow',waterBody:'none',exposedRock:false},plants:[{speciesId:'grass',biomassGPerM2:150,densityPerM2:1}]}));
 const incremental=projectCohortsToCover({width:2,height:1,cellSize:10,tileSize:5,cells});
 cells[1].plants[0].biomassGPerM2=320;
 updateCohortsInCover(incremental,{width:2,height:1,cellSize:10,tileSize:5,cells,dirtyCellIndices:new Set([1])});
 const complete=projectCohortsToCover({width:2,height:1,cellSize:10,tileSize:5,cells});
 assert.deepEqual(incremental.cover,complete.cover);
 assert.deepEqual(incremental.type,complete.type);
});
test('incremental projection reports only output tiles whose rendered state changed',()=>{
 const cells=[0,1].map(index=>({index,water:{soilMm:60,capacityMm:100},soil:{mineralNitrogenGPerM2:1.5},climate:{solarMjPerM2Day:18},terrain:{habitat:'meadow',waterBody:'none',exposedRock:false},plants:[{speciesId:'grass',biomassGPerM2:150,densityPerM2:1}]}));
 const field=projectCohortsToCover({width:2,height:1,cellSize:10,tileSize:5,cells});
 const changed=[];
 cells[1].soil.mineralNitrogenGPerM2=2.5;
 updateCohortsInCover(field,{width:2,height:1,cellSize:10,tileSize:5,cells,dirtyCellIndices:new Set([1]),onTileChanged:(index,x,y)=>changed.push({index,x,y})});
 assert.deepEqual(changed,[]);
 cells[1].plants[0].biomassGPerM2=320;
 updateCohortsInCover(field,{width:2,height:1,cellSize:10,tileSize:5,cells,dirtyCellIndices:new Set([1]),onTileChanged:(index,x,y)=>changed.push({index,x,y})});
 assert.ok(changed.length>0);
 assert.ok(changed.every(tile=>tile.x>=2&&tile.x<4));
});
test('renderer is optional and caches chunks with injected canvas factory',async()=>{
 const {setCanvasFactory}=await import('../../src/modules/biosphere/flora/rendering/leaves/index.js');
 let raster=0;setCanvasFactory((w,h)=>{raster++;const ctx=new Proxy({canvas:{width:w,height:h}}, {get(t,p){if(p in t)return t[p];return ()=>{}},set(){return true;}});return{width:w,height:h,getContext:()=>ctx};});
 try{const f=createGrassCover(opts),r=new GrassCoverRenderer({chunkTiles:8,maxChunks:8});
 const ctx=new Proxy({canvas:{width:160,height:120}}, {get(t,p){if(p in t)return t[p];return ()=>{}},set(){return true;}});
 r.draw(ctx,f,{viewportWidth:160,viewportHeight:120});const original=raster;
 r.draw(ctx,f,{viewportWidth:160,viewportHeight:120});assert.equal(raster,original);assert.ok(r.cache.size<=8);
 }finally{setCanvasFactory(null);}
});
