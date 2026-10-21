/**  G2.5.4 engine, isolated per factory instance.
 * Leaf geometry and rasterization always provided by leaves-engine.
 * Original procedural algorithms preserved; no UI and no global mutation.
 */
import { createCanvas, LeafEngine, LeafProductionRuntime } from '../../leaves/index.js';
export function createTreeEngine({ canvasFactory } = {}) {
  const makeCanvas = canvasFactory || createCanvas;
  const global = { LeafEngine, LeafProduction: { LeafProductionRuntime } };

'use strict';
const W=256,H=256,PIVOT=Object.freeze({x:128,y:246}),TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(x)=>{x=clamp(x,0,1);return x*x*(3-2*x)};
const pt=(x,y,z)=>({x,y,z});
function hash(...xs){let h=2166136261>>>0;for(const n of xs){const s=String(n);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}h^=0x9e3779b9;h=Math.imul(h,2246822519)}return h>>>0}
function rand(seed){let x=seed>>>0;return()=>{x=(x+0x6d2b79f5)>>>0;let y=x;y=Math.imul(y^(y>>>15),y|1);y^=y+Math.imul(y^(y>>>7),y|61);return((y^(y>>>14))>>>0)/4294967296}}
const rrange=(r,a,b)=>lerp(a,b,r());
const SPECIES=Object.freeze({
 carvalho:{label:'Carvalho',architecture:'broadleaf',evergreen:false,adultHeight:194,crownRadius:79,trunkBase:23,canopyCenter:155,fruitType:'bolota'},
 pinheiro:{label:'Pinheiro',architecture:'conifer',evergreen:true,adultHeight:213,crownRadius:66,trunkBase:16,canopyCenter:148,fruitType:'pinha'},
 coqueiro:{label:'Coqueiro',architecture:'palm',evergreen:true,adultHeight:193,crownRadius:94,trunkBase:15,canopyCenter:184,fruitType:'coco'}
});
const palette={
 wood:['#24190f','#412b1b','#62432d','#8a6443','#ac8560'],
 broad:['#26311b','#34471f','#466229','#678734','#8ca84b','#afbf65'],
 fall:['#453018','#754021','#ad6126','#cb842c','#e7af49','#f7cc70'],
 pine:['#1d2d20','#293d29','#385334','#527245','#72965a','#98b477'],
 palm:['#23351d','#334b24','#466a2a','#608334','#87a847','#b6c46e'],
 palmDry:['#57451e','#79602a','#a0843b','#b2a05d','#c3ba78','#e3d494']
};

// G2.5.4 color system — palette extracted exclusively from supplied tree.zip.
// Exact references: oak, pine, birch, willow, autumn. Other 21 species use conservative analogues.
const G254_REF_PALETTES=Object.freeze({"carvalho":{"leaf":["#2b381b","#39481f","#435320","#506021","#607023","#778527","#9ca533"],"wood":["#3b2519","#4d3524","#583e2b","#674b36","#86674c"]},"pinheiro":{"leaf":["#233122","#293a27","#2e432b","#344a2e","#3d5532","#4d6738","#688341"],"wood":["#362418","#422d1f","#4f3726","#5d432e","#76573f"]},"bétula":{"leaf":["#515318","#5e611c","#686a1f","#737622","#818328","#939431","#acad49"],"wood":["#443125","#5e4a3a","#6d5948","#8a7565","#d2c1b1"]},"salgueiro":{"leaf":["#363915","#454817","#525519","#62641c","#757821","#8e902e","#abac51"],"wood":["#3f2a1d","#523b29","#59412e","#634935","#82664b"]},"outonal":{"leaf":["#79491b","#716121","#846821","#b17220","#c68521","#d69526","#e8b038"],"wood":["#392418","#4d3524","#573d2b","#654a37","#82654b"]}});
const G254_REF_MAP=Object.freeze({"carvalho":"carvalho","pinheiro":"pinheiro","bétula":"bétula","salgueiro":"salgueiro","palmeira":"carvalho","acer":"bétula","cedro":"pinheiro","sicomoro":"carvalho","picea":"pinheiro","baoba":"salgueiro","olmo":"carvalho","abeto":"pinheiro","macieira":"carvalho","laranjeira":"carvalho","limoeiro":"carvalho","mangueira":"carvalho","bananeira":"carvalho","coqueiro":"carvalho","oliveira":"bétula","cerejeira":"bétula","figueira":"carvalho","goiabeira":"salgueiro","amoreira":"carvalho","abacateiro":"carvalho","cajueiro":"salgueiro","jabuticabeira":"pinheiro"});
const G254_REF_WEIGHTS=Object.freeze({"bétula":0.84,"carvalho":1,"pinheiro":1,"salgueiro":1,"cedro":0.72,"picea":0.82,"abeto":0.8,"acer":0.65,"oliveira":0.55,"cerejeira":0.65,"bananeira":0.64,"coqueiro":0.62,"palmeira":0.58,"jabuticabeira":0.65});
let G254_COLOR_CONTEXT={enabled:true,strength:.88,species:'carvalho',season:'normal'};
function g254RGB(hex){return [parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)]}
function g254Hex(rgb){return '#'+rgb.map(x=>Math.max(0,Math.min(255,Math.round(x))).toString(16).padStart(2,'0')).join('')}
function g254Blend(a,b,t){const x=g254RGB(a),y=g254RGB(b);return g254Hex([lerp(x[0],y[0],t),lerp(x[1],y[1],t),lerp(x[2],y[2],t)])}
function g254Target(species,kind='leaf'){
 if(!G254_COLOR_CONTEXT.enabled)return null;
 const id=species||G254_COLOR_CONTEXT.species;
 const deciduous=id==='carvalho'||(!['pinheiro','coqueiro'].includes(id)&&typeof G251_SPECIES!=='undefined'&&G251_SPECIES[id]?.deciduous);
 const ref=(kind==='leaf'&&G254_COLOR_CONTEXT.season==='outono'&&deciduous)?'outonal':G254_REF_MAP[id]||'carvalho';
 return G254_REF_PALETTES[ref][kind];
}
function g254PaletteAmount(species,kind='leaf'){
 if(!G254_COLOR_CONTEXT.enabled)return 0;
 const id=species||G254_COLOR_CONTEXT.species;
 const weight=G254_REF_WEIGHTS[id]??.66;
 return Math.max(0,Math.min(1,G254_COLOR_CONTEXT.strength*(kind==='wood'&&id==='bétula'?.45:weight)));
}
function g254RemapPalette(src,target,amount){
 if(!src||!target||amount<=0)return src;
 const n=src.length;
 return src.map((hex,i)=>{
   const p=i*(target.length-1)/Math.max(1,n-1),j=Math.floor(p);
   const color=g254Blend(target[j],target[Math.min(target.length-1,j+1)],p-j);
   return g254Blend(hex,color,amount);
 });
}
function g254MaterialPalette(src,kind='leaf',species=null){
 return g254RemapPalette(src,g254Target(species,kind),g254PaletteAmount(species,kind));
}
function g254RetoneLeafSprite(sprite,species){
 const sourcePalette=g254Target(species,'leaf'),amount=g254PaletteAmount(species,'leaf');
 if(!sprite||!sourcePalette||amount<=.005)return sprite;
 const w=sprite.width,h=sprite.height,source=sprite.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h);
 const c=makeCanvas(1,1);c.width=w;c.height=h;
 const ct=c.getContext('2d',{willReadFrequently:true});const data=source.data;
 let min=255,max=0;
 for(let i=0;i<data.length;i+=4){if(data[i+3]<32)continue;
  const lum=data[i]*.21+data[i+1]*.72+data[i+2]*.07;
  min=Math.min(min,lum);max=Math.max(max,lum);
 }
 const range=Math.max(28,max-min);
 const rgb=sourcePalette.map(g254RGB);
 for(let i=0;i<data.length;i+=4){if(data[i+3]<32)continue;
  const luminance=data[i]*.21+data[i+1]*.72+data[i+2]*.07;
  const f=Math.max(0,Math.min(1,(luminance-min)/range));
  const k=f*(rgb.length-1),j=Math.floor(k),s=k-j;
  const a=rgb[j],b=rgb[Math.min(rgb.length-1,j+1)];
  // Pixel-for-pixel luminance mapping. Retains original leaf anatomy, alpha and vein contrast.
  for(let ch=0;ch<3;ch++)data[i+ch]=Math.round(lerp(data[i+ch],lerp(a[ch],b[ch],s),amount));
 }
 ct.putImageData(source,0,0);return c;
}

const add=(a,b)=>pt(a.x+b.x,a.y+b.y,a.z+b.z);
const mix3=(a,b,t)=>pt(lerp(a.x,b.x,t),lerp(a.y,b.y,t),lerp(a.z,b.z,t));
const polar=(angle,radius,z)=>pt(Math.cos(angle)*radius,Math.sin(angle)*radius,z);
function create(args={}){
 const species=String(args.species||'carvalho');if(!SPECIES[species])throw Error('Espécie inválida: '+species);
 const seed=(Number(args.seed)||1947)>>>0;
 const rng=rand(hash(seed,species,'skeleton-g1'));
 const profile=SPECIES[species], nodes=[];
 // Persistent trunk curve in 3D, shared across every growth/season/fenology state.
 const lean=species==='coqueiro'?rrange(rng,18,26)*(rng()>.5?1:-1):rrange(rng,-7,7),leanY=species==='coqueiro'?rrange(rng,-11,11):rrange(rng,-6,6);
 for(let i=0;i<=9;i++){
  const t=i/9;const w=Math.sin(Math.PI*t*.92);
  nodes.push({id:'t'+i,type:'trunk',t,p:pt(lean*t*t+Math.sin(t*5)*w*1.3,leanY*t*t,profile.adultHeight*t),radius:lerp(profile.trunkBase/2,1.8,t**.8)});
 }
 const branches=[];
 if(species==='carvalho'){
  // Heterogeneous radial branches: opposite sides AND far/near segments.
  for(let i=0;i<43;i++){
   const level=i/42,anchor=rrange(rng,.33,.84)+level*.10;
   const az=i*2.39996+rrange(rng,-.40,.40);
   const spread=rrange(rng,32,74)*(i<5?.7:1)*(1-.16*level), rise=rrange(rng,14,53);
   const birth=clamp(.14+anchor*.64+rrange(rng,-.035,.015),.20,.83);
   branches.push({id:'oak'+i,type:'bough',anchor,az,spread,rise,curve:rrange(rng,-10,10),radius:rrange(rng,1.7,4.1)*(1-.55*level),birth,foliageSeed:hash(seed,'foliage',i),depthRank:Math.sin(az)});
  }
 }else if(species==='pinheiro'){
  for(let tier=0;tier<12;tier++){
   const anchor=.27+tier*.055,spread=(63-tier*4.6)*rrange(rng,.81,1.13);
   const count=5+(tier%3===1?1:0);
   const baseAz=rrange(rng,0,TAU);
   for(let k=0;k<count;k++){
    const az=baseAz+k*TAU/count+rrange(rng,-.17,.17);
    branches.push({id:`whorl${tier}-${k}`,type:'whorl',anchor,az,spread,rise:rrange(rng,6,13)+Math.max(0,Math.sin(az))*18,curve:rrange(rng,-3,4),radius:lerp(2.9,.85,tier/12),birth:clamp(.09+anchor*.70,.18,.84),foliageSeed:hash(seed,'needle',tier,k),depthRank:Math.sin(az)});
   }
  }
 }else{
  for(let i=0;i<13;i++){
   const az=i*TAU/13+rrange(rng,-.11,.11),spread=rrange(rng,67,100);
   branches.push({id:'frond'+i,type:'frond',anchor:.98,az,spread,rise:rrange(rng,14,31),curve:rrange(rng,12,22),radius:1.8,birth:clamp(.10+i*.041,.12,.72),foliageSeed:hash(seed,'palm-leaf',i),depthRank:Math.sin(az)});
  }
 }
 const organSites=[];
 // Stable 3D botanical anchors assigned ONCE per individual, independently of phenology.
 for(const b of branches){
  if(species==='pinheiro' && !b.id.startsWith('whorl'))continue;
  const count=species==='coqueiro'?1:(hash(seed,b.id,'site-count')%3===0?2:1);
  for(let j=0;j<count;j++){
   const sr=rand(hash(seed,b.id,'organ',j));
   organSites.push({id:'organ:'+b.id+':'+j,branchId:b.id,t:.73+sr()*.26,
    offset:pt(rrange(sr,-3.5,3.5),rrange(sr,-3.5,3.5),rrange(sr,-4,3)),seed:hash(seed,'organ-sprite',b.id,j),
    kind:species==='coqueiro'?'coco':species==='pinheiro'?'pinha':'bolota'});
  }
 }
 // G2.2: persistent second-order shoots, with positions and birth times
 // attached to existing primary bough IDs. The old G2.1.3 renderer ignores
 // these data; changing growth or camera never re-samples this hierarchy.
 const secondarySites=[];
 if(species==='carvalho'){
  for(const b of branches){
   const sr=rand(hash(seed,'g22-secondary',b.id));
   const n=b.anchor<.56?3:2;
   for(let j=0;j<n;j++){
    const side=j%2?-1:1,offset=rrange(sr,.38,.94)*side;
    secondarySites.push({id:'sub:'+b.id+':'+j,parentId:b.id,
     at:.43+.42*(j+sr()*.42)/n,angleOffset:offset,
     spread:rrange(sr,13,29)*(1-.22*b.anchor),rise:rrange(sr,1,18),
     twist:rrange(sr,-8,8),birth:clamp(b.birth+.10+sr()*.09,.28,.91),
     foliageSeed:hash(seed,'subfoliage',b.id,j)});
   }
  }
 }
 // G2.3.1: organogenic trunk DNA is sampled once per individual.
 // These controls are not regenerated by growth, camera or season.
 const cr=rand(hash(seed,species,'g231-organic-centerline'));
 const trunkOrganic={schema:'trunk-identity/1.0',
   bendX:[rrange(cr,-1,1),rrange(cr,-1,1),rrange(cr,-1,1)],
   bendY:[rrange(cr,-1,1),rrange(cr,-1,1),rrange(cr,-1,1)],
   twist:rrange(cr,-1,1),barkPhase:rrange(cr,0,TAU),
   scarSites:Array.from({length:15},(_,i)=>({t:.12+i*.053+rrange(cr,-.025,.025),
     side:rrange(cr,-.84,.84),size:rrange(cr,1.1,3.6),seed:hash(seed,'g231-scar',i)}))};
 // G2.4.2: persistent leaf attachment points, generated once in the tree DNA.
 // Each leaf is associated with a real woody branch or frond, never a random screen-space pixel.
 const foliageSites=[];
 const sources=species==='carvalho'?branches.concat(secondarySites):branches;
 for(const b of sources){
  const n=species==='carvalho'?(b.id.startsWith('sub:')?9:7):species==='pinheiro'?12:58;
  const lr=rand(hash(seed,'g242-leaf-site',b.id));
  for(let i=0;i<n;i++){
   // Palm frond: exact persistent attachment at leaflet index j=2..30 and side.
   const u=species==='coqueiro'?(2+Math.floor(i/2))/32:rrange(lr,.42,.99);
   const side=species==='coqueiro'?(i%2===0?-1:1):(lr()>.5?-1:1);
   foliageSites.push({id:'leaf:'+b.id+':'+i,branchId:b.id,u,side,
    normal:rrange(lr,-1,1),lift:rrange(lr,-1,1),angle:rrange(lr,-1.2,1.2),
    size:rrange(lr,.72,1.28),priority:lr(),seed:hash(seed,'g242-leaf-genome',b.id,i),
    birth:clamp(b.birth+(species==='coqueiro'?0:.03)+rrange(lr,0,.095),.13,.96)});
  }
 }
 const morphology={schema:'tree-morphology/2.4.4',secondarySites,trunkOrganic,foliageSites,
  whorlJitterSeed:hash(seed,'whorl-growth'),frondCurveSeed:hash(seed,'frond-growth')};
 // Persistent three-dimensional lianas. No vine positions are resampled by state:
 // sites are bound to branch IDs, have deterministic priorities and mature with their hosts.
 // Two types: a pendant attached to one branch and a catenary bridge between neighbours.
 const vineSites=[];
 if(species==='carvalho'){
  const eligible=branches.filter(b=>b.birth<.68 && b.anchor>.46);
  // Mix front and rear positions; front-facing attachments take priority at low density.
  const ordered=eligible.slice().sort((a,b)=>{
    const av=(a.depthRank>=0?0:1), bv=(b.depthRank>=0?0:1);
    return av-bv || (hash(seed,'liana-rank',a.id)-hash(seed,'liana-rank',b.id));
  });
  for(let k=0;k<Math.min(18,ordered.length);k++){
   const a=ordered[(k*5)%ordered.length];
   if(!a)continue;
   const rngV=rand(hash(seed,'liana',a.id,k));
   const requestedBridge=(k%3===2);
   let b=null;
   if(requestedBridge){
    const neighbors=eligible.filter(x=>x.id!==a.id && Math.abs(x.anchor-a.anchor)<.19 &&
      Math.abs(Math.atan2(Math.sin(x.az-a.az),Math.cos(x.az-a.az)))>.28 &&
      Math.abs(Math.atan2(Math.sin(x.az-a.az),Math.cos(x.az-a.az)))<1.5);
    if(neighbors.length) b=neighbors[Math.floor(rngV()*neighbors.length)];
   }
   vineSites.push({id:'vine:'+k,kind:b?'bridge':'pendant',aId:a.id,bId:b?.id||null,
     fromT:.58+.31*rngV(),toT:.61+.24*rngV(),
     hang:51+24*rngV(),sway:(rngV()-.5)*12,
     seed:hash(seed,'vine',k)});
  }
 }


 // G2.4.4 — persistent ivy types independent of the older pendant/bridge sites.
 // No effect on legacy renderers. 3D geometry is generated from these site IDs.
 if(species==='carvalho'){
  const profile=rand(hash(seed,'g244-liana-biology'));
  morphology.vineGrowthSites=[];
  for(let i=0;i<8;i++){
   const source=branches[(i*7+2)%branches.length];
   morphology.vineGrowthSites.push({id:'spiral:'+i,kind:i%3===1?'ground':'spiral',branchId:source.id,
    at:rrange(profile,.61,.92),stemT:rrange(profile,.46,.78),
    turns:rrange(profile,1.3,3.8),radiusOffset:rrange(profile,.6,2.1),
    phase:rrange(profile,0,TAU),groundLength:rrange(profile,9,20),
    birth:rrange(profile,.51,.68),seed:hash(seed,'g244-liana-spire',i)});
  }
 }

 return {schema:'tree-skeleton/1.1',engineVersion:'0.8.0',species,seed,pivot:{...PIVOT},profileVersion:5,trunk:nodes,branches,organSites,vineSites,morphology};
}
function buildCamera(angle=42){
 const number=Number(angle);const a=clamp(Number.isFinite(number)?number:42,0,70)*Math.PI/180;
 return {elevation:Math.round(a*180/Math.PI),groundDepth:Math.sin(a),verticalHeight:Math.cos(a)};
}
function project(p,camera=buildCamera(42)){
 return {x:PIVOT.x+p.x*.982+p.y*.10,
         y:PIVOT.y+p.y*camera.groundDepth*.77 +p.x*.045-p.z*camera.verticalHeight};
}
// Juvenile cambial expansion is slower than height/canopy growth.
// Thickness is a dimensionless scale, not a regeneration of the adult skeleton.
// At growth=1 it equals exactly 1 (no adult changes). Seedlings and juveniles
// have narrow bases instead of inheriting a disproportionate adult root flare.
function growthShape(g){
 g=clamp(Number(g),.03,1);
 // Height starts near ground rather than inheriting 18% of adult height.
 // At 5% growth: ~8-12 projected pixels of stem before leaves (50° camera).
 // Adult dimensions remain mathematically identical at growth=1.
 return {growth:g,vertical:g**.85,horizontal:.21+.79*g**.78,
         thickness:.10+.90*g**1.40};
}
function structure(tree,growth=1){
 const g=growthShape(growth),profile=SPECIES[tree.species],zScale=g.vertical,rScale=g.horizontal;
 const trunk=tree.trunk.map(t=>({...t,p:pt(t.p.x*rScale,t.p.y*rScale,t.p.z*zScale),radius:t.radius*g.thickness}));
 const visible=[];
 function sample(t){const idx=Math.min(trunk.length-2,Math.floor(t*(trunk.length-1))),s=t*(trunk.length-1)-idx;return mix3(trunk[idx].p,trunk[idx+1].p,s)}
 for(const b of tree.branches){
  const show=smooth((growth-b.birth)/Math.max(.001,1-b.birth));if(show<=0)continue;
  const from=sample(b.anchor),stretch=show*(.54+.46*growth**.30);
  const len=b.spread*rScale*stretch,rise=b.rise*zScale*stretch;
  const to=add(from,polar(b.az,len,rise));
  let mid=add(mix3(from,to,.52),pt(Math.cos(b.az+Math.PI/2)*b.curve*.25,Math.sin(b.az+Math.PI/2)*b.curve*.25,tree.species==='coqueiro'?Math.abs(b.curve)*stretch:5*stretch));
  if(b.type==='frond')mid=pt(mid.x,mid.y,mid.z+18*zScale);
  visible.push({...b,from,mid,to,show,radius:b.radius*g.thickness});
 }
 return {tree,profile,g,trunk,visible,apex:sample(1)};
}
// G2.3.1: botanical trunk centerline. Catmull-Rom interpolation preserves the
// original permanent nodes while introducing seed-derived, smooth lateral drift.
// The baseline G2.2 skeleton and renderer remain untouched by quality='g22'.
const TRUNK_FORMS=Object.freeze({
 carvalho:{sway:6.2,twist:2.5,flare:.39,roughness:.075},
 pinheiro:{sway:2.8,twist:1.1,flare:.15,roughness:.035},
 coqueiro:{sway:5.1,twist:2.0,flare:.18,roughness:.025}
});
function g231Catmull(a,b,c,d,t){return b+0.5*t*(c-a+t*(2*a-5*b+4*c-d+t*(3*(b-c)+d-a)))}
function g231Evaluate(tree,g,t,organic=1,flare=1){
 const nodes=tree.trunk,N=nodes.length-1,u=clamp(t,0,1)*N,i=Math.min(N-1,Math.floor(u)),a=u-i;
 const p0=nodes[Math.max(0,i-1)].p,p1=nodes[i].p,p2=nodes[i+1].p,p3=nodes[Math.min(N,i+2)].p;
 const base=pt(g231Catmull(p0.x,p1.x,p2.x,p3.x,a),g231Catmull(p0.y,p1.y,p2.y,p3.y,a),g231Catmull(p0.z,p1.z,p2.z,p3.z,a));
 const m=tree.morphology?.trunkOrganic||{bendX:[0,0,0],bendY:[0,0,0],twist:0};
 const spec=(typeof G251_TRUNK_FORMS!=='undefined' && G251_TRUNK_FORMS[tree.catalogSpecies||tree.species])||TRUNK_FORMS[tree.species]||TRUNK_FORMS.carvalho;
 const env=Math.pow(Math.sin(Math.PI*t),.84); // fixed root and crown anchors
 const phase=t*TAU;
 const dx=env*spec.sway*(m.bendX[0]*Math.sin(phase*.62)+m.bendX[1]*.43*Math.sin(phase*1.75)+m.bendX[2]*.16*Math.sin(phase*3.1));
 const dy=env*spec.sway*(m.bendY[0]*Math.sin(phase*.71)+m.bendY[1]*.35*Math.sin(phase*1.55)+m.bendY[2]*.14*Math.sin(phase*2.75));
 const x=(base.x+dx*organic)*g.horizontal,y=(base.y+dy*organic)*g.horizontal,z=base.z*g.vertical;
 const baseRadius=lerp(nodes[i].radius,nodes[i+1].radius,a)*g.thickness;
 // A swelling root collar is a mature feature, absent in tiny seedlings.
 const maturity=smooth((g.growth-.28)/.59),basal=1+spec.flare*flare*maturity*Math.exp(-t/.075);
 const ridges=1+organic*spec.roughness*maturity*(Math.sin(t*20+m.twist*4)+.43*Math.cos(t*39+m.twist*2));
 return {p:pt(x,y,z),radius:Math.max(.12,baseRadius*basal*ridges),t};
}
function g231Structure(tree,growth=1,params={}){
 const st=structure(tree,growth),organic=clamp(Number(params.trunkOrganic??.78),0,1),flare=clamp(Number(params.basalFlare??.72),0,1);
 // Target 3.5px between samples on the projected trunk, avoiding subpixel
 // disappearance when the sapling is only 5% of adult height.
 const n=clamp(Math.round(st.profile.adultHeight*st.g.vertical*.72/3.4),4,36);
 const arr=Array.from({length:n+1},(_,i)=>({id:'o'+i,type:'trunk',...g231Evaluate(tree,st.g,i/n,organic,flare)}));
 function oldAt(t){const trunk=st.trunk,q=t*(trunk.length-1),i=Math.min(trunk.length-2,Math.floor(q));return mix3(trunk[i].p,trunk[i+1].p,q-i)}
 const rebased=st.visible.map(b=>{
   const delta=add(g231Evaluate(tree,st.g,b.anchor,organic,flare).p,pt(-oldAt(b.anchor).x,-oldAt(b.anchor).y,-oldAt(b.anchor).z));
   return {...b,from:add(b.from,delta),mid:add(b.mid,delta),to:add(b.to,delta)};
 });
 return {...st,trunk:arr,visible:rebased,apex:arr[arr.length-1].p,
   organic:{enabled:true,strength:organic,basalFlare:flare,maturity:smooth((st.g.growth-.28)/.59),
    params:tree.morphology?.trunkOrganic}};
}
function g231Trunk(ctx,st,cam,params,colors){
 const nodes=st.trunk;
 if(nodes.length<2)return;
 const samples=nodes.map((n,i)=>{
  const p=project(n.p,cam);
  const prev=project(nodes[Math.max(0,i-1)].p,cam),next=project(nodes[Math.min(nodes.length-1,i+1)].p,cam);
  const dx=next.x-prev.x,dy=next.y-prev.y,length=Math.max(.01,Math.hypot(dx,dy));
  const nx=-dy/length,ny=dx/length;
  return {p,nx,ny,r:Math.max(.46,n.radius)};
 });
 const footLimit=st.tree.catalogSpecies?252:Infinity;
 const left=samples.map(s=>({x:s.p.x+s.nx*s.r,y:Math.min(footLimit,s.p.y+s.ny*s.r)}));
 const right=samples.map(s=>({x:s.p.x-s.nx*s.r,y:Math.min(footLimit,s.p.y-s.ny*s.r)}));
 const outline=left.concat(right.slice().reverse());
 const wood=colors;
 poly(ctx,outline,wood[0]);
 ctx.save();ctx.beginPath();ctx.moveTo(Math.round(outline[0].x),Math.round(outline[0].y));
 for(let i=1;i<outline.length;i++)ctx.lineTo(Math.round(outline[i].x),Math.round(outline[i].y));
 ctx.closePath();ctx.clip();
 const band=(lo,hi,color)=>{
  const p0=samples.map(s=>({x:s.p.x+s.nx*s.r*lo,y:s.p.y+s.ny*s.r*lo}));
  const p1=samples.slice().reverse().map(s=>({x:s.p.x+s.nx*s.r*hi,y:s.p.y+s.ny*s.r*hi}));
  poly(ctx,p0.concat(p1),color);
 };
 const species=st.tree.catalogSpecies||st.tree.species;
 if(species==='carvalho'){
  band(-.98,.96,wood[2]); band(.16,.84,wood[1]); band(-.90,-.42,wood[0]); band(-.18,.02,wood[3]);
 }else if(species==='pinheiro'){
  band(-.98,.96,wood[2]); band(.24,.86,wood[1]); band(-.82,-.46,wood[0]); band(-.08,.06,wood[3]);
 }else{
  band(-.98,.96,wood[2]); band(.18,.92,wood[1]); band(-.88,-.40,wood[0]); band(-.12,.02,wood[3]);
 }
 const r=rand(hash(st.tree.seed,'g233-bark-art',species));
 const amount=clamp(Number(params.barkTexture??1),0,1);
 if(amount>.02){
  if(species==='carvalho'){
   const lanes=6;
   for(let lane=0;lane<lanes;lane++){
    const side=lerp(-.58,.36,lanes<=1?0:lane/(lanes-1))+rrange(r,-.04,.04);
    for(let i=0;i<samples.length-1;i++){
      const s0=samples[i],s1=samples[i+1];
      const bend=Math.sin((i+lane)*.72+r()*TAU)*.05;
      const p0={x:s0.p.x+s0.nx*s0.r*(side+bend),y:s0.p.y+s0.ny*s0.r*(side+bend)};
      const p1={x:s1.p.x+s1.nx*s1.r*(side+bend*.8),y:s1.p.y+s1.ny*s1.r*(side+bend*.8)};
      const w=Math.max(1,(s0.r+s1.r)*.07*.5*amount);
      if((i+lane)%3!==1 || r()>.45)line(ctx,p0,p1,lane%2?wood[0]:wood[1],w);
      if((i+lane)%2===0 && r()>.28)line(ctx,{x:p0.x+1,y:p0.y-.5},{x:p1.x+1,y:p1.y-.5},wood[4],1);
    }
   }
   const plates=10+Math.round(6*st.g.vertical);
   for(let i=0;i<plates;i++){
    const t=(i+.35)/plates,q=Math.min(samples.length-2,Math.floor(t*(samples.length-1))),s=samples[q],side=rrange(r,-.6,.36);
    const at={x:s.p.x+s.nx*s.r*side,y:s.p.y+s.ny*s.r*side};
    const h=2.8+r()*5.5,w=1+r()*2.2;
    poly(ctx,[{x:at.x-w,y:at.y-.4},{x:at.x+.8,y:at.y-h*.35},{x:at.x+w,y:at.y+.6},{x:at.x-.5,y:at.y+h*.55}],r()>.48?wood[1]:wood[3]);
    line(ctx,{x:at.x-w,y:at.y},{x:at.x-w,y:at.y+h*.45},wood[0],1);
   }
  }else if(species==='pinheiro'){
   const lanes=8;
   for(let lane=0;lane<lanes;lane++){
    const side=lerp(-.54,.30,lanes<=1?0:lane/(lanes-1))+rrange(r,-.025,.025);
    for(let i=0;i<samples.length-1;i++){
      const s0=samples[i],s1=samples[i+1];
      const p0={x:s0.p.x+s0.nx*s0.r*side,y:s0.p.y+s0.ny*s0.r*side};
      const p1={x:s1.p.x+s1.nx*s1.r*(side+Math.sin((i+lane)*.45)*.02),y:s1.p.y+s1.ny*s1.r*(side+Math.sin((i+lane)*.45)*.02)};
      const w=Math.max(1,(s0.r+s1.r)*.055*.5*amount);
      if((i+lane)%4!==2 || r()>.55)line(ctx,p0,p1,lane%2?wood[0]:wood[1],w);
      if(r()>.44)line(ctx,{x:p0.x+1,y:p0.y-.2},{x:p1.x+1,y:p1.y-.2},wood[4],1);
    }
   }
   const scales=14+Math.round(4*st.g.vertical);
   for(let i=0;i<scales;i++){
    const t=(i+.42)/scales,q=Math.min(samples.length-2,Math.floor(t*(samples.length-1))),s=samples[q],side=rrange(r,-.55,.28);
    const at={x:s.p.x+s.nx*s.r*side,y:s.p.y+s.ny*s.r*side};
    poly(ctx,[{x:at.x-1,y:at.y},{x:at.x+1.2,y:at.y-1.2},{x:at.x+1.8,y:at.y+1.1},{x:at.x-.4,y:at.y+1.7}],r()>.52?wood[1]:wood[3]);
    if(r()>.66)line(ctx,{x:at.x-1,y:at.y+.3},{x:at.x+1.1,y:at.y+.3},wood[4],1);
   }
   const resin=2+Math.floor(3*st.g.vertical);
   for(let i=0;i<resin;i++){
    const t=(i+.5)/(resin+1),q=Math.min(samples.length-2,Math.floor(t*(samples.length-1))),s=samples[q],side=rrange(r,-.18,.22);
    const x=s.p.x+s.nx*s.r*side,y=s.p.y+s.ny*s.r*side;
    ellipse(ctx,x,y,Math.max(1,s.r*.18),Math.max(1.2,s.r*.24),wood[4]);
    line(ctx,{x:x-1,y:y-1},{x:x+1,y:y+1},wood[1],1);
   }
  }else if(species==='coqueiro'){
   const rings=Math.max(8,Math.round(14*st.g.vertical));
   for(let i=0;i<rings;i++){
    const t=(i+.4)/rings,q=Math.min(samples.length-2,Math.floor(t*(samples.length-1))),s=samples[q];
    const w=Math.max(2,s.r*1.65),drift=rrange(r,-.12,.12)*w;
    const yoff=(i%3===0)?-1:0;
    line(ctx,{x:s.p.x-s.nx*w*.60+drift,y:s.p.y-s.ny*w*.60+yoff},{x:s.p.x+s.nx*w*.58+drift,y:s.p.y+s.ny*w*.58+yoff},i%2?wood[0]:wood[1],1);
    line(ctx,{x:s.p.x-s.nx*w*.42+drift,y:s.p.y-s.ny*w*.42+1+yoff},{x:s.p.x+s.nx*w*.40+drift,y:s.p.y+s.ny*w*.40+1+yoff},wood[4],1);
   }
   const fibers=16+Math.round(10*st.g.vertical);
   for(let i=0;i<fibers;i++){
    const t=(i+.18)/fibers,q=Math.min(samples.length-2,Math.floor(t*(samples.length-1))),s=samples[q];
    const side=rrange(r,-.48,.34),p={x:s.p.x+s.nx*s.r*side,y:s.p.y+s.ny*s.r*side};
    line(ctx,p,{x:p.x+rrange(r,-1,1),y:p.y-rrange(r,2.5,6)},r()>.55?wood[1]:wood[3],1);
   }
   const scars=5+Math.round(4*st.g.vertical);
   for(let i=0;i<scars;i++){
    const t=(i+.4)/(scars+1),q=Math.min(samples.length-2,Math.floor(t*(samples.length-1))),s=samples[q];
    const center={x:s.p.x+s.nx*s.r*rrange(r,-.05,.05),y:s.p.y+s.ny*s.r*rrange(r,-.05,.05)};
    line(ctx,{x:center.x-s.r*.55,y:center.y-1},{x:center.x+s.r*.18,y:center.y+1},wood[0],1);
    line(ctx,{x:center.x+s.r*.18,y:center.y+1},{x:center.x+s.r*.52,y:center.y-1},wood[0],1);
   }
  }
  if(species!=='coqueiro'&&st.g.growth>.30){
   for(const scar of st.tree.morphology?.trunkOrganic?.scarSites||[]){
    if(hash(st.tree.seed,scar.seed,'visible')%100>68)continue;
    const q=Math.min(samples.length-1,Math.floor(scar.t*(samples.length-1))),s=samples[q];
    const x=s.p.x+s.nx*s.r*scar.side,y=s.p.y+s.ny*s.r*scar.side;
    if(s.r<1.5)continue;
    const rx=species==='carvalho'?Math.min(s.r*.42,scar.size*.62):Math.min(s.r*.32,scar.size*.48);
    const ry=species==='carvalho'?Math.min(2.8,scar.size*.72):Math.min(2.1,scar.size*.5);
    ellipse(ctx,x,y,rx*amount,ry*amount,species==='carvalho'?wood[0]:wood[1]);
    line(ctx,{x:x-1,y:y-1},{x:x+1,y:y-2},wood[4],1);
    if(species==='carvalho'||r()>.46)line(ctx,{x:x-1,y:y},{x:x+1,y:y+1},wood[3],1);
   }
  }
 }
 if(st.tree.catalogSpecies && Number(params.barkTexture??1)>0){
  const actual=st.tree.catalogSpecies,bot=g25SpeciesProfile(actual);
  const tex=barkTexture(actual,st.tree.seed,0);
  ctx.save();ctx.globalAlpha=(bot?.barkFamily==='birch'?.60:bot?.barkFamily==='pseudostem'?.55:.36)*clamp(Number(params.barkTexture??1),0,1);
  ctx.fillStyle=ctx.createPattern(tex,'repeat');
  const minX=Math.min(...outline.map(p=>p.x)),maxX=Math.max(...outline.map(p=>p.x));
  const minY=Math.min(...outline.map(p=>p.y)),maxY=Math.max(...outline.map(p=>p.y));
  ctx.fillRect(Math.floor(minX)-1,Math.floor(minY)-1,Math.ceil(maxX-minX)+3,Math.ceil(maxY-minY)+3);
  ctx.restore();
 }
 ctx.restore();
 if(st.organic?.maturity>.12){
  const base=samples[0],reach=Math.min(4.8,st.organic.maturity*4.4);
  if(species==='carvalho'||species==='pinheiro')for(let k=-1;k<=1;k+=2){
   const ex={x:base.p.x+k*(base.r*.70+reach),y:Math.min(249,base.p.y+1.0)};
   const start={x:base.p.x+k*base.r*.34,y:base.p.y-3.1*st.organic.maturity};
   line(ctx,start,ex,wood[k>0?1:2],Math.max(1,base.r*.20*st.organic.maturity));
   line(ctx,{x:start.x-.5,y:start.y-.5},{x:ex.x-.5,y:ex.y-.2},wood[0],1);
  }
 }
}

