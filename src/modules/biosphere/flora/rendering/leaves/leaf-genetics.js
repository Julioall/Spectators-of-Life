/* Generated from the G9  procedural engines; modular ESM edition. */

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const num=(v,def)=>Number.isFinite(Number(v))?Number(v):def;
function mix32(n){let x=n|0;x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);return (x^(x>>>16))>>>0}
function unit(seed,n){return mix32(seed ^ Math.imul(n+1,0x9e3779b9))/4294967296}
function seedOf(x){if(Number.isFinite(Number(x)))return Number(x)|0;let h=2166136261;for(let i=0;i<String(x).length;i++)h=Math.imul(h^String(x).charCodeAt(i),16777619);return h|0}
const LOCI=['length','width','lobes','veins','fold','pigment','stiffness','longevity','resilience','spread','curvature'];
const SPECIES=[
 {id:'quercus',name:'Carvalho',scientific:'Quercus sp.',family:'Fagaceae',shape:'carvalho',structure:'simples',margin:'lobada',veinPattern:'pinada',deciduous:true,palette:['#1a2b16','#294522','#3b612a','#557e32','#72a340','#97be58','#c6d783'],base:{length:1,width:1.03,marginDetail:.62,veinDensity:.73,fold:.26,windStiffness:.50,curvature:.08},physiology:{longevityDays:185,seasonalPigment:.92,droughtTolerance:.55,coldTolerance:.72}},
 {id:'acer',name:'Bordo',scientific:'Acer sp.',family:'Sapindaceae',shape:'bordo',structure:'simples',margin:'lobada',veinPattern:'palmada',deciduous:true,palette:['#1b301b','#28532a','#397739','#4d9941','#67b557','#95cd71','#c7e292'],base:{length:1.06,width:1.17,marginDetail:.78,veinDensity:.86,fold:.27,windStiffness:.42,curvature:.03},physiology:{longevityDays:160,seasonalPigment:1,droughtTolerance:.40,coldTolerance:.86}},
 {id:'mangifera',name:'Mangueira',scientific:'Mangifera indica',family:'Anacardiaceae',shape:'lanceolada',structure:'simples',margin:'inteira',veinPattern:'pinada',deciduous:false,palette:['#112c1d','#204a29','#276b34','#34823c','#529748','#77b15c','#a3c97e'],base:{length:1.32,width:.68,marginDetail:.17,veinDensity:.92,fold:.37,windStiffness:.72,curvature:.16},physiology:{longevityDays:490,seasonalPigment:.10,droughtTolerance:.65,coldTolerance:.17}},
 {id:'salix',name:'Salgueiro',scientific:'Salix sp.',family:'Salicaceae',shape:'salgueiro',structure:'simples',margin:'serrilhada',veinPattern:'pinada',deciduous:true,palette:['#253421','#3a5029','#547436','#739449','#93b35a','#b4c97b','#d7dfa5'],base:{length:1.38,width:.65,marginDetail:.48,veinDensity:.70,fold:.14,windStiffness:.18,curvature:.21},physiology:{longevityDays:150,seasonalPigment:.70,droughtTolerance:.25,coldTolerance:.83}},
 {id:'ginkgo',name:'Ginkgo',scientific:'Ginkgo biloba',family:'Ginkgoaceae',shape:'ginkgo',structure:'simples',margin:'ondulada',veinPattern:'dicotomica',deciduous:true,palette:['#2a341a','#475626','#697936','#869948','#a6b85c','#c7d275','#e2e5a5'],base:{length:.93,width:1.13,marginDetail:.45,veinDensity:.86,fold:.15,windStiffness:.50,curvature:.02},physiology:{longevityDays:190,seasonalPigment:1,droughtTolerance:.63,coldTolerance:.86}},
 {id:'pinus',name:'Pinheiro (agulha)',scientific:'Pinus sp.',family:'Pinaceae',shape:'agulha',structure:'simples',margin:'inteira',veinPattern:'paralela',deciduous:false,palette:['#182921','#20382a','#2b4935','#376244','#477d52','#689866','#94b48a'],base:{length:1.29,width:.51,marginDetail:0,veinDensity:.35,fold:.08,windStiffness:.78,curvature:.07},physiology:{longevityDays:780,seasonalPigment:.04,droughtTolerance:.76,coldTolerance:.92}},
 {id:'fraxinus',name:'Freixo (pinada)',scientific:'Fraxinus sp.',family:'Oleaceae',shape:'lanceolada',structure:'pinada',margin:'serrilhada',veinPattern:'pinada',deciduous:true,palette:['#182b16','#284923','#38612d','#527d36','#709d44','#91ba58','#bdd47a'],base:{length:1.04,width:.83,leafletCount:9,leafletSpread:.76,leafletScale:1.02,marginDetail:.46,veinDensity:.81,fold:.18,windStiffness:.43,curvature:.07},physiology:{longevityDays:165,seasonalPigment:.88,droughtTolerance:.45,coldTolerance:.73}},
 {id:'trifolium',name:'Trevo (trifoliada)',scientific:'Trifolium sp.',family:'Fabaceae',shape:'oval',structure:'trifoliada',margin:'inteira',veinPattern:'reticulada',deciduous:false,palette:['#19301a','#2e5324','#40752e','#55933b','#77b34f','#9fce68','#c9e28e'],base:{length:.86,width:1.16,leafletCount:3,leafletSpread:.83,leafletScale:1.08,marginDetail:.1,veinDensity:.67,fold:.16,windStiffness:.19,curvature:.04},physiology:{longevityDays:95,seasonalPigment:.26,droughtTolerance:.30,coldTolerance:.53}},
 {id:'jacaranda',name:'Jacarandá (bipinada)',scientific:'Jacaranda mimosifolia',family:'Bignoniaceae',shape:'oval',structure:'bipinada',margin:'inteira',veinPattern:'pinada',deciduous:true,palette:['#1b361f','#2d5529','#3d7132','#559044','#75af59','#9dc775','#c5df98'],base:{length:1.12,width:.70,leafletCount:13,leafletSpread:.75,leafletScale:.76,marginDetail:.09,veinDensity:.57,fold:.16,windStiffness:.22,curvature:.18},physiology:{longevityDays:190,seasonalPigment:.60,droughtTolerance:.44,coldTolerance:.33}},
 {id:'ceiba',name:'Paineira (palmada)',scientific:'Ceiba speciosa',family:'Malvaceae',shape:'lanceolada',structure:'palmada',margin:'serrilhada',veinPattern:'pinada',deciduous:true,palette:['#1a2d19','#2c4925','#3c692f','#57823b','#78a34c','#9ebf65','#ccda86'],base:{length:1,width:.88,leafletCount:7,leafletSpread:.95,leafletScale:.91,marginDetail:.46,veinDensity:.76,fold:.18,windStiffness:.51,curvature:.08},physiology:{longevityDays:175,seasonalPigment:.69,droughtTolerance:.62,coldTolerance:.20}}
];
const table=Object.fromEntries(SPECIES.map(s=>[s.id,s]));
const getSpecies=id=>table[id]||null;
const sizeTrait=(v,mul,lo,hi)=>clamp(v*mul,lo,hi);
function createGenome(species,seed=2026,diversity=.65){
 if(!getSpecies(species))throw new Error('Espécie desconhecida: '+species);
 const s=seedOf(seed),d=clamp(num(diversity,.65));
 const alleles={};for(let i=0;i<LOCI.length;i++){
  // both alleles remain in [0,1]. Diversity modulates departures from baseline 0.5.
  alleles[LOCI[i]]=[0,1].map(j=>Math.round(clamp(.5+(unit(s,i*19+j*71+11)-.5)*d*1.8)*10000)/10000);
 }
 return {schema:'leaf-genome/1',species,seed:s,generation:0,alleles};
}
function validateGenome(g){
 if(!g||g.schema!=='leaf-genome/1'||!getSpecies(g.species))throw new Error('Genoma inválido ou espécie desconhecida');
 for(const key of LOCI){if(!Array.isArray(g.alleles?.[key])||g.alleles[key].length!==2||g.alleles[key].some(n=>!Number.isFinite(n)||n<0||n>1))throw new Error('Locus inválido: '+key)}
 return g;
}
function breed(mother,father,seed=2026,mutationRate=.025){
 validateGenome(mother);validateGenome(father);
 if(mother.species!==father.species)throw new Error('Cruzamento restrito à mesma espécie');
 const s=seedOf(seed),rate=clamp(num(mutationRate,.025));const alleles={};
 LOCI.forEach((key,i)=>{const allelesFrom=[mother,father];alleles[key]=allelesFrom.map((p,j)=>{
  const selected=p.alleles[key][unit(s,13+i*23+j*3)<.5?0:1];
  const mutated=unit(s,927+i*17+j)<rate? (unit(s,1079+i*17+j)-.5)*.38:0;
  return Math.round(clamp(selected+mutated)*10000)/10000;
 });});
 return {schema:'leaf-genome/1',species:mother.species,seed:s,
  generation:Math.max(mother.generation||0,father.generation||0)+1,alleles};
}
function trait(genome,key){return (genome.alleles[key][0]+genome.alleles[key][1])*.5*2-1}
function pigmentRamp(palette,variation){
 // Adjust brightness/temperature without destroying the species' 7-step indexed-pixel palette.
 return palette.map(hex=>{const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
  const tint=variation*18;const rr=clamp(Math.round(c[0]+tint),0,255),gg=clamp(Math.round(c[1]-Math.abs(tint)*.23),0,255),bb=clamp(Math.round(c[2]-tint*.42),0,255);
  return '#'+[rr,gg,bb].map(v=>v.toString(16).padStart(2,'0')).join('');});
}
function phenotype(genome,environment={}){
 validateGenome(genome);const sp=getSpecies(genome.species),base=sp.base,phy=sp.physiology;
 const g=name=>trait(genome,name);
 const drought=clamp(num(environment.drought,0)),nutrients=clamp(num(environment.nutrients,1));
 const vitality=clamp(1-(1-nutrients)*.26-drought*(1-phy.droughtTolerance)*.31,.55,1);
 const m={species:sp.id,genome,shape:sp.shape,structure:sp.structure,margin:sp.margin,veinPattern:sp.veinPattern,deciduous:sp.deciduous,
  length:sizeTrait((base.length||1)*(1+g('length')*.20)*vitality,1,.3,1.6),
  width:sizeTrait((base.width||1)*(1+g('width')*.22)*vitality,1,.25,1.8),
  marginDetail:clamp(num(base.marginDetail,.4)+g('lobes')*.20),
  veinDensity:clamp(num(base.veinDensity,.7)+g('veins')*.21),
  fold:clamp(num(base.fold,.15)+g('fold')*.18),
  curvature:clamp(num(base.curvature,.1)+g('curvature')*.23,-1,1),
  windStiffness:clamp(num(base.windStiffness,.35)+g('stiffness')*.22),
  leafletCount:sp.structure==='simples'?1:sp.structure==='trifoliada'?3:Math.round((clamp(num(base.leafletCount,7)+g('spread')*4,3,17)-1)/2)*2+1,
  leafletSpread:clamp(num(base.leafletSpread,.7)+g('spread')*.18),
  leafletScale:clamp(num(base.leafletScale,1)*(1+g('width')*.12),.5,1.5),
  leafColorRamp:pigmentRamp(sp.palette,g('pigment')),
  lifespanDays:Math.round(phy.longevityDays*(1+g('longevity')*.24)),
  seasonalPigment:clamp(phy.seasonalPigment),
  droughtTolerance:clamp(phy.droughtTolerance+g('resilience')*.16),
  coldTolerance:clamp(phy.coldTolerance+g('resilience')*.12),
  genotypeSignature:LOCI.map(k=>genome.alleles[k].join(':')).join('|'),
  geneticTraits:Object.fromEntries(LOCI.map(k=>[k,Math.round(g(k)*1000)/1000]))};
 if(sp.structure==='palmada'){m.leafletCount=Math.min(9,m.leafletCount)}
 if(sp.structure==='bipinada'){m.leafletCount=Math.min(17,m.leafletCount)}
 return m;
}
function resolve(options={}){
 if(!options.species)return {...options};
 const species=getSpecies(options.species);if(!species)throw new Error('Espécie desconhecida: '+options.species);
 const genome=options.genome?validateGenome(options.genome):createGenome(options.species,options.seed??2026,options.geneticDiversity??.65);
 if(genome.species!==species.id)throw new Error('Genoma não corresponde à espécie selecionada');
 const traits=phenotype(genome,options);
 const explicit=options.overrideSpeciesTraits||{};
 // Species controls shape, physiology and genetics. Rendering/lighting/life/wind parameters remain caller-controlled.
 return {...options,...traits,...explicit,genome,seed:options.seed??genome.seed,species:species.id,
  _geneticsResolved:true};
}
function summary(options={}){
 if(!options.species)return null;
 const p=options._geneticsResolved?options:resolve(options);
 return {species:p.species,scientific:getSpecies(p.species).scientific,family:getSpecies(p.species).family,
  generation:p.genome.generation,seed:p.genome.seed,genome:p.genome,
  lifespanDays:p.lifespanDays,seasonalPigment:p.seasonalPigment,
  droughtTolerance:p.droughtTolerance,coldTolerance:p.coldTolerance,
  traits:p.geneticTraits,shape:p.shape,structure:p.structure};
}
export { LOCI, SPECIES, getSpecies, createGenome, validateGenome, breed, phenotype, resolve, summary };
