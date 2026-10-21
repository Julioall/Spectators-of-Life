/* Generated from the G9  procedural engines; modular ESM edition. */
import { LeafProductionRuntime } from '../../leaves/index.js';
import { createCanvas } from '../../leaves/index.js';

const VERSION='1.0.0';
const TAU=Math.PI*2, rad=d=>d*Math.PI/180, clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const PRESETS=[
 {id:'arbusto_denso',name:'Arbusto denso',group:'arbustos',mode:'shrub',shape:'eliptica',structure:'simples',leafCount:76,leafW:34,leafH:38,spread:90,height:120,foliage:1,flower:0,flex:.38,branch:'#69553a',description:'Copa arredondada com ramos secundários e folhas pequenas.'},
 {id:'arbusto_florido',name:'Arbusto florido',group:'arbustos',mode:'shrub',shape:'oval',structure:'simples',leafCount:64,leafW:30,leafH:35,spread:92,height:116,flower:.27,petal:'#e8a2b4',flex:.46,branch:'#685039',description:'Volume irregular com flores e folhagem distribuídas.'},
 {id:'cerca_viva',name:'Cerca-viva',group:'arbustos',mode:'hedge',shape:'azevinho',structure:'simples',leafCount:93,leafW:26,leafH:31,spread:101,height:105,flower:0,flex:.27,branch:'#4f5035',description:'Massa vegetal compacta, contorno aparado e muitos ramos.'},
 {id:'arbusto_aromatico',name:'Arbusto aromático',group:'arbustos',mode:'shrub',shape:'lanceolada',structure:'simples',leafCount:69,leafW:23,leafH:37,spread:83,height:123,flower:.11,petal:'#d0b2ef',flex:.65,branch:'#616046',description:'Ramos finos, folhas alongadas e pequenas inflorescências.'},
 {id:'samambaia',name:'Samambaia',group:'herbaceas',mode:'fern',shape:'lanceolada',structure:'bipinada',leafCount:12,leafW:62,leafH:124,spread:87,height:128,flower:0,flex:.77,branch:'#627b4a',description:'Frondes compostas abertas em disposição radial.'},
 {id:'herbacea_larga',name:'Herbácea folhosa',group:'herbaceas',mode:'herb',shape:'bananeira',structure:'simples',leafCount:17,leafW:50,leafH:82,spread:76,height:112,flower:0,flex:.57,branch:'#5a7a40',description:'Folhas largas surgindo de pecíolos herbáceos.'},
 {id:'erva_florida',name:'Erva silvestre florida',group:'herbaceas',mode:'herb',shape:'serrilhada',structure:'simples',leafCount:38,leafW:27,leafH:39,spread:72,height:136,flower:.35,petal:'#e8d294',flex:.78,branch:'#62874c',description:'Hastes ramificadas, folhas serrilhadas e flores.'},
 {id:'grama_fina',name:'Gramínea fina',group:'herbaceas',mode:'grass',shape:'salgueiro',structure:'simples',leafCount:47,leafW:13,leafH:102,spread:84,height:132,flower:0,flex:.93,branch:'#517942',description:'Lâminas estreitas surgindo em uma touceira.'},
 {id:'capim_ornamental',name:'Capim ornamental',group:'herbaceas',mode:'grass',shape:'lanceolada',structure:'simples',leafCount:38,leafW:18,leafH:127,spread:93,height:146,flower:.14,petal:'#e0c58e',flex:.88,branch:'#698253',description:'Folhas longas, arqueadas, e algumas espigas.'},
 {id:'trevo_rasteiro',name:'Trevo rasteiro',group:'rasteiras',mode:'clover',shape:'coracao',structure:'trifoliada',leafCount:29,leafW:40,leafH:41,spread:110,height:32,flower:.08,petal:'#e5dcef',flex:.68,branch:'#537d42',description:'Folhas trifoliadas em pequenos caules horizontais.'},
 {id:'hera_rasteira',name:'Hera rasteira',group:'rasteiras',mode:'creeper',shape:'coracao',structure:'simples',leafCount:42,leafW:34,leafH:40,spread:119,height:42,flower:0,flex:.48,branch:'#4a613b',description:'Ramos rastejantes com folhas alternadas em nós.'},
 {id:'forracao',name:'Planta de forração',group:'rasteiras',mode:'carpet',shape:'eliptica',structure:'simples',leafCount:71,leafW:20,leafH:24,spread:117,height:28,flower:.07,petal:'#a9b9e3',flex:.35,branch:'#49733c',description:'Cobertura horizontal com folhas pequenas e densas.'},
 {id:'roseta',name:'Roseta herbácea',group:'rasteiras',mode:'rosette',shape:'lanceolada',structure:'simples',leafCount:25,leafW:36,leafH:92,spread:92,height:22,flower:0,flex:.32,branch:'#556b3c',description:'Folhas organizadas em espiral desde um centro basal.'},
 {id:'suculenta_baixa',name:'Suculenta baixa',group:'rasteiras',mode:'rosette',shape:'oval',structure:'simples',leafCount:24,leafW:36,leafH:62,spread:76,height:22,flower:0,flex:.12,branch:'#537566',description:'Folhas carnosas em camadas radiais compactas.'},
 {id:'cipó_rasteiro',name:'Cipó rasteiro',group:'rasteiras',mode:'creeper',shape:'lanceolada',structure:'simples',leafCount:35,leafW:23,leafH:48,spread:120,height:38,flower:.16,petal:'#e6b0a2',flex:.7,branch:'#647448',description:'Caules rastejantes ramificados com brotos nas pontas.'}
];
const INDEX=new Map(PRESETS.map(p=>[p.id,Object.freeze(p)]));
function hash32(str){let h=2166136261;for(const c of String(str))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
function seeded(seed){let a=(Number(seed)||0)>>>0;return()=>{a=(a+0x6d2b79f5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
function makePlant(options={}){
 const profile=INDEX.get(options.preset||'arbusto_denso');if(!profile)throw new Error('Preset desconhecido: '+options.preset);
 const seed=Number(options.seed??501)|0,rand=seeded(hash32(profile.id+':'+seed));
 const density=clamp(Number(options.density??1),.3,1.6),age=clamp(Number(options.age??1),.08,1);
 const season=options.season||'verao',drought=clamp(Number(options.drought??0),0,1);
 const growth=.2+.8*Math.sqrt(age),sway=profile.flex;
 const leaves=[],stems=[],flowers=[];
 const range=(a,b)=>a+(b-a)*rand();
 // Coordenadas locais 0..256 x 0..208; o pé está no centro inferior.
 function stem(x0,y0,x1,y1,w=2.3,shade=0){stems.push({x0,y0,x1,y1,w,shade});}
 function leaf(x,y,w,h,angle=0,variant=0,depth=0,flex=sway){
   leaves.push({x,y,w,h,angle,variant,depth,flex:clamp(flex,0,1),phase:range(0,TAU)});
 }
 function flower(x,y,size=4){flowers.push({x,y,size,phase:range(0,TAU)});}
 const n=Math.max(3,Math.round(profile.leafCount*density*(.25+.75*growth))),baseY=206;
 const bushWidth=profile.mode==='shrub'||profile.mode==='hedge'?1.25:1;
 if(profile.mode==='shrub'||profile.mode==='hedge'){
   const hedge=profile.mode==='hedge',W=profile.spread*growth,H=profile.height*growth;
   const tips=Math.max(10,Math.round(n/3.7));
   for(let b=0;b<tips;b++){
     const theta=range(-1.18,1.18),distance=Math.sqrt(rand());
     let tx=Math.sin(theta)*W*(.55+.52*distance),ty=baseY-H*(.38+.68*rand());
     if(hedge){tx=range(-W,W);ty=baseY-H*(.55+.45*rand());}
     const midX=tx*.44+range(-11,11),midY=baseY-H*.46;
     stem(0,baseY,midX,midY,range(1.5,3.8)*growth);
     stem(midX,midY,tx,ty,range(.8,1.9)*growth);
     for(let k=0;k<3;k++){
       const u=.6+k*.2,px=midX+(tx-midX)*u+range(-13,13),py=midY+(ty-midY)*u+range(-10,10);
       leaf(px,py,profile.leafW*range(.8,1.2)*growth*bushWidth,profile.leafH*range(.8,1.25)*growth*bushWidth,range(-160,160),Math.floor(rand()*4),py,range(.34,.82));
     }
   }
   while(leaves.length<n){
     const a=rand()*TAU,r=Math.sqrt(rand()),x=Math.cos(a)*W*r,y=baseY-H*.66+Math.sin(a)*H*.61*r;
     leaf(x,Math.min(baseY-9,y),profile.leafW*range(.7,1.2)*growth*bushWidth,profile.leafH*range(.78,1.18)*growth*bushWidth,range(-175,175),Math.floor(rand()*4),y);
   }
 }else if(profile.mode==='fern'){
   const fan=Math.max(5,n),spread=profile.spread*growth;
   for(let i=0;i<fan;i++){
     const a=i/fan*TAU+range(-.21,.21),r=range(.35,1),x=Math.sin(a)*spread*r,
       y=baseY-profile.height*growth*.72 + Math.cos(a)*profile.height*growth*.43*r;
     stem(0,baseY,x*.78,y+10,.85*growth);
     leaf(x,y,profile.leafW*growth*range(1,1.24),profile.leafH*growth*range(.9,1.22),a*180/Math.PI,Math.floor(rand()*4),y,.8);
   }
 }else if(profile.mode==='herb'){
   const stemsN=Math.max(4,Math.round(n/3.3)),sp=profile.spread*growth;
   for(let j=0;j<stemsN;j++){
     const theta=range(-.8,.8),height=range(.4,1)*profile.height*growth;
     const x=Math.sin(theta)*sp+range(-12,12),top=baseY-height;
     stem(0,baseY,x*.53,baseY-height*.55,range(1,2.5));stem(x*.53,baseY-height*.55,x,top,range(.7,1.7));
     for(let k=0;k<3;k++){
       const t=(k+1)/3.6,px=x*t,py=baseY-height*t,side=k%2?1:-1;
       leaf(px+side*range(7,24),py+range(-8,5),profile.leafW*growth*range(.78,1.2),profile.leafH*growth*range(.7,1.07),side*range(30,83),Math.floor(rand()*4),py);
     }
     if(profile.flower>0 && rand()<profile.flower*2.0)flower(x,top,range(3.5,6));
   }
   while(leaves.length<n){leaf(range(-sp,sp),range(baseY-profile.height*growth,baseY-9),profile.leafW*growth,profile.leafH*growth,range(-70,70),Math.floor(rand()*4));}
 }else if(profile.mode==='grass'){
   for(let j=0;j<n;j++){
     const a=range(-1.2,1.2),h=profile.leafH*range(.4,1.17)*growth,w=profile.leafW*range(.65,1.4)*growth;
     const x=Math.sin(a)*profile.spread*range(.25,.7)*growth,
       y=baseY-h*.49-Math.cos(a)*range(6,16);
     stem(range(-17,17),baseY,x*.7,y+h*.18,range(.5,1));
     leaf(x,y,w,h,a*180/Math.PI*.85,Math.floor(rand()*4),y,range(.72,.99));
     if(profile.flower>0 && rand()<profile.flower*.5)flower(x+Math.sin(a)*h*.5,y-h*.38,range(1.9,3.2));
   }
 }else if(profile.mode==='clover'||profile.mode==='carpet'){
   const count=n,sp=profile.spread*growth;
   for(let j=0;j<count;j++){
     const x=range(-sp,sp),py=range(baseY-65*growth,baseY-8),x0=x*range(.52,.86);
     if(j%3===0)stem(0,baseY,x0,py+6,range(.65,1.3));
     leaf(x,py,profile.leafW*growth*range(.7,1.2),profile.leafH*growth*range(.8,1.15),range(0,360),Math.floor(rand()*4),py,.65);
     if(profile.flower>0 && rand()<profile.flower)flower(x,py-9,range(2,4));
   }
 }else if(profile.mode==='creeper'){
   const stemsN=5,sp=profile.spread*growth;
   for(let branch=0;branch<stemsN;branch++){
     const dir=branch%2?1:-1,tipX=dir*range(sp*.48,sp),baseOffset=range(-16,16);
     let x=0,y=baseY-12+baseOffset;
     for(let j=0;j<8;j++){
       const k=(j+1)/8,nx=tipX*k,ny=baseY-20-28*(.5+.5*Math.sin(j*.73+branch))+baseOffset*.5;
       stem(x,y,nx,ny,range(.8,1.9));
       x=nx;y=ny;
       if(rand()<.95)leaf(nx+range(-5,5),ny+range(-9,6),profile.leafW*growth*range(.75,1.2),profile.leafH*growth*range(.75,1.17),range(-160,160),Math.floor(rand()*4),ny,.66);
       if(profile.flower>0&&rand()<profile.flower*.3)flower(nx,ny-9,3);
     }
   }
 }else if(profile.mode==='rosette'){
   for(let j=0;j<n;j++){
     const a=(j/n)*TAU+range(-.17,.17),radius=range(.16,.62)*profile.spread*growth;
     const x=Math.sin(a)*radius,y=baseY-42+Math.cos(a)*radius*.44;
     leaf(x,y,profile.leafW*growth*range(.8,1.18),profile.leafH*growth*range(.7,1.05),a*180/Math.PI,Math.floor(rand()*4),y,profile.flex);
   }
 }
 // In seasonal winter, herbaceous/ground plants remain but colours and size reflect phenotype.
 return {id:`${profile.id}-${seed}`,preset:profile.id,group:profile.group,profile,seed,season,density,age,drought,worldX:Number(options.worldX)||0,worldY:Number(options.worldY)||0,
   stems,leaves:leaves.sort((a,b)=>a.depth-b.depth),flowers,width:256,height:224,pivot:{x:128,y:206},
   metadata:{preset:profile.id,seed,season,age,density,drought,leafCount:leaves.length,stemCount:stems.length,flowerCount:flowers.length,
     shape:profile.shape,structure:profile.structure,source:'LeafEngine G3–G7 + LeafProductionRuntime G8'}};
}
class PlantRenderer{
 constructor({runtime=new LeafProductionRuntime({memoryMB:64,spriteSize:96,windFrames:1,variantCount:4}),windField=null}={}){
  if(!runtime)throw Error('PlantRenderer exige LeafProductionRuntime G8');this.runtime=runtime;
  this.windField=windField||runtime.windField||null;
 }
 leafConfig(plant,variant){return {shape:plant.profile.shape,structure:plant.profile.structure,size:96,
  seed:hash32(plant.preset+':folha:'+variant),palette:plant.season==='outono'?'outono':plant.season==='inverno'?'inverno':plant.season==='primavera'?'primavera':(plant.profile.mode==='fern'?'primavera':'floresta'),
  season:plant.season,seasonIntensity:.85,lifeProgress:clamp(.4+.35*plant.age,.05,.85),drought:plant.drought,
  pitch:(variant-1.5)*5,angle:0,tilt:0,variation:.48+variant*.07,texture:.68,veins:true,margin:'auto',marginDetail:.56,
  veinDensity:.82,veinContrast:.69,lightElevation:52,fold:.18,curvature:(variant-1.5)*.08,
  leafletCount:plant.profile.structure==='bipinada'?11:plant.profile.structure==='trifoliada'?3:7,
  leafletScale:1.0,leafletSpread:.8,windStrength:0,stem:false,deciduous:plant.group!=='rasteiras'};}
 prepare(plant){for(let variant=0;variant<4;variant++)this.runtime.requestSprite(this.leafConfig(plant,variant),{lod:0,priority:1});}
 sampleWind(plant,phase){if(!this.windField)return {vx:0,vy:0,strength:0};
  const p=hash32(plant.preset)%1000;return this.windField.sample(plant.worldX||p*.91+plant.seed%500,plant.worldY||780+p*.37,phase);
 }
 draw(ctx,plant,{x=0,y=0,scale=1,time=0,wind=0,guide=false}={}){
  const p=plant.profile,windFactor=clamp(Number(wind)||0,0,1),w=this.sampleWind(plant,time),
   gust=windFactor*clamp((Math.abs(w.vx)+Math.abs(w.vy))*.75,0,1.6);
  let ready=0,pending=0;
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.imageSmoothingEnabled=false;
  if(guide){ctx.strokeStyle='#3b514744';ctx.strokeRect(-127,-202,255,214);ctx.strokeStyle='#537d6855';ctx.beginPath();ctx.moveTo(-112,0);ctx.lineTo(112,0);ctx.stroke();}
  // Structural stem lines intentionally drawn once per frame; leaves themselves are cached G8 sprites.
  for(const s of plant.stems){
   const bend=(1-s.y1/224)*gust*(6+8*p.flex),bend0=(1-s.y0/224)*gust*(6+8*p.flex);
   ctx.strokeStyle=p.branch;ctx.lineWidth=Math.max(.65,s.w);ctx.lineCap='round';ctx.beginPath();
   ctx.moveTo(s.x0+bend0-0,s.y0-206);ctx.lineTo(s.x1+bend,s.y1-206);ctx.stroke();
  }
  const cache=new Map();for(const l of plant.leaves){
   let res=cache.get(l.variant);if(!res){res=this.runtime.requestSprite(this.leafConfig(plant,l.variant),{lod:0,priority:2});cache.set(l.variant,res)}
   if(res.status==='ready'||res.status==='atlas'){
     ready++;ctx.save();const sway=gust*l.flex*(8+.11*(206-l.y)) + windFactor*l.flex*Math.sin(time*TAU+ l.phase)*(2.5+gust*2),
       turn=gust*l.flex*.2*Math.sin(time*TAU+l.phase)+(windFactor*.045*l.flex*Math.sin(time*TAU*2+l.phase));
     ctx.translate(l.x+sway,l.y-206+gust*l.flex*2*Math.sin(l.phase+time*TAU));ctx.rotate(rad(l.angle)+turn);
     // Image is a genuine LeafEngine sprite, rotated/scaled as a reusable plant component.
     if(res.status==='ready')ctx.drawImage(res.canvas,-l.w/2,-l.h/2,l.w,l.h);
     else{const r=res.rect;ctx.drawImage(res.canvas,r.x,r.y,r.w,r.h,-l.w/2,-l.h/2,l.w,l.h)}
     ctx.restore();
   }else pending++;
  }
  for(const f of plant.flowers){
   const bx=f.x+gust*p.flex*4,by=f.y-206;
   ctx.fillStyle='#695d2f';ctx.fillRect(Math.round(bx-1),Math.round(by-1),3,3);
   ctx.fillStyle=p.petal||'#edcf9f';const r=Math.max(1,Math.round(f.size*.54));
   for(const [dx,dy] of [[-r,0],[r,0],[0,-r],[0,r]])ctx.fillRect(Math.round(bx+dx-r/2),Math.round(by+dy-r/2),r,r);
   ctx.fillStyle='#f5d679';ctx.fillRect(Math.round(bx),Math.round(by),2,2);
  }
  ctx.restore();return {ready,pending,total:plant.leaves.length};
 }
 renderToCanvas(plant,{width=320,height=240,wind=0,time=0}={}){
  const c=createCanvas(width,height);
  this.draw(c.getContext('2d'),plant,{x:width*.5,y:height*.90,scale:Math.min(width/290,height/235),wind,time});return c;
 }
}
export { PRESETS, makePlant, PlantRenderer, hash32 };