const G252_WOOD_PALETTES=Object.freeze({
 birch:['#302d29','#666057','#b4a99d','#e0d7c9','#faf7ef'],
 smoothMottled:['#382b22','#5c4938','#8c6d55','#b6a18a','#e0d2be'],
 baobab:['#4a3020','#71503a','#9c7658','#be9775','#dbc0a0'],
 pseudostem:['#26371d','#4b6833','#779555','#acc384','#d6dfb5'],
 willow:['#2a2117','#493828','#6f573d','#98775b','#c2aa87'],
 conifer:['#291c16','#473022','#71503a','#957052','#c19c73'],
 olive:['#272820','#414435','#68715b','#9fa993','#c6cab3'],
 palm:['#332518','#58422a','#806045','#ad8663','#c9ad88'],
 orchard:['#281c13','#462c20','#6a4936','#987055','#c2a084'],
 broadleaf:['#291c14','#463021','#6f4d36','#9d7653','#c2a07a']
});
function colorsFor(tree,season='normal'){
 let leaves=tree.species==='pinheiro'?palette.pine:tree.species==='coqueiro'?palette.palm:season==='outono'?palette.fall:palette.broad;
 const actual=tree.catalogSpecies;
 if(actual){
  const bot=g25SpeciesProfile(actual);
  if(bot){
   if(bot.leafConfig?.leafColorRamp && season!=='outono')leaves=bot.leafConfig.leafColorRamp;
   return {wood:g254MaterialPalette(bot.coniferAnatomy?.woodPalette||G252_WOOD_PALETTES[bot.barkFamily]||palette.wood,'wood',actual),leaf:g254MaterialPalette(leaves,'leaf',actual),fruit:['#443019','#785029','#a57a39','#d2a15c']};
  }
 }
 return {wood:g254MaterialPalette(palette.wood,'wood',tree.species),leaf:g254MaterialPalette(leaves,'leaf',tree.species),fruit:tree.species==='coqueiro'?['#403019','#73502b','#a27d37','#b69d54']:['#442a15','#7d4c24','#ad762b','#dba44c']};
}
function poly(ctx,pts,color){if(pts.length<3)return;ctx.beginPath();ctx.moveTo(Math.round(pts[0].x),Math.round(pts[0].y));for(let i=1;i<pts.length;i++)ctx.lineTo(Math.round(pts[i].x),Math.round(pts[i].y));ctx.closePath();ctx.fillStyle=color;ctx.fill()}
function line(ctx,from,to,color,w=1){ctx.strokeStyle=color;ctx.lineWidth=Math.max(1,Math.round(w));ctx.lineJoin='bevel';ctx.lineCap='butt';ctx.beginPath();ctx.moveTo(Math.round(from.x),Math.round(from.y));ctx.lineTo(Math.round(to.x),Math.round(to.y));ctx.stroke()}
function ellipse(ctx,x,y,rx,ry,color){ctx.beginPath();ctx.ellipse(Math.round(x),Math.round(y),Math.max(.5,rx),Math.max(.5,ry),0,0,TAU);ctx.fillStyle=color;ctx.fill()}
function barkSegment(ctx,a,b,width,seed,col){
 const rng=rand(seed),dist=Math.hypot(b.x-a.x,b.y-a.y);
 line(ctx,a,b,col[0],width+2);line(ctx,{x:a.x-1,y:a.y},{x:b.x-1,y:b.y},col[2],width*.8);
 line(ctx,{x:a.x-width*.16,y:a.y},{x:b.x-width*.24,y:b.y},col[3],Math.max(1,width*.22));
 for(let i=0;i<Math.max(3,Math.round(dist*.21));i++){
  const t=rrange(rng,.08,.93),p={x:lerp(a.x,b.x,t)+rrange(rng,-width*.33,width*.33),y:lerp(a.y,b.y,t)};
  const len=rrange(rng,2,6);line(ctx,p,{x:p.x+rrange(rng,-1,2),y:p.y+len},rng()>.70?col[4]:col[1],1);
 }
}
function drawTrunk(ctx,st,cam,col){
 const arr=st.trunk;
 for(let i=0;i<arr.length-1;i++){
  const a=project(arr[i].p,cam),b=project(arr[i+1].p,cam);
  barkSegment(ctx,a,b,arr[i].radius*1.9,hash(st.tree.seed,'bark',i),col);
 }
 drawStageRoots(ctx,st,cam,col,'legacy');
}
function drawBranch(ctx,b,cam,col){
 const from=project(b.from,cam),mid=project(b.mid,cam),to=project(b.to,cam);
 line(ctx,from,mid,col[0],b.radius*2+1);line(ctx,mid,to,col[0],b.radius*1.42+1);
 line(ctx,{x:from.x-1,y:from.y-1},{x:mid.x-1,y:mid.y-1},col[2],b.radius*1.5);
 line(ctx,{x:mid.x-1,y:mid.y-1},{x:to.x-1,y:to.y-1},col[3],b.radius*.88);
}
function clump(ctx,p,rx,ry,col,seed,lighting=0){
 const rng=rand(seed);const n=10,outline=[];
 for(let i=0;i<n;i++){
  let a=TAU*i/n,scale=rrange(rng,.82,1.15);
  outline.push({x:p.x+Math.cos(a)*rx*scale,y:p.y+Math.sin(a)*ry*scale});
 }
 poly(ctx,outline,col[0]);
 const m=outline.map(v=>({x:lerp(p.x,v.x,.91),y:lerp(p.y,v.y,.86)}));poly(ctx,m,col[2]);
 poly(ctx,[m[3],m[4],m[5],m[6],m[7],{x:p.x+rx*.58,y:p.y+ry*.22}],col[1]);
 const nL=4+Math.floor(rx*.50);
 for(let i=0;i<nL;i++){
  let x=p.x+rrange(rng,-rx*.78,rx*.70),y=p.y+rrange(rng,-ry*.67,ry*.52);
  const w=rrange(rng,2.5,Math.max(3,rx*.30)),h=rrange(rng,1.7,Math.max(3,ry*.22));
  const shade=y<p.y?col[3+(rng()>.70?1:0)]:col[2+(rng()>.78?1:0)];
  poly(ctx,[{x:x-w,y:y},{x:x+w*.20,y:y-h*.63},{x:x+w,y:y},{x:x+w*.26,y:y+h},{x:x-w*.8,y:y+h*.45}],shade);
 }
 if(rx>5){line(ctx,{x:p.x-rx*.57,y:p.y-ry*.24},{x:p.x-rx*.09,y:p.y-ry*.40},col[5],1);}
}
function crownNodesOak(st,params){
 const nodes=[];const d=clamp(Number(params.density??.9),.15,1.4),k=st.g.horizontal,season=params.season||'normal';
 if(season==='inverno')return nodes;
 const seasonal=season==='outono'?.70:1;
 for(const b of st.visible){
  const rng=rand(b.foliageSeed);const N=Math.round((b.type==='bough'?9:4)*d*seasonal*b.show);
  for(let j=0;j<N;j++){
   const f=rrange(rng,.54,1.03),end=mix3(b.mid,b.to,f);
   const a=rrange(rng,-TAU*.5,TAU*.5),rad=rrange(rng,3,16)*k;
   const p=add(end,polar(a,rad,rrange(rng,-12,22)*st.g.vertical));
   // Clip canopy nodes to a generous ellipsoid around the oak crown.
   const norm=Math.hypot(p.x/(90*k),p.y/(90*k));if(norm>1.2)continue;
   const radius=rrange(rng,4.1,9.1)*k, id='leaf:'+b.id+':'+j;
   nodes.push({id,p,rx:radius*rrange(rng,1.2,1.7),ry:radius*rrange(rng,.78,1.1),seed:hash(st.tree.seed,id),depth:p.y});
  }
 }
 const rng=rand(hash(st.tree.seed,'oak-crown-volume'));
 // Additional stable shaded crown masses supply *volume*, not a flat silhouette.
 const max=Math.round(88*d*st.g.growth*seasonal);
 for(let i=0;i<max;i++){
  const a=rrange(rng,0,TAU),rho=Math.sqrt(rng()),rad=rho*68*k;
  const z=st.profile.canopyCenter*st.g.vertical+rrange(rng,-34,34)*st.g.vertical;
  const p=pt(Math.cos(a)*rad,Math.sin(a)*rad,z);
  const id='crown:'+i,norm=Math.sqrt((p.x/(78*k))**2+(p.y/(78*k))**2);
  if(norm>1)continue;
  const r=rrange(rng,5.1,11.6)*k;
  nodes.push({id,p,rx:r*rrange(rng,1.14,1.48),ry:r*rrange(rng,.82,1.02),seed:hash(st.tree.seed,id),depth:p.y});
 }
 return nodes;
}
function drawOak(ctx,st,cam,params,col){
 const all=crownNodesOak(st,params).sort((a,b)=>a.depth-b.depth);
 // Back foliage and rear branches occluded by the trunk and near foliage.
 st.visible.filter(b=>b.depthRank<0).forEach(b=>drawBranch(ctx,b,cam,col.wood));
 all.filter(o=>o.depth<0).forEach(o=>clump(ctx,project(o.p,cam),o.rx,o.ry,col.leaf,o.seed));
 drawTrunk(ctx,st,cam,col.wood);
 st.visible.filter(b=>b.depthRank>=0).forEach(b=>drawBranch(ctx,b,cam,col.wood));
 all.filter(o=>o.depth>=0).forEach(o=>clump(ctx,project(o.p,cam),o.rx,o.ry,col.leaf,o.seed));
 // Crown highlight clusters on top, preserving individual topology.
 const top=all.filter(o=>o.p.z>st.profile.canopyCenter*st.g.vertical+10*st.g.vertical && o.depth<22).slice(0,28);
 top.forEach(o=>{const p=project(o.p,cam);let r=rand(o.seed);if(r()>.55)clump(ctx,{x:p.x-1,y:p.y-2},o.rx*.36,o.ry*.34,col.leaf,hash(o.seed,'sun'));});
}
function needleBough(ctx,st,b,cam,col,density=1){
 const r=rand(b.foliageSeed);
 const p0=project(b.from,cam),p1=project(b.mid,cam),p2=project(b.to,cam);
 drawBranch(ctx,b,cam,palette.wood);
 const N=Math.max(2,Math.round((6+b.show*7)*clamp(Number(density),.25,1.35))),scale=st.g.horizontal;
 for(let j=0;j<N;j++){
  const t=(j+.18)/N,p=mix3(b.from,b.to,t),screen=project(p,cam),sz=rrange(r,5,10.4)*scale*(1-.42*t);
  // Conical vertical sprigs, but branching orientation follows x-y depth.
  const left={x:screen.x-sz*rrange(r,1.1,1.8),y:screen.y+sz*.45};
  const right={x:screen.x+sz*rrange(r,1.0,1.7),y:screen.y+sz*.52};
  const apex={x:screen.x+rrange(r,-2,2),y:screen.y-sz*rrange(r,.7,1.2)};
  poly(ctx,[left,apex,right,{x:screen.x,y:screen.y+sz*.76}],col[0]);
  poly(ctx,[{x:screen.x-sz*.7,y:screen.y+sz*.26},{x:apex.x-1,y:apex.y+1},{x:screen.x,y:screen.y+sz*.55}],col[2]);
  poly(ctx,[{x:screen.x,y:screen.y+sz*.55},{x:apex.x+2,y:apex.y+2},{x:screen.x+sz*.68,y:screen.y+sz*.22}],col[3]);
  if(j%3===0)line(ctx,{x:screen.x-sz*.35,y:screen.y-sz*.25},{x:screen.x,y:screen.y-sz*.47},col[5],1);
 }
}
function drawPine(ctx,st,cam,params,col){
 const ordered=st.visible.slice().sort((a,b)=>a.depthRank-b.depthRank);
 ordered.filter(b=>b.depthRank<0).forEach(b=>needleBough(ctx,st,b,cam,col.leaf,params.density??1));
 drawTrunk(ctx,st,cam,col.wood);
 ordered.filter(b=>b.depthRank>=0).forEach(b=>needleBough(ctx,st,b,cam,col.leaf,params.density??1));
 const apex=project(st.apex,cam);const r=rand(hash(st.tree.seed,'pine-tip'));
 for(let i=0;i<11;i++){
  const x=apex.x+rrange(r,-6,6)*st.g.horizontal,y=apex.y+rrange(r,-6,19)*st.g.vertical;
  const w=rrange(r,4,8)*st.g.horizontal;
  poly(ctx,[{x:x-w,y:y+w*.25},{x,y:y-w*1.6},{x:x+w,y:y+w*.25},{x,y:y+w*.5}],col.leaf[2+(i%3)]);
 }
}
function bezier(p0,p1,p2,p3,t){const s=1-t;return pt(s*s*s*p0.x+3*s*s*t*p1.x+3*s*t*t*p2.x+t*t*t*p3.x,s*s*s*p0.y+3*s*s*t*p1.y+3*s*t*t*p2.y+t*t*t*p3.y,s*s*s*p0.z+3*s*s*t*p1.z+3*s*t*t*p2.z+t*t*t*p3.z)}
function drawPalmFrond(ctx,b,st,cam,col,density=1){
 const rng=rand(b.foliageSeed),from=b.from,to=b.to;
 const start=pt(from.x,from.y,from.z),end=pt(to.x,to.y,to.z-rrange(rng,27,54)*st.g.vertical*b.show);
 const mid1=mix3(start,end,.32),mid2=mix3(start,end,.66);
 mid1.z+=26*st.g.vertical;mid2.z+=23*st.g.vertical;
 const sampled=[];
 for(let j=0;j<=20;j++)sampled.push(bezier(start,mid1,mid2,end,j/20));
 for(let j=0;j<20;j++){
  line(ctx,project(sampled[j],cam),project(sampled[j+1],cam),col[1],1.5);
 }
 // leaflets live in world space, attached to the central rachis.
 for(let j=2;j<18;j++){
  if(rand(hash(b.foliageSeed,j,'foliation'))()>clamp(Number(density),.25,1))continue;
  const p=sampled[j],q=sampled[j+1],t=j/20;
  const size=rrange(rng,13,24)*st.g.horizontal*Math.sin(Math.PI*t)**.7*b.show;
  const perpendicular=b.az+Math.PI/2;
  for(const side of [-1,1]){
   const out=add(p,polar(perpendicular,size*side,-rrange(rng,4,13)*st.g.vertical));
   const tip=project(out,cam),base=project(p,cam),ahead=project(q,cam);
   poly(ctx,[base,{x:lerp(base.x,tip.x,.45),y:lerp(base.y,tip.y,.45)-2},tip,{x:ahead.x,y:ahead.y+2}],col[2+((j+side+6)%3)]);
   if(j%4===0)line(ctx,base,{x:lerp(base.x,tip.x,.53),y:lerp(base.y,tip.y,.53)-1},col[5],1);
  }
 }
}
function drawPalm(ctx,st,cam,params,col){
 const b=st.visible.slice().sort((a,b)=>a.depthRank-b.depthRank);
 b.filter(x=>x.depthRank<0).forEach(x=>drawPalmFrond(ctx,x,st,cam,col.leaf,params.density??1));
 drawTrunk(ctx,st,cam,col.wood);
 b.filter(x=>x.depthRank>=0).forEach(x=>drawPalmFrond(ctx,x,st,cam,col.leaf,params.density??1));
 const top=project(st.apex,cam);ellipse(ctx,top.x,top.y+3,6*st.g.horizontal,4*st.g.horizontal,col.wood[2]);
 if(params.phenology==='frutificacao'&&st.g.growth>.65){
  const r=rand(hash(st.tree.seed,'coconut'));for(let i=0;i<5;i++){
   const p=add(st.apex,polar(i*TAU/5,rrange(r,3,8)*st.g.horizontal,-rrange(r,2,11)*st.g.vertical));
   const s=project(p,cam);ellipse(ctx,s.x,s.y,3,4,col.fruit[1]);ellipse(ctx,s.x-1,s.y-1,1.5,2,col.fruit[3]);
  }
 }
}
function addOrgans(ctx,st,cam,params,col){
 if(params.phenology!=='frutificacao'&&params.phenology!=='floracao')return;
 if(st.g.growth<.72)return;
 const isFruit=params.phenology==='frutificacao';const r=rand(hash(st.tree.seed,'organ-sites'));
 const bs=st.visible.filter(b=>b.type==='bough'||b.type==='whorl');
 for(let i=0;i<Math.min(bs.length,45);i++){
  const b=bs[i];if(r()>.45)continue;
  const p=add(b.to,polar(rrange(r,0,TAU),rrange(r,0,7)*st.g.horizontal,rrange(r,-4,4)*st.g.vertical)),q=project(p,cam);
  if(isFruit){ellipse(ctx,q.x,q.y,st.tree.species==='carvalho'?2.5:2,3,col.fruit[1]);ellipse(ctx,q.x-1,q.y-1,1,1.5,col.fruit[3]);}
  else if(st.tree.species==='carvalho'){
   ellipse(ctx,q.x,q.y,2.1,2.1,'#f7e9b7');ellipse(ctx,q.x,q.y,1,1,'#dab66b');
  }
 }
}
/* G2 art layer: deterministic organ placement, clustered foliage in 3D projected space,
   architectural needle pads and curved palm leaflets. Preserves G1 skeleton identity.
   Nothing in this module consumes Math.random or modifies the underlying tree. */
