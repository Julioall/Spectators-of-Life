/* Generated from the G9  procedural engines; modular ESM edition. */

 const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
 const smooth=(a,b,v)=>{const x=clamp((v-a)/(b-a));return x*x*(3-2*x)};
 const mix=(a,b,t)=>a+(b-a)*t;
 const rnd=(seed,n)=>{let x=(seed+Math.imul(n,0x9e3779b9))|0;x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);return ((x^(x>>>16))>>>0)/4294967296};
 const norm=(v,f)=>Number.isFinite(+v)?clamp(+v):f;
 const numDays=(v,f)=>Number.isFinite(+v)?Math.max(0,+v):f;
 const SEASONS=['primavera','verao','outono','inverno'];
 const STAGES=[{id:'broto',from:0,to:.12},{id:'expansao',from:.12,to:.32},
  {id:'jovem',from:.32,to:.46},{id:'madura',from:.46,to:.73},
  {id:'senescente',from:.73,to:.90},{id:'seca',from:.90,to:.995},
  {id:'desprendida',from:.995,to:1}];
 function evaluate(options={}){
   const lifespanDays=Math.max(1,numDays(options.lifespanDays,180));
   const age=options.ageDays!=null?clamp(numDays(options.ageDays,0)/lifespanDays):norm(options.lifeProgress,.56),seed=(Number(options.seed)||0)|0;
   const season=SEASONS.includes(options.season)?options.season:'verao';
   const deciduous=options.deciduous!==false;
   const drought=norm(options.drought,0),pests=norm(options.herbivory,0),fungus=norm(options.disease,0);
   const nutrients=norm(options.nutrients,1),seasonIntensity=norm(options.seasonIntensity,1);
   const seasonalPigment=norm(options.seasonalPigment,1);
   const droughtTolerance=norm(options.droughtTolerance,0);
   const effectiveDrought=drought*(1-droughtTolerance*.65);
   const stage=STAGES.find(s=>age>=s.from&&age<s.to)?.id || 'desprendida';
   const growth=.10+.90*smooth(0,.38,age);
   const unfurl=.13+.87*smooth(.025,.23,age);
   const old=smooth(.70,1,age);
   const seasonal=(deciduous ? (season==='outono'?.80:season==='inverno'?1:0) :
     (season==='outono'?.18:season==='inverno'?.28:0))*seasonIntensity*seasonalPigment;
   const warm=clamp(old*.98+seasonal*(.45+.40*smooth(.32,.66,age)) + effectiveDrought*.28+(1-nutrients)*.23);
   const dryness=clamp(smooth(.81,.99,age)*.92 + effectiveDrought*.65 + (1-nutrients)*.12 + (season==='inverno'&&deciduous?.20*seasonIntensity:0));
   const chlorosis=clamp(warm*.85 + (1-nutrients)*.50 + fungus*.12);
   const damage=clamp(pests*(.40+.60*smooth(.15,.5,age)) + old*.20 + effectiveDrought*.07);
   const blemish=clamp(fungus*(.4+.6*smooth(.18,.5,age)) + old*.20 + effectiveDrought*.11);
   const detached=age>=.995 || (options.abscission===true);
   return {seed,progress:age,ageDays:Math.round(age*lifespanDays*100)/100,lifespanDays,stage,season,deciduous,growth,unfurl,senescence:old,
     warm,dryness,chlorosis,damage,blemish,nutrients,drought,pests,fungus,detached};
 }
 // Stable leaf-surface coordinates u∈[-1,1], t∈[0,1]. Shape unchanged between frames.
 function ellipse(u,t,xc,yc,rx,ry){const dx=(u-xc)/rx,dy=(t-yc)/ry;return dx*dx+dy*dy;}
 function sample(u,t,life){
   const s=life.seed;
   const wave=.52+.26*Math.sin(13.4*t+4.3*u+rnd(s,11)*7)+.22*Math.sin(7.4*t-8.1*u+rnd(s,12)*7);
   const patch=smooth(.22,.87,wave);
   const tip=smooth(.63,1,t),edge=smooth(.72,1,Math.abs(u));
   const autumn=clamp(life.warm*(.64+.30*patch+.13*tip));
   const dry=clamp(life.dryness*(.22+.53*edge+.22*tip+.12*patch));
   let lesion=0,insideHole=false;
   if(life.damage>.03){
     const n=6;
     for(let i=0;i<n;i++){
       const r=Math.max(0,(life.damage-(i*.07)));
       if(r<=0)continue;
       const centerU=(rnd(s,300+i*11)*1.75-.875),centerT=.12+rnd(s,301+i*11)*.78;
       const radiusU=(.025+r*.19)*(i%2?.85:1.28);
       const radiusT=.018+r*.115;
       const d=ellipse(u,t,centerU,centerT,radiusU,radiusT);
       if(d<1 && r>.12)insideHole=true;
     }
   }
   if(life.blemish>.015){
     for(let i=0;i<7;i++){
       const u0=-.7+rnd(s,800+i*13)*1.4,t0=.10+rnd(s,801+i*13)*.76;
       const r=.013+life.blemish*.105;
       const d=ellipse(u,t,u0,t0,r*2.1,r*.8);
       if(d<1)lesion=Math.max(lesion,(1-smooth(.15,1,d))*(.3+.7*life.blemish));
     }
   }
   return {autumn,dry,lesion,hole:insideHole};
 }
 function edgeWear(t,side,life){
   if(life.damage<=0)return 1;
   const wiggle=.5+.5*Math.sin(33*t+side*1.1+rnd(life.seed,513)*5)*Math.sin(17*t+side*3+rnd(life.seed,514)*7);
   return 1-(life.damage*.24 + life.dryness*.085)*Math.pow(wiggle,3);
 }
 function summarize(s){return {progress:s.progress,stage:s.stage,season:s.season,deciduous:s.deciduous,
    lifespan_days:s.lifespanDays,age_days:s.ageDays,relative_size:s.growth,unfurl:s.unfurl,autumn_pigment:s.warm,dryness:s.dryness,
    herbivory_damage:s.damage,disease_blemishes:s.blemish,detached:s.detached};}
export { SEASONS, STAGES, evaluate, sample, edgeWear, summarize };
