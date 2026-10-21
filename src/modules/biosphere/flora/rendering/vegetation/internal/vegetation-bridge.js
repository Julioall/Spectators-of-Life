/* Generated from the G9  procedural engines; modular ESM edition. */

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const bucket=(v,steps)=>Math.round(clamp(Number(v)||0,0,1)*steps)/steps;
class VegetationBridge{
 constructor({runtime,windField,season='verao',ageBuckets=8,droughtBuckets=4}={}){
  if(!runtime)throw new Error('VegetationBridge requer LeafProductionRuntime');
  this.runtime=runtime;this.windField=windField||runtime.windField;
  this.season=season;this.ageBuckets=ageBuckets;this.droughtBuckets=droughtBuckets;
  if(this.windField)this.runtime.windField=this.windField;
 }
 setEnvironment({season=this.season,windField=this.windField}={}){
  this.season=season;if(windField){this.windField=windField;this.runtime.windField=windField}
 }
 sampleWind(x,y,phase){return this.windField?.sample(x,y,phase)||{vx:0,vy:0,strength:0,direction:0,gust:0,turbulence:0}}
 // anchors: [{id,x,y,worldSize,lifeProgress,drought,species,genome,...}]
 // plant: {id,species,seed,genome,...}; nenhum ramo ou folha é criado automaticamente.
 instancesFromAnchors(plant,anchors,{baseSize=56,quantize=true}={}){
  if(!Array.isArray(anchors))throw Error('anchors precisa ser um array');
  return anchors.map((p,i)=>{
   const age=Number(p.lifeProgress??plant.lifeProgress??.53);
   const drought=Number(p.drought??plant.drought??0);
   return {id:`${plant.id}:${p.id??i}`,x:Number(p.x)||0,y:Number(p.y)||0,
    worldSize:Number(p.worldSize??baseSize),species:p.species||plant.species,
    genome:p.genome||plant.genome||undefined,
    config:{season:this.season,lifeProgress:quantize?bucket(age,this.ageBuckets):age,
      drought:quantize?bucket(drought,this.droughtBuckets):drought,
      nutrients:p.nutrients??plant.nutrients??1,
      herbivory:p.herbivory??0,disease:p.disease??0,
      ...(p.visualOptions||{})}};
  });
 }
 // O chamador mantém o estado e a física; não serializamos Canvas nem texturas.
 serialize(plant,anchors){return {schema:'vegetation-leaves/1',plant,anchors}}
}
export { VegetationBridge };