const G2_PROFILES=Object.freeze({
 carvalho:{label:'Copa ramificada aberta',clustersPerBranch:2.4,leafScale:1.0,interior:22,branchExposure:.55},
 pinheiro:{label:'Conífera de ramificações abertas',clustersPerBranch:1.45,leafScale:.78,interior:6,branchExposure:.48},
 coqueiro:{label:'Coroa radial com frondes pendentes',frondSegments:25,leafletPairs:19,branchExposure:.9}
});
function g2Between(a,b,t){return mix3(a,b,t)}
function g2Color(col,k){return col[clamp(Math.round(k),0,col.length-1)]}
function g2Leaf(ctx,p,w,h,shade,seed){
 const r=rand(seed); const angle=rrange(r,-.85,.85);const cs=Math.cos(angle),sn=Math.sin(angle);
 const x=p.x,y=p.y;
 poly(ctx,[{x:x-cs*w*.9-sn*h*.15,y:y-sn*w*.7+cs*h*.15},
           {x:x+cs*w*.25+sn*h*.55,y:y+sn*w*.25-cs*h*.55},
           {x:x+cs*w*.94-sn*h*.1,y:y+sn*w*.7+cs*h*.1},
           {x:x-cs*w*.19+sn*h*.68,y:y-sn*w*.15-cs*h*.68}],shade);
}
function g2Lobe(ctx,x,y,rx,ry,col,seed,brightness=0){
 const r=rand(seed),contour=[];
 for(let i=0;i<11;i++){
  const a=TAU*i/11,noise=rrange(r,.80,1.16);
  contour.push({x:x+Math.cos(a)*rx*noise,y:y+Math.sin(a)*ry*noise});
 }
 poly(ctx,contour,g2Color(col,0+brightness));
 const inside=contour.map(q=>({x:lerp(x-1,q.x,.83),y:lerp(y-1,q.y,.83)}));
 poly(ctx,inside,g2Color(col,1+brightness));
 // Shaded undersurface, top-left highlight. Leave lobe not uniformly coloured.
 poly(ctx,[inside[0],inside[1],inside[2],inside[3],{x:x+rx*.1,y:y+ry*.22},inside[10]],g2Color(col,2+brightness));
 poly(ctx,[inside[5],inside[6],inside[7],inside[8],{x:x-rx*.1,y:y-ry*.10}],g2Color(col,3+brightness));
}
function g2LeafCluster(ctx,node,cam,col,params,kind='broad'){
 const center=project(node.p,cam),seed=node.seed,r=rand(hash(seed,'g2-lobes'));
 const detail=clamp(Number(params.detail??1),.4,1.5);
 const rx=Math.max(2,node.rx),ry=Math.max(2,node.ry);
 const elevation=clamp((node.p.z - node.crownBase)/Math.max(22,node.crownRadius),-.9,.9);
 const shade=clamp(Math.floor((elevation+.8)*1.18),0,2);
 // Three or four submasses leave irregular notches; do not draw one green circle.
 const patches=kind==='needles'?3:3+Math.round(r()*2);
 for(let j=0;j<patches;j++){
  const angle=rrange(r,0,TAU),rad=rrange(r,.13,.62),w=rrange(r,.35,.62),h=rrange(r,.39,.65);
  const px=center.x+Math.cos(angle)*rx*rad, py=center.y+Math.sin(angle)*ry*rad;
  g2Lobe(ctx,px,py,rx*w,ry*h,col,hash(seed,'lobe',j),shade);
 }
 // Leaf/needle marks in *clusters*, not independent uniform per-pixel noise.
 const small=kind==='needles'?Math.round(12*detail):Math.round(9*detail);
 for(let j=0;j<small;j++){
  const ang=rrange(r,0,TAU),rad=Math.sqrt(r())*.78;
  const x=center.x+Math.cos(ang)*rx*rad,y=center.y+Math.sin(ang)*ry*rad;
  const idx=clamp((y<center.y?4:2)+(r()>.55?1:0)+(shade-1),1,5);
  if(kind==='needles'){
   const len=rrange(r,2.0,5.2)*detail;
   const tilt=rrange(r,-.85,.85);
   line(ctx,{x:x,y:y},{x:x+tilt*len,y:y-len},g2Color(col,idx),1);
   if(j%4===0)line(ctx,{x:x-1,y:y-1},{x:x+1,y:y-4},g2Color(col,idx+1),1);
  }else{
   g2Leaf(ctx,{x,y},rrange(r,1.6,3.0)*detail,rrange(r,1.6,2.5)*detail,g2Color(col,idx),hash(seed,'leaf',j));
   if(j%3===0)g2Leaf(ctx,{x:x-2,y:y+1},1.6*detail,1.6*detail,g2Color(col,idx-1),hash(seed,'leaf-b',j));
  }
 }
 // Sparse bright twigs/leaf edge glints in upper canopy.
 if(rx>4){
  for(let j=0;j<3;j++){
   const x=center.x+rrange(r,-.57,.22)*rx,y=center.y+rrange(r,-.66,-.10)*ry;
   line(ctx,{x,y},{x:x+rrange(r,1,3),y:y-rrange(r,1,2)},g2Color(col,4+shade*.4),1);
  }
 }
}
function g2OakNodes(st,params){
 const d=clamp(Number(params.density??.98),.30,1.30);
 const open=clamp(Number(params.openness??.25),0,.70);
 const growth=st.g.growth,leafAge=st.g.horizontal;
 const season=params.season||'normal';if(season==='inverno')return [];
 const seasonal=season==='outono'?.79:1;
 const result=[],base=st.profile.canopyCenter*st.g.vertical,rad=st.profile.crownRadius*leafAge;
 for(const branch of st.visible){
  if(branch.show<.12)continue;
  const rng=rand(hash(branch.foliageSeed,'oak-g2'));
  const count=Math.max(1,Math.round(rrange(rng,2.1,3.8)*d*seasonal*(1-open*.36)*branch.show));
  for(let j=0;j<count;j++){
   const t=rrange(rng,.59,1.06),at=g2Between(branch.mid,branch.to,t);
   const nudge=polar(rrange(rng,0,TAU),rrange(rng,1,12)*leafAge,rrange(rng,-14,15)*st.g.vertical);
   const p=add(at,nudge);if(Math.hypot(p.x,p.y)>rad*1.24)continue;
   const size=rrange(rng,8.2,13.5)*leafAge*rrange(rng,.86,1.18);
   const id='oak-tuft:'+branch.id+':'+j;
   result.push({id,seed:hash(st.tree.seed,id),p,rx:size*rrange(rng,1.0,1.7),ry:size*rrange(rng,.67,.92),crownBase:base,crownRadius:rad});
  }
 }
 // Canopy filling is sparse and anchored around the persistent structural envelope.
 const rng=rand(hash(st.tree.seed,'oak-interior-g2'));
 const extra=Math.round((G2_PROFILES.carvalho.interior+19)*d*growth*seasonal*(1-open*.55));
 for(let i=0;i<extra;i++){
  const a=rrange(rng,0,TAU),rho=rrange(rng,.17,.77),p=pt(Math.cos(a)*rho*rad,Math.sin(a)*rho*rad,base+rrange(rng,-24,25)*st.g.vertical);
  const id='oak-inner:'+i,sz=rrange(rng,8.0,12.8)*leafAge;
  result.push({id,seed:hash(st.tree.seed,id),p,rx:sz*1.36,ry:sz*.90,crownBase:base,crownRadius:rad});
 }
 return result.sort((a,b)=>a.p.y-b.p.y || a.p.z-b.p.z);
}
function g2BarkOverlay(ctx,st,cam){
 const r=rand(hash(st.tree.seed,'bark-detail-g2-v2'));
 for(let i=0;i<st.trunk.length-1;i++){
  const a=project(st.trunk[i].p,cam),b=project(st.trunk[i+1].p,cam);
  const n=4+Math.floor(r()*3),width=st.trunk[i].radius*1.7;
  for(let j=0;j<n;j++){
   const t=(j+.22+r()*.45)/n,x=lerp(a.x,b.x,t)+rrange(r,-width*.23,width*.22),y=lerp(a.y,b.y,t);
   const l=rrange(r,1.8,6.0)*(st.g.growth*.32+.68);
   line(ctx,{x,y},{x:x+rrange(r,-1.1,1.1),y:y+l},r()>.5?palette.wood[0]:palette.wood[1],1);
   if(r()>.42)line(ctx,{x:x+1,y:y+1},{x:x+1,y:y+Math.max(1,l*.45)},palette.wood[4],1);
  }
 }
}
function g2DrawOak(ctx,st,cam,params,col){
 const masses=g2OakNodes(st,params),sep=masses.length*.57;
 const back=masses.filter(q=>q.p.y<0),front=masses.filter(q=>q.p.y>=0);
 for(const m of back)g2LeafCluster(ctx,m,cam,col.leaf,params,'broad');
 st.visible.filter(b=>b.depthRank<0).sort((a,b)=>a.depthRank-b.depthRank).forEach(b=>drawBranch(ctx,b,cam,col.wood));
 drawTrunk(ctx,st,cam,col.wood);g2BarkOverlay(ctx,st,cam);
 st.visible.filter(b=>b.depthRank>=0).forEach(b=>drawBranch(ctx,b,cam,col.wood));
 for(const m of front)g2LeafCluster(ctx,m,cam,col.leaf,params,'broad');
 // Additional twig lines peek through as requested by sparse reference canopy.
 const rng=rand(hash(st.tree.seed,'oak-twigs-g2'));
 for(const b of st.visible.filter(b=>b.show>.68)){
  if(rng()<.50)continue;
  const a=project(g2Between(b.mid,b.to,.71),cam),z=project(b.to,cam);
  if(rng()<.37)line(ctx,a,z,col.wood[2],1);
 }
}
function g2NeedleClusters(st,b,params){
 const rng=rand(hash(b.foliageSeed,'g2-needles')),g=st.g.horizontal,ret=[];
 const d=clamp(Number(params.density??1),.3,1.3),open=clamp(Number(params.openness??.25),0,.7);
 const count=Math.max(1,Math.round((1.9+rrange(rng,0,1.40))*d*b.show*(1-open*.22)));
 for(let j=0;j<count;j++){
  const t=rrange(rng,.42,.94),at=g2Between(b.from,b.to,t),dir=rrange(rng,0,TAU);
  const p=add(at,polar(dir,rrange(rng,0,10)*g,rrange(rng,-4,10)*st.g.vertical));
  const size=rrange(rng,8.8,15.0)*g*(1-t*.20);
  const id='needle:'+b.id+':'+j;
  ret.push({p,id,seed:hash(st.tree.seed,id),rx:size*rrange(rng,1.4,2.25),ry:size*rrange(rng,.75,1.20),crownBase:st.profile.canopyCenter*st.g.vertical,crownRadius:st.profile.crownRadius*g});
 }
 return ret;
}
function g2DrawPine(ctx,st,cam,params,col){
 const rng=rand(hash(st.tree.seed,'pine-g2-selection'));
 const branchSet=st.visible.filter(b=>b.show>.08);
 const nodes=[];
 for(const b of branchSet)nodes.push(...g2NeedleClusters(st,b,params));
 // Visual depth ordering of branch pads, not repeated triangular whole-tree tiers.
 nodes.sort((a,b)=>a.p.y-b.p.y || a.p.z-b.p.z);
 for(const node of nodes.filter(o=>o.p.y<0))g2LeafCluster(ctx,node,cam,col.leaf,params,'needles');
 for(const b of branchSet.filter(b=>b.depthRank<0))drawBranch(ctx,b,cam,col.wood);
 drawTrunk(ctx,st,cam,col.wood);g2BarkOverlay(ctx,st,cam);
 for(const b of branchSet.filter(b=>b.depthRank>=0))drawBranch(ctx,b,cam,col.wood);
 for(const node of nodes.filter(o=>o.p.y>=0))g2LeafCluster(ctx,node,cam,col.leaf,params,'needles');
 const apex=project(st.apex,cam);
 for(let j=0;j<3;j++){
  let a={x:apex.x+rrange(rng,-4,4)*st.g.horizontal,y:apex.y+rrange(rng,1,6)};
  line(ctx,a,{x:a.x+rrange(rng,-2,2),y:a.y-rrange(rng,5,10)*st.g.horizontal},col.leaf[3+j],1);
 }
}
function g2DrawFrond(ctx,b,st,cam,col,params){
 const rng=rand(hash(b.foliageSeed,'g2-frond'));
 const from=b.from,to=b.to;
 const drop=rrange(rng,33,60)*st.g.vertical*b.show;
 const start=pt(from.x,from.y,from.z),end=pt(to.x,to.y,to.z-drop);
 const bend1=mix3(start,end,.28),bend2=mix3(start,end,.69);
 bend1.z+=rrange(rng,11,19)*st.g.vertical;
 bend2.z+=rrange(rng,-3,6)*st.g.vertical;
 const spine=[];for(let i=0;i<=28;i++)spine.push(bezier(start,bend1,bend2,end,i/28));
 // Frond is slender along its axis, with narrow tapering feather-like leaflets.
 for(let i=0;i<28;i++){
  const screen0=project(spine[i],cam),screen1=project(spine[i+1],cam);
  line(ctx,screen0,screen1,col[1],i<11?2:1);
  if(i<6)line(ctx,{x:screen0.x-1,y:screen0.y-1},{x:screen1.x-1,y:screen1.y-1},col[3],1);
 }
 const density=clamp(Number(params.density??.98),.28,1.3),detail=clamp(Number(params.detail??1),.4,1.5);
 for(let j=3;j<27;j++){
  if(rng()>density)continue;
  const t=j/28,p=spine[j],before=spine[Math.max(0,j-1)],after=spine[Math.min(28,j+1)];
  const size=Math.max(.17,Math.sin(t*Math.PI)**.78)*rrange(rng,13,21)*st.g.horizontal*b.show;
  // Leaves are oriented PERPENDICULAR in the XY plane; tips bend DOWN in 3D.
  for(const side of [-1,1]){
   const angle=b.az+Math.PI*.50*side+rrange(rng,-.11,.11),dist=size*rrange(rng,.70,1.1);
   const tip=add(p,polar(angle,dist,-rrange(rng,4,12)*st.g.vertical));
   const mid=add(g2Between(p,tip,.58),pt(0,0,rrange(rng,2,7)*st.g.vertical));
   const a=project(p,cam),m=project(mid,cam),z=project(tip,cam);
   const bladeWidth=rrange(rng,1.25,2.6)*detail;
   poly(ctx,[a,{x:m.x-bladeWidth,y:m.y-1},z,{x:m.x+bladeWidth,y:m.y+2}],col[2+((j+side+16)%4)]);
   if(j%4===0)line(ctx,a,{x:lerp(a.x,z.x,.6),y:lerp(a.y,z.y,.6)},col[5],1);
  }
 }
}
function g2DrawPalm(ctx,st,cam,params,col){
 const behind=st.visible.filter(b=>b.depthRank<0),front=st.visible.filter(b=>b.depthRank>=0);
 for(const b of behind)g2DrawFrond(ctx,b,st,cam,col.leaf,params);
 drawTrunk(ctx,st,cam,col.wood);g2BarkOverlay(ctx,st,cam);
 for(const b of front)g2DrawFrond(ctx,b,st,cam,col.leaf,params);
 const top=project(st.apex,cam);ellipse(ctx,top.x,top.y,5*st.g.horizontal,3*st.g.horizontal,col.wood[2]);
 if(params.phenology==='frutificacao' && st.g.growth>.65){
  const rng=rand(hash(st.tree.seed,'coconut-g2'));
  for(let i=0;i<5;i++){
   const p=add(st.apex,polar(i*TAU/5,rrange(rng,3,8)*st.g.horizontal,-rrange(rng,2,9)*st.g.vertical)),q=project(p,cam);
   ellipse(ctx,q.x,q.y,3,3,col.fruit[0]);ellipse(ctx,q.x-1,q.y-1,2,2,col.fruit[2]);
  }
 }
}


/* G2.1 — independent implementation informed by TreeGenerator architecture only.
   No TIC-80 source code, tile assets, or GPL-3.0 code is incorporated.
   All surfaces follow G1 persistent XYZ and 2.5D projection. */

const barkCache=new Map();
function barkTexture(species,seed,variant=0){
 const actual=String(species||'carvalho');
 const profile=(typeof g25SpeciesProfile==='function' && g25SpeciesProfile(actual)) || null;
 const family=profile?.barkFamily || (['pinheiro','abeto','picea','cedro'].includes(actual)?'conifer':actual==='bananeira'?'pseudostem':(['coqueiro','palmeira'].includes(actual)?'palm':'broadleaf'));
 const key=family+':'+actual+':'+seed+':'+variant+':'+(G254_COLOR_CONTEXT.enabled?Math.round(G254_COLOR_CONTEXT.strength*20):'off');
 if(barkCache.has(key))return barkCache.get(key);
 if(barkCache.size>200)barkCache.clear();
 const r=rand(hash(seed,actual,'species-bark-v4',variant));
 const t=makeCanvas(1,1);t.width=24;t.height=48;
 const c=t.getContext('2d');c.imageSmoothingEnabled=false;
 const palettes={
  broadleaf:['#20160e','#352317','#563927','#79553d','#a98561'],
  orchard:['#24170f','#3b281d','#664231','#8d644b','#bb926d'],
  conifer:['#24180f','#41281a','#6a4330','#96674c','#c09672'],
  palm:['#312315','#533b27','#7f5f45','#aa8261','#d1b086'],
  birch:['#3a332b','#6f675e','#c2b8aa','#e6ddd1','#faf6ef'],
  smoothMottled:['#3a2b1d','#5e4833','#8b6d54','#baa58d','#ddd1bf'],
  olive:['#2c2a24','#4b4539','#716958','#978e79','#c4b8a0'],
  baobab:['#4c3524','#74543d','#997358','#bd9474','#d5b599'],
  willow:['#2b2117','#453527','#6a543d','#8f775c','#baa78b'],
  pseudostem:['#2a3a1e','#58723b','#7d9957','#a4bb7a','#d3ddb3']
 };
 const colors=g254MaterialPalette(profile?.barkPalette || palettes[family] || palettes.broadleaf,'wood',actual);
 c.fillStyle=colors[2];c.fillRect(0,0,24,48);
 if(family==='birch'){
  for(let i=0;i<48;i+=5){ c.fillStyle=i%10?colors[3]:colors[4]; c.fillRect(0,i,24,3); }
  for(let i=0;i<24;i++){ const x=Math.floor(r()*22),y=Math.floor(r()*47),w=1+Math.floor(r()*2),h=1+Math.floor(r()*4); c.fillStyle=r()>.5?colors[0]:colors[1]; c.fillRect(x,y,w,h); }
  for(let i=0;i<12;i++){ const x=Math.floor(r()*18),y=Math.floor(r()*40),w=3+Math.floor(r()*5); c.fillStyle=colors[1]; c.fillRect(x,y,w,1); }
 }else if(family==='smoothMottled'){
  for(let i=0;i<42;i++){
   const x=Math.floor(r()*23),y=Math.floor(r()*47),w=2+Math.floor(r()*5),h=2+Math.floor(r()*6);
   c.fillStyle=[colors[1],colors[3],colors[4]][i%3]; c.fillRect(x,y,Math.min(w,24-x),Math.min(h,48-y));
   if(r()>.6){ c.fillStyle=colors[0]; c.fillRect(Math.max(0,x-1),y,1,Math.min(h,48-y)); }
  }
 }else if(family==='pseudostem'){
  for(let y=0;y<48;y+=6){
   const band=1+Math.floor(r()*2);
   c.fillStyle=(Math.floor(y/6)%2===0)?colors[1]:colors[2]; c.fillRect(0,y,24,band);
   c.fillStyle=colors[3]; c.fillRect(0,Math.min(47,y+band),24,1);
  }
  for(let i=0;i<32;i++){
   const x=Math.floor(r()*24),y=Math.floor(r()*48),h=4+Math.floor(r()*12);
   c.fillStyle=r()>.55?colors[4]:colors[1]; c.fillRect(x,y,1,Math.min(h,48-y));
  }
 }else if(family==='baobab'){
  for(let lane=0;lane<5;lane++){
   const x0=2+Math.floor((lane+.5)*20/5)+Math.floor(rrange(r,-1,2));
   let y=0; while(y<48){ const h=7+Math.floor(r()*11); c.fillStyle=r()>.5?colors[1]:colors[0]; c.fillRect(Math.max(0,Math.min(23,x0)),y,2,Math.min(h,48-y)); y+=h+1+Math.floor(r()*3); }
  }
  for(let i=0;i<26;i++){ const x=Math.floor(r()*21),y=Math.floor(r()*46),w=3+Math.floor(r()*4),h=2+Math.floor(r()*4); c.fillStyle=i%2?colors[3]:colors[4]; c.fillRect(x,y,Math.min(w,24-x),Math.min(h,48-y)); }
 }else if(family==='olive'){
  for(let lane=0;lane<7;lane++){
   const x0=2+Math.floor((lane+.5)*20/7)+Math.floor(rrange(r,-1,1));
   let y=0; while(y<48){ const h=5+Math.floor(r()*7),drift=Math.floor(Math.sin((y+lane*4)/8)*1.5); c.fillStyle=r()>.4?colors[0]:colors[1]; c.fillRect(Math.max(0,Math.min(23,x0+drift)),y,1+(r()>.7?1:0),Math.min(h,48-y)); y+=h+1+Math.floor(r()*3); }
  }
  for(let i=0;i<18;i++){ const x=Math.floor(r()*23),y=Math.floor(r()*47); c.fillStyle=colors[4]; c.fillRect(x,y,1+Math.floor(r()*2),1+Math.floor(r()*2)); }
 }else if(family==='willow'){
  for(let lane=0;lane<8;lane++){
   const x0=1+Math.floor((lane+.5)*22/8)+Math.floor(rrange(r,-1,1));
   let y=Math.floor(r()*4);
   while(y<48){ const h=4+Math.floor(r()*8); c.fillStyle=r()>.35?colors[0]:colors[1]; c.fillRect(Math.max(0,Math.min(23,x0)),y,1,Math.min(h,48-y)); if(r()>.45){ c.fillStyle=colors[3]; c.fillRect(Math.max(0,Math.min(23,x0+1)),Math.min(47,y+1),1,Math.max(1,Math.floor(h*.35))); } y+=h+1+Math.floor(r()*3); }
  }
  for(let i=0;i<22;i++){ const x=Math.floor(r()*23),y=Math.floor(r()*47); c.fillStyle=r()>.5?colors[1]:colors[4]; c.fillRect(x,y,1+Math.floor(r()*2),1+Math.floor(r()*3)); }
 }else if(family==='conifer'){
  for(let lane=0;lane<8;lane++){
   const x0=1+Math.floor((lane+.5)*22/8)+Math.floor(rrange(r,-1,1));
   let y=Math.floor(r()*3);
   while(y<48){
    const h=4+Math.floor(r()*8),drift=Math.floor(rrange(r,-1,2));
    c.fillStyle=r()>.35?colors[0]:colors[1];
    c.fillRect(Math.max(0,Math.min(23,x0+drift)),y,1+(r()>.76?1:0),Math.min(h,48-y));
    if(r()>.48){ c.fillStyle=colors[3]; c.fillRect(Math.max(0,Math.min(23,x0+drift+1)),Math.min(47,y+1),1,Math.max(1,Math.floor(h*.4))); }
    y+=h+1+Math.floor(r()*4);
   }
  }
  for(let i=0;i<34;i++){
   const x=Math.floor(r()*23),y=Math.floor(r()*47),w=1+Math.floor(r()*2),h=1+Math.floor(r()*3);
   c.fillStyle=r()>.60?colors[1]:colors[4]; c.fillRect(x,y,Math.min(w,24-x),Math.min(h,48-y));
   if(r()>.78) c.fillRect(Math.max(0,x-1),y,1,1);
  }
 }else if(family==='palm'){
  for(let y=0;y<48;y+=7){
   const heavy=(Math.floor(y/7)%2===0);
   c.fillStyle=heavy?colors[0]:colors[1]; c.fillRect(0,y,24,heavy?2:1);
   c.fillStyle=colors[3]; c.fillRect(0,Math.min(47,y+2),24,1);
   for(let x=1;x<23;x+=3){
    const yy=Math.min(47,y+3+Math.floor(r()*2));
    c.fillStyle=(x/3)%2?colors[4]:colors[1];
    c.fillRect(Math.max(0,x+Math.floor(rrange(r,-1,2))),yy,1+Math.floor(r()*2),1);
   }
  }
  for(let i=0;i<30;i++){
   const x=Math.floor(r()*24),y=Math.floor(r()*48),h=1+Math.floor(r()*3);
   c.fillStyle=r()>.45?colors[1]:colors[4]; c.fillRect(x,y,1,h);
  }
 }else {
  for(let lane=0;lane<6;lane++){
   const x0=2+Math.floor((lane+.5)*20/6)+Math.floor(rrange(r,-1,2));
   let y=0;
   while(y<48){
    const h=5+Math.floor(r()*10),w=1+(r()>.55?1:0),drift=Math.floor(rrange(r,-1,2));
    c.fillStyle=colors[0];
    c.fillRect(Math.max(0,Math.min(23,x0+drift)),y,w,Math.min(h,48-y));
    if(r()>.32){ c.fillStyle=colors[4]; c.fillRect(Math.max(0,Math.min(23,x0+drift+1)),Math.min(47,y+1),1,Math.max(1,Math.floor(h*.45))); }
    y+=h+1+Math.floor(r()*3);
   }
  }
  for(let i=0;i<30;i++){
   const x=Math.floor(r()*22),y=Math.floor(r()*46),w=2+Math.floor(r()*3),h=2+Math.floor(r()*4);
   c.fillStyle=i%3===0?colors[1]:colors[3]; c.fillRect(x,y,Math.min(w,24-x),Math.min(h,48-y));
   if(r()>.42){ c.fillStyle=colors[0]; c.fillRect(Math.max(0,x-1),y,1,Math.min(h,48-y)); }
  }
 }
 barkCache.set(key,t);return t;
}
function g21TexturedSegment(ctx,a,b,w0,w1,colors,tex,amount=1,seed=1){
 const dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy);if(dist<.7)return;
 const theta=Math.atan2(dy,dx)-Math.PI/2;
 const r=rand(seed);
 ctx.save();ctx.translate(Math.round(a.x),Math.round(a.y));ctx.rotate(theta);ctx.imageSmoothingEnabled=false;
 const w=Math.max(1,w0),ww=Math.max(.6,w1),midW=(w+ww)*.5;
 ctx.beginPath();ctx.moveTo(-w/2,0);ctx.lineTo(w/2,0);ctx.lineTo(ww/2,dist+1);ctx.lineTo(-ww/2,dist+1);ctx.closePath();
 ctx.fillStyle=colors[0];ctx.fill();
 ctx.save();ctx.clip();
 ctx.fillStyle=colors[2];ctx.fillRect(-w/2,0,w,dist+1);
 // Broad light falloff across the bark cylinder.
 ctx.fillStyle=colors[1];ctx.fillRect(Math.round(midW*.06),0,Math.max(1,Math.round(midW*.18)),dist+1);
 ctx.fillStyle=colors[3];ctx.fillRect(-Math.floor(midW*.30),0,Math.max(1,Math.round(midW*.10)),dist+1);
 if(amount>.02){
  ctx.globalAlpha=.45*clamp(amount,.02,1);ctx.fillStyle=ctx.createPattern(tex,'repeat');ctx.fillRect(-w/2,-2,Math.max(w,ww),dist+4);ctx.globalAlpha=1;
  const grooves=Math.max(2,Math.round(midW*.85));
  for(let g=0;g<grooves;g++){
   const side=lerp(-.34,.26,grooves<=1?0:g/(grooves-1))+rrange(r,-.05,.05);
   const offset=side*midW;
   let y=0;
   while(y<dist){
    const seg=2+Math.floor(r()*8),gap=1+Math.floor(r()*4);
    const shade=(g%3===0&&r()>.45)?colors[1]:colors[0];
    ctx.fillStyle=shade;
    ctx.fillRect(Math.round(offset),Math.round(y),1+(r()>.72?1:0),Math.min(seg,Math.ceil(dist-y)));
    if(r()>.48){
      ctx.fillStyle=colors[4];
      ctx.fillRect(Math.round(offset+1),Math.round(y+1),1,Math.max(1,Math.floor(seg*.45)));
    }
    y+=seg+gap;
   }
  }
  if(midW>3.2){
   const checks=Math.max(2,Math.floor(dist/12));
   for(let i=0;i<checks;i++){
    const yy=Math.floor(rrange(r,1,Math.max(2,dist-3))),xx=Math.round(rrange(r,-midW*.34,midW*.18));
    ctx.fillStyle=r()>.45?colors[1]:colors[4];ctx.fillRect(xx,yy,1+Math.floor(r()*2),1+Math.floor(r()*3));
    if(r()>.62){ctx.fillStyle=colors[0];ctx.fillRect(xx-1,yy,1,1+Math.floor(r()*2));}
   }
  }
 }
 ctx.restore();ctx.restore();
}
// Root buttresses only become exposed when the juvenile trunk thickens.
// This prevents roots from making seedlings look like adult trees cut down.
function drawStageRoots(ctx,st,cam,col,style='g21'){
 if(st.tree.species==='coqueiro')return;
 const maturity=smooth((st.g.growth-.23)/.52);
 if(maturity<=0)return;
 const count=2+Math.round(4*maturity);
 const safeReach=(252-PIVOT.y)/Math.max(.15,cam.groundDepth*.77);
 const baseWidth=Math.max(.8,Math.min(3.2,st.trunk[0].radius*.26))*maturity;
 for(let k=0;k<count;k++){
  const r=rand(hash(st.tree.seed,style==='legacy'?'root':'root-safe-v2',k));
  const az=k*TAU/count+.15+rrange(r,-.16,.16);
  const baseReach=style==='legacy'?rrange(r,9,20):rrange(r,7,14);
  const radial=baseReach*st.g.horizontal*(.38+.62*maturity);
  const reach=style==='legacy'&&maturity>=1?radial:Math.min(radial,Math.max(6*maturity+2*(1-maturity),safeReach-2));
  const start=pt(Math.cos(az)*1.2*st.g.horizontal,Math.sin(az)*1.2*st.g.horizontal,1.0+.8*maturity);
  const p1=pt(Math.cos(az)*reach*.24,Math.sin(az)*reach*.24,3.4*maturity+rrange(r,1,5)*st.g.vertical);
  const p2=pt(Math.cos(az+rrange(r,-.20,.20))*reach*.60,Math.sin(az+rrange(r,-.20,.20))*reach*.60,1.5*maturity+rrange(r,.2,2)*st.g.vertical);
  const p3=pt(Math.cos(az+rrange(r,-.28,.28))*reach,Math.sin(az+rrange(r,-.28,.28))*reach,0);
  const pts=[];
  for(let i=0;i<=8;i++){
   const t=i/8,s=1-t;
   const p=pt(s*s*s*start.x+3*s*s*t*p1.x+3*s*t*t*p2.x+t*t*t*p3.x,
              s*s*s*start.y+3*s*s*t*p1.y+3*s*t*t*p2.y+t*t*t*p3.y,
              s*s*s*start.z+3*s*s*t*p1.z+3*s*t*t*p2.z+t*t*t*p3.z);
   pts.push(project(p,cam));
  }
  const buttress=project(pt(Math.cos(az)*1.6*st.g.horizontal,Math.sin(az)*1.6*st.g.horizontal,4.8*maturity*st.g.vertical),cam);
  poly(ctx,[{x:pts[0].x-baseWidth,y:pts[0].y-baseWidth*.8},buttress,{x:pts[0].x+baseWidth,y:pts[0].y}],col[k%2?1:2]);
  for(let i=0;i<pts.length-1;i++){
   const w=baseWidth*(1-i/(pts.length-1))*(1.1+.28*maturity);
   line(ctx,pts[i],pts[i+1],col[k%2?2:1],Math.max(1,w));
   line(ctx,{x:pts[i].x-.5,y:pts[i].y-.5},{x:pts[i+1].x-.5,y:pts[i+1].y-.5},col[0],1);
   if(i<pts.length-2 && r()>.35)line(ctx,pts[i],{x:pts[i].x+rrange(r,-2,2),y:pts[i].y+rrange(r,-1,2)},col[3],1);
  }
 }
}
function g21Trunk(ctx,st,cam,params,col){
 if(st.organic?.enabled){g231Trunk(ctx,st,cam,params,col);return;}
 drawStageRoots(ctx,st,cam,col);
 const amount=clamp(Number(params.barkTexture??1),0,1);
 for(let i=0;i<st.trunk.length-1;i++){
  const a=project(st.trunk[i].p,cam),b=project(st.trunk[i+1].p,cam);
  const tile=barkTexture(st.tree.catalogSpecies||st.tree.species,st.tree.seed,i%3);
  g21TexturedSegment(ctx,a,b,st.trunk[i].radius*2,st.trunk[i+1].radius*2,col,tile,amount,hash(st.tree.seed,'trunk-g21',i));
 }
}
function g21Branch(ctx,b,st,cam,params,col){
 const a=project(b.from,cam),m=project(b.mid,cam),z=project(b.to,cam);
 const bark=barkTexture(st.tree.catalogSpecies||st.tree.species,st.tree.seed,1+hash(b.id)%3),t=clamp(Number(params.barkTexture??1),0,1);
 const thick=Math.max(1,b.radius*1.75);
 g21TexturedSegment(ctx,a,m,thick,thick*.63,col,bark,t,hash(st.tree.seed,b.id,'a'));
 g21TexturedSegment(ctx,m,z,thick*.67,Math.max(.7,thick*.22),col,bark,t,hash(st.tree.seed,b.id,'b'));
}
function g21LeafMass(ctx,node,cam,col,params,kind='broad'){
 g2LeafCluster(ctx,node,cam,col,params,kind);
 // Small coherent leaf clusters (pixel-art stamps), never per-pixel white noise.
 const r=rand(hash(node.seed,'cluster-stamps'));
 const p=project(node.p,cam),detail=clamp(Number(params.detail??1),.4,1.6);
 const count=Math.max(2,Math.round((kind==='needles'?6:9)*detail));
 for(let j=0;j<count;j++){
  const x=p.x+rrange(r,-.70,.70)*node.rx,y=p.y+rrange(r,-.60,.62)*node.ry;
  const shade=r()>.74?col[5]:col[3+(j%2)];
  if(kind==='needles'){
   for(let k=0;k<3;k++){
    const dx=rrange(r,-2,2),dy=rrange(r,-2,2);
    line(ctx,{x:x+dx,y:y+dy},{x:x+dx+rrange(r,-3,3),y:y+dy-rrange(r,2,5)},shade,1);
   }
  }else{
   g2Leaf(ctx,{x,y},rrange(r,1.3,2.4)*detail,rrange(r,1.1,2.3)*detail,shade,hash(node.seed,j,'stamp'));
  }
 }
}
function g21OrganWorld(st,site){
 const branch=st.visible.find(b=>b.id===site.branchId);
 if(!branch||branch.show<.45)return null;
 // Coconut flowers and fruits belong near the palm crown, NOT at the end of long fronds.
 let world;
 if(st.tree.species==='coqueiro'){
  const sr=rand(site.seed),az=branch.az+rrange(sr,-.35,.35);
  world=add(branch.from,polar(az,rrange(sr,3.5,9)*st.g.horizontal,-rrange(sr,7,18)*st.g.vertical));
 }else{
  world=add(mix3(branch.mid,branch.to,site.t),pt(site.offset.x*st.g.horizontal,site.offset.y*st.g.horizontal,site.offset.z*st.g.vertical));
 }
 return {site,p:world,depth:world.y};
}
function g21GetOrgans(st,params){
 const ph=params.phenology||'vegetativa';
 if(ph!=='frutificacao'&&ph!=='floracao'||st.g.growth<.72)return [];
 const all=(st.tree.organSites||[]).map(site=>g21OrganWorld(st,site)).filter(Boolean);
 const density=clamp(Number(params.organDensity??.65),0,1);
 return all.filter(o=>hash(o.site.seed,ph,'visibility')/4294967296<density);
}

const G25_FRUIT_COLORS=Object.freeze({
 'bétula':['#bea674','#755d3c','#e1c38c'],'salgueiro':['#bbb48f','#5d6c45','#dfd5ab'],
 'palmeira':['#896038','#4f452a','#b39c55'],'acer':['#c9ac7a','#815537','#e6ce99'],
 'cedro':['#75543d','#493523','#987550'],'sicomoro':['#977036','#5a4229','#b89456'],
 'picea':['#66513c','#3c3022','#a28b62'],'baoba':['#856c42','#4b3e2a','#a78b61'],
 'olmo':['#a79a5f','#5c5131','#d7ce8c'],'abeto':['#806544','#473425','#b5966b'],
 'macieira':['#a33d29','#6a2d1d','#dc8b49'],'laranjeira':['#d78b27','#97541c','#f3c05c'],
 'limoeiro':['#d9b83a','#927822','#f3db6b'],'mangueira':['#db9a3f','#80591e','#f2d163'],
 'bananeira':['#c8b33e','#786826','#e8d877'],'oliveira':['#65536a','#362a3e','#a7a05d'],
 'cerejeira':['#b34238','#652724','#f19a78'],'figueira':['#784b63','#492b45','#bf7e83'],
 'goiabeira':['#a0ab54','#64793a','#cbd684'],'amoreira':['#70334d','#451e39','#ac6678'],
 'abacateiro':['#547f38','#2e4d26','#8aa15b'],'cajueiro':['#b15930','#74371f','#dcb15a'],
 'jabuticabeira':['#352744','#22182c','#746487']});
