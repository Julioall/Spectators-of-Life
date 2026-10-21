/** ASTERRA: pure visual projection of already-simulated grass cohorts.
 * The Web Worker remains the only source of ecological truth. */
export type GrassSample = Readonly<{biomassGPerM2:number;wetland:boolean;blocked:boolean}>;
export type GrassAutotile = {
  width:number;height:number;detail:number;states:Uint8Array;masks:Uint8Array;
};
export const GRASS_NEIGHBORS:readonly (readonly [number,number])[] = [
 [0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]
] as const;
const clamp=(v:number)=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
export function grassHash(seed:number,x:number,y:number):number{
 let h=(seed|0)^Math.imul(x|0,374761393)^Math.imul(y|0,668265263);
 h=Math.imul(h^(h>>>13),1274126177);
 return ((h^(h>>>16))>>>0)/4294967296;
}
function smoothNoise(seed:number,x:number,y:number,step:number):number{
 const gx=x/step,gy=y/step,ix=Math.floor(gx),iy=Math.floor(gy);
 const fx=gx-ix,fy=gy-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
 const a=grassHash(seed,ix,iy),b=grassHash(seed,ix+1,iy);
 const c=grassHash(seed,ix,iy+1),d=grassHash(seed,ix+1,iy+1);
 return (a+(b-a)*u)*(1-v)+(c+(d-c)*u)*v;
}
/** Never creates coverage on a cell without living grass biomass. */
export function generateGrassAutotile(
 cells:readonly GrassSample[],width:number,height:number,seed:number,detail=4
):GrassAutotile{
 if(!Number.isInteger(width)||width<=0||!Number.isInteger(height)||height<=0
   ||cells.length!==width*height||!Number.isInteger(detail)||detail<1||detail>8)
   throw new RangeError('Invalid ASTERRA grass grid');
 const columns=width*detail,rows=height*detail;
 const states=new Uint8Array(columns*rows),masks=new Uint8Array(columns*rows);
 for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
   const cell=cells[Math.floor(y/detail)*width+Math.floor(x/detail)]!;
   if(cell.blocked||cell.biomassGPerM2<=.5)continue;
   const cover=clamp(1-Math.exp(-cell.biomassGPerM2/125));
   const large=smoothNoise(seed^0x4211,x,y,14);
   const small=smoothNoise(seed^0x7312,x,y,5);
   if(cover<.14+.62*large+.24*small)continue;
   states[y*columns+x]=cell.wetland?3:cover>.68?2:1;
 }
 for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
   const i=y*columns+x;if(!states[i])continue;
   let mask=0;
   GRASS_NEIGHBORS.forEach(([dx,dy],bit)=>{
     const nx=x+dx,ny=y+dy;
     if(nx>=0&&ny>=0&&nx<columns&&ny<rows&&states[ny*columns+nx])mask|=1<<bit;
   });
   masks[i]=mask;
 }
 return {width:columns,height:rows,detail,states,masks};
}
