/** Spectators-of-Life adaptation. Reads natural-world coortes and never mutates the Worker state. */
import {GrassCoverField} from './grass-cover.js';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:0));
export function biomeForHabitat(habitat){return ({upland:'alpine',woodland:'forest',meadow:'meadow',wetland:'wetland',dryland:'savanna',desert:'savanna'})[habitat]||'meadow';}
export function naturalCellToGrassEnv(cell){const water=cell?.water||{},soil=cell?.soil||{},climate=cell?.climate||{};
 const moisture=clamp(water.soilMm/Math.max(1,water.capacityMm||1));
 const nutrients=clamp((soil.mineralNitrogenGPerM2??soil.mineralNGPerM2??soil.availableNitrogenGPerM2??.5)/3);
 const light=clamp((climate.solarMjPerM2Day||0)/18);
 const trees=(cell?.plants||[]).filter(p=>['oak','pine','birch','willow','autumnal'].includes(p.speciesId));
 const shade=clamp(trees.reduce((n,p)=>n+clamp((p.biomassGPerM2||0)/750)*.32,0));
 return {moisture,nutrients,light,shade};
}
/** Re-project one core cell per source grid cell; resample to an optional finer cosmetic layer.
 * Uses existing core coortes as the source; does not invent seeds, competition, or biology.
 */
export function projectCohortsToCover({seed=1947,width,height,cells,biome='meadow',tileSize=10,cellSize=40,grassBiomassForFullCover=350,blockedCells}={}){
 if(!Array.isArray(cells)||!width||!height||cells.length!==width*height)throw Error('Expected complete natural-world cell snapshot');
 const field=new GrassCoverField({width:width*cellSize,height:height*cellSize,tileSize,seed,biome,initialise:false});
 updateCohortsInCover(field,{seed,width,height,cells,tileSize,cellSize,grassBiomassForFullCover,blockedCells,
   dirtyCellIndices:new Set(cells.map((_,index)=>index))});
 return field;
}

/** Reprojects only changed source cells into an existing cosmetic coverage field. */
export function updateCohortsInCover(field,{seed=field?.seed??1947,width,height,cells,tileSize=field?.tileSize??10,cellSize=40,grassBiomassForFullCover=350,blockedCells,dirtyCellIndices,onTileChanged}={}){
 if(!field||!Array.isArray(cells)||!width||!height||cells.length!==width*height)throw Error('Expected complete natural-world cell snapshot');
 if(field.cols!==Math.ceil(width*cellSize/tileSize)||field.rows!==Math.ceil(height*cellSize/tileSize)||field.tileSize!==tileSize)throw Error('Coverage field dimensions do not match the natural-world grid');
 const dirty=dirtyCellIndices??new Set(cells.map((_,index)=>index));
 for(const sourceIndex of dirty){
  if(!Number.isInteger(sourceIndex)||sourceIndex<0||sourceIndex>=cells.length)continue;
  const sx=sourceIndex%width,sy=Math.floor(sourceIndex/width),source=cells[sourceIndex];
  const startX=Math.max(0,Math.floor(sx*cellSize/tileSize)),endX=Math.min(field.cols,Math.ceil((sx+1)*cellSize/tileSize));
  const startY=Math.max(0,Math.floor(sy*cellSize/tileSize)),endY=Math.min(field.rows,Math.ceil((sy+1)*cellSize/tileSize));
  let amount=0;
  for(const plant of source.plants||[]){if(plant.speciesId==='grass')amount+=(plant.biomassGPerM2||0)*Math.max(.1,Math.min(1.5,plant.densityPerM2||1));}
  const light=clamp((source.climate?.solarMjPerM2Day||0)/18),habitat=source.terrain?.habitat;
  const blocked=blockedCells?.has(source.index)??false;
  const invalidSource=source.terrain?.waterBody&&source.terrain.waterBody!=='none'||source.terrain?.exposedRock||blocked;
  for(let y=startY;y<endY;y++)for(let x=startX;x<endX;x++){
   const wx=(x+.5)*tileSize,wy=(y+.5)*tileSize;
   if(Math.min(width-1,Math.floor(wx/cellSize))!==sx||Math.min(height-1,Math.floor(wy/cellSize))!==sy)continue;
   const i=y*field.cols+x,noise=.90+((x*17+y*37+seed)%13)/65;
   const value=invalidSource?0:clamp(amount/grassBiomassForFullCover)*clamp(light*.25+.75)*noise;
   const cover=Math.round(clamp(value)*255),type=habitat==='wetland'?2:1;
   if(field.cover[i]!==cover||field.seedBank[i]!==cover||field.type[i]!==type||field.patch[i]!==1){
    field.cover[i]=cover;field.seedBank[i]=cover;field.type[i]=type;field.patch[i]=1;
    onTileChanged?.(i,x,y);
   }
  }
 }
 return field;
}