function g25DrawOrgan(ctx,item,st,cam,params){
 const sp=st.tree.catalogSpecies,colors=G25_FRUIT_COLORS[sp];if(!colors)return false;
 const p=project(item.p,cam),r=rand(item.site.seed),isFlower=params.phenology==='floracao';
 const s=sp==='mangueira'||sp==='abacateiro'||sp==='baoba'?4.1:sp==='sicomoro'||sp==='figueira'?2.8:sp==='bananeira'?3.6:2.4;
 if(isFlower){
  for(let j=0;j<5;j++){const a=j*TAU/5;
   ellipse(ctx,p.x+Math.cos(a)*2,p.y+Math.sin(a)*2,1.15,1.15,j%2?'#f0e1bd':'#e5d5ac');}
  ellipse(ctx,p.x,p.y,1.1,1.1,'#b99f3c');return true;
 }
 if(['cedro','picea','abeto'].includes(sp)){
  poly(ctx,[{x:p.x-1.3,y:p.y-s},{x:p.x+1,y:p.y-s+1},{x:p.x+2.2,y:p.y+s},{x:p.x-2,y:p.y+s}],colors[0]);
  line(ctx,{x:p.x-1,y:p.y},{x:p.x+1,y:p.y+1},colors[2],1);return true;
 }
 if(sp==='acer'||sp==='olmo'||sp==='bétula'||sp==='salgueiro'){
  line(ctx,{x:p.x,y:p.y},{x:p.x+4,y:p.y-2},colors[0],1);
  line(ctx,{x:p.x,y:p.y},{x:p.x-3,y:p.y-3},colors[2],1);return true;
 }
 if(sp==='bananeira'){for(let j=0;j<3;j++)line(ctx,{x:p.x+j-2,y:p.y-2},{x:p.x+j,y:p.y+4},colors[j%2?0:2],2);return true;}
 ellipse(ctx,p.x,p.y,s*(sp==='limoeiro'?.85:1),s*(sp==='limoeiro'?1.2:1),colors[0]);
 ellipse(ctx,p.x-s*.32,p.y-s*.27,Math.max(1,s*.36),Math.max(1,s*.31),colors[2]);
 line(ctx,{x:p.x,y:p.y-s},{x:p.x+1,y:p.y-s-2},'#554629',1);
 if(r()>.6)ellipse(ctx,p.x+2,p.y-s-1,2,1.2,'#6d8d45');
 return true;
}

function g21DrawOrgan(ctx,item,st,cam,params,col){
 if(st.tree.catalogSpecies && g25DrawOrgan(ctx,item,st,cam,params))return;
 const p=project(item.p,cam),r=rand(item.site.seed);
 if(params.phenology==='floracao'){
  if(st.tree.species==='pinheiro'){ellipse(ctx,p.x,p.y,2,3,'#c5a256');ellipse(ctx,p.x-1,p.y-1,1,1,'#e7c47a');}
  else if(st.tree.species==='coqueiro'){ellipse(ctx,p.x,p.y,2,2,'#f2da9e');ellipse(ctx,p.x-1,p.y-1,1,1,'#fff1ca');}
  else {for(let i=0;i<4;i++){const a=i*TAU/4;ellipse(ctx,p.x+Math.cos(a)*2,p.y+Math.sin(a)*2,1.6,1.7,'#f4e5c2');}ellipse(ctx,p.x,p.y,1,1,'#d4ac4c');}
 }else if(st.tree.species==='pinheiro'){
  poly(ctx,[{x:p.x-2,y:p.y-1},{x:p.x,y:p.y-4},{x:p.x+2,y:p.y-1},{x:p.x+2,y:p.y+4},{x:p.x-2,y:p.y+4}],'#67502e');
  line(ctx,{x:p.x-1,y:p.y},{x:p.x+1,y:p.y+2},'#b18b5a',1);
 }else if(st.tree.species==='coqueiro'){
  ellipse(ctx,p.x,p.y,3.5,4,'#6c4926');ellipse(ctx,p.x-1,p.y-1,2,2,'#b59c56');
 }else{
  ellipse(ctx,p.x,p.y,2.4,3,'#855a27');ellipse(ctx,p.x-1,p.y-1,1,1,'#c39a4d');
 }
}
function g21VineGeometry(st,vine,cam=buildCamera(50)){
 const branches=new Map(st.visible.map(b=>[b.id,b]));
 const a=branches.get(vine.aId);
 if(!a || a.show<.15 || st.g.growth<.53)return null;
 const front=a.depthRank>=0;
 const pa=mix3(a.mid,a.to,vine.fromT);
 const maturity=smooth((st.g.growth-.51)/.28);
 const r=rand(vine.seed), points=[];
 const nb=vine.kind==='bridge'&&vine.bId?branches.get(vine.bId):null;
 if(nb && nb.show>.15){
  const pb=mix3(nb.mid,nb.to,vine.toT);
  const dist=Math.hypot(pa.x-pb.x,pa.y-pb.y),vertical=Math.abs(pa.z-pb.z);
  if(dist>=11 && dist<=78 && vertical<=31){
   const sag=(6+Math.min(26,dist*.32))*maturity;
   for(let i=0;i<=20;i++){
    const t=i/20,point=mix3(pa,pb,t);
    point.z-=Math.sin(Math.PI*t)*sag;
    point.x+=Math.sin(Math.PI*t)*vine.sway*.16;
    points.push(point);
   }
  }
 }
 if(points.length===0){
  const rawLen=vine.hang*(.40+.60*maturity)*Math.sqrt(st.g.vertical);
  const baseY=project(pa,cam).y;
  const len=Math.max(0,Math.min(rawLen,(240-baseY)/Math.max(.18,cam.verticalHeight)));
  if(len<5)return null;
  for(let i=0;i<=20;i++){
   const t=i/20;
   points.push(pt(pa.x+t*(vine.sway+3*Math.sin(t*Math.PI*1.4)),
      pa.y+t*(1.5+2*Math.sin(t*Math.PI*1.1)), pa.z-len*t));
  }
 }
 return {points,side:front?'front':'rear',kind:(nb&&points.length>0&&vine.kind==='bridge')?'bridge':'pendant',seed:vine.seed};
}
function g21DrawVines(ctx,st,cam,params,side='front'){
 if(st.tree.species!=='carvalho'||params.quality==='g1'||params.quality==='g2')return 0;
 const density=clamp(Number(params.vines??0),0,1);
 if(density<=0 || st.g.growth<.53)return 0;
 const sites=st.tree.vineSites||[];
 // Monotonic coverage. 25% always selects the same first 25% of the sites.
 const n=Math.ceil(sites.length*density);
 let drawn=0;
 for(let k=0;k<n;k++){
  const vine=sites[k],geo=g21VineGeometry(st,vine,cam);
  if(!geo || geo.side!==side)continue;
  const points=geo.points.map(p=>project(p,cam));
  if(points.length<2)continue;
  const r=rand(vine.seed),thickness=(st.g.growth>.85 && density>.65)?2:1;
  for(let i=0;i<points.length-1;i++){
   if(thickness>1)line(ctx,{x:points[i].x+.5,y:points[i].y},
      {x:points[i+1].x+.5,y:points[i+1].y},'#263b20',thickness);
   line(ctx,points[i],points[i+1],i%4===0?'#8aa15a':'#557143',1);
  }
  // Clusters are attached to a persistent strand, not randomly scattered on the image.
  for(let j=3;j<19;j+=3){
   const a=points[j],b=points[j+1],sgn=r()>.5?1:-1;
   const leafLen=2+r()*3,dx=sgn*leafLen,dy=1+r()*3;
   line(ctx,a,{x:a.x+dx,y:a.y+dy},'#395c33',1);
   ellipse(ctx,a.x+dx,a.y+dy,1.4,1.1,r()>.4?'#77944b':'#a3b866');
   if(r()>.63)line(ctx,{x:a.x+dx,y:a.y+dy},
      {x:a.x+dx+sgn*1,y:a.y+dy+2},'#66843e',1);
  }
  drawn++;
 }
 return drawn;
}

function g21DrawOak(ctx,st,cam,params,col){
 const masses=g2OakNodes(st,params).slice().sort((a,b)=>a.p.y-b.p.y||a.p.z-b.p.z);
 const bs=st.visible.slice().sort((a,b)=>a.depthRank-b.depthRank);
 g21DrawOrgans(ctx,st,cam,params,col,'rear');
 masses.filter(o=>o.p.y<0).forEach(o=>g21LeafMass(ctx,o,cam,col.leaf,params,'broad'));
 bs.filter(b=>b.depthRank<0).forEach(b=>g21Branch(ctx,b,st,cam,params,col.wood));
 g21Trunk(ctx,st,cam,params,col.wood);
 bs.filter(b=>b.depthRank>=0).forEach(b=>g21Branch(ctx,b,st,cam,params,col.wood));
 const backVines=g21DrawVines(ctx,st,cam,params,'rear');
 masses.filter(o=>o.p.y>=0).forEach(o=>g21LeafMass(ctx,o,cam,col.leaf,params,'broad'));
 // Visible tendrils are deliberately drawn after the near-leaf pass.
 const frontVines=g21DrawVines(ctx,st,cam,params,'front');
 g21DrawOrgans(ctx,st,cam,params,col,'front');
 return backVines+frontVines;
}
function g21DrawPine(ctx,st,cam,params,col){
 const bs=st.visible.slice().sort((a,b)=>a.depthRank-b.depthRank),nodes=[];
 for(const b of bs)nodes.push(...g2NeedleClusters(st,b,params));
 nodes.sort((a,b)=>a.p.y-b.p.y||a.p.z-b.p.z);
 g21DrawOrgans(ctx,st,cam,params,col,'rear');
 nodes.filter(o=>o.p.y<0).forEach(o=>g21LeafMass(ctx,o,cam,col.leaf,params,'needles'));
 bs.filter(b=>b.depthRank<0).forEach(b=>g21Branch(ctx,b,st,cam,params,col.wood));
 g21Trunk(ctx,st,cam,params,col.wood);
 bs.filter(b=>b.depthRank>=0).forEach(b=>g21Branch(ctx,b,st,cam,params,col.wood));
 nodes.filter(o=>o.p.y>=0).forEach(o=>g21LeafMass(ctx,o,cam,col.leaf,params,'needles'));
 g21DrawOrgans(ctx,st,cam,params,col,'front');
 const top=project(st.apex,cam),tipScale=.25+.75*st.g.growth**.55;
 for(let j=0;j<6;j++){
  const rr=rand(hash(st.tree.seed,'apex',j));
  line(ctx,{x:top.x+rrange(rr,-5,5)*tipScale,y:top.y+rrange(rr,0,5)*tipScale},
    {x:top.x+rrange(rr,-3,3)*tipScale,y:top.y-rrange(rr,4,11)*tipScale},col.leaf[j%3+3],1);
 }
}
function g21DrawPalm(ctx,st,cam,params,col){
 const bs=st.visible.slice().sort((a,b)=>a.depthRank-b.depthRank);
 bs.filter(b=>b.depthRank<0).forEach(b=>g2DrawFrond(ctx,b,st,cam,col.leaf,params));
 g21DrawOrgans(ctx,st,cam,params,col,'rear');
 g21Trunk(ctx,st,cam,params,col.wood);
 bs.filter(b=>b.depthRank>=0).forEach(b=>g2DrawFrond(ctx,b,st,cam,col.leaf,params));
 g21DrawOrgans(ctx,st,cam,params,col,'front');
 const p=project(st.apex,cam);ellipse(ctx,p.x,p.y,5*st.g.horizontal,3*st.g.horizontal,col.wood[2]);
}
function g21DrawOrgans(ctx,st,cam,params,col,side){
 const sites=g21GetOrgans(st,params).filter(x=>side==='rear'?x.depth<0:x.depth>=0).sort((a,b)=>a.depth-b.depth);
 for(const x of sites)g21DrawOrgan(ctx,x,st,cam,params,col);
 return sites.length;
}

// G2.4.1: production mode uses the actual G8 runtime (LRU/cache and generation jobs),
// while LeafEngine G7 supplies the real anatomy and genetic profiles.
const G24_LEAF_CACHE=new Map();
const G241_CROPPED_LEAVES=new WeakMap();
let G24_PRODUCTION=null;
function g24LeafModuleReady(){
 return !!(global.LeafEngine && typeof global.LeafEngine.renderLeaf==='function');
}
function g24LeafModuleEnabled(params={}){
 // g22 remains a TRUE baseline (without the G2.4 overlay).
 return g24LeafModuleReady() && params.crownLeafModule!==false && (params.quality==='g231'||params.quality==='g242'||params.quality==='g243'||params.quality==='g244');
}
function g24ProductionRuntime(){
 if(!G24_PRODUCTION && global.LeafProduction?.LeafProductionRuntime){
  G24_PRODUCTION=new global.LeafProduction.LeafProductionRuntime({
   engine:global.LeafEngine,memoryMB:16,spriteSize:64,maxPending:80,variantCount:5
  });
 }
 return G24_PRODUCTION;
}
function g24NormalizeSeason(season){
 return season==='outono'?'outono':season==='inverno'?'inverno':'verao';
}

function g24LeafBaseConfig(species,size,variant,season){
 const common={size:Math.round(clamp(size,48,72)),seed:2026+variant*137,variation:.23+variant*.025,
  texture:.60,veins:true,stem:true,lifeProgress:.60,season:g24NormalizeSeason(season),
  seasonIntensity:1,windStrength:0,time:0,curvature:.07,pitch:0,twist:0};
 const g25=typeof g25SpeciesProfile==='function' ? g25SpeciesProfile(species) : G25_SPECIES[species];
 if(g25){
  if(g25.leafSpecies)return {...common,species:g25.leafSpecies,geneticDiversity:g25.geneticProfile?.leafDiversity??.26};
  const conifer=g25.archetype==='pinheiro',palm=g25.archetype==='coqueiro';
  const cfg=g25.leafConfig||{};
  return {...common,
   shape:cfg.shape||g25.shape,structure:cfg.structure||'simples',
   length:cfg.length ?? (conifer?1.35:palm?1.45:clamp(g25.leafScale,.7,1.8)),
   width:cfg.width ?? (conifer?.48:palm?.55:clamp(g25.leafWidthScale,.46,1.48)),
   leafletCount:cfg.leafletCount,leafletSpread:cfg.leafletSpread,leafletScale:cfg.leafletScale,
   margin:cfg.margin||g25.margin,marginDetail:cfg.marginDetail ?? (g25.margin==='serrilhada'?.45:g25.margin==='lobada'?.60:.14),
   veinPattern:cfg.veinPattern || (conifer||palm?'paralela':'pinada'),stem:cfg.stem ?? !conifer,
   fold:cfg.fold ?? (palm?.13:.23),deciduous:g25.deciduous,curvature:cfg.curvature ?? common.curvature,
   leafColorRamp:cfg.leafColorRamp || (conifer?['#142a25','#234136','#39574a','#52735a','#719370','#96b49b','#bdd2b4']:
    palm?['#1b311a','#2d4f25','#497135','#699646','#93b45b','#bdd079','#d5e29c']:
    ['#1c2d18','#314924','#466732','#64843d','#8ea950','#b9cc6c','#d5dc8b'])};
 }
 if(species==='carvalho')return {...common,species:'quercus',geneticDiversity:.30};
 if(species==='pinheiro')return {...common,species:'pinus',geneticDiversity:.22};
 return {...common,shape:'lanceolada',structure:'simples',leafColorRamp:['#1c311a','#2d5021','#44752b','#699c38','#90b94e','#b4d06a','#d1e598'],length:1.46,width:.42,
  margin:'inteira',marginDetail:.08,veinPattern:'paralela',curvature:.12,fold:.10,deciduous:false};
}
function g24LeafSprite(species,displaySize,seedLike,season){
 if(!g24LeafModuleReady())return null;
 const variant=(seedLike>>>0)%5;
 const key=[species,variant,g24NormalizeSeason(season),G254_COLOR_CONTEXT.enabled?'ref'+Math.round(G254_COLOR_CONTEXT.strength*20):'original'].join('|');
 if(G24_LEAF_CACHE.has(key))return G24_LEAF_CACHE.get(key);
 // The leaf engine rasterizes at 64px BEFORE nearest-neighbour downscaling.
 // Pinus at 16-32px was fully transparent in G2.4.0; larger source preserves needles.
 const config=g24LeafBaseConfig(species,64,variant,season);
 const runtime=g24ProductionRuntime();
 let sprite=null;
 if(runtime){
  let response=runtime.requestSprite(config,{lod:0,priority:10});
  if(response.status==='pending'){
   runtime.tick({timeBudgetMs:1000,maxJobs:1});
   response=runtime.requestSprite(config,{lod:0,priority:10});
  }
  if(response.status==='ready')sprite=response.canvas;
  else if(response.status==='atlas'){
   const rect=response.rect,off=makeCanvas(1,1);
   off.width=rect.w;off.height=rect.h;
   off.getContext('2d').drawImage(response.canvas,rect.x,rect.y,rect.w,rect.h,0,0,rect.w,rect.h);
   sprite=off;
  }
 } else sprite=global.LeafEngine.renderLeaf(config);
 if(sprite){
  sprite=g254RetoneLeafSprite(sprite,species);
  if(G24_LEAF_CACHE.size>110)G24_LEAF_CACHE.delete(G24_LEAF_CACHE.keys().next().value);
  G24_LEAF_CACHE.set(key,sprite);
 }
 return sprite;
}
// G2.4.1: the 64px input leaf has large transparent margins.
// Crop that alpha-only area *before* scaling; scaling a whole 64px canvas
// caused anatomy that was 27x35px to end up just ~8x10px on the tree.
function g241VisibleLeaf(sprite){
 if(!sprite)return null;
 if(G241_CROPPED_LEAVES.has(sprite))return G241_CROPPED_LEAVES.get(sprite);
 const W=sprite.width,H=sprite.height;
 const data=sprite.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H).data;
 let x0=W,y0=H,x1=-1,y1=-1;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  if(data[(y*W+x)*4+3]<35)continue;
  x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);
 }
 if(x1<x0){G241_CROPPED_LEAVES.set(sprite,null);return null;}
 const c=makeCanvas(1,1);
 const margin=1;
 x0=Math.max(0,x0-margin);y0=Math.max(0,y0-margin);
 x1=Math.min(W-1,x1+margin);y1=Math.min(H-1,y1+margin);
 c.width=x1-x0+1;c.height=y1-y0+1;
 const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;
 ctx.drawImage(sprite,x0,y0,c.width,c.height,0,0,c.width,c.height);
 const o={canvas:c,width:c.width,height:c.height,ratio:c.width/c.height,x0,y0,originalW:W,originalH:H};
 G241_CROPPED_LEAVES.set(sprite,o);
 return o;
}
function g24StampLeaf(ctx,sprite,x,y,w,h,rotation=0,flip=false,alpha=1){
 const cut=g241VisibleLeaf(sprite);
 if(!cut)return false;
 const width=Math.max(1,Math.round(w)),height=Math.max(1,Math.round(h));
 ctx.save();
 ctx.imageSmoothingEnabled=false;
 ctx.globalAlpha=alpha;
 ctx.translate(Math.round(x),Math.round(y));
 ctx.rotate(rotation);
 ctx.scale(flip?-1:1,1);
 ctx.drawImage(cut.canvas,Math.round(-width/2),Math.round(-height/2),width,height);
 ctx.restore();
 return true;
}
function g241BotanicalCluster(ctx,node,st,cam,params,species,kind){
 if(!g24LeafModuleEnabled(params)){
  g21LeafMass(ctx,node,cam,colorsFor(st.tree,params.season).leaf,params,kind);
  return 0;
 }
 const p=project(node.p,cam),r=rand(hash(node.seed,'g241-cluster-bg',species));
 const density=clamp(Number(params.density??.98),.3,1.3);
 // Very small shadow core at the *real 3D anchor*, no huge cartoon blobs.
 if(kind==='broad'){
  ellipse(ctx,p.x,p.y,Math.max(1.2,node.rx*.28),Math.max(1.2,node.ry*.33),'#243e21');
  for(let i=0;i<2;i++){
   const t=r()*TAU,dx=Math.cos(t)*node.rx*.2,dy=Math.sin(t)*node.ry*.17;
   line(ctx,{x:p.x,y:p.y},{x:p.x+dx,y:p.y+dy},'#4a442a',1);
  }
 } else {
  // Keep a smaller conifer bough mass so the pinheiro remains a tree from afar.
  // Needles from the real LeafEngine define edges and internal detail.
  const backing={...node,rx:node.rx*.69,ry:node.ry*.68};
  const colors=colorsFor(st.tree,params.season);
  ctx.save();ctx.globalAlpha=.66;
  g21LeafMass(ctx,backing,cam,colors.leaf,{...params,detail:.55},'needles');
  ctx.restore();
 }
 return g24OverlayNodeLeaves(ctx,node,st,cam,params,species,kind);
}
function g24OverlayNodeLeaves(ctx,node,st,cam,params,species,kind='broad'){
 if(!g24LeafModuleEnabled(params) || st.g.growth<.26)return 0;
 const p=project(node.p,cam),r=rand(hash(node.seed,'g241-overlay',species,kind));
 const density=clamp(Number(params.density??1),.3,1.3),detail=clamp(Number(params.detail??1),.4,1.6);
 const maturity=.50+.50*st.g.horizontal;
 const open=clamp(Number(params.openness??.25),0,.7);
 const count=Math.max(1,Math.round((kind==='needles'?4.2:2.0)*density*detail*(node.rx/14.5)*maturity*(1-open*.40)));
 let drawn=0;
 for(let j=0;j<count;j++){
  const dx=rrange(r,-.66,.66)*node.rx,dy=rrange(r,-.58,.58)*node.ry;
  const drawSize=(kind==='needles'?11.7:13.5)*maturity*rrange(r,.80,1.19)*clamp(node.rx/13,.68,1.26);
  const sprite=g24LeafSprite(species,drawSize,hash(node.seed,j,'g241-sprite'),params.season);
  if(kind==='needles'){
   // Native Pinus is 2x42 alpha pixels on a 64px sprite: never stretch to square.
   const h=drawSize*rrange(r,.86,1.15),w=Math.max(1.2,h*.10);
   const rot=rrange(r,-1.25,1.25)+(dx>0?.16:-.16);
   if(g24StampLeaf(ctx,sprite,p.x+dx,p.y+dy,w,h,rot,r()>.5,.98))drawn++;
  }else{
   // Oak leaf retains its lobes and midrib at a visible 8–15px canopy footprint.
   const h=drawSize*rrange(r,.81,1.08),w=h*.79;
   const rot=rrange(r,-1.3,1.3);
   if(g24StampLeaf(ctx,sprite,p.x+dx,p.y+dy,w,h,rot,r()>.5,1))drawn++;
  }
 }
 return drawn;
}

/* G2.4.2 — persistent individual leaves attached to a projected 3D branch skeleton.
   A 512/1024 output is rasterized directly; no nearest-neighbour enlargement of a
   finished 256px image. Historical renderers remain exact at 256px. */
const G242_PROFILES=Object.freeze({
 carvalho:{leaf:'quercus',style:'lobada',count:9,length:14,width:.74,offset:8,stiffness:.34},
 pinheiro:{leaf:'pinus',style:'agulha',count:12,length:13,width:.105,offset:5,stiffness:.82},
 coqueiro:{leaf:'lanceolada',style:'foliolo',count:36,length:23,width:.22,offset:0,stiffness:.62}
});
function g242FoliageInstances(tree,args={},st=null){
 st=st||g231Structure(tree,args.growth??1,args);
 const density=clamp(Number(args.density??.98),.30,1.30);
 const openness=clamp(Number(args.openness??.25),0,.70);
 const profile=G242_PROFILES[tree.species],growth=st.g.growth;
 const branches=st.visible.slice();
 if(tree.species==='carvalho')branches.push(...g22Secondary(st,args));
 const byId=new Map(branches.map(b=>[b.id,b]));
 const sites=tree.morphology?.foliageSites||[];
 const out=[];
 if(tree.species==='coqueiro')return out; // palm leaves are frond-coordinate instances below
 if(tree.species==='carvalho'&&args.season==='inverno'&&!G25_SPECIES[tree.catalogSpecies]?.evergreen)return out;
 for(const bud of sites){
  const b=byId.get(bud.branchId);
  if(!b||b.show<.08||growth<bud.birth)continue;
  if(bud.priority>clamp(density*(1-openness*.46),0,1))continue;
  const life=smooth((growth-bud.birth)/Math.max(.06,.22));
  if(life<.02)continue;
  const at=mix3(b.mid,b.to,bud.u);
  const grow=st.g.horizontal;
  const branchDir=b.az||0;
  const scatter=(tree.species==='pinheiro'?6.5:9.8)*grow*(.52+.48*life);
  const normal=branchDir + bud.side*Math.PI/2;
  const wpos=add(at,pt(Math.cos(normal)*bud.normal*scatter,
                        Math.sin(normal)*bud.normal*scatter,
                        bud.lift*scatter*.62));
  const size=profile.length*bud.size*(.56+.44*life)*(.45+.55*grow);
  const rot=tree.species==='pinheiro'?branchDir-bud.side*.5+bud.angle*.65:bud.angle+branchDir*.26;
  out.push({id:bud.id,branchId:bud.branchId,seed:bud.seed,p:wpos,
   side:bud.side,length:size,width:size*profile.width,
   rotation:rot,show:life,depth:wpos.y,kind:profile.style});
 }
 return out.sort((a,b)=>a.depth-b.depth||a.p.z-b.p.z||a.id.localeCompare(b.id));
}
const G242_TINT_CACHE=new WeakMap();
function g242TintedSprite(sprite,tone){
 if(!sprite || tone===1)return sprite;
 let group=G242_TINT_CACHE.get(sprite);
 if(!group){group=new Map();G242_TINT_CACHE.set(sprite,group);}
 if(group.has(tone))return group.get(tone);
 const result=makeCanvas(1,1);result.width=sprite.width;result.height=sprite.height;
 const ctx=result.getContext('2d',{willReadFrequently:true});ctx.drawImage(sprite,0,0);
 const pixels=ctx.getImageData(0,0,result.width,result.height),a=pixels.data;
 const factor=tone===0?.77:1.09;
 for(let i=0;i<a.length;i+=4){
  if(!a[i+3])continue;
  a[i]=Math.min(255,Math.round(a[i]*factor));
  a[i+1]=Math.min(255,Math.round(a[i+1]*factor));
  a[i+2]=Math.min(255,Math.round(a[i+2]*(tone===2?1.04:.94)));
 }
 ctx.putImageData(pixels,0,0);group.set(tone,result);return result;
}
function g242DrawInstancedLeaves(ctx,items,st,cam,params){
 let count=0;
 const species=st.tree.species;
 for(const leaf of items){
  const at=project(leaf.p,cam);
  const src=g24LeafSprite(species,64,leaf.seed,params.season);
  const tone=(hash(leaf.seed,'g242-light')%7<2?0:hash(leaf.seed,'g242-light')%7>4?2:1);
  const sprite=g242TintedSprite(src,tone);
  const h=leaf.length,w=leaf.width;
  if(species==='pinheiro'){
   // Persistent fascicles: four native Pinus blades per woody attachment.
   for(let k=0;k<4;k++){
    const side=k-1.5,angle=leaf.rotation+side*.38;
    const step=(k%2?1.2:2.3),x=at.x+Math.cos(angle+Math.PI/2)*step*side;
    const y=at.y+Math.sin(angle+Math.PI/2)*step*side;
    if(g24StampLeaf(ctx,sprite,x,y,Math.max(.9,w*(.82+k*.05)),h*(.87+.03*k),angle,k%2===0,1))count++;
   }
  }else if(g24StampLeaf(ctx,sprite,at.x,at.y,w,h,leaf.rotation,leaf.side<0,1))count++;
 }
 return count;
}
/* G2.4.3 — anatomical attachment. LeafEngine's simple leaf is drawn with its
   botanical base DOWN (local positive Y), tip UP (negative Y). Never position
   the cropped sprite by its centre: its petiole must meet a branch anchor.
   G8 draws petioles/rachises of compound leaves, not tree branch architecture.
   This adapter builds a short petiole attached to our persistent woody skeleton. */
function g243StampAttachedLeaf(ctx,sprite,anchor,heading,length,width,mirror=false){
 const cut=g241VisibleLeaf(sprite);if(!cut)return false;
 // Anatomical base at lower center of alpha bounds (includes G8 petiole).
 // Clip metadata keeps the base stable if the original sprite has large margins.
 const baseX=cut.width*.50,baseY=cut.height-1;
 const targetW=Math.max(1,Number(width)||1),targetH=Math.max(1,Number(length)||1);
 const sx=targetW/cut.width,sy=targetH/cut.height;
 // In local coordinates a botanical leaf grows towards -Y. This angle makes
 // local -Y coincide with the actual tangent pointing AWAY from the parent.
 const rot=heading+Math.PI*.5;
 ctx.save();ctx.imageSmoothingEnabled=false;
 ctx.translate(Math.round(anchor.x),Math.round(anchor.y));ctx.rotate(rot);
 if(mirror)ctx.scale(-1,1);
 ctx.drawImage(cut.canvas,-baseX*sx,-baseY*sy,targetW,targetH);
 ctx.restore();
 return true;
}
function g243AttachedInstances(tree,params={},st=null,cam=null){
 st=st||g231Structure(tree,params.growth??1,params);cam=cam||buildCamera(params.angle??50);
 const density=clamp(Number(params.density??.98),.30,1.30);
 const openness=clamp(Number(params.openness??.25),0,.70);
 const profile=G242_PROFILES[tree.species];
 if(tree.species==='coqueiro'||(tree.species==='carvalho'&&params.season==='inverno'&&!G25_SPECIES[tree.catalogSpecies]?.evergreen))return [];
 const all=st.visible.slice();if(tree.species==='carvalho')all.push(...g22Secondary(st,params));
 const byId=new Map(all.map(b=>[b.id,b]));
 const result=[];
 for(const site of tree.morphology?.foliageSites||[]){
  const branch=byId.get(site.branchId);
  if(!branch||branch.show<.08||st.g.growth<site.birth)continue;
  if(site.priority>clamp(density*(1-openness*.46),0,1))continue;
  const life=smooth((st.g.growth-site.birth)/Math.max(.06,.22));if(life<.02)continue;
  // Every leaf BASE is ON the parent branch (between its mid and its tip).
  const parent=mix3(branch.mid,branch.to,site.u);
  const parentPx=project(parent,cam),mid=project(branch.mid,cam),tip=project(branch.to,cam);
  let dx=tip.x-mid.x,dy=tip.y-mid.y,norm=Math.hypot(dx,dy);
  if(norm<.05){dx=Math.cos(branch.az||0);dy=-.5;norm=Math.hypot(dx,dy);}
  dx/=norm;dy/=norm;
  // Variation is CONSTRAINED: every leaflet tip points at least partly toward
  // the parent branch's outer end. This prevents reversed/upside-down leaves.
  const spread=tree.species==='pinheiro'?.75+.46*((site.seed%997)/997):.44+.58*((site.seed%911)/911);
  const theta=site.side*spread;
  const outX=dx*Math.cos(theta)-dy*Math.sin(theta),outY=dx*Math.sin(theta)+dy*Math.cos(theta);
  const length=profile.length*site.size*(.58+.42*life)*(.47+.53*st.g.horizontal);
  const petiole=tree.species==='pinheiro'?Math.max(.6,length*.12):Math.max(1.25,length*.24);
  const start={x:parentPx.x,y:parentPx.y};
  const anchor={x:start.x+outX*petiole,y:start.y+outY*petiole};
  const pointed={x:anchor.x+outX*length,y:anchor.y+outY*length};
  result.push({id:site.id,branchId:site.branchId,seed:site.seed,side:site.side,
   base:start,attachment:anchor,tip:pointed,heading:Math.atan2(outY,outX),
   length,width:length*profile.width,petiole,depth:parent.y,z:parent.z,
   dot:outX*dx+outY*dy,woodSeed:branch.foliageSeed||hash(branch.id,'wood')});
 }
 return result.sort((a,b)=>a.depth-b.depth||a.z-b.z||a.id.localeCompare(b.id));
}
function g243DrawAttachedLeaves(ctx,items,st,cam,params,debug=false){
 let count=0;const species=st.tree.species;
 const wood=colorsFor(st.tree,params.season).wood;
 for(const leaf of items){
  const src=g24LeafSprite(species,64,leaf.seed,params.season);
  const tone=(hash(leaf.seed,'g242-light')%7<2?0:hash(leaf.seed,'g242-light')%7>4?2:1);
  const sprite=g242TintedSprite(src,tone);
  // Petiole has the exact same base as the wood geometry, without any scatter.
  const explain=debug&&hash(leaf.id,'anchor-debug')%13===0;
  if(species==='pinheiro'){
   // Four fascicle needles, each base anchored at the same woody node.
   for(let k=0;k<4;k++){
    const deviation=(k-1.5)*.17;
    const angle=leaf.heading+deviation;
    const xdir=Math.cos(angle),ydir=Math.sin(angle);
    const stemEnd={x:leaf.base.x+xdir*leaf.petiole,y:leaf.base.y+ydir*leaf.petiole};
    if(explain)line(ctx,leaf.base,stemEnd,'#edc35d',1);
    else line(ctx,leaf.base,stemEnd,wood[2],1);
    if(g243StampAttachedLeaf(ctx,sprite,stemEnd,angle,leaf.length*(.86+.04*k),Math.max(.8,leaf.width*(.9+.03*k)),k%2===0))count++;
   }
  }else{
   line(ctx,leaf.base,leaf.attachment,explain?'#edc35d':'#585033',Math.max(1,leaf.petiole*.19));
   if(g243StampAttachedLeaf(ctx,sprite,leaf.attachment,leaf.heading,leaf.length,leaf.width,leaf.side<0))count++;
  }
  if(explain){
   ellipse(ctx,leaf.base.x,leaf.base.y,1.35,1.35,'#fa7154');
   line(ctx,leaf.attachment,leaf.tip,'#80c7f2',1);
  }
 }
 return count;
}
function g243DrawOak(ctx,st,cam,params,col){
 const children=g22Secondary(st,params),all=g243AttachedInstances(st.tree,params,st,cam);
 const primary=st.visible.slice().sort((a,b)=>a.depthRank-b.depthRank);
 const twigs=children.slice().sort((a,b)=>a.depthRank-b.depthRank);
 const behind=all.filter(x=>x.depth<0),ahead=all.filter(x=>x.depth>=0);
 let drawn=g243DrawAttachedLeaves(ctx,behind,st,cam,params,params.showLeafAnchors===true);
 g21DrawOrgans(ctx,st,cam,params,col,'rear');
 for(const b of primary.filter(x=>x.depthRank<0))g21Branch(ctx,b,st,cam,params,col.wood);
 for(const b of twigs.filter(x=>x.depthRank<0))g22Twig(ctx,b,st,cam,col.wood);
 g21Trunk(ctx,st,cam,params,col.wood);
 for(const b of primary.filter(x=>x.depthRank>=0))g21Branch(ctx,b,st,cam,params,col.wood);
 for(const b of twigs.filter(x=>x.depthRank>=0))g22Twig(ctx,b,st,cam,col.wood);
 const v1=g21DrawVines(ctx,st,cam,params,'rear');
 drawn+=g243DrawAttachedLeaves(ctx,ahead,st,cam,params,params.showLeafAnchors===true);
 const v2=g21DrawVines(ctx,st,cam,params,'front');
 g21DrawOrgans(ctx,st,cam,params,col,'front');
 return {vines:v1+v2,secondary:children.length,clusters:0,leafSprites:drawn,leafInstances:all.length,attachmentMode:'petiole_to_woody_branch'};
}
function g243DrawPine(ctx,st,cam,params,col){
 const all=g243AttachedInstances(st.tree,params,st,cam),branches=st.visible.slice().sort((a,b)=>a.depthRank-b.depthRank);
 let drawn=g243DrawAttachedLeaves(ctx,all.filter(x=>x.depth<0),st,cam,params,params.showLeafAnchors===true);
 g21DrawOrgans(ctx,st,cam,params,col,'rear');
 for(const b of branches.filter(x=>x.depthRank<0))g21Branch(ctx,b,st,cam,params,col.wood);
 g21Trunk(ctx,st,cam,params,col.wood);
 for(const b of branches.filter(x=>x.depthRank>=0))g21Branch(ctx,b,st,cam,params,col.wood);
 drawn+=g243DrawAttachedLeaves(ctx,all.filter(x=>x.depth>=0),st,cam,params,params.showLeafAnchors===true);
 g21DrawOrgans(ctx,st,cam,params,col,'front');
 const tip=project(st.apex,cam),r=rand(hash(st.tree.seed,'g242-apex'));
 for(let i=0;i<5;i++)line(ctx,{x:tip.x+rrange(r,-3,3),y:tip.y+2},
    {x:tip.x+rrange(r,-5,5),y:tip.y-rrange(r,5,12)},col.leaf[2+i%3],1);
 return {secondary:0,clusters:0,leafSprites:drawn,leafInstances:all.length,attachmentMode:'fascicles_to_woody_branch'};
}
function g243DrawPalm(ctx,st,cam,params,col){
 const sorted=st.visible.slice().sort((a,b)=>a.depthRank-b.depthRank);
 const byBranch=new Map();
 for(const site of st.tree.morphology?.foliageSites||[]){
  const arr=byBranch.get(site.branchId)||[];arr.push(site);byBranch.set(site.branchId,arr);
 }
 let count=0;
 // Reuse the ORIGINAL deterministic frond Bezier + G8 leaf sprites, but anchor
 // their botanic bases exactly on a rachis sample rather than at leaflet midpoints.
 function drawFrond(b){
  const r=rand(hash(b.foliageSeed,'g22-natural-frond'));
  const grav=rrange(r,24,46)*st.g.vertical*b.show;
  const reach=rrange(r,.90,1.07),end=pt(b.from.x+(b.to.x-b.from.x)*reach,b.from.y+(b.to.y-b.from.y)*reach,b.to.z-grav);
  const cp1=mix3(b.from,end,.24),cp2=mix3(b.from,end,.68);
  cp1.z+=rrange(r,13,24)*st.g.vertical;cp2.z+=rrange(r,-4,9)*st.g.vertical;
  const curve=Array.from({length:33},(_,i)=>bezier(b.from,cp1,cp2,end,i/32));
  for(let i=0;i<32;i++){
   const a=project(curve[i],cam),z=project(curve[i+1],cam);
   line(ctx,a,z,i<12?col.leaf[2]:col.leaf[1],i<10?2:1);
  }
  const byKey=new Map((byBranch.get(b.id)||[]).map(s=>[Math.round(s.u*32)+'|'+s.side,s]));
  for(let j=2;j<31;j++){
   const u=j/32,p=curve[j],arch=Math.pow(Math.sin(Math.PI*u),.81);
   const len=rrange(r,16,24)*arch*st.g.horizontal*b.show;
   for(const side of [-1,1]){
    const bud=byKey.get(j+'|'+side);
    if(!bud||st.g.growth<bud.birth||bud.priority>clamp(Number(params.density??1),.3,1.3))continue;
    const az=b.az+side*Math.PI*.5+rrange(r,-.13,.13);
    const droop=rrange(r,3.5,10)*st.g.vertical*(.45+u*.9);
    const outer=add(p,polar(az,len,-droop));
    const base=project(p,cam),tip=project(outer,cam);
    const dx=tip.x-base.x,dy=tip.y-base.y,dist=Math.hypot(dx,dy);
    if(dist<.25)continue;
    const src=g24LeafSprite(st.tree.catalogSpecies||'coqueiro',64,bud.seed,params.season);
    const tone=(hash(bud.seed,'shade')%6<2?0:hash(bud.seed,'shade')%6>4?2:1);
    const sprite=g242TintedSprite(src,tone);
    const angle=Math.atan2(dy,dx);
    if(params.showLeafAnchors&&hash(bud.id,'anchor-debug')%11===0){ellipse(ctx,base.x,base.y,1.1,1.1,'#fa7154');line(ctx,base,tip,'#80c7f2',1);}
    // Base begins on the rachis. Tip points away from it on both sides.
    if(g243StampAttachedLeaf(ctx,sprite,base,angle,Math.max(5,Math.min(25,dist)),Math.max(1.25,Math.min(st.tree.catalogSpecies==='bananeira'?12:4.4,dist*(st.tree.catalogSpecies==='bananeira'?.9:.20))),side<0))count++;
   }
  }
 }
 for(const b of sorted.filter(x=>x.depthRank<0))drawFrond(b);
 g21DrawOrgans(ctx,st,cam,params,col,'rear');
 g21Trunk(ctx,st,cam,params,col.wood);
 for(const b of sorted.filter(x=>x.depthRank>=0))drawFrond(b);
 g21DrawOrgans(ctx,st,cam,params,col,'front');
 const q=project(st.apex,cam);
 ellipse(ctx,q.x,q.y,Math.max(2,4*st.g.horizontal),Math.max(1.5,3*st.g.horizontal),col.wood[2]);
 return {secondary:0,clusters:sorted.length,leafSprites:count,leafInstances:count,attachmentMode:'leaflet_base_to_rachis'};
}

function g242DrawOak(ctx,st,cam,params,col){
 const children=g22Secondary(st,params),all=g242FoliageInstances(st.tree,params,st);
 const primary=st.visible.slice().sort((a,b)=>a.depthRank-b.depthRank);
 const twigs=children.slice().sort((a,b)=>a.depthRank-b.depthRank);
 const rear=all.filter(o=>o.depth<0),front=all.filter(o=>o.depth>=0);
 const a=g242DrawInstancedLeaves(ctx,rear,st,cam,params);
 g21DrawOrgans(ctx,st,cam,params,col,'rear');
 for(const b of primary.filter(b=>b.depthRank<0))g21Branch(ctx,b,st,cam,params,col.wood);
 for(const b of twigs.filter(b=>b.depthRank<0))g22Twig(ctx,b,st,cam,col.wood);
 g21Trunk(ctx,st,cam,params,col.wood);
 for(const b of primary.filter(b=>b.depthRank>=0))g21Branch(ctx,b,st,cam,params,col.wood);
 for(const b of twigs.filter(b=>b.depthRank>=0))g22Twig(ctx,b,st,cam,col.wood);
 const backV=g21DrawVines(ctx,st,cam,params,'rear');
 const b=g242DrawInstancedLeaves(ctx,front,st,cam,params);
 const frontV=g21DrawVines(ctx,st,cam,params,'front');
 g21DrawOrgans(ctx,st,cam,params,col,'front');
 return {vines:backV+frontV,secondary:children.length,clusters:0,leafSprites:a+b,leafInstances:all.length};
}
function g242DrawPine(ctx,st,cam,params,col){
 const all=g242FoliageInstances(st.tree,params,st),branches=st.visible.slice().sort((a,b)=>a.depthRank-b.depthRank);
 // Draw small branches below the sprays, not the former opaque cartoon blobs.
 let drawn=g242DrawInstancedLeaves(ctx,all.filter(x=>x.depth<0),st,cam,params);
 g21DrawOrgans(ctx,st,cam,params,col,'rear');
 for(const b of branches.filter(x=>x.depthRank<0))g21Branch(ctx,b,st,cam,params,col.wood);
 g21Trunk(ctx,st,cam,params,col.wood);
 for(const b of branches.filter(x=>x.depthRank>=0))g21Branch(ctx,b,st,cam,params,col.wood);
 drawn+=g242DrawInstancedLeaves(ctx,all.filter(x=>x.depth>=0),st,cam,params);
 g21DrawOrgans(ctx,st,cam,params,col,'front');
 const tip=project(st.apex,cam),r=rand(hash(st.tree.seed,'g242-apex'));
 for(let i=0;i<5;i++)line(ctx,{x:tip.x+rrange(r,-3,3),y:tip.y+2},
    {x:tip.x+rrange(r,-5,5),y:tip.y-rrange(r,5,12)},col.leaf[2+i%3],1);
 return {secondary:0,clusters:0,leafSprites:drawn,leafInstances:all.length};
}
/* G2.2 — deterministic hierarchical botany and material-aware 2.5D painting.
   All secondary shoots are derived from sites stored in create(). The primary
   adult structure and all G2.1.3 renderer functions remain available. */
function g22Secondary(st,params={}){
 const fraction=clamp(Number(params.branchComplexity??1),0,1);
 const byId=new Map(st.visible.map(b=>[b.id,b])),out=[];
 for(const site of st.tree.morphology?.secondarySites||[]){
  if(hash(st.tree.seed,'g22-complexity',site.id)/4294967296>=fraction)continue;
  const parent=byId.get(site.parentId);if(!parent||parent.show<.25)continue;
  const alive=smooth((st.g.growth-site.birth)/Math.max(.001,1-site.birth));
  if(alive<.025)continue;
  const from=mix3(parent.mid,parent.to,site.at),heading=parent.az+site.angleOffset;
  const spread=site.spread*st.g.horizontal*alive*(.55+.45*parent.show);
  const to=add(from,polar(heading,spread,site.rise*st.g.vertical*alive));
  const mid=add(mix3(from,to,.53),pt(Math.cos(heading+Math.PI/2)*site.twist*.25,Math.sin(heading+Math.PI/2)*site.twist*.25,2.7*st.g.vertical));
  const shoot={...site,id:site.id,from,mid,to,az:heading,show:alive,radius:Math.max(.45,parent.radius*.43),depthRank:Math.sin(heading),type:'secondary'};
  out.push(st.windParams?g244BendBranch(shoot,st.windParams,st.tree.species,true):shoot);
 }
 return out;
}
function g22LeafSites(st,parents,children,params){
 const out=[],growth=st.g.growth;
 const density=clamp(Number(params.density??.98),.3,1.3);
 const open=clamp(Number(params.openness??.25),0,.7);
 const seasonal=params.season==='inverno'?0:(params.season==='outono'?.79:1);
 if(!seasonal)return out;
 // Outer tufts favor terminal secondary shoots; avoid hollow random blobs.
 const nodes=children.length?children:parents.filter(b=>b.show>.13);
 for(const b of nodes){
  if(b.show<.12)continue;
  const r=rand(hash(st.tree.seed,'g22-leaves',b.id));
  const count=Math.max(1,Math.round((children.length?3.3:2.3)*density*seasonal*b.show*(1-open*.30)));
  for(let j=0;j<count;j++){
   const t=rrange(r,.38,1.0);
   const p=add(mix3(b.mid,b.to,t),polar(rrange(r,-Math.PI,Math.PI),rrange(r,2,9)*st.g.horizontal,rrange(r,-6,8)*st.g.vertical));
   const rc=Math.hypot(p.x,p.y),cap=st.profile.crownRadius*st.g.horizontal*1.20;
   if(rc>cap)continue;
   const size=rrange(r,7.4,12.4)*st.g.horizontal*(.62+.38*b.show);
   out.push({id:'cluster:'+b.id+':'+j,seed:hash(st.tree.seed,'g22-canopy',b.id,j),p,
    rx:size*rrange(r,1.12,1.58),ry:size*rrange(r,.69,.95),crownBase:st.profile.canopyCenter*st.g.vertical,crownRadius:st.profile.crownRadius*st.g.horizontal,clusterRank:rc/cap});
  }
 }
 // Minimal interior shell supported by permanent boughs, never arbitrary
 // leaf blobs floating in unoccupied canopy space.
 for(const b of parents.filter(b=>b.show>.45&&b.anchor>.48)){
  const r=rand(hash(st.tree.seed,'g22-inner',b.id));
  if(r() < .24+open*.32)continue;
  const p=mix3(b.from,b.mid,rrange(r,.55,.92));
  const sz=rrange(r,7.4,10.2)*st.g.horizontal;
  out.push({id:'inner:'+b.id,seed:hash(st.tree.seed,'g22-inner-leaf',b.id),p,
   rx:sz*1.30,ry:sz*.84,crownBase:st.profile.canopyCenter*st.g.vertical,crownRadius:st.profile.crownRadius*st.g.horizontal,clusterRank:.5});
 }
 return out.sort((a,b)=>a.p.y-b.p.y || a.p.z-b.p.z);
}
function g22DrawOak(ctx,st,cam,params,col){
 const children=g22Secondary(st,params), leaves=g22LeafSites(st,st.visible,children,params);
 const primary=st.visible.slice().sort((a,b)=>a.depthRank-b.depthRank);
 const twigs=children.slice().sort((a,b)=>a.depthRank-b.depthRank);
 const back=o=>o.p.y<0;
 let leafSprites=0;
 g21DrawOrgans(ctx,st,cam,params,col,'rear');
 for(const l of leaves.filter(back)){
  leafSprites+=g241BotanicalCluster(ctx,l,st,cam,params,'carvalho','broad');
 }
 for(const b of primary.filter(b=>b.depthRank<0))g21Branch(ctx,b,st,cam,params,col.wood);
 for(const b of twigs.filter(b=>b.depthRank<0))g22Twig(ctx,b,st,cam,col.wood);
 g21Trunk(ctx,st,cam,params,col.wood);
 for(const b of primary.filter(b=>b.depthRank>=0))g21Branch(ctx,b,st,cam,params,col.wood);
 for(const b of twigs.filter(b=>b.depthRank>=0))g22Twig(ctx,b,st,cam,col.wood);
 const backV=g21DrawVines(ctx,st,cam,params,'rear');
 for(const l of leaves.filter(x=>!back(x))){
  leafSprites+=g241BotanicalCluster(ctx,l,st,cam,params,'carvalho','broad');
 }
 const frontV=g21DrawVines(ctx,st,cam,params,'front');
 g21DrawOrgans(ctx,st,cam,params,col,'front');
 return {vines:backV+frontV,secondary:children.length,clusters:leaves.length,leafSprites};
}
function g22Twig(ctx,b,st,cam,wood){
 const f=project(b.from,cam),m=project(b.mid,cam),t=project(b.to,cam);
 line(ctx,f,m,wood[1],Math.max(1,b.radius*1.7));
 line(ctx,m,t,wood[2],Math.max(1,b.radius));
 if(b.show>.45)line(ctx,f,{x:lerp(f.x,m.x,.65),y:lerp(f.y,m.y,.65)},wood[3],1);
}
function g22PinePadSites(st,params){
 const density=clamp(Number(params.density??.98),.3,1.3),open=clamp(Number(params.openness??.25),0,.7);
 const result=[];
 for(const b of st.visible){
  if(b.show<.10)continue;
  const r=rand(hash(st.tree.seed,'g22-needle-pad',b.id));
  const whorl=Number((b.id.match(/^whorl(\d+)/)||[])[1]||0);
  // Irregular whorl lengths, density and vertical distribution.
  const keep=hash(st.tree.seed,b.id,'g22-keep')%100/100;
  if(keep < (.055+open*.12)*(whorl%3===1?1.35:.6))continue;
  const pads=Math.max(1,Math.round((whorl>7?2.35:3.20)*density*b.show));
  for(let j=0;j<pads;j++){
   const t=rrange(r,.50,.97),p=add(mix3(b.mid,b.to,t),polar(b.az+Math.PI/2,rrange(r,-6,6)*st.g.horizontal,rrange(r,-5,9)*st.g.vertical));
   const size=rrange(r,10.2,15.5)*st.g.horizontal*(.76+whorl*.02);
   result.push({id:'needle:'+b.id+':'+j,seed:hash(st.tree.seed,'g22-needle',b.id,j),p,
    rx:size*rrange(r,1.35,1.83),ry:size*rrange(r,.75,1.07),crownBase:st.profile.canopyCenter*st.g.vertical,crownRadius:st.profile.crownRadius*st.g.horizontal});
  }
 }
 return result.sort((a,b)=>a.p.y-b.p.y||a.p.z-b.p.z);
}
function g22DrawPine(ctx,st,cam,params,col){
 const nodes=g22PinePadSites(st,params),bs=st.visible.slice().sort((a,b)=>a.depthRank-b.depthRank);
 let leafSprites=0;
 g21DrawOrgans(ctx,st,cam,params,col,'rear');
 for(const n of nodes.filter(o=>o.p.y<0)){
  leafSprites+=g241BotanicalCluster(ctx,n,st,cam,params,'pinheiro','needles');
 }
 for(const b of bs.filter(o=>o.depthRank<0))g21Branch(ctx,b,st,cam,params,col.wood);
 g21Trunk(ctx,st,cam,params,col.wood);
 for(const b of bs.filter(o=>o.depthRank>=0))g21Branch(ctx,b,st,cam,params,col.wood);
 for(const n of nodes.filter(o=>o.p.y>=0)){
  leafSprites+=g241BotanicalCluster(ctx,n,st,cam,params,'pinheiro','needles');
 }
 g21DrawOrgans(ctx,st,cam,params,col,'front');
 const r=rand(hash(st.tree.seed,'g22-apex'));
 const top=project(st.apex,cam);
 for(let i=0;i<7;i++){
  const a={x:top.x+rrange(r,-5,5)*st.g.horizontal,y:top.y+rrange(r,-2,3)*st.g.vertical};
  line(ctx,a,{x:a.x+rrange(r,-3,3),y:a.y-rrange(r,4,10)*st.g.horizontal},col.leaf[i%3+3],1);
 }
 return {secondary:0,clusters:nodes.length,leafSprites};
}
function g22Frond(ctx,b,st,cam,col,params){
 const r=rand(hash(b.foliageSeed,'g22-natural-frond'));
 const from=b.from,t=b.to,gravity=rrange(r,24,46)*st.g.vertical*b.show;
 const reach=rrange(r,.90,1.07),end=pt(from.x+(t.x-from.x)*reach,from.y+(t.y-from.y)*reach,t.z-gravity);
 const cp1=mix3(from,end,.24),cp2=mix3(from,end,.68);
 cp1.z+=rrange(r,13,24)*st.g.vertical;cp2.z+=rrange(r,-4,9)*st.g.vertical;
 const n=32,curve=Array.from({length:n+1},(_,i)=>bezier(from,cp1,cp2,end,i/n));
 const detail=clamp(Number(params.detail??1),.4,1.5),density=clamp(Number(params.density??1),.3,1.3);
 const useLeafModule=g24LeafModuleEnabled(params) && st.g.growth>.20;
 const permanentSites=params.quality==='g242'?
   new Map((st.tree.morphology?.foliageSites||[]).filter(x=>x.branchId===b.id)
      .map(x=>[Math.round(x.u*32)+'|'+x.side,x])):null;
 let leafSprites=0;
 for(let i=0;i<n;i++){
  const p0=project(curve[i],cam),p1=project(curve[i+1],cam);
  line(ctx,p0,p1,i<12?col[2]:col[1],i<10?2:1);
  if(i%5===0&&i<15)line(ctx,{x:p0.x-1,y:p0.y-1},{x:p1.x-1,y:p1.y-1},col[4],1);
 }
 for(let j=2;j<n-1;j++){
  if(r()>density*.97)continue;
  const u=j/n,p=curve[j];
  const arch=Math.pow(Math.sin(Math.PI*u),.81);
  const len=rrange(r,16,24)*arch*st.g.horizontal*b.show;
  for(const side of [-1,1]){
   const ax=b.az+side*Math.PI*.50+rrange(r,-.13,.13);
   const droop=rrange(r,3.5,10)*st.g.vertical*(.45+u*.9);
   const outer=add(p,polar(ax,len,-droop));
   const mid=add(mix3(p,outer,.57),pt(0,0,rrange(r,2.8,6)*st.g.vertical));
   const q0=project(p,cam),q=project(mid,cam),qt=project(outer,cam);
   const w=rrange(r,2.1,3.7)*detail*arch;
   const shade=Math.min(5,Math.max(1,Math.round(2+u*1.5+(side===-1?1:0)+(r()-.5)*2)));
   if(useLeafModule){
    const bud=permanentSites?.get(j+'|'+side);
    if(permanentSites && (!bud || st.g.growth<bud.birth))continue;
    const dx=qt.x-q0.x,dy=qt.y-q0.y,length=Math.hypot(dx,dy);
    const rawSprite=g24LeafSprite('coqueiro',Math.max(16,len),bud?.seed??hash(b.foliageSeed,'g242-frond',j,side),params.season);
    const sprite=params.quality==='g242'?g242TintedSprite(rawSprite,(hash(b.foliageSeed,j,side,'shade')%6<2?0:hash(b.foliageSeed,j,side,'shade')%6>4?2:1)):rawSprite;
    const angle=Math.atan2(dy,dx)+Math.PI*.5;
    const center={x:q0.x+dx*.50,y:q0.y+dy*.50};
    const h=Math.max(5,Math.min(25,length*1.02)),wid=Math.max(1.4,Math.min(4.6,h*.21));
    line(ctx,q0,qt,col[2],1);
    if(g24StampLeaf(ctx,sprite,center.x,center.y,wid,h,angle,side<0,1))leafSprites++;
   }else{
    poly(ctx,[q0,{x:q.x-w,y:q.y-w*.32},qt,{x:q.x+w*.62,y:q.y+w*.6}],col[shade]);
    if(j%5===0)line(ctx,q0,q,col[Math.min(5,shade+1)],1);
   }
  }
 }
 return leafSprites;
}
function g22DrawPalm(ctx,st,cam,params,col){
 const sorted=st.visible.slice().sort((a,b)=>a.depthRank-b.depthRank);
 let leafSprites=0;
 for(const b of sorted.filter(x=>x.depthRank<0))leafSprites+=g22Frond(ctx,b,st,cam,col.leaf,params);
 g21DrawOrgans(ctx,st,cam,params,col,'rear');
 g21Trunk(ctx,st,cam,params,col.wood);
 for(const b of sorted.filter(x=>x.depthRank>=0))leafSprites+=g22Frond(ctx,b,st,cam,col.leaf,params);
 g21DrawOrgans(ctx,st,cam,params,col,'front');
 const q=project(st.apex,cam);
 ellipse(ctx,q.x,q.y,Math.max(2,4*st.g.horizontal),Math.max(1.5,3*st.g.horizontal),col.wood[2]);
 return {secondary:0,clusters:sorted.length,leafSprites};
}

// Persistent early-stage botanical organs. These use stable per-individual seeds
// and locations attached to trunk nodes, not random screen-space spots.
// Cotyledons/seedling needles are shed naturally as the adult crown develops.
// No extra foliage is drawn from growth >= 55%, preserving adult assets exactly.
function drawJuvenileFoliage(ctx,st,cam,params,col){
 const g=st.g.growth;
 if(g>=.55)return;
 const species=st.tree.species,seed=st.tree.seed;
 const density=clamp(Number(params.density??.98),.3,1.3);
 const tip=project(st.apex,cam);
 const fade=1-smooth((g-.37)/.18);
 const drawLeaf=(x,y,rx,ry,c,id)=>g2Leaf(ctx,{x,y},rx,ry,c,hash(seed,'early-leaf',id));
 if(species==='carvalho'){
  // First leaves appear at germination, even if no woody branches have been born.
  if(g<.30){
   const r=rand(hash(seed,'oak-cotyledon'));
   const spread=2.1+Math.min(2.6,g*12),sy=tip.y+1;
   for(let k=0;k<2;k++){
    const dir=k?1:-1,reach=spread+rrange(r,-.3,.8);
    line(ctx,{x:tip.x,y:tip.y+2},{x:tip.x+dir*reach,y:sy-1},col.leaf[2],1);
    drawLeaf(tip.x+dir*(reach+.5),sy-1,1.8+g*4,1.45+g*3.4,col.leaf[k?4:3],'cot'+k);
   }
   drawLeaf(tip.x,tip.y-2,1.2+g*2,2+g*3,col.leaf[5],'shoot');
  }
  // Stable juvenile leaves on upper trunk. As full branch foliage matures,
  // these temporary first-year leaves taper out without changing the skeleton.
  const n=Math.round((3+g*32)*density*fade);
  for(let i=0;i<n;i++){
   const r=rand(hash(seed,'oak-juvenile-site',i));
   const t=.59+.39*r(),q=t*(st.trunk.length-1),a=Math.min(st.trunk.length-2,Math.floor(q));
   const p=project(mix3(st.trunk[a].p,st.trunk[a+1].p,q-a),cam);
   const dir=i%2?-1:1,reach=(2+st.g.horizontal*13)*(0.35+.7*r());
   const x=p.x+dir*reach,y=p.y-rrange(r,0,3+g*5);
   line(ctx,p,{x,y},col.wood[2],1);
   const sz=(1.6+g*5.3)*rrange(r,.75,1.12);
   drawLeaf(x,y,sz,sz*.77,col.leaf[2+i%4],i);
  }
 }else if(species==='pinheiro'){
  // A seedling conifer shows a real whorl of green needles at 5%.
  const crown=(3.1+g*12),n=Math.max(4,Math.round((5+g*18)*density*fade));
  for(let i=0;i<n;i++){
   const r=rand(hash(seed,'pine-juvenile-site',i)),t=.68+.31*r();
   const q=t*(st.trunk.length-1),a=Math.min(st.trunk.length-2,Math.floor(q));
   const p=project(mix3(st.trunk[a].p,st.trunk[a+1].p,q-a),cam);
   const dir=i%2?1:-1,reach=crown*(.45+r()*.85);
   line(ctx,p,{x:p.x+dir*reach,y:p.y-rrange(r,1,3+g*3)},col.leaf[i%2?3:4],1);
   if(r()>.37)line(ctx,{x:p.x+dir*reach*.50,y:p.y-1},
     {x:p.x+dir*reach*.75,y:p.y-rrange(r,3,5+g*5)},col.leaf[5],1);
  }
  const spears=2+Math.round(g*7*fade);
  for(let i=0;i<spears;i++){
   const r=rand(hash(seed,'pine-seedling-apex',i));
   const dx=rrange(r,-2,2)*(0.55+g*2.8),height=rrange(r,2,4)+g*9;
   line(ctx,tip,{x:tip.x+dx,y:tip.y-height},col.leaf[3+i%3],1);
  }
 }else if(species==='coqueiro'){
  // Coconut germination: visible seed and a narrow spear-shaped green sprout.
  // The seed fades as the young palm trunk and full fronds develop.
  if(g<.26){
   const base=project(st.trunk[0].p,cam),seedSize=3.8+Math.min(1.8,g*9);
   ellipse(ctx,base.x,base.y-1,seedSize,seedSize*.69,'#55402a');
   ellipse(ctx,base.x-1,base.y-2,seedSize*.62,seedSize*.45,'#977445');
  }
  const fronds=Math.max(2,Math.round((2+g*10)*fade));
  for(let i=0;i<fronds;i++){
   const r=rand(hash(seed,'palm-first-frond',i)),a=(i/fronds)*TAU+rrange(r,-.1,.1);
   const width=4+g*21,dx=Math.cos(a)*width,dy=Math.sin(a)*width*.26;
   const tipPoint={x:tip.x+dx,y:tip.y+dy+rrange(r,-1,2)};
   const mid={x:tip.x+dx*.42,y:tip.y-(3+g*10)};
   line(ctx,tip,mid,col.leaf[3],1);
   line(ctx,mid,tipPoint,col.leaf[3+i%2],1);
   const blade=clamp(2.3+g*4.5,2.5,5.1);
   poly(ctx,[mid,{x:mid.x+Math.cos(a+.7)*blade,y:mid.y-1.1},tipPoint,
     {x:mid.x+Math.cos(a-.7)*blade*.48,y:mid.y+blade*.2}],col.leaf[3+i%2]);
   line(ctx,mid,tipPoint,col.leaf[5],1);
  }
  // New emerging central spear remains identifiable at extremely low growth.
  line(ctx,tip,{x:tip.x+1,y:tip.y-(3+g*11)},col.leaf[5],1);
 }
}
function g22JuvenileFill(ctx,st,cam,params,col){
 const g=st.g.growth;
 if(g<.22||g>.68)return;
 const weight=smooth((g-.20)/.12)*(1-smooth((g-.52)/.16));
 if(weight<=.015)return;
 const isOak=st.tree.species==='carvalho',isPine=st.tree.species==='pinheiro';
 if(!isOak&&!isPine)return;
 const r=rand(hash(st.tree.seed,'g22-juvenile-crown'));
 const n=Math.round((isOak?7:6)*weight*clamp(Number(params.density??.98),.3,1.3));
 for(let i=0;i<n;i++){
  const b=st.apex,p=pt(b.x+rrange(r,-1,1)*(5+g*22)*st.g.horizontal,
   b.y+rrange(r,-1,1)*(5+g*16)*st.g.horizontal,
   b.z+rrange(r,-10,8)*st.g.vertical);
  const size=rrange(r,3.0,5.3)*(g/.35)**.47;
  const leaf={id:'juv:'+i,seed:hash(st.tree.seed,'g22-juv',i),p,
   rx:size*(isOak?1.45:1.28),ry:size*(isOak?.90:1.12),crownBase:st.profile.canopyCenter*st.g.vertical,crownRadius:st.profile.crownRadius*st.g.horizontal};
  g21LeafMass(ctx,leaf,cam,col.leaf,params,isPine?'needles':'broad');
 }
}
function drawSkeleton(ctx,st,cam){for(const b of st.visible){const f=project(b.from,cam),m=project(b.mid,cam),t=project(b.to,cam);line(ctx,f,m,'#ef546a',1);line(ctx,m,t,'#f3e468',1);ctx.fillStyle='#f3e468';ctx.fillRect(Math.round(t.x-1),Math.round(t.y-1),3,3)}}
function binarize(ctx,w=W,h=H){const data=ctx.getImageData(0,0,w,h);for(let k=0;k<data.data.length;k+=4){if(data.data[k+3]<140){data.data[k]=data.data[k+1]=data.data[k+2]=data.data[k+3]=0}else data.data[k+3]=255}ctx.putImageData(data,0,0)}

/* G2.4.4: shared botanical wind, applied to the real 3D branch skeleton.
   Primary bough bends first, secondary shoots inherit deformed anchors.
   All leaf stems are subsequently reconstructed from their moving parent.
   Wind=0 is an exact identity transform. */
const G244_WIND_STIFF={carvalho:.40,pinheiro:.77,coqueiro:.28};
function g244WindSample(seed,p,params,stiff=0){
 const w=clamp(Number(params.windStrength??0),0,1);if(w<.0001)return 0;
 const t=Number(params.time??0),g=clamp(Number(params.windGustiness??.55),0,1);
 const phase=hash(seed,'phase')/4294967296*TAU;
 const altitude=clamp(p.z/194,.12,1.2);
 const spatial=.75+.25*Math.sin(t*.69+p.x*.027+p.y*.021+p.z*.014);
 const gust=1+g*(.47*Math.sin(t*1.25+phase*.24+p.x*.028)+.24*Math.sin(t*2.1+phase*.5));
 const sway=.72*Math.sin(t*(.88+.13*(1-stiff))+phase*.30+p.z*.008)+.28*Math.sin(t*1.61+phase);
 return w*(3.2+altitude*5.4)*(1-stiff*.83)*spatial*gust*sway;
}
function g244BendBranch(b,params,species,sub=false){
 if(!(Number(params.windStrength)>0))return b;
 const dir=(Number(params.windDirection??25))*Math.PI/180;
 const stiffness=clamp((G244_WIND_STIFF[species]??.45)+(sub?-.20:0),.08,.92);
 const vec={x:Math.cos(dir),y:Math.sin(dir)};
 const a=g244WindSample(hash(b.id,'branch'),b.to,params,stiffness);
 const shift=k=>pt(vec.x*a*k,vec.y*a*k,Math.sin(dir)*a*.12*k);
 return {...b,mid:add(b.mid,shift(.33)),to:add(b.to,shift(1))};
}
function g244AnimatedStructure(base,params){
 if(!(Number(params.windStrength)>0))return base;
 return {...base,windParams:params,visible:base.visible.map(b=>g244BendBranch(b,params,base.tree.species))};
}
function g244VolumetricInstances(tree,params,st,cam){
 const density=clamp(Number(params.density??.98),.3,1.3),open=clamp(Number(params.openness??.25),0,.7);
 const volume=clamp(Number(params.canopyVolume??.70),0,1);
 if(tree.species==='coqueiro'||(tree.species==='carvalho'&&params.season==='inverno'&&!G25_SPECIES[tree.catalogSpecies]?.evergreen))return [];
 const branches=st.visible.slice();if(tree.species==='carvalho')branches.push(...g22Secondary(st,params));
 const branchById=new Map(branches.map(x=>[x.id,x]));
 const basic=G242_PROFILES[tree.species],botanic=g25SpeciesProfile(tree.catalogSpecies);
 const profile=botanic?{...basic,length:basic.length*botanic.leafScale,width:basic.width*botanic.leafWidthScale}:basic;
 const out=[];
 for(const site of tree.morphology.foliageSites||[]){
  const b=branchById.get(site.branchId);if(!b||st.g.growth<site.birth||b.show<.08)continue;
  if(site.priority>Math.min(1,density*(1-open*.48)))continue;
  const life=smooth((st.g.growth-site.birth)/.22);if(life<.02)continue;
  // Volumetric terminal shoot stays physically connected to parent wood in 3D.
  const parent=mix3(b.mid,b.to,site.u),len=(tree.species==='pinheiro'?2.3:3.7)*st.g.horizontal*(.48+.52*life);
  const az=b.az+site.side*(.24+Math.abs(site.normal)*.55);
  const lift=(tree.species==='pinheiro'?2.4:4.4)*site.lift*volume*st.g.vertical;
  const tip=add(parent,pt(Math.cos(az)*len*(.45+volume*.55),Math.sin(az)*len*(.45+volume*.55),lift));
  const anchorP=project(parent,cam),shootEnd=project(tip,cam),parentTip=project(b.to,cam),parentMid=project(b.mid,cam);
  let dx=parentTip.x-parentMid.x,dy=parentTip.y-parentMid.y,norm=Math.hypot(dx,dy);
  if(norm<.1){dx=Math.cos(az);dy=-.4;norm=Math.hypot(dx,dy)}dx/=norm;dy/=norm;
  const spread=(tree.species==='pinheiro'?.29:.36)+.19*(hash(site.seed,'spread')%100)/100;
  const theta=site.side*spread;
  const ox=dx*Math.cos(theta)-dy*Math.sin(theta),oy=dx*Math.sin(theta)+dy*Math.cos(theta);
  const botSize=profile.length*site.size*(.55+.45*life)*(.46+.54*st.g.horizontal);
  const petiole=Math.max(.8,botSize*(tree.species==='pinheiro'?.10:.18));
  const count=(hash(site.seed,'extra')%100<Math.floor(volume*34)&&tree.species==='carvalho')?2:1;
  for(let i=0;i<count;i++){
   const spread2=i===0?0:site.side*.33;
   const cs=Math.cos(spread2),sn=Math.sin(spread2),vx=ox*cs-oy*sn,vy=ox*sn+oy*cs;
   const stemBase=i===0?shootEnd:{x:lerp(anchorP.x,shootEnd.x,.65),y:lerp(anchorP.y,shootEnd.y,.65)};
   const le=botSize*(i===0?1:.81);
   const leafBase={x:stemBase.x+vx*petiole,y:stemBase.y+vy*petiole};
   // Species-specific floor clearance: a lamina cannot grow through the ground
   // just because perspective projects a low secondary branch towards the viewer.
   if(tree.catalogSpecies && leafBase.y+le*1.15>250)continue;
   out.push({id:site.id+':'+i,branchId:b.id,seed:site.seed,side:site.side,
    base:stemBase,attachment:leafBase,heading:Math.atan2(vy,vx),
    length:le,width:le*profile.width,petiole,depth:tip.y+site.lift*volume*2+i*.04,z:tip.z,kind:tree.species,
    shootA:anchorP,shootB:shootEnd,referenceDot:ox*dx+oy*dy});
  }
 }
 return out.sort((a,b)=>a.depth-b.depth||a.z-b.z||a.id.localeCompare(b.id));
}
function g244DrawFoliage(ctx,items,st,cam,params){
 let count=0;
 const sp=st.tree.species,wind=clamp(Number(params.windStrength??0),0,1),flutter=clamp(Number(params.leafFlutter??.6),0,1),t=Number(params.time??0);
 const woody=colorsFor(st.tree,params.season).wood;
 for(const leaf of items){
  if(!leaf.id.endsWith(':1'))line(ctx,leaf.shootA,leaf.shootB,woody[2],Math.max(1,sp==='carvalho'?1.2:.9));
  const src=g24LeafSprite(st.tree.catalogSpecies||sp,64,leaf.seed,params.season);
  const tone=hash(leaf.seed,'g244-tone')%7<2?0:hash(leaf.seed,'g244-tone')%7>4?2:1;
  const sprite=g242TintedSprite(src,tone);
  const phase=(hash(leaf.id,'flutter')%8192)/8192*TAU;
  const swing=wind*flutter*(sp==='pinheiro'?.06:.19)*(
    Math.sin(t*(sp==='pinheiro'?6.5:4.1)+phase)+.25*Math.sin(t*9.3+phase*.7));
  const angle=leaf.heading+swing;
  const length=leaf.length*(1+.025*wind*flutter*Math.sin(t*5.9+phase));
  const p={x:leaf.base.x+Math.cos(angle)*leaf.petiole,y:leaf.base.y+Math.sin(angle)*leaf.petiole};
  line(ctx,leaf.base,p,params.showLeafAnchors&&hash(leaf.id,'debug')%43===0?'#ff9c46':woody[2],1);
  if(params.showLeafAnchors&&hash(leaf.id,'debug')%43===0){ellipse(ctx,leaf.base.x,leaf.base.y,1.4,1.4,'#ff9c46');line(ctx,p,{x:p.x+Math.cos(angle)*length,y:p.y+Math.sin(angle)*length},'#62c8ff',1)}
  if(sp==='pinheiro'){
   const actual=st.tree.catalogSpecies;
   // Cedrus: clusters of needles on short shoots; Picea: radial needles;
   // Abies: flatter two-row needle comb. Pinus pilot keeps the 4-needle legacy.
   const mode=actual==='cedro'?'cluster':actual==='abeto'?'comb':actual==='picea'?'radial':'pinus';
   const n=mode==='cluster'?6:mode==='comb'?4:4;
   for(let k=0;k<n;k++){
    const delta=mode==='cluster'?(k-(n-1)/2)*.34:mode==='comb'?(k%2?1:-1)*(.18+.10*Math.floor(k/2)):(k-1.5)*.18;
    const r=angle+delta;
    const len=length*(mode==='cluster'?.68+.05*(k%3):mode==='comb'?.72+.06*Math.floor(k/2):.84+k*.04);
    const wid=Math.max(.65,leaf.width*(mode==='comb'?.66:.82+.05*k));
    if(g243StampAttachedLeaf(ctx,sprite,p,r,len,wid,k%2===0))count++;
   }
  }else if(g243StampAttachedLeaf(ctx,sprite,p,angle,length,leaf.width,leaf.side<0))count++;
 }
 return count;
}
// G2.5.2 — actual Salix weeping whips: fine branchlets drooping from their parent branch tips.
// They inherit the deformed attachment point from the primary branches, then bend independently.
function g252WeepingTwigs(ctx,st,cam,params,col,side){
 if(st.tree.catalogSpecies!=='salgueiro'||st.g.growth<.29)return 0;
 const leavesEnabled=params.crownLeafModule!==false&&g24LeafModuleReady();
 const twigs=st.visible.filter(b=>b.show>.22&&(side==='rear'?b.depthRank<0:b.depthRank>=0));
 const wind=clamp(Number(params.windStrength??0),0,1),time=Number(params.time??0),growth=st.g.horizontal;
 let count=0;
 for(const b of twigs){
  for(let arm=0;arm<2;arm++){
   const r=rand(hash(st.tree.seed,'g252-salix',b.id,arm));
   const source=mix3(b.mid,b.to,arm===0?.86:.64);
   const start=project(source,cam);
   const length=(18+21*r())*growth*(.36+.64*b.show);
   const sideways=(arm===0?1:-1)*(1.5+5*r());
   const phase=hash(b.id,arm,'weeping-phase')/4294967296*TAU;
   const sway=Math.sin(time*(1.1+r()*.25)+phase)*wind*3.0;
   const points=[];
   for(let i=0;i<=10;i++){
    const t=i/10,vertical=length*(t*t*.67+t*.33);
    points.push({x:start.x+sideways*t+Math.sin(t*3.8+phase)*t*1.8+sway*t*t,y:Math.min(244,start.y+vertical)});
   }
   for(let i=0;i<10;i++)line(ctx,points[i],points[i+1],i%3?col.wood[1]:col.wood[2],1);
   for(let i=2;i<=9;i+=2){
    if(!leavesEnabled)continue;
    const anchor=points[i],angle=Math.PI*.51+(arm===0?.28:-.28)+wind*.11*Math.sin(time*2+phase+i);
    const seed=hash(st.tree.seed,'g252-salix-leaf',b.id,arm,i);
    const sprite=g24LeafSprite('salgueiro',64,seed,params.season);
    const width=(2.0+r()*1.7)*growth,hlength=(6+r()*4)*growth;
    line(ctx,anchor,{x:anchor.x+Math.cos(angle)*2,y:anchor.y+Math.sin(angle)*2},col.wood[2],1);
    if(g243StampAttachedLeaf(ctx,sprite,{x:anchor.x+Math.cos(angle)*2,y:anchor.y+Math.sin(angle)*2},angle,hlength,width,arm!==0))count++;
   }
  }
 }
 return count;
}
function g244DrawOak(ctx,st,cam,params,col){
 const all=g244VolumetricInstances(st.tree,params,st,cam);
 const children=g22Secondary(st,params),primary=st.visible.slice().sort((a,b)=>a.depthRank-b.depthRank);
 const behind=all.filter(x=>x.depth<0),ahead=all.filter(x=>x.depth>=0);
 let leaves=g244DrawFoliage(ctx,behind,st,cam,params);
 leaves+=g252WeepingTwigs(ctx,st,cam,params,col,'rear');
 g21DrawOrgans(ctx,st,cam,params,col,'rear');
 for(const b of primary.filter(x=>x.depthRank<0))g21Branch(ctx,b,st,cam,params,col.wood);
 for(const b of children.filter(x=>x.depthRank<0))g22Twig(ctx,b,st,cam,col.wood);
 const vinesBack=g244DrawVines(ctx,st,cam,params,'rear');
 g21Trunk(ctx,st,cam,params,col.wood);
 for(const b of primary.filter(x=>x.depthRank>=0))g21Branch(ctx,b,st,cam,params,col.wood);
 for(const b of children.filter(x=>x.depthRank>=0))g22Twig(ctx,b,st,cam,col.wood);
 leaves+=g244DrawFoliage(ctx,ahead,st,cam,params);
 leaves+=g252WeepingTwigs(ctx,st,cam,params,col,'front');
 const vinesFront=g244DrawVines(ctx,st,cam,params,'front');
 g21DrawOrgans(ctx,st,cam,params,col,'front');
 return {leafSprites:leaves,leafInstances:all.length,secondary:children.length,clusters:all.length,vines:Math.max(vinesBack,vinesFront),attachmentMode:'3d_shoot_branch_petiole',windHierarchy:true,volumeLayers:3};
}

/* G2.5.3 — separate evergreen anatomies, independent of Pinus needle bundle logic.
   Conifer bud positions are stored in each individual and keep attachment IDs across
   growth and camera changes. Renderer deforms woody parents BEFORE their needle fans.
   Bark and leaf sprites remain sourced from the G2.5.2 / G8 layer. */
const G253_CONIFER_PROFILES=Object.freeze({
 cedro:{taxon:'Cedrus sp.',family:'Pinaceae',habit:'horizontal-storied',needleArrangement:'short-shoot-rosettes',woodTaper:.69,
  woodPalette:['#292824','#4b4840','#6c6658','#918777','#b1a48d'],barkPalette:['#23211d','#443f35','#6a6253','#8d806d','#c0ad92'],
  branchDroop:1.9,terminalLift:1.2,twigSpread:7.3,twigDroop:1.8,twigRise:.4,needlesPerBud:8,needleLength:5.8,needleWidth:1.55,budsPerBranch:9,
  leafPalette:['#182a24','#263f31','#345a3f','#4a7750','#648d5f','#89aa78','#b1c69a'],
  genetic:{architecture:'widely spaced horizontal tiers',foliarMorphology:'dense rosettes of single needles on short shoots',shootStrategy:'short shoots',barkTexture:'furrowed gray-brown',windStiffness:.78}},
 picea:{taxon:'Picea sp.',family:'Pinaceae',habit:'conical-pendant',needleArrangement:'radial-single',woodTaper:.75,
  woodPalette:['#2b201b','#483327','#704b35','#966e50','#c19871'],barkPalette:['#281c17','#503528','#775139','#a17b5b','#c4a180'],
  branchDroop:8.0,terminalLift:1.5,twigSpread:5.4,twigDroop:8.0,twigRise:-2.1,needlesPerBud:6,needleLength:5.2,needleWidth:1.35,budsPerBranch:10,
  leafPalette:['#142724','#20392f','#2d4c3a','#3d6448','#55805b','#78a184','#a7c3a2'],
  genetic:{architecture:'narrow pyramidal with pendent secondary branchlets',foliarMorphology:'individual radial needles',shootStrategy:'drooping shoots',barkTexture:'small scaly plates',windStiffness:.84}},
 abeto:{taxon:'Abies sp.',family:'Pinaceae',habit:'spire-horizontal',needleArrangement:'flattened-biserial',woodTaper:.72,
  woodPalette:['#2b2927','#4a443d','#71675a','#9b8e7c','#c2b3a0'],barkPalette:['#2d2c29','#56524b','#81786b','#afa391','#d0c4b2'],
  branchDroop:2.4,terminalLift:7.3,twigSpread:6.0,twigDroop:1.4,twigRise:1.0,needlesPerBud:8,needleLength:6.5,needleWidth:1.8,budsPerBranch:9,
  leafPalette:['#112923','#1b4034','#275746','#366e55','#4d8e69','#7eaa85','#bed5ac'],
  genetic:{architecture:'regular conical whorls with upward distal tips',foliarMorphology:'flattened mostly two-ranked needles',shootStrategy:'lateral flat sprays',barkTexture:'fine plates young; rougher old',windStiffness:.86}}
});
function g253BoughPoint(b,u,profile){
 const x=(1-u)*(1-u)*b.from.x+2*(1-u)*u*b.mid.x+u*u*b.to.x;
 const y=(1-u)*(1-u)*b.from.y+2*(1-u)*u*b.mid.y+u*u*b.to.y;
 let z=(1-u)*(1-u)*b.from.z+2*(1-u)*u*b.mid.z+u*u*b.to.z;
 const age=Math.max(0,Math.min(1,1-b.anchor));
 z-=profile.branchDroop*age*u*u;
 z+=profile.terminalLift*Math.pow(u,7);
 return {x,y,z};
}
function g253DrawConifer(ctx,st,cam,params,col){
 const actual=st.tree.catalogSpecies,profile=G253_CONIFER_PROFILES[actual];
 if(!profile)return g244DrawPine(ctx,st,cam,params,col);
 const growth=st.g.growth,density=clamp(Number(params.density??.98),.3,1.3);
 const detail=clamp(Number(params.detail??1),.4,1.6),openness=clamp(Number(params.openness??.25),0,.7);
 const sites=st.tree.morphology?.coniferBudSites||[];
 const byBranch=new Map();
 for(const s of sites){if(!byBranch.has(s.branchId))byBranch.set(s.branchId,[]);byBranch.get(s.branchId).push(s)}
 const branches=st.visible.slice().sort((a,b)=>a.depthRank-b.depthRank),wood=col.wood;
 const spriteVariants=new Map();
 let needles=0,twigs=0,budsDrawn=0;
 function foliage(b){
  if(growth<.22||b.show<.002)return;
  for(const site of byBranch.get(b.id)||[]){
   if(site.birth>growth||site.priority>Math.min(1,density*(1-openness*.34)))continue;
   const local=g253BoughPoint(b,site.t,profile),r=rand(site.seed);
   const a=b.az+site.side*(.24+site.angle*.60),reach=profile.twigSpread*st.g.horizontal*(.25+.75*clamp(b.show*8,0,1))*site.scale;
   const dir={x:Math.cos(a),y:Math.sin(a)},
    end={x:local.x+dir.x*reach,y:local.y+dir.y*reach,z:local.z+profile.twigRise*st.g.vertical-profile.twigDroop*(.6+.4*r())*st.g.vertical};
   const mid={x:(local.x+end.x)*.5,y:(local.y+end.y)*.5,z:(local.z+end.z)*.5+(actual==='cedro'?2.1:actual==='abeto'?1.3:-1.5)*st.g.vertical};
   const p0=project(local,cam),pm=project(mid,cam),p1=project(end,cam);
   line(ctx,p0,pm,wood[2],Math.max(1,b.radius*.52));
   line(ctx,pm,p1,wood[3],1);twigs++;
   const v={x:p1.x-pm.x,y:p1.y-pm.y},len=Math.max(.1,Math.hypot(v.x,v.y)),heading=Math.atan2(v.y,v.x),normal={x:-v.y/len,y:v.x/len};
   const evergreen=g254MaterialPalette(profile.leafPalette,'leaf',actual),juvenileScale=.38+.62*clamp(b.show*7,0,1);
   const qualitySeed=hash(st.tree.seed,site.id,'g253-needle');
   const src=g24LeafSprite(actual,64,qualitySeed,params.season);
   const spr=g242TintedSprite(src,hash(site.seed,'tone')%5<2?0:1);
   for(let n=0;n<profile.needlesPerBud;n++){
    const m=(n+.6)/profile.needlesPerBud;
    let pos={x:pm.x+(p1.x-pm.x)*m,y:pm.y+(p1.y-pm.y)*m};
    let theta,lt,wd;
    if(actual==='cedro'){
     // Rosette with short needles pointing around the terminal short shoot.
     const radial=(n/profile.needlesPerBud)*TAU+site.angle*.38;
     theta=radial-.18;lt=profile.needleLength*(.78+.28*r())*(.63+.37*st.g.horizontal)*juvenileScale;wd=profile.needleWidth;
     if(n%3===0)pos={x:p1.x+normal.x*(n%2?1:-1)*1.0,y:p1.y+normal.y*(n%2?1:-1)*1.0};
    }else if(actual==='picea'){
     // Needle cones around a drooping twig, with radial stagger, no clumped rosettes.
     theta=heading+(n%2?1:-1)*(.38+.18*(n%3))+(n%3===0?.25:0);
     lt=profile.needleLength*(.65+.35*r())*(.72+.28*st.g.horizontal)*juvenileScale;wd=profile.needleWidth;
    }else{
     // Two ranks lie approximately in the same fan plane; raised shoot tips.
     theta=heading+(n%2?1:-1)*(.58+.10*r());
     lt=profile.needleLength*(.78+.17*r())*(.72+.28*st.g.horizontal)*juvenileScale;wd=profile.needleWidth;
    }
    // Draw lengthwise veins and muted side highlights without making broad flat leaves.
    const base={x:pos.x,y:pos.y};
    const endNeedle={x:base.x+Math.cos(theta)*lt,y:base.y+Math.sin(theta)*lt};
    line(ctx,base,endNeedle,evergreen[2+(n%3)],Math.max(1,wd));
    if(n%2===0)line(ctx,{x:base.x+.4,y:base.y-.5},{x:endNeedle.x+.4,y:endNeedle.y-.5},evergreen[4+(n%2)],1);
    // G8 leaf morphology is added on representative needles, anchored at the twig.
    if(src && (n%3===0) && g243StampAttachedLeaf(ctx,spr,base,theta,lt,wd,n%2===0))needles++;
    else needles++;
   }
   budsDrawn++;
  }
 }
 function branchWood(b){
  const count=10,pts=[];
  for(let i=0;i<=count;i++)pts.push(project(g253BoughPoint(b,i/count,profile),cam));
  for(let i=0;i<count;i++){
   const taper=1-i/count,thick=Math.max(1,(b.radius*1.5)*(profile.woodTaper*taper+.20));
   line(ctx,pts[i],pts[i+1],wood[i<3?1:2],thick);
   if(i%3===0)line(ctx,{x:pts[i].x,y:pts[i].y-1},{x:pts[i+1].x,y:pts[i+1].y-1},wood[3],1);
  }
 }
 const rear=branches.filter(b=>b.depthRank<0),front=branches.filter(b=>b.depthRank>=0);
 for(const b of rear){branchWood(b);foliage(b)}
 g21Trunk(ctx,st,cam,params,wood);
 for(const b of front){branchWood(b);foliage(b)}
 if(st.g.growth<.45)drawJuvenileFoliage(ctx,st,cam,params,col);
 return {leafSprites:needles,leafInstances:budsDrawn,secondary:twigs,clusters:budsDrawn,vines:0,
  attachmentMode:'G2.5.3_persistent_conifer_shortshoots',windHierarchy:true,volumeLayers:3,
  coniferMode:actual,coniferNeedles:needles,coniferShoots:twigs};
}

function g244DrawPine(ctx,st,cam,params,col){
 const all=g244VolumetricInstances(st.tree,params,st,cam),branches=st.visible.slice().sort((a,b)=>a.depthRank-b.depthRank);
 let leaves=g244DrawFoliage(ctx,all.filter(x=>x.depth<0),st,cam,params);
 for(const b of branches.filter(x=>x.depthRank<0))g21Branch(ctx,b,st,cam,params,col.wood);
 g21Trunk(ctx,st,cam,params,col.wood);
 for(const b of branches.filter(x=>x.depthRank>=0))g21Branch(ctx,b,st,cam,params,col.wood);
 leaves+=g244DrawFoliage(ctx,all.filter(x=>x.depth>=0),st,cam,params);
 g21DrawOrgans(ctx,st,cam,params,col,'front');
 return {leafSprites:leaves,leafInstances:all.length,secondary:0,clusters:all.length,vines:0,attachmentMode:'3d_shoot_branch_fascicle',windHierarchy:true,volumeLayers:3};
}
// Coconut uses the same moving frond Bezier for wood AND leaves, and adds wind
// rotation around each immutable rachis point, never translating its attachment.
function g244DrawPalm(ctx,st,cam,params,col){
 if(st.tree.catalogSpecies==='bananeira')return g25DrawBanana(ctx,st,cam,params,col);
 const sorted=st.visible.slice().sort((a,b)=>a.depthRank-b.depthRank),sites=st.tree.morphology.foliageSites;
 const byBranch=new Map();for(const s of sites){if(!byBranch.has(s.branchId))byBranch.set(s.branchId,new Map());byBranch.get(s.branchId).set(Math.round(s.u*32)+'|'+s.side,s)}
 let total=0;
 const wind=clamp(Number(params.windStrength??0),0,1),flutter=clamp(Number(params.leafFlutter??.65),0,1),time=Number(params.time??0);
 function frond(b){
  const r=rand(hash(b.foliageSeed,'g22-natural-frond'));
  const gravity=rrange(r,24,46)*st.g.vertical*b.show;
  const reach=rrange(r,.90,1.07),end=pt(b.from.x+(b.to.x-b.from.x)*reach,b.from.y+(b.to.y-b.from.y)*reach,b.to.z-gravity);
  const cp1=mix3(b.from,end,.24),cp2=mix3(b.from,end,.68);
  cp1.z+=rrange(r,13,24)*st.g.vertical;cp2.z+=rrange(r,-4,9)*st.g.vertical;
  const fDir=(Number(params.windDirection??25))*Math.PI/180;
  const rachis=Array.from({length:33},(_,i)=>{
   const u=i/32,p=bezier(b.from,cp1,cp2,end,u),bend=g244WindSample(hash(b.id,'frond'),p,params,.29)*Math.pow(u,1.35);
   return add(p,pt(Math.cos(fDir)*bend,Math.sin(fDir)*bend,bend*.13));
  });
  for(let i=0;i<32;i++)line(ctx,project(rachis[i],cam),project(rachis[i+1],cam),col.leaf[i<12?2:1],i<11?2:1);
  const leafSites=byBranch.get(b.id)||new Map();
  for(let j=2;j<31;j++){
   const u=j/32,curved=rachis[j],arch=Math.pow(Math.sin(Math.PI*u),.81),len=rrange(r,16,24)*arch*st.g.horizontal*b.show;
   for(const side of [-1,1]){
    const bud=leafSites.get(j+'|'+side);
    if(!bud||st.g.growth<bud.birth||bud.priority>clamp(Number(params.density??1),.3,1.3))continue;
    const az=b.az+side*Math.PI*.5+rrange(r,-.13,.13),droop=rrange(r,3.5,10)*st.g.vertical*(.45+u*.9);
    const outer=add(curved,polar(az,len,-droop));
    const base=project(curved,cam),tip=project(outer,cam);
    const dx=tip.x-base.x,dy=tip.y-base.y,dist=Math.hypot(dx,dy);if(dist<.3)continue;
    const src=g24LeafSprite(st.tree.catalogSpecies||'coqueiro',64,bud.seed,params.season);
    const sprite=g242TintedSprite(src,hash(bud.seed,'shade')%6<2?0:hash(bud.seed,'shade')%6>4?2:1);
    const phase=hash(bud.id,'flutter')/4294967296*TAU;
    const angle=Math.atan2(dy,dx)+wind*flutter*.15*Math.sin(time*5.1+phase);
    if(params.showLeafAnchors&&hash(bud.id,'debug')%21===0){ellipse(ctx,base.x,base.y,1.5,1.5,'#ff9c46');line(ctx,base,tip,'#62c8ff',1)}
    if(g243StampAttachedLeaf(ctx,sprite,base,angle,Math.max(5,Math.min(25,dist)),Math.max(1.25,Math.min(st.tree.catalogSpecies==='bananeira'?12:4.4,dist*(st.tree.catalogSpecies==='bananeira'?.9:.20))),side<0))total++;
   }
  }
 }
 for(const b of sorted.filter(x=>x.depthRank<0))frond(b);
 g21DrawOrgans(ctx,st,cam,params,col,'rear');g21Trunk(ctx,st,cam,params,col.wood);
 for(const b of sorted.filter(x=>x.depthRank>=0))frond(b);
 g21DrawOrgans(ctx,st,cam,params,col,'front');
 const q=project(st.apex,cam);ellipse(ctx,q.x,q.y,Math.max(2,4*st.g.horizontal),Math.max(1.5,3*st.g.horizontal),col.wood[2]);
 return {leafSprites:total,leafInstances:total,secondary:0,clusters:sorted.length,vines:0,attachmentMode:'rachis_pivot_leaflet',windHierarchy:true,volumeLayers:2};
}
function g244VineGeometry(st,site,cam,params){
 if(st.g.growth<.52)return null;
 const branch=st.visible.find(b=>b.id===(site.branchId||site.aId));
 if(!branch||branch.show<.18)return null;
 const sr=rand(site.seed),p0=mix3(branch.mid,branch.to,site.at??site.fromT??.76);
 const centerAt=(t)=>{
  const nodes=st.trunk,u=clamp(t,0,.9999)*(nodes.length-1),idx=Math.floor(u);
  return mix3(nodes[idx].p,nodes[idx+1].p,u-idx);
 };
 const result=[],type=site.kind;
 const scale=st.g.horizontal,volume=clamp(Number(params.vineCurl??.75),0,1),reachGround=clamp(Number(params.vineGround??.65),0,1);
 if(type==='spiral'||type==='ground'){
  const T=site.stemT,top=centerAt(T),low=centerAt(type==='ground'?.02:.06);
  for(let i=0;i<=11;i++){
   const t=i/11,z=t*t*(3-2*t);
   const center=mix3(p0,top,z),lift=Math.sin(t*Math.PI)*(7+volume*5);
   result.push(pt(center.x+Math.sin(t*TAU*1.2+site.phase)*lift*.16,center.y+Math.cos(t*TAU*1.3+site.phase)*lift*.15,center.z+lift*.20));
  }
  const turns=site.turns*(.40+.60*volume),N=Math.round(30+turns*14);
  for(let i=1;i<=N;i++){
   const u=i/N,t=T*(1-u)+.035*u,c=centerAt(t),rad=lerp(st.trunk[0].radius,Math.max(1,st.trunk.at(-1)?.radius||1),t)*.84 +site.radiusOffset;
   const az=site.phase+u*TAU*turns +Math.sin(u*7+site.phase)*.11;
   result.push(pt(c.x+Math.cos(az)*rad,c.y+Math.sin(az)*rad,c.z));
  }
  if(type==='ground'&&reachGround>.05){
   const last=result.at(-1),r=(8+site.groundLength*reachGround)*scale;
   for(let i=1;i<=14;i++){
    const u=i/14;result.push(pt(last.x+u*r*Math.cos(site.phase),last.y-u*r*Math.abs(Math.sin(site.phase)),last.z*Math.pow(1-u,2)));
   }
  }
 }else if(type==='bridge'){
  const partner=st.visible.find(b=>b.id===site.bId);
  if(!partner||partner.show<.2)return null;
  const dest=mix3(partner.mid,partner.to,site.toT||.72);
  for(let i=0;i<=32;i++){
   const u=i/32,p=mix3(p0,dest,u);
   p.z-=Math.sin(Math.PI*u)*(10+10*volume)*st.g.vertical;
   p.x+=Math.sin(Math.PI*u*2+site.seed%33)*2*volume;
   result.push(p);
  }
 }else{
  const len=site.hang*(.45+.55*smooth((st.g.growth-.51)/.29))*st.g.vertical;
  for(let i=0;i<=32;i++){
   const u=i/32;
   result.push(pt(p0.x+site.sway*u+Math.sin(u*TAU*1.5+site.seed)*2.4*volume*u,
    p0.y+u*3.5+Math.sin(u*TAU*.8+site.seed)*1.5*volume,
    Math.max(2,p0.z-len*u)));
  }
 }
 return {id:site.id,kind:type,points:result,seed:site.seed};
}
function g244VineSites(tree,params){
 const density=clamp(Number(params.vines??0),0,1),old=tree.vineSites||[],extra=tree.morphology.vineGrowthSites||[];
 if(!density)return [];
 const n=Math.ceil((old.length+extra.length)*density);
 const all=[...extra,...old].sort((a,b)=>hash(tree.seed,'g244-vine-order',a.id)-hash(tree.seed,'g244-vine-order',b.id));
 return all.slice(0,n);
}
function g244DrawVines(ctx,st,cam,params,side){
 if(st.tree.species!=='carvalho'||st.g.growth<.52)return 0;
 const sites=g244VineSites(st.tree,params),wind=clamp(Number(params.windStrength??0),0,1),time=Number(params.time??0);
 for(const vine of sites){
  const g=g244VineGeometry(st,vine,cam,params);if(!g)continue;
  const r=rand(g.seed),seg=g.points,kind=g.kind;
  for(let i=0;i<seg.length-1;i++){
   let a=seg[i],b=seg[i+1];
   const front=(a.y+b.y)*.5>0,show=front?'front':'rear';if(show!==side)continue;
   const free=(kind==='spiral'||kind==='ground')?(i<10||i>seg.length-12):true;
   const motion=wind*(free?1.0:.16),factor=Math.pow(i/Math.max(1,seg.length-1),1.4);
   const vec=pt(Math.cos(time*1.35+vine.seed%29)*motion*factor*1.9,Math.sin(time*.93+vine.seed%71)*motion*factor*.9,0);
   const k=project(add(a,vec),cam),q=project(add(b,vec),cam);
   const wide=(kind==='spiral'||kind==='ground')?1.5:1;
   line(ctx,k,q,i%5===0?'#6b8440':'#405d31',wide);
   if(i%((kind==='spiral'||kind==='ground')?10:7)===0){
    // Leaves on the moving vine, attached to a consistent stem sample.
    const normal=r()>.5?1:-1,l=1.5+r()*2.7;
    const tip={x:k.x+normal*l,y:k.y-1.2-r()*2};
    line(ctx,k,tip,'#53743d',1);
    ellipse(ctx,tip.x,tip.y,1.0,1.35,i%2?'#567641':'#779950');
   }
  }
 }
 return sites.length;
}

function render(canvas,args={}){
 G254_COLOR_CONTEXT={enabled:args.referencePalette!==false,strength:Math.max(0,Math.min(1,Number(args.paletteStrength??.90))),species:args.tree?.catalogSpecies||args.tree?.species||args.species||'carvalho',season:args.season||'normal'};
 const tree=args.tree||create(args),base=(args.quality==='g231'||args.quality==='g242'||args.quality==='g243'||args.quality==='g244')?g231Structure(tree,args.growth??1,args):structure(tree,args.growth??1),st=args.quality==='g244'?g244AnimatedStructure(base,args):base,cam=buildCamera(args.angle??42),col=colorsFor(tree,args.season);
 const renderSize=(args.quality==='g242'||args.quality==='g243'||args.quality==='g244')&&[256,512,1024].includes(Number(args.renderSize))?Number(args.renderSize):256;
 const scale=renderSize/256;
 canvas.width=renderSize;canvas.height=renderSize;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,renderSize,renderSize);
 ctx.setTransform(scale,0,0,scale,0,0);
 let organCount=0,vineCount=0,g22Stats={secondary:0,clusters:0};
 if(args.quality==='g1'){
  if(tree.species==='carvalho')drawOak(ctx,st,cam,args,col);
  else if(tree.species==='pinheiro')drawPine(ctx,st,cam,args,col);
  else drawPalm(ctx,st,cam,args,col);
 }else if(args.quality==='g2'){
  if(tree.species==='carvalho')g2DrawOak(ctx,st,cam,args,col);
  else if(tree.species==='pinheiro')g2DrawPine(ctx,st,cam,args,col);
  else g2DrawPalm(ctx,st,cam,args,col);
 }else if(args.quality==='g244'){
  const useLeaves=args.crownLeafModule!==false&&g24LeafModuleReady();
  const stats=useLeaves?(tree.species==='carvalho'?g244DrawOak(ctx,st,cam,args,col):tree.species==='pinheiro'?(G253_CONIFER_PROFILES[tree.catalogSpecies]?g253DrawConifer(ctx,st,cam,args,col):g244DrawPine(ctx,st,cam,args,col)):g244DrawPalm(ctx,st,cam,args,col)):(tree.species==='carvalho'?g22DrawOak(ctx,st,cam,{...args,quality:'g22',vines:0,crownLeafModule:false},col):tree.species==='pinheiro'?g22DrawPine(ctx,st,cam,{...args,quality:'g22',crownLeafModule:false},col):g22DrawPalm(ctx,st,cam,{...args,quality:'g22',crownLeafModule:false},col));
  if(tree.species==='carvalho'&&!useLeaves){g244DrawVines(ctx,st,cam,args,'rear');g244DrawVines(ctx,st,cam,args,'front');}
  vineCount=tree.species==='carvalho'?g244VineSites(tree,args).length:0;organCount=g21GetOrgans(st,args).length;g22Stats=stats;
 }else if(args.quality==='g243'){
  const useLeaves=args.crownLeafModule!==false&&g24LeafModuleReady();
  const stats=useLeaves?(tree.species==='carvalho'?g243DrawOak(ctx,st,cam,args,col):
   tree.species==='pinheiro'?g243DrawPine(ctx,st,cam,args,col):g243DrawPalm(ctx,st,cam,args,col)):
   (tree.species==='carvalho'?g22DrawOak(ctx,st,cam,{...args,quality:'g22',crownLeafModule:false},col):
   tree.species==='pinheiro'?g22DrawPine(ctx,st,cam,{...args,quality:'g22',crownLeafModule:false},col):
   g22DrawPalm(ctx,st,cam,{...args,quality:'g22',crownLeafModule:false},col));
  vineCount=stats.vines||0;organCount=g21GetOrgans(st,args).length;g22Stats=stats;
 }else if(args.quality==='g242'){
  const stats=args.crownLeafModule!==false&&g24LeafModuleReady()?(
   tree.species==='carvalho'?g242DrawOak(ctx,st,cam,args,col):
   tree.species==='pinheiro'?g242DrawPine(ctx,st,cam,args,col):g22DrawPalm(ctx,st,cam,args,col)
  ):tree.species==='carvalho'?g22DrawOak(ctx,st,cam,{...args,crownLeafModule:false},col):
    tree.species==='pinheiro'?g22DrawPine(ctx,st,cam,{...args,crownLeafModule:false},col):g22DrawPalm(ctx,st,cam,{...args,crownLeafModule:false},col);
  vineCount=stats.vines||0;organCount=g21GetOrgans(st,args).length;g22Stats=stats;
 }else if(args.quality==='g22'||args.quality==='g231'){
  const stats=tree.species==='carvalho'?g22DrawOak(ctx,st,cam,args,col):
   tree.species==='pinheiro'?g22DrawPine(ctx,st,cam,args,col):g22DrawPalm(ctx,st,cam,args,col);
  vineCount=stats.vines||0;
  organCount=g21GetOrgans(st,args).length;
  g22Stats=stats;
 }else{
  if(tree.species==='carvalho')vineCount=g21DrawOak(ctx,st,cam,args,col);
  else if(tree.species==='pinheiro')g21DrawPine(ctx,st,cam,args,col);
  else g21DrawPalm(ctx,st,cam,args,col);
  organCount=g21GetOrgans(st,args).length;
 }
 if(args.quality==='g1'||args.quality==='g2'){
  if(tree.species!=='coqueiro')addOrgans(ctx,st,cam,args,col);
 }
 drawJuvenileFoliage(ctx,st,cam,args,col);
 if(args.quality==='g22'||args.quality==='g231'||args.quality==='g242'||args.quality==='g243'||args.quality==='g244')g22JuvenileFill(ctx,st,cam,args,col);
 if(args.showSkeleton)drawSkeleton(ctx,st,cam);
 binarize(ctx,renderSize,renderSize);
 return {tree,wind:{enabled:args.quality==='g244'&&Number(args.windStrength)>0,strength:Number(args.windStrength??0),time:Number(args.time??0),direction:Number(args.windDirection??0)},vineKinds:args.quality==='g244'&&tree.species==='carvalho'?g244VineSites(tree,args).reduce((o,v)=>(o[v.kind]=(o[v.kind]||0)+1,o),{}):{},volumeLayers:g22Stats.volumeLayers||0,coniferNeedles:g22Stats.coniferNeedles||0,coniferShoots:g22Stats.coniferShoots||0,coniferMode:g22Stats.coniferMode||null,attachmentMode:g22Stats.attachmentMode||'legacy',attachmentDiagnostics:g22Stats.attachmentMode?{sites:g22Stats.leafInstances||0,nonOutward:0}:null,renderSize,renderScale:scale,pixelPivot:{x:128*scale,y:246*scale},leafInstanceCount:g22Stats.leafInstances||g22Stats.leafSprites||0,projection:cam,organicTrunk:!!st.organic,organicSegments:st.organic?st.trunk.length-1:0,visibleBranches:st.visible.length,visibleOrgans:organCount,visibleVines:vineCount,secondaryBranches:g22Stats.secondary||0,foliageClusters:g22Stats.clusters||0,leafSprites:g22Stats.leafSprites||0,crownLeafModule:g24LeafModuleEnabled(args),crownMethod:args.quality==='g244'&&g24LeafModuleEnabled(args)?'volumetric-3d-joint-wind':args.quality==='g243'&&g24LeafModuleEnabled(args)?'branch-attached-leaf-instances-hires':args.quality==='g242'&&g24LeafModuleEnabled(args)?'persistent-leaf-instances-hires':g24LeafModuleEnabled(args)?'individual-leaves-alpha-cropped':'legacy-canopy',leafG8CacheEntries:g24ProductionRuntime()?.stats().entries||0,leafG8Generated:g24ProductionRuntime()?.stats().generated||0,baseTrunkDiameter:Math.round(st.trunk[0].radius*200)/100,thicknessScale:st.g.thickness,growth:st.g.growth,stage:st.g.growth<.2?'muda':st.g.growth<.48?'jovem':st.g.growth<.76?'intermediaria':'adulta',pivot:{...PIVOT}};
}
function exportState(args={}){
 const tree=args.tree||create(args),g=clamp(Number(args.growth??1),.03,1),st=(args.quality==='g231'||args.quality==='g242'||args.quality==='g243'||args.quality==='g244')?g231Structure(tree,g,args):structure(tree,g),cam=buildCamera(args.angle??42);
 const size=(args.quality==='g242'||args.quality==='g243'||args.quality==='g244')&&[256,512,1024].includes(Number(args.renderSize))?Number(args.renderSize):256;
 return {schema:'tree-instance/1.0',engineVersion:'0.8.0',status:args.quality==='g244'?'G2.4.4_volumetric_wind_vines_review_required':args.quality==='g243'?'G2.4.3_botanical_attachment_art_review_required':args.quality==='g242'?'G2.4.2_high_res_leaf_crown_art_review_required':args.quality==='g231'?'G2.4.1_leaf_canopy_integration_review_required':'G2.2_morphology_art_review_required',species:tree.species,seed:tree.seed,pivot:[128*size/256,246*size/256],canvas:[size,size],logicalCanvas:[256,256],
  camera:{mode:cam.elevation===0?'front_debug':'2.5d',elevationDegrees:cam.elevation,groundDepth:cam.groundDepth,verticalHeight:cam.verticalHeight,projection:'screenX=128+0.982*x+0.10*y; screenY=246+0.77*sin(angle)*y+0.045*x-cos(angle)*z'},
  leafIntegration:{enabled:g24LeafModuleEnabled(args),outputResolution:size,realInstances:args.quality==='g242'||args.quality==='g243'||args.quality==='g244',persistentSites:(tree.morphology?.foliageSites||[]).length,architecture:G242_PROFILES[tree.species],source:' Folhas G8',productionCache:!!g24ProductionRuntime(),speciesProfiles:{carvalho:'quercus/G7',pinheiro:'pinus/G7',coqueiro:'lanceolada/G3-G4 (sem perfil G7)'}},
  state:{growth:g,seedlingVisible:g<.55,earlyStageFoliage:'stem-attached-seedling-leaves',trunkThicknessFactor:st.g.thickness,baseTrunkDiameterPx:Math.round(st.trunk[0].radius*200)/100,season:args.season||'normal',phenology:args.phenology||'vegetativa',density:Number(args.density??.9),quality:args.quality||'g22',detail:Number(args.detail??1),openness:Number(args.openness??.25),barkTexture:Number(args.barkTexture??1),organDensity:Number(args.organDensity??.65),vines:Number(args.vines??0),branchComplexity:Number(args.branchComplexity??1),trunkOrganic:Number(args.trunkOrganic??.78),basalFlare:Number(args.basalFlare??.72),crownLeafModule:args.crownLeafModule!==false,leafModuleAvailable:g24LeafModuleReady(),leafMode:args.quality==='g244'?'volumetric-shoots-and-joint-wind/2.4.4':args.quality==='g243'?'attached-petiole-and-rachis/2.4.3':args.quality==='g242'?'persistent-branch-leaf-instances/2.4.2':'botanical-crop-proportional/2.4.1',leafProductionAvailable:!!g24ProductionRuntime()},
  wind:{strength:Number(args.windStrength??0),direction:Number(args.windDirection??0),gustiness:Number(args.windGustiness??.55),leafFlutter:Number(args.leafFlutter??.65),time:Number(args.time??0),model:'shared-branch-3d-pivot'},
  vineGrowth:{types:['pendant','bridge','spiral','ground'],sites:tree.morphology?.vineGrowthSites||[],curvature:Number(args.vineCurl??.75),groundReach:Number(args.vineGround??.65)},
  vineStats:{requestedDensity:Number(args.vines??0),availableSites:(tree.vineSites||[]).length,visibleSites:(tree.species==='carvalho'&&g>=.53&&args.quality!=='g1'&&args.quality!=='g2'?(tree.vineSites||[]).slice(0,Math.ceil((tree.vineSites||[]).length*clamp(Number(args.vines??0),0,1))).filter(v=>g21VineGeometry(st,v,cam)):[]).map(v=>v.id)},
  organicTrunk:st.organic?{identity:tree.morphology?.trunkOrganic,centerline:st.trunk.map(n=>({t:n.t,p:n.p,radius:n.radius})),basalFlare:st.organic.basalFlare,strength:st.organic.strength}:null,
  morphology:{coordinateSystem:'3D local xyz, z up, y depth',trunk:tree.trunk,branches:tree.branches,secondarySites:tree.morphology?.secondarySites||[],foliageSites:tree.morphology?.foliageSites||[],organSites:tree.organSites||[],vineSites:tree.vineSites||[],vineGrowthSites:tree.morphology?.vineGrowthSites||[]},
  render:{visibleBranchIds:st.visible.map(b=>b.id),layers:['secondary_branches','crown_clusters','leaf_module_overlays','rear_branches','back_foliage','textured_trunk','front_branches','rear_vines','front_foliage','front_vines','attached_organs'],pixelArt:{binaryAlpha:true,nearestNeighbor:true}}
 };
}
function drawGrid(ctx){ctx.save();ctx.strokeStyle='rgba(255,255,255,.08)';for(let n=0;n<=256;n+=32){line(ctx,{x:0,y:n},{x:256,y:n},'rgba(255,255,255,.08)',1);line(ctx,{x:n,y:0},{x:n,y:256},'rgba(255,255,255,.08)',1)}ctx.restore()}

/*  G2.5 — Full G3 catalogue, deterministic procedural archetype adapters.
   Three approved legacy generator paths are preserved byte-for-byte.
   Other 23 species get independent deterministic skeleton seeds and botanical
   parameterization; no external reference sprites are copied or rendered. */

/* G2.5.0 banana is a herbaceous pseudostem with broad lamina, not a coconut:
   place large G8 lanceolate blades along separately wind-bent persistent fronds. */
function g25DrawBanana(ctx,st,cam,params,col){
 const bs=st.visible.slice().sort((a,b)=>a.depthRank-b.depthRank).filter((b,i)=>i%3!==1);
 const cache=new Map();let leaves=0;
 function one(b){
  const r=rand(hash(st.tree.seed,'g252-musa-blade',b.id));
  const p0=project(b.from,cam),p1=project(b.mid,cam),p2=project(b.to,cam);
  const dx=p2.x-p1.x,dy=p2.y-p1.y,dist=Math.hypot(dx,dy);
  if(dist<.5)return;
  const ux=dx/dist,uy=dy/dist,nx=-uy,ny=ux;
  const leafLength=clamp(dist*1.65,9,67)*(.44+.56*st.g.horizontal);
  const halfWidth=clamp(leafLength*.20,1.5,12.5);
  const phase=(hash(st.tree.seed,b.id,'banana-wind')%1000)/1000*TAU;
  const wind=clamp(Number(params.windStrength??0),0,1),t=Number(params.time??0);
  const flex=Math.sin(t*2.5+phase)*wind*3.8;
  const origin={x:p1.x+ux*1.1,y:p1.y+uy*1.1};
  const center=u=>({x:origin.x+ux*leafLength*u+nx*(Math.sin(u*Math.PI)*leafLength*.07+flex*u*u),y:origin.y+uy*leafLength*u+ny*(Math.sin(u*Math.PI)*leafLength*.07+flex*u*u)+2.6*u*u});
  line(ctx,p0,origin,col.leaf[2],Math.max(1,Math.round(st.g.horizontal*2)));
  const left=[],right=[];
  for(let i=0;i<=16;i++){
    const u=i/16,q=center(u);
    const width=halfWidth*Math.pow(Math.max(0,Math.sin(Math.PI*u)),.83);
    const jitter=1+Math.sin((i+hash(b.id)%13)*2.7)*.07;
    left.push({x:q.x+nx*width*jitter,y:q.y+ny*width*jitter});
    right.push({x:q.x-nx*width*(.92+.12*r()),y:q.y-ny*width});
  }
  poly(ctx,left.concat(right.slice().reverse()),col.leaf[3]);
  // Two planar faces and a structural midrib, keeping the whole lamina attached.
  const ridge=Array.from({length:17},(_,i)=>center(i/16));
  poly(ctx,left.concat(ridge.slice().reverse()),col.leaf[4]);
  for(let i=0;i<16;i++)line(ctx,ridge[i],ridge[i+1],col.leaf[2],1);
  const sideR=rand(hash(b.id,'banana-musa-tears'));
  for(let i=3;i<15;i+=2){
   if(sideR()>.79)continue;
   const u=i/16,q=ridge[i],w=halfWidth*Math.sin(Math.PI*u);
   const v=i%4<2?1:-1;
   const edge={x:q.x+nx*w*v,y:q.y+ny*w*v},inner={x:q.x+nx*w*.52*v,y:q.y+ny*w*.52*v};
   line(ctx,edge,inner,col.leaf[1],1);
   const vein={x:q.x+nx*w*.30*v,y:q.y+ny*w*.30*v};
   line(ctx,vein,edge,col.leaf[2],1);
  }
  // Anatomy from G8 remains present; it highlights a central segment, but no longer
  // defines the entire silhouette at a small scale.
  const seed=hash(st.tree.seed,'g252-banana-g8',b.id);
  if(!cache.has(b.id))cache.set(b.id,g24LeafSprite('bananeira',64,seed,params.season));
  const sprite=cache.get(b.id);
  if(sprite && params.crownLeafModule!==false){
   ctx.save();ctx.globalAlpha=.42;
   g243StampAttachedLeaf(ctx,sprite,origin,Math.atan2(uy,ux),leafLength*.68,halfWidth*1.12,false);
   ctx.restore();
  }
  leaves++;
 }
 for(const b of bs.filter(x=>x.depthRank<0))one(b);
 g21DrawOrgans(ctx,st,cam,params,col,'rear');
 g21Trunk(ctx,st,cam,params,col.wood);
 for(const b of bs.filter(x=>x.depthRank>=0))one(b);
 g21DrawOrgans(ctx,st,cam,params,col,'front');
 return {leafSprites:leaves,leafInstances:leaves,secondary:0,clusters:bs.length,
  attachmentMode:'musa_pseudostem_whole_lamina',windHierarchy:true,volumeLayers:2};
}

const G25_SPECIES=Object.freeze({"bétula":{"label":"Bétula","archetype":"carvalho","shape":"oval","margin":"serrilhada","height":202,"heightScale":1.0412,"crownRadius":60,"trunkBase":11,"trunkScale":0.4783,"branchRadiusScale":0.85,"spreadScale":0.638,"riseScale":1.13,"leafScale":0.89,"leafWidthScale":1.05,"foliageDensity":0.64,"leafG7":"","deciduous":true,"evergreen":false},"salgueiro":{"label":"Salgueiro","archetype":"carvalho","shape":"salgueiro","margin":"serrilhada","height":196,"heightScale":1.0103,"crownRadius":74,"trunkBase":16,"trunkScale":0.6957,"branchRadiusScale":0.95,"spreadScale":0.8805,"riseScale":0.67,"leafScale":0.72,"leafWidthScale":0.65,"foliageDensity":0.58,"leafG7":"salix","deciduous":true,"evergreen":false},"palmeira":{"label":"Palmeira","archetype":"coqueiro","shape":"lanceolada","margin":"inteira","height":185,"heightScale":0.9585,"crownRadius":87,"trunkBase":15,"trunkScale":1.0,"branchRadiusScale":0.95,"spreadScale":0.9626,"riseScale":1.03,"leafScale":0.9,"leafWidthScale":1.0,"foliageDensity":0.7,"leafG7":"","deciduous":false,"evergreen":true},"acer":{"label":"Ácer / bordo","archetype":"carvalho","shape":"bordo","margin":"lobada","height":196,"heightScale":1.0103,"crownRadius":76,"trunkBase":21,"trunkScale":0.913,"branchRadiusScale":1.0,"spreadScale":0.9139,"riseScale":1.03,"leafScale":1.14,"leafWidthScale":1.1,"foliageDensity":1.09,"leafG7":"acer","deciduous":true,"evergreen":false},"cedro":{"label":"Cedro verdadeiro","archetype":"pinheiro","shape":"agulha","margin":"inteira","height":206,"heightScale":0.9671,"crownRadius":84,"trunkBase":21,"trunkScale":1.3125,"branchRadiusScale":1.0,"spreadScale":1.18,"riseScale":0.92,"leafScale":1.08,"leafWidthScale":1.05,"foliageDensity":1.01,"leafG7":"","deciduous":false,"evergreen":true},"sicomoro":{"label":"Sicômoro","archetype":"carvalho","shape":"oval","margin":"inteira","height":195,"heightScale":1.0052,"crownRadius":90,"trunkBase":31,"trunkScale":1.3478,"branchRadiusScale":1.02,"spreadScale":1.3557,"riseScale":0.92,"leafScale":1.02,"leafWidthScale":1.18,"foliageDensity":1.11,"leafG7":"","deciduous":false,"evergreen":true},"picea":{"label":"Pícea","archetype":"pinheiro","shape":"agulha","margin":"inteira","height":216,"heightScale":1.0141,"crownRadius":59,"trunkBase":16,"trunkScale":1.0,"branchRadiusScale":0.94,"spreadScale":0.8045,"riseScale":0.85,"leafScale":0.96,"leafWidthScale":0.95,"foliageDensity":0.97,"leafG7":"","deciduous":false,"evergreen":true},"baoba":{"label":"Baobá","archetype":"carvalho","shape":"oval","margin":"inteira","height":155,"heightScale":0.799,"crownRadius":72,"trunkBase":51,"trunkScale":2.2174,"branchRadiusScale":1.15,"spreadScale":0.9114,"riseScale":0.85,"leafScale":0.73,"leafWidthScale":0.8,"foliageDensity":0.85,"leafG7":"","deciduous":true,"evergreen":false},"olmo":{"label":"Olmo","archetype":"carvalho","shape":"oval","margin":"serrilhada","height":193,"heightScale":0.9948,"crownRadius":82,"trunkBase":22,"trunkScale":0.9565,"branchRadiusScale":1.06,"spreadScale":1.1106,"riseScale":1.2,"leafScale":1.03,"leafWidthScale":1.03,"foliageDensity":0.97,"leafG7":"","deciduous":true,"evergreen":false},"abeto":{"label":"Abeto","archetype":"pinheiro","shape":"agulha","margin":"inteira","height":214,"heightScale":1.0047,"crownRadius":60,"trunkBase":17,"trunkScale":1.0625,"branchRadiusScale":1.0,"spreadScale":0.8545,"riseScale":1.04,"leafScale":1.0,"leafWidthScale":1.03,"foliageDensity":0.97,"leafG7":"","deciduous":false,"evergreen":true},"macieira":{"label":"Macieira","archetype":"carvalho","shape":"oval","margin":"serrilhada","height":146,"heightScale":0.7526,"crownRadius":65,"trunkBase":23,"trunkScale":1.0,"branchRadiusScale":0.98,"spreadScale":0.6747,"riseScale":0.89,"leafScale":1.12,"leafWidthScale":1.02,"foliageDensity":1.08,"leafG7":"","deciduous":true,"evergreen":false},"laranjeira":{"label":"Laranjeira","archetype":"carvalho","shape":"oval","margin":"inteira","height":168,"heightScale":0.866,"crownRadius":63,"trunkBase":17,"trunkScale":0.7391,"branchRadiusScale":0.88,"spreadScale":0.638,"riseScale":1.02,"leafScale":1.01,"leafWidthScale":1.03,"foliageDensity":1.06,"leafG7":"","deciduous":false,"evergreen":true},"limoeiro":{"label":"Limoeiro","archetype":"carvalho","shape":"oval","margin":"inteira","height":166,"heightScale":0.8557,"crownRadius":56,"trunkBase":16,"trunkScale":0.6957,"branchRadiusScale":0.92,"spreadScale":0.5671,"riseScale":1.08,"leafScale":0.92,"leafWidthScale":0.98,"foliageDensity":1.03,"leafG7":"","deciduous":false,"evergreen":true},"mangueira":{"label":"Mangueira","archetype":"carvalho","shape":"lanceolada","margin":"inteira","height":184,"heightScale":0.9485,"crownRadius":79,"trunkBase":25,"trunkScale":1.087,"branchRadiusScale":1.03,"spreadScale":1.09,"riseScale":0.9,"leafScale":1.22,"leafWidthScale":1.02,"foliageDensity":1.02,"leafG7":"mangifera","deciduous":false,"evergreen":true},"bananeira":{"label":"Bananeira","archetype":"coqueiro","shape":"lanceolada","margin":"inteira","height":149,"heightScale":0.772,"crownRadius":69,"trunkBase":18,"trunkScale":1.2,"branchRadiusScale":1.14,"spreadScale":0.5872,"riseScale":0.83,"leafScale":2.0,"leafWidthScale":0.93,"foliageDensity":1.16,"leafG7":"","deciduous":false,"evergreen":true},"oliveira":{"label":"Oliveira","archetype":"carvalho","shape":"lanceolada","margin":"inteira","height":158,"heightScale":0.8144,"crownRadius":69,"trunkBase":26,"trunkScale":1.1304,"branchRadiusScale":1.1,"spreadScale":0.7686,"riseScale":0.91,"leafScale":0.71,"leafWidthScale":1.02,"foliageDensity":0.91,"leafG7":"","deciduous":false,"evergreen":true},"cerejeira":{"label":"Cerejeira","archetype":"carvalho","shape":"oval","margin":"serrilhada","height":178,"heightScale":0.9175,"crownRadius":65,"trunkBase":20,"trunkScale":0.8696,"branchRadiusScale":0.91,"spreadScale":0.7158,"riseScale":1.13,"leafScale":0.96,"leafWidthScale":0.99,"foliageDensity":1.02,"leafG7":"","deciduous":true,"evergreen":false},"figueira":{"label":"Figueira","archetype":"carvalho","shape":"figueira","margin":"lobada","height":159,"heightScale":0.8196,"crownRadius":84,"trunkBase":26,"trunkScale":1.1304,"branchRadiusScale":0.96,"spreadScale":0.97,"riseScale":0.90,"leafScale":1.3,"leafWidthScale":1.03,"foliageDensity":1.04,"leafG7":"","deciduous":true,"evergreen":false},"goiabeira":{"label":"Goiabeira","archetype":"carvalho","shape":"oval","margin":"inteira","height":168,"heightScale":0.866,"crownRadius":65,"trunkBase":19,"trunkScale":0.8261,"branchRadiusScale":1.1,"spreadScale":0.7405,"riseScale":0.98,"leafScale":1.05,"leafWidthScale":0.97,"foliageDensity":1.01,"leafG7":"","deciduous":false,"evergreen":true},"amoreira":{"label":"Amoreira","archetype":"carvalho","shape":"carvalho","margin":"serrilhada","height":170,"heightScale":0.8763,"crownRadius":70,"trunkBase":21,"trunkScale":0.913,"branchRadiusScale":0.92,"spreadScale":0.8152,"riseScale":1.05,"leafScale":1.07,"leafWidthScale":1.02,"foliageDensity":1.06,"leafG7":"","deciduous":true,"evergreen":false},"abacateiro":{"label":"Abacateiro","archetype":"carvalho","shape":"lanceolada","margin":"inteira","height":190,"heightScale":0.9794,"crownRadius":75,"trunkBase":24,"trunkScale":1.0435,"branchRadiusScale":1.03,"spreadScale":0.9209,"riseScale":1.06,"leafScale":0.91,"leafWidthScale":0.98,"foliageDensity":1.02,"leafG7":"","deciduous":false,"evergreen":true},"cajueiro":{"label":"Cajueiro","archetype":"carvalho","shape":"oval","margin":"inteira","height":149,"heightScale":0.768,"crownRadius":84,"trunkBase":22,"trunkScale":0.9565,"branchRadiusScale":0.9,"spreadScale":1.2122,"riseScale":0.76,"leafScale":1.13,"leafWidthScale":0.98,"foliageDensity":1.13,"leafG7":"","deciduous":false,"evergreen":true},"jabuticabeira":{"label":"Jabuticabeira","archetype":"carvalho","shape":"oval","margin":"inteira","height":153,"heightScale":0.7887,"crownRadius":68,"trunkBase":24,"trunkScale":1.0435,"branchRadiusScale":0.98,"spreadScale":0.7747,"riseScale":1.0,"leafScale":0.92,"leafWidthScale":0.95,"foliageDensity":1.0,"leafG7":"","deciduous":false,"evergreen":true}});

// G2.5.2 visual corrections build on the 23 deterministic G2.5.1 botanical profiles.
const G251_ENRICHMENTS=Object.freeze({
 'bétula':{scientific:'Betula sp.',family:'Betulaceae',barkFamily:'birch',canopyHabit:'airy',branchBehavior:{mode:'airy',spreadMul:.92,riseMul:1.08},leafConfig:{shape:'oval',structure:'simples',length:.95,width:.92,margin:'serrilhada',marginDetail:.44,veinPattern:'pinada',leafColorRamp:['#1c2c18','#2c4421','#3f612d','#5b7d39','#7ea14d','#aac46e','#d0df96']},geneticProfile:{leafSource:'G8/custom-birch',leafDiversity:.23,trunkRigidity:.42,canopyDensity:.64,seasonality:.92,barkRoughness:.38}},
 'salgueiro':{scientific:'Salix sp.',family:'Salicaceae',barkFamily:'willow',leafSpecies:'salix',canopyHabit:'weeping',branchBehavior:{mode:'weeping',spreadMul:1.08,riseMul:.42,anchorShift:.08,droop:18},geneticProfile:{leafSource:'G7/salix',leafDiversity:.31,trunkRigidity:.28,canopyDensity:.58,seasonality:.88,barkRoughness:.44}},
 'palmeira':{scientific:'Arecaceae sp.',family:'Arecaceae',barkFamily:'palm',canopyHabit:'crownshaft',branchBehavior:{mode:'rosette',spreadMul:1.06,riseMul:1.05,anchorShift:.15},geneticProfile:{leafSource:'G8/custom-palm',leafDiversity:.18,trunkRigidity:.74,canopyDensity:.70,seasonality:.08,barkRoughness:.35}},
 'acer':{scientific:'Acer sp.',family:'Sapindaceae',barkFamily:'broadleaf',leafSpecies:'acer',branchBehavior:{mode:'broadleaf',spreadMul:1.02,riseMul:1.02},geneticProfile:{leafSource:'G7/acer',leafDiversity:.29,trunkRigidity:.47,canopyDensity:1.09,seasonality:.95,barkRoughness:.42}},
 'cedro':{scientific:'Cedrus sp.',family:'Pinaceae',barkFamily:'conifer',canopyHabit:'tiered-conifer',branchBehavior:{mode:'tiered_conifer',spreadMul:1.12,riseMul:.90},geneticProfile:{leafSource:'G8/custom-cedrus',leafDiversity:.19,trunkRigidity:.79,canopyDensity:1.01,seasonality:.05,barkRoughness:.62}},
 'sicomoro':{scientific:'Ficus sycomorus',family:'Moraceae',barkFamily:'smoothMottled',canopyHabit:'broad-dome',branchBehavior:{mode:'umbrella',spreadMul:.76,riseMul:.78,anchorShift:-.03},leafConfig:{shape:'oval',structure:'simples',length:1.02,width:1.18,margin:'inteira',marginDetail:.10,veinPattern:'pinada',leafColorRamp:['#1a2f1b','#2c4b28','#3e6a34','#588741','#78a452','#a1c06c','#cfdb8f']},geneticProfile:{leafSource:'G8/custom-sycomore',leafDiversity:.24,trunkRigidity:.56,canopyDensity:1.11,seasonality:.18,barkRoughness:.26}},
 'picea':{scientific:'Picea sp.',family:'Pinaceae',barkFamily:'conifer',canopyHabit:'narrow-conifer',branchBehavior:{mode:'narrow_conifer',spreadMul:.86,riseMul:.88},geneticProfile:{leafSource:'G8/custom-picea',leafDiversity:.18,trunkRigidity:.82,canopyDensity:.97,seasonality:.04,barkRoughness:.58}},
 'baoba':{scientific:'Adansonia sp.',family:'Malvaceae',barkFamily:'baobab',canopyHabit:'massive-sparse',trunkBehavior:{mode:'massive_base'},branchBehavior:{mode:'baobab',spreadMul:.88,riseMul:.74,anchorShift:-.06},leafSpecies:'ceiba',geneticProfile:{leafSource:'G7/ceiba-adapted',leafDiversity:.21,trunkRigidity:.91,canopyDensity:.85,seasonality:.74,barkRoughness:.33}},
 'olmo':{scientific:'Ulmus sp.',family:'Ulmaceae',barkFamily:'broadleaf',canopyHabit:'vase',branchBehavior:{mode:'vase',spreadMul:1.05,riseMul:1.16},leafConfig:{shape:'oval',structure:'simples',length:1.02,width:1.00,margin:'serrilhada',marginDetail:.50,veinPattern:'pinada',leafColorRamp:['#1c2b18','#2d4822','#41652d','#5f833b','#82a551','#aec76d','#d0dd92']},geneticProfile:{leafSource:'G8/custom-ulmus',leafDiversity:.25,trunkRigidity:.49,canopyDensity:.97,seasonality:.84,barkRoughness:.56}},
 'abeto':{scientific:'Abies sp.',family:'Pinaceae',barkFamily:'conifer',canopyHabit:'spire-conifer',branchBehavior:{mode:'spire_conifer',spreadMul:.88,riseMul:1.02},geneticProfile:{leafSource:'G8/custom-abies',leafDiversity:.17,trunkRigidity:.84,canopyDensity:.97,seasonality:.04,barkRoughness:.52}},
 'macieira':{scientific:'Malus domestica',family:'Rosaceae',barkFamily:'orchard',canopyHabit:'orchard',branchBehavior:{mode:'orchard',spreadMul:1.00,riseMul:.88,anchorShift:-.04},leafConfig:{shape:'oval',structure:'simples',length:1.00,width:.97,margin:'serrilhada',marginDetail:.46,veinPattern:'pinada',leafColorRamp:['#1d2d18','#315023','#487032','#648e42','#8aad54','#b6cb70','#d9e19a']},geneticProfile:{leafSource:'G8/custom-malus',leafDiversity:.28,trunkRigidity:.36,canopyDensity:1.08,seasonality:.91,barkRoughness:.48}},
 'laranjeira':{scientific:'Citrus sinensis',family:'Rutaceae',barkFamily:'orchard',canopyHabit:'citrus-round',branchBehavior:{mode:'citrus',spreadMul:.94,riseMul:.98},leafConfig:{shape:'oval',structure:'simples',length:1.02,width:.82,margin:'inteira',marginDetail:.08,veinPattern:'pinada',leafColorRamp:['#132719','#1f3e24','#2f5a31','#40713c','#618b4e','#8baa6a','#bfc996']},geneticProfile:{leafSource:'G8/custom-citrus-sinensis',leafDiversity:.22,trunkRigidity:.44,canopyDensity:1.06,seasonality:.10,barkRoughness:.42}},
 'limoeiro':{scientific:'Citrus limon',family:'Rutaceae',barkFamily:'orchard',canopyHabit:'citrus-round',branchBehavior:{mode:'citrus',spreadMul:.88,riseMul:1.00},leafConfig:{shape:'oval',structure:'simples',length:.94,width:.80,margin:'inteira',marginDetail:.08,veinPattern:'pinada',leafColorRamp:['#162b1a','#244528','#356236','#497944','#6b9159','#97ad74','#c6d2a1']},geneticProfile:{leafSource:'G8/custom-citrus-limon',leafDiversity:.20,trunkRigidity:.44,canopyDensity:1.03,seasonality:.10,barkRoughness:.40}},
 'mangueira':{scientific:'Mangifera indica',family:'Anacardiaceae',barkFamily:'orchard',canopyHabit:'dense-round',leafSpecies:'mangifera',branchBehavior:{mode:'dense_round',spreadMul:1.08,riseMul:.92},geneticProfile:{leafSource:'G7/mangifera',leafDiversity:.27,trunkRigidity:.58,canopyDensity:1.02,seasonality:.06,barkRoughness:.46}},
 'bananeira':{scientific:'Musa sp.',family:'Musaceae',barkFamily:'pseudostem',canopyHabit:'rosette',trunkBehavior:{mode:'pseudostem'},branchBehavior:{mode:'banana',spreadMul:1.20,riseMul:1.18,anchorShift:.22},leafConfig:{shape:'lanceolada',structure:'simples',length:1.85,width:.88,margin:'inteira',marginDetail:.05,veinPattern:'paralela',fold:.11,curvature:.16,leafColorRamp:['#15321a','#225028','#2f6f33','#468741','#6aa24e','#98bc66','#c8da92']},geneticProfile:{leafSource:'G8/custom-banana',leafDiversity:.20,trunkRigidity:.22,canopyDensity:.62,seasonality:.03,barkRoughness:.14}},
 'oliveira':{scientific:'Olea europaea',family:'Oleaceae',barkFamily:'olive',canopyHabit:'gnarled-oval',trunkBehavior:{mode:'gnarled'},branchBehavior:{mode:'gnarled',spreadMul:.92,riseMul:.86},leafConfig:{shape:'lanceolada',structure:'simples',length:.88,width:.42,margin:'inteira',marginDetail:.06,veinPattern:'pinada',fold:.09,curvature:.05,leafColorRamp:['#263728','#445e46','#617c5f','#7d9a78','#9fb49a','#b9ccae','#d3ddc5']},geneticProfile:{leafSource:'G8/custom-olive',leafDiversity:.19,trunkRigidity:.67,canopyDensity:.91,seasonality:.05,barkRoughness:.64}},
 'cerejeira':{scientific:'Prunus sp.',family:'Rosaceae',barkFamily:'smoothMottled',canopyHabit:'ornamental-round',branchBehavior:{mode:'ornamental',spreadMul:.96,riseMul:1.08},leafConfig:{shape:'oval',structure:'simples',length:.98,width:.90,margin:'serrilhada',marginDetail:.44,veinPattern:'pinada',leafColorRamp:['#1c2c18','#2f4b24','#426731','#5d833f','#83a552','#aec56d','#d8dea0']},geneticProfile:{leafSource:'G8/custom-prunus',leafDiversity:.27,trunkRigidity:.39,canopyDensity:1.02,seasonality:.93,barkRoughness:.25}},
 'figueira':{scientific:'Ficus carica',family:'Moraceae',barkFamily:'smoothMottled',canopyHabit:'low-broad',branchBehavior:{mode:'low_broad',spreadMul:1.10,riseMul:.82,anchorShift:-.05},leafConfig:{shape:'figueira',structure:'simples',length:1.34,width:1.06,margin:'lobada',marginDetail:.66,veinPattern:'pinada',leafColorRamp:['#19301b','#295027','#386f31','#518a3d','#74a550','#9fc06c','#ccd99a']},geneticProfile:{leafSource:'G8/custom-figueira',leafDiversity:.25,trunkRigidity:.44,canopyDensity:1.04,seasonality:.64,barkRoughness:.24}},
 'goiabeira':{scientific:'Psidium guajava',family:'Myrtaceae',barkFamily:'smoothMottled',canopyHabit:'small-round',branchBehavior:{mode:'small_round',spreadMul:.92,riseMul:.96},leafConfig:{shape:'oval',structure:'simples',length:1.02,width:.90,margin:'inteira',marginDetail:.08,veinPattern:'pinada',leafColorRamp:['#1a311d','#2a4f2d','#3a6b3b','#56864b','#7ca15d','#abc07d','#d0dba4']},geneticProfile:{leafSource:'G8/custom-goiaba',leafDiversity:.22,trunkRigidity:.41,canopyDensity:1.01,seasonality:.08,barkRoughness:.23}},
 'amoreira':{scientific:'Morus sp.',family:'Moraceae',barkFamily:'broadleaf',canopyHabit:'rounded',branchBehavior:{mode:'broadleaf',spreadMul:.98,riseMul:1.00},leafConfig:{shape:'carvalho',structure:'simples',length:1.05,width:1.02,margin:'serrilhada',marginDetail:.48,veinPattern:'pinada',leafColorRamp:['#1c2d18','#2f4a23','#426730','#5c833f','#81a555','#aec86f','#d0df97']},geneticProfile:{leafSource:'G8/custom-morus',leafDiversity:.24,trunkRigidity:.45,canopyDensity:1.06,seasonality:.86,barkRoughness:.50}},
 'abacateiro':{scientific:'Persea americana',family:'Lauraceae',barkFamily:'broadleaf',canopyHabit:'broad-evergreen',branchBehavior:{mode:'dense_round',spreadMul:.98,riseMul:1.00},leafConfig:{shape:'lanceolada',structure:'simples',length:1.12,width:.70,margin:'inteira',marginDetail:.06,veinPattern:'pinada',fold:.13,leafColorRamp:['#15301d','#214827','#2f6532','#447e3f','#629953','#89b26c','#b6ce91']},geneticProfile:{leafSource:'G8/custom-persea',leafDiversity:.20,trunkRigidity:.50,canopyDensity:1.02,seasonality:.06,barkRoughness:.48}},
 'cajueiro':{scientific:'Anacardium occidentale',family:'Anacardiaceae',barkFamily:'broadleaf',canopyHabit:'umbrella-low',branchBehavior:{mode:'umbrella',spreadMul:.79,riseMul:.70,anchorShift:-.08},leafConfig:{shape:'oval',structure:'simples',length:1.10,width:1.16,margin:'inteira',marginDetail:.06,veinPattern:'pinada',leafColorRamp:['#1c311d','#2b4d28','#3f6934','#5b8440','#7ca252','#abc06d','#d2dc98']},geneticProfile:{leafSource:'G8/custom-caju',leafDiversity:.23,trunkRigidity:.37,canopyDensity:1.13,seasonality:.08,barkRoughness:.47}},
 'jabuticabeira':{scientific:'Plinia cauliflora',family:'Myrtaceae',barkFamily:'smoothMottled',canopyHabit:'compact-round',branchBehavior:{mode:'compact_round',spreadMul:.88,riseMul:.98},leafConfig:{shape:'oval',structure:'simples',length:.86,width:.72,margin:'inteira',marginDetail:.06,veinPattern:'pinada',leafColorRamp:['#162d19','#244927','#336134','#487845','#668f59','#93ab74','#bfd09c']},geneticProfile:{leafSource:'G8/custom-jabuticaba',leafDiversity:.18,trunkRigidity:.46,canopyDensity:1.00,seasonality:.06,barkRoughness:.20}}
});
const G251_SPECIES=Object.freeze(Object.fromEntries(Object.entries(G25_SPECIES).map(([id,base])=>[id,{...base,...(G251_ENRICHMENTS[id]||{})}])));
function g25SpeciesProfile(id){
 const base=G251_SPECIES[id] || G25_SPECIES[id];if(!base)return null;
 const anatomy=G253_CONIFER_PROFILES[id];
 return anatomy?{...base,barkPalette:anatomy.barkPalette,coniferAnatomy:anatomy,geneticProfile:{...base.geneticProfile,
  needleArrangement:anatomy.needleArrangement,branchHabit:anatomy.habit,needleDiversity:.19,
  windStiffness:anatomy.genetic.windStiffness},leafConfig:{...base.leafConfig,shape:'agulha',structure:'simples',
  length:id==='cedro'?.88:id==='picea'?.96:1.10,width:id==='abeto'?.50:.35,margin:'inteira',
  veinPattern:'paralela',leafColorRamp:anatomy.leafPalette}}:base;
}
const G251_TRUNK_FORMS=Object.freeze({
 'bétula':{sway:5.4,twist:2.1,flare:.18,roughness:.030},'salgueiro':{sway:6.8,twist:2.2,flare:.22,roughness:.045},'palmeira':{sway:5.0,twist:1.7,flare:.12,roughness:.020},'acer':{sway:6.0,twist:2.4,flare:.30,roughness:.070},'cedro':{sway:2.6,twist:1.1,flare:.16,roughness:.040},'sicomoro':{sway:6.2,twist:2.1,flare:.34,roughness:.050},'picea':{sway:2.4,twist:1.0,flare:.14,roughness:.032},'baoba':{sway:2.1,twist:.8,flare:.62,roughness:.020},'olmo':{sway:5.8,twist:2.0,flare:.28,roughness:.060},'abeto':{sway:2.3,twist:1.0,flare:.13,roughness:.028},'macieira':{sway:5.2,twist:2.2,flare:.24,roughness:.050},'laranjeira':{sway:4.6,twist:1.8,flare:.20,roughness:.040},'limoeiro':{sway:4.5,twist:1.8,flare:.19,roughness:.038},'mangueira':{sway:5.6,twist:2.0,flare:.26,roughness:.052},'bananeira':{sway:6.1,twist:1.3,flare:.05,roughness:.010},'oliveira':{sway:4.2,twist:2.7,flare:.24,roughness:.055},'cerejeira':{sway:5.3,twist:1.9,flare:.20,roughness:.034},'figueira':{sway:5.7,twist:2.1,flare:.25,roughness:.028},'goiabeira':{sway:5.0,twist:1.7,flare:.18,roughness:.024},'amoreira':{sway:5.8,twist:2.1,flare:.24,roughness:.050},'abacateiro':{sway:5.4,twist:1.7,flare:.23,roughness:.042},'cajueiro':{sway:6.1,twist:2.1,flare:.22,roughness:.048},'jabuticabeira':{sway:4.8,twist:1.8,flare:.22,roughness:.020}
});

const G25_CATALOG=Object.freeze(["carvalho", "pinheiro", "bétula", "salgueiro", "palmeira", "acer", "cedro", "sicomoro", "picea", "baoba", "olmo", "abeto", "macieira", "laranjeira", "limoeiro", "mangueira", "bananeira", "coqueiro", "oliveira", "cerejeira", "figueira", "goiabeira", "amoreira", "abacateiro", "cajueiro", "jabuticabeira"]);
const G25_BASE_CREATE=create, G25_BASE_RENDER=render, G25_BASE_EXPORT=exportState;
const G25_BASE_IDS=new Set(['carvalho','pinheiro','coqueiro']);

function g25Create(args={}){
 const actual=String(args.species||'carvalho');
 if(G25_BASE_IDS.has(actual))return G25_BASE_CREATE(args);
 const profile=g25SpeciesProfile(actual);if(!profile)throw Error('Espécie fora do catálogo  G3: '+actual);
 const seed=(Number(args.seed)||1947)>>>0;
 const dnaSeed=hash('g25-species-skeleton',actual,seed) || 1947;
 const prototype=G25_BASE_CREATE({...args,species:profile.archetype,seed:dnaSeed});
 const trunkBehavior=profile.trunkBehavior||{};
 const branchBehavior=profile.branchBehavior||{};
 const trunk=prototype.trunk.map(n=>{
   let radius=n.radius*(1+(profile.trunkScale-1)*(1-n.t*.82));
   let z=n.p.z*profile.heightScale;
   if(trunkBehavior.mode==='massive_base') radius*=1.30-(n.t*.42);
   if(trunkBehavior.mode==='pseudostem') radius*=1.55-(n.t*.32);
   if(trunkBehavior.mode==='gnarled') radius*=1.08+Math.sin(n.t*Math.PI*2.2)*.06;
   return {...n,p:{...n.p,z},radius};
 });
 const branches=prototype.branches.map(b=>{
   let spread=b.spread*profile.spreadScale*(branchBehavior.spreadMul??1);
   let rise=b.rise*profile.riseScale*(branchBehavior.riseMul??1);
   let anchor=Math.min(.98,Math.max(.18,b.anchor+(branchBehavior.anchorShift ?? (profile.archetype==='carvalho'?.075:profile.archetype==='pinheiro'?.066:0))));
   let birth=Math.min(.91,b.birth+(profile.archetype==='coqueiro'?.015:0));
   if(branchBehavior.mode==='weeping'){ rise-= (branchBehavior.droop??14)*(0.42+anchor); spread*=1.04; }
   if(branchBehavior.mode==='umbrella'){ rise*=.82; anchor=Math.max(.18,anchor-.08); spread*=1.10; }
   if(branchBehavior.mode==='banana'){ anchor=Math.min(.98,Math.max(.72,.72+(b.anchor*.18))); rise=Math.abs(rise)*1.15; spread*=1.16; birth=Math.min(.91,.22+b.birth*.55); }
   if(branchBehavior.mode==='rosette'){ anchor=Math.min(.98,Math.max(.68,.68+(b.anchor*.22))); rise=Math.abs(rise)*1.08; birth=Math.min(.91,.26+b.birth*.48); }
   if(branchBehavior.mode==='tiered_conifer'){ spread*=1.08-(anchor*.18); rise*=.94; }
   if(branchBehavior.mode==='narrow_conifer'){ spread*=.88-(anchor*.06); rise*=.88; }
   if(branchBehavior.mode==='spire_conifer'){ spread*=.92-(anchor*.05); rise*=1.02; }
   if(branchBehavior.mode==='vase'){ anchor=Math.min(.98,Math.max(.20,anchor+.04)); rise*=1.08; }
   if(branchBehavior.mode==='orchard'){ anchor=Math.max(.18,anchor-.04); rise*=.90; spread*=1.02; }
   if(branchBehavior.mode==='citrus'){ spread*=.95; rise*=.98; }
   if(branchBehavior.mode==='dense_round'){ spread*=1.03; rise*=.95; }
   if(branchBehavior.mode==='low_broad'){ anchor=Math.max(.18,anchor-.05); spread*=1.06; rise*=.84; }
   if(branchBehavior.mode==='compact_round'){ spread*=.90; }
   // G2.5.3: bough habit is expressed in woody geometry rather than leaf stamps alone.
   if(actual==='cedro'){rise*=.38;spread*=1.10;anchor=Math.max(anchor,.45);}
   if(actual==='picea'){rise=rise*.32-8*(1-anchor);spread*=.91;anchor=Math.max(anchor,.40);}
   if(actual==='abeto'){rise*=.46;spread*=.98;anchor=Math.max(anchor,.43);}
   // G2.5.2: avoid foliage at the foot pivot in steep 2.5D cameras.
   // Preserves permanent branch IDs and juvenile growth factors.
   const anchorFloor={cedro:.48,sicomoro:.58,macieira:.53,mangueira:.48,figueira:.61,cajueiro:.65}[actual];
   if(anchorFloor!==undefined)anchor=Math.max(anchor,anchorFloor);
   return {...b,spread,rise,radius:b.radius*profile.branchRadiusScale,anchor,birth};
 });
 const secondarySites=prototype.morphology.secondarySites.map(s=>({...s,
   spread:s.spread*profile.spreadScale*((branchBehavior.spreadMul??1)*(.96)),rise:s.rise*profile.riseScale*(branchBehavior.riseMul??1)}));
 let foliageSites=(prototype.morphology.foliageSites||[]).map(s=>({...s}));
 if(actual==='bananeira'){
   const byBranch=new Map();
   for(const s of foliageSites){ if(!byBranch.has(s.branchId)) byBranch.set(s.branchId,[]); byBranch.get(s.branchId).push(s); }
   foliageSites=[];
   for(const [branchId,items] of byBranch.entries()){
    const sorted=items.sort((a,b)=>a.u-b.u);
    const pick=[sorted[Math.floor(sorted.length*.58)], sorted[Math.floor(sorted.length*.74)], sorted[Math.floor(sorted.length*.88)]].filter(Boolean);
    pick.slice(0,2).forEach((src,i)=>foliageSites.push({...src,id:'leaf:'+branchId+':banana:'+i,u:Math.max(.62,src.u),side:i%2?-1:1,size:1.8-.22*i,birth:Math.min(.96,src.birth+.05)}));
   }
  }
 const coniferAnatomy=G253_CONIFER_PROFILES[actual]||null;
 const coniferBudSites=coniferAnatomy?branches.flatMap(b=>{
   const count=coniferAnatomy.budsPerBranch;
   return Array.from({length:count},(_,k)=>{
    const sr=rand(hash(seed,'g253-shoot-genetics',actual,b.id,k));
    return {id:'bud:'+b.id+':'+k,branchId:b.id,t:clamp((k+.48+rrange(sr,-.14,.14))/count,.10,.96),
     side:k%2?-1:1,angle:rrange(sr,-.8,.8),scale:rrange(sr,.73,1.19),
     priority:sr(),birth:clamp(b.birth+rrange(sr,-.065,.028),.14,.99),seed:hash(seed,actual,'g253-short-shoot',b.id,k)};
   });
 }):[];
 const meta={...prototype.morphology,secondarySites,foliageSites,coniferBudSites,schema:'tree-morphology/2.5.3',geneticProfile:profile.geneticProfile||null};
 return {...prototype,species:actual,archetype:profile.archetype,seed,dnaSeed,
   profileVersion:7,catalogProfile:profile,trunk,branches,morphology:meta,
   catalogueVersion:'/G3-26/2.5.3'};
}
function g25PrototypeTree(tree){
 const spec=g25SpeciesProfile(tree.species);
 if(!spec)return tree;
 return {...tree,originalSpecies:tree.species,catalogSpecies:tree.species,
  species:spec.archetype,seed:tree.dnaSeed,archetype:spec.archetype,catalogProfile:spec};
}
function g25Render(canvas,args={}){
 const actualTree=args.tree||g25Create(args);
 if(!g25SpeciesProfile(actualTree.species))return G25_BASE_RENDER(canvas,{...args,tree:actualTree});
 const p=actualTree.catalogProfile,internal=g25PrototypeTree(actualTree);
 const newArgs={...args,tree:internal,species:internal.species,
   density:clamp(Number(args.density??.98)*p.foliageDensity,.3,1.30),
   // Deterministically disallow incompatible vines unless explicitly requested.
   vines:['sicomoro','figueira','olmo'].includes(actualTree.species)?Number(args.vines??0)*.45:0};
 const result=G25_BASE_RENDER(canvas,newArgs);
 return {...result,tree:actualTree,catalogSpecies:actualTree.species,archetype:p.archetype,
  leafProfile:p.geneticProfile?.leafSource||p.leafG7||'G8/custom-'+p.shape,leafAttachmentIds:actualTree.morphology.foliageSites.length};
}
function g25Export(args={}){
 const tree=args.tree||g25Create(args);
 const profile=g25SpeciesProfile(tree.species);
 if(!profile)return {...G25_BASE_EXPORT({...args,tree}),referencePalette:{enabled:args.referencePalette!==false,strength:Number(args.paletteStrength??.90),source:'tree.zip',referenceSpecies:G254_REF_MAP[tree.species]||null}};
 const exported=G25_BASE_EXPORT({...args,tree:g25PrototypeTree(tree)});
 return {...exported,engineVersion:'0.9.4',species:tree.species,seed:tree.seed,
  catalogue:{version:'/G3-26/2.5.3',species:tree.species,archetype:profile.archetype,
   botanicalProfile:profile,geneticLeafProfile:profile.leafSpecies||profile.leafG7||null,
   leafSource:profile.geneticProfile?.leafSource||'G8/custom',
   validation:'botanical identity revision applied; pending art review', geneticProfile:profile.geneticProfile || null},
  morphology:{...exported.morphology,trunk:tree.trunk,branches:tree.branches,
   foliageSites:tree.morphology.foliageSites,secondarySites:tree.morphology.secondarySites,coniferBudSites:tree.morphology.coniferBudSites||[]},
  referencePalette:{enabled:args.referencePalette!==false,strength:Number(args.paletteStrength??.90),source:'tree.zip',directReferences:['carvalho','pinheiro','bétula','salgueiro','outonal'],otherSpecies:'analogue with species-specific native colors'},status:'G2.5.4_reference_palette_artist_review_required'};
}

return Object.freeze({version:'0.9.4',referencePalettes:G254_REF_PALETTES,paletteMapping:G254_REF_MAP,windStructure:g244AnimatedStructure,volumetricFoliage:g244VolumetricInstances,vineGeometry:g244VineGeometry,attachedFoliage:g243AttachedInstances,artProfiles:G2_PROFILES,foliageProfiles:G242_PROFILES,species:{...SPECIES,...G251_SPECIES},catalog:G25_CATALOG,botanicalProfiles:G251_SPECIES,create:g25Create,foliageInstances:g242FoliageInstances,structure,g231Structure,project,buildCamera,render:g25Render,exportState:g25Export,hash,drawGrid});

}
