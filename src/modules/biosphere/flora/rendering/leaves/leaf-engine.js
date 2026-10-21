/* Generated from the G9  procedural engines; modular ESM edition. */
import * as LeafGenetics from './leaf-genetics.js';
import * as LeafLifecycle from './leaf-lifecycle.js';
import * as WindApi from '../../../../atmosphere/wind/index.js';
import { createCanvas } from './canvas.js';


  const SHAPES = [
    {id:'eliptica', name:'Elíptica'}, {id:'oval', name:'Oval'},
    {id:'lanceolada', name:'Lanceolada'}, {id:'serrilhada', name:'Serrilhada'},
    {id:'carvalho', name:'Carvalho'}, {id:'bordo', name:'Bordo'},
    {id:'coracao', name:'Coração'}, {id:'ginkgo', name:'Ginkgo'},
    {id:'agulha', name:'Agulha'}, {id:'salgueiro',name:'Salgueiro'},
    {id:'azevinho',name:'Azevinho'}, {id:'bananeira',name:'Bananeira'}
  ];
  const STRUCTURES = [
    {id:'simples',name:'Simples (um limbo)'},
    {id:'pinada',name:'Composta pinada'},
    {id:'bipinada',name:'Composta bipinada'},
    {id:'palmada',name:'Composta palmada'},
    {id:'trifoliada',name:'Composta trifoliada'}
  ];
  const PALETTES = {
    floresta: ['#162818','#24432a','#355f32','#4b7938','#669742','#8eb858','#b8d67a'],
    primavera:['#26452b','#346735','#4c8a42','#68ac51','#91cb65','#b4dd86','#d3eaa6'],
    outono:   ['#402521','#673625','#925027','#bc722c','#da9c3a','#efbf54','#f7d877'],
    vermelho: ['#321d2a','#562a39','#7d3442','#a7474b','#c96a59','#e29b75','#f2c39a'],
    inverno:  ['#1c3133','#2c4f49','#436961','#67897b','#89aa98','#b5c9ab','#d5dfcc']
  };
  const MARGINS = [
    {id:'auto', name:'Automática pelo formato'}, {id:'inteira',name:'Inteira'},
    {id:'serrilhada',name:'Serrilhada'}, {id:'dentada',name:'Dentada'},
    {id:'ondulada',name:'Ondulada'}, {id:'lobada',name:'Lobada'},
    {id:'espinhosa',name:'Espinhosa'}
  ];
  const VENATION = [
    {id:'auto',name:'Automática pelo formato'}, {id:'pinada',name:'Pinada'},
    {id:'palmada',name:'Palmada'}, {id:'paralela',name:'Paralela'},
    {id:'dicotomica',name:'Dicotômica (leque)'}, {id:'reticulada',name:'Reticulada'}
  ];
  const DEFAULT = {
    shape:'carvalho', structure:'simples', size:96, angle:0, tilt:0,
    length:1.0, width:1.0, variation:0.35, texture:0.56,
    veins:true, stem:true, palette:'floresta', seed:2026,
    leafletCount:9, leafletScale:1.0, leafletSpread:0.75,
    curvature:0, curl:0, fold:0.15,
    windStrength:0, windDirection:80, time:0,
    pitch:0, twist:0, lightAzimuth:-35, lightElevation:55,
    margin:'auto', marginDetail:.40, veinPattern:'auto', veinDensity:.7,
    veinContrast:.72, surfaceRoughness:.20,
    worldX:0,worldY:0,windStiffness:.35,windMass:.38,windDrag:.7,
    windShelter:0,windExposure:1,gustiness:.60,turbulence:.38,
    spatialScale:190,windSeed:47261,windSpeed:1,
    lifeProgress:.56,season:'verao',seasonIntensity:1,deciduous:true,
    drought:0,nutrients:1,herbivory:0,disease:0,abscission:false
  };
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const genetics=()=>LeafGenetics;
  const resolved=opts=>opts?._geneticsResolved?opts:(opts?.species && genetics()?.resolve?genetics().resolve(opts):opts);
  const geneticSummary=opts=>opts?.species && genetics()?.summary?genetics().summary(opts):null;
  const lifecycle=()=>LeafLifecycle;
  const lifeState=cfg=>lifecycle()?.evaluate(cfg) || {growth:1,unfurl:1,dryness:0,detached:false,warm:0,damage:0};
  const lerp=(a,b,t)=>a+(b-a)*t;

  function hash(n){
    let x=n|0;
    x=Math.imul(x ^ (x>>>16),0x7feb352d);
    x=Math.imul(x ^ (x>>>15),0x846ca68b);
    return ((x ^ (x>>>16))>>>0)/4294967296;
  }
  function noise(x,y,s){return hash((Math.imul((x|0),374761393) ^ Math.imul((y|0),668265263) ^ Math.imul(s|0,2246822519))|0);}
  const rgba=(hex)=>{
    const z=hex.replace('#','');return [parseInt(z.slice(0,2),16),parseInt(z.slice(2,4),16),parseInt(z.slice(4,6),16)];
  };
  // G3 + G4: geometria parametrica, malha 3D, z-buffer e nervuras em UV.
  // Uma folha continua sendo um sprite 2D com projecao 2.5D; NAO cria arvores.
  function makeCanvas(size){
    return createCanvas(size,size);
  }
  function drawPixelLine(ctx,points,color,thickness){
    ctx.strokeStyle=color;ctx.lineWidth=thickness;ctx.lineJoin='round';ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);
    points.slice(1).forEach(p=>ctx.lineTo(p[0],p[1]));ctx.stroke();
  }
  function smoothstep(a,b,x){const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);}
  function mixRamp(ramp,index){
    const q=clamp(Math.round(index),0,ramp.length-1);return ramp[q];
  }
  function configureGeometry(raw){
    const cfg={...DEFAULT,...raw};
    if(raw.windField && raw.windStrength==null)cfg.windStrength=1;
    cfg.size=Math.round(clamp(Number(cfg.size)||96,16,256));
    cfg.seed=(Number(cfg.seed)||0)|0;
    for(const [k,min,max] of [['variation',0,1],['texture',0,1],['marginDetail',0,1],
      ['veinDensity',0,1],['veinContrast',0,1],['surfaceRoughness',0,1],['fold',0,1],
      ['windStrength',0,1],['curvature',-1,1],['curl',-1,1],['length',.3,1.6],['width',.25,1.8],
      ['tilt',-85,85],['pitch',-82,82],['twist',-90,90],['lightElevation',5,90],
      ['windStiffness',0,1],['windMass',0,1],['windDrag',0,1],['windShelter',0,1],
      ['windExposure',0,1],['lifeProgress',0,1],['seasonIntensity',0,1],
      ['drought',0,1],['nutrients',0,1],['herbivory',0,1],['disease',0,1],['gustiness',0,1],['turbulence',0,1],['spatialScale',24,2000],['windSpeed',0,3]]) {
      cfg[k]=clamp(Number(cfg[k])||0,min,max);
    }
    cfg.angle=((Number(cfg.angle)||0)%360+360)%360;
    cfg.lightAzimuth=((Number(cfg.lightAzimuth)||0)%360+360)%360;
    cfg.windDirection=((Number(cfg.windDirection)||0)%360+360)%360;
    cfg.worldX=Number(cfg.worldX)||0; cfg.worldY=Number(cfg.worldY)||0;
    cfg.windSeed=(Number(cfg.windSeed)||0)|0;
    cfg.time=((Number(cfg.time)||0)%1+1)%1;
    return cfg;
  }
  // G5 — Campo compartilhado e resposta biomecanica estilizada (estatica, sem integrador).
  // A mesma amostra espacial serve para gramas/arbustos via WindApi.
  // A defasagem no tempo aproxima inercia elastica preservando acesso aleatorio a frames.
  function makeWindDynamics(cfg){
    const globalField=typeof cfg.windField?.sample==='function' ? cfg.windField : null;
    const sdk=WindApi;
    const field=globalField || (sdk?.createWindField ? sdk.createWindField({
      seed:cfg.windSeed,strength:cfg.windStrength,direction:cfg.windDirection,
      gustiness:cfg.gustiness,turbulence:cfg.turbulence,
      spatialScale:cfg.spatialScale,flowSpeed:cfg.windSpeed
    }) : null);
    const gain=(1-cfg.windStiffness*.78)*(.30+cfg.windDrag*.70)*
      (1-cfg.windShelter)*cfg.windExposure*(globalField?cfg.windStrength:1);
    if(gain<=0 || (!globalField&&cfg.windStrength<=0))return {vx:0,vy:0,intensity:0,flutter:0,phase:0};
    const delayed=cfg.time-(.008+.085*cfg.windMass)*(1-cfg.windStiffness*.60);
    let rootSample,tipSample;
    if(field){
      rootSample=field.sample(cfg.worldX,cfg.worldY,delayed);
      tipSample=field.sample(cfg.worldX+18,cfg.worldY-35,delayed-.015*cfg.windMass);
    }else{
      const f=2*Math.PI*cfg.time,ang=cfg.windDirection*Math.PI/180;
      const power=cfg.windStrength*(.8+.2*Math.sin(f+cfg.worldX*.015));
      const w={vx:Math.sin(ang)*power,vy:-Math.cos(ang)*power,strength:power};
      rootSample=tipSample=w;
    }
    const vx=(rootSample.vx*.34+tipSample.vx*.66)*gain;
    const vy=(rootSample.vy*.34+tipSample.vy*.66)*gain;
    const flutter= Math.sin(2*Math.PI*cfg.time*2 + cfg.worldX*.017 + cfg.worldY*.012 +
      hash(cfg.seed+917)*.45) * Math.min(1.5,tipSample.strength)*gain;
    return {vx,vy,intensity:Math.hypot(vx,vy),flutter,
      direction:Math.atan2(vx,-vy),fieldSample:tipSample};
  }
  function anatomy(shape,cfg){
    const autoMargin={serrilhada:'serrilhada',carvalho:'lobada',bordo:'lobada',
      salgueiro:'serrilhada',azevinho:'espinhosa',ginkgo:'ondulada',figueira:'lobada'};
    const autoVein={bordo:'palmada',coracao:'palmada',ginkgo:'dicotomica',agulha:'paralela',
      bananeira:'paralela',azevinho:'reticulada'};
    return {margin:cfg.margin==='auto'?(autoMargin[shape]||'inteira'):cfg.margin,
      vein:cfg.veinPattern==='auto'?(autoVein[shape]||'pinada'):cfg.veinPattern};
  }
  function leafProfile(shape,cfg){
    const {margin}=anatomy(shape,cfg);
    const asym=(hash(cfg.seed+78)-.5)*.25*cfg.variation;
    const shift=(hash(cfg.seed+279)-.5)*.075*cfg.variation;
    const teeth=shape==='azevinho'?10:shape==='salgueiro'?19:14;
    function width(t,side){
      t=clamp(t,0,1);
      const st=Math.max(0,Math.sin(Math.PI*t));
      let w=Math.pow(st,.83);
      if(shape==='oval')w=Math.pow(st,.73)*(1.15-.32*t);
      if(shape==='lanceolada')w=Math.pow(st,1.14)*(.66+.25*t)*.74;
      if(shape==='salgueiro')w=Math.pow(st,1.25)*(.80+.1*t)*.50;
      if(shape==='agulha')w=Math.pow(st,.30)*.11;
      if(shape==='bananeira')w=Math.pow(st,.5)*(1-.12*t)*1.17;
      if(shape==='coracao')w=(.52+1.1*Math.pow(st,.78))*Math.pow(1-t,.62)*(.95-.10*t);
      if(shape==='ginkgo')w=Math.pow(smoothstep(0,.72,t),.69)*(1.15-.12*t);
      if(shape==='carvalho')w=Math.pow(st,.61)*(.64+.45*Math.pow(Math.cos(5*Math.PI*t),2));
      if(shape==='bordo')w=Math.pow(st,.70)*(.60 + .46*Math.pow(Math.max(0,Math.cos(3*Math.PI*t+.3)),3));
      if(shape==='azevinho')w=Math.pow(st,.75)*(.92+.07*Math.sin(t*14));
      if(shape==='serrilhada')w=Math.pow(st,.83);
      let m=1;
      const irregular=cfg.marginDetail;
      if(margin==='serrilhada'){
        const wave=t*teeth+ .16;
        m+=irregular*.125*((wave%1)-.54);
      } else if(margin==='dentada') {
        m+=irregular*.15*(1-Math.abs((t*teeth+.2)%1*2-1));
      } else if(margin==='ondulada'){
        m+=irregular*.105*Math.sin(t*Math.PI*11+side*.38);
      } else if(margin==='lobada'){
        m+=irregular*(shape==='carvalho'?.075:.23)*(Math.cos(t*Math.PI*(shape==='bordo'?8:11)+.3)**3);
      } else if(margin==='espinhosa'){
        const frac=(t*10+.25)%1;
        m+=irregular*.23*Math.pow(1-Math.abs(2*frac-1),13);
      }
      // Low-frequency asymmetry belongs to the silhouette, not to per-pixel noise.
      const wobble=.018*cfg.variation*Math.sin(t*20 + hash(cfg.seed+99)*8+side*1.1);
      return Math.max(.002,w*m*(1+(side>0?asym:-asym))+wobble*w);
    }
    function longitudinal(u,t){
      // Botanical notches: cordate basal sinus and ginkgo's split distal edge.
      const abs=Math.abs(u);
      if(shape==='coracao')return .145*Math.pow(Math.max(0,1-abs),2)+t*(1-.145*Math.pow(Math.max(0,1-abs),2));
      if(shape==='ginkgo')return t*(.88+.12*Math.sin(Math.PI*abs));
      return t;
    }
    return {width,longitudinal,shift};
  }
  function makeVeins(shape,cfg){
    if(!cfg.veins)return [];
    const {vein}=anatomy(shape,cfg),out=[];
    // Coordinates are UV where u spans (-1..1), t spans (0..1).
    function add(u0,t0,u1,t1,width=.65){out.push({u0,t0,u1,t1,w:width});}
    const main=shape==='ginkgo'?.45:1;
    add(0,.06,0,.96,main);
    const density=cfg.veinDensity;
    if(vein==='paralela'){
      const n=3+Math.round(density*3);
      for(let i=1;i<=n;i++)for(const side of [-1,1]){
        const u=side*i/(n+1)*.93;
        add(0,.12,u,.31,.6);add(u,.31,u*.96,.82,.5);add(u*.96,.82,0,.97,.30);
      }
    }else if(vein==='dicotomica'){
      for(let k=-5;k<=5;k++){
        const u=k/5*.88;
        add(0,.17,u*.39,.43,.53);add(u*.39,.43,u,.92,.48);
        if(k%2===0)add(u*.39,.48,u*.95+.1,.91,.32);
      }
    }else if(vein==='palmada'){
      for(let k=-3;k<=3;k++){
        if(k===0)continue;
        const u=k/3*.90;
        add(0,.12,u*.57,.43,.73);add(u*.57,.43,u,.76,.60);
        if(density>.4)add(u*.57,.43,u*.96,.59,.32);
      }
    }else{
      const n=4+Math.round(density*5);
      for(let j=0;j<n;j++){
        const t0=.14 + j*(.74/(n-1));
        for(const side of [-1,1]){
          const t1=clamp(t0+.15*(1-t0)+.06,.1,.97);
          const reach=.85+hash(cfg.seed+j*31+side*919)*.1;
          add(0,t0,side*.40,t0+(t1-t0)*.53,.72);
          add(side*.40,t0+(t1-t0)*.53,side*reach,t1,.54);
          if(density>.42){
            add(side*.44,t0+(t1-t0)*.56,side*.70,t1+.035,.31);
            if(vein==='reticulada')add(side*.70,t1,side*.81,clamp(t1+.11,0,1),.27);
          }
        }
      }
    }
    return out;
  }
  function renderSimpleLeaf(options={}) {
    const cfg=configureGeometry(options);
    const S=cfg.size, shape=SHAPES.some(s=>s.id===cfg.shape)?cfg.shape:'eliptica';
    const life=lifeState(cfg);
    if(life.detached)return makeCanvas(S);
    const ramp=(cfg.leafColorRamp||PALETTES[cfg.palette]||PALETTES.floresta).map(rgba);
    const warmRamp=(PALETTES[life.warm>.70 && (hash(cfg.seed+75)>.67)?'vermelho':'outono']).map(rgba);
    const brownRamp=['#271e19','#403020','#614127','#86552e','#ab7b40','#bd9960','#d2b47d'].map(rgba);
    const c=makeCanvas(S),ctx=c.getContext('2d',{willReadFrequently:true});
    const img=ctx.createImageData(S,S),out=img.data;
    const profile=leafProfile(shape,cfg),venation=makeVeins(shape,cfg);
    const lifePixels=life.warm>.005 || life.dryness>.005 || life.damage>.03 || life.blemish>.015;
    const L=S*.55*cfg.length*life.growth, W=S*.195*cfg.width*life.growth*life.unfurl;
    const angle=cfg.angle*Math.PI/180, cs=Math.cos(angle),sn=Math.sin(angle);
    const yaw=cfg.tilt*Math.PI/180,pitch=cfg.pitch*Math.PI/180;
    const cosY=Math.cos(yaw),sinY=Math.sin(yaw),cosP=Math.cos(pitch),sinP=Math.sin(pitch);
    const lightA=cfg.lightAzimuth*Math.PI/180,lightE=cfg.lightElevation*Math.PI/180;
    const light=[Math.sin(lightA)*Math.cos(lightE),Math.cos(lightA)*Math.cos(lightE),Math.sin(lightE)];
    const wind=makeWindDynamics(cfg);
    const phase=Math.PI*2*cfg.time;
    const randomPhase=hash(cfg.seed+913)*Math.PI*2;
    function point(u,t){
      const yy=profile.longitudinal(u,t);
      const w=profile.width(t,u>=0?1:-1) * (lifecycle()?.edgeWear(t,u>=0?1:-1,life) ?? 1);
      let x=u*W*w;
      let y=(yy-.5)*L;
      let z=0;
      const curve=cfg.curvature*.16*L*t*t + profile.shift*L*Math.sin(t*Math.PI);
      // Shape the blade as a three-dimensional surface, not a flat scaled bitmap.
      x+=curve;
      const veinRidge= Math.exp(-Math.abs(u)*18)*.015*L;
      z+=cfg.fold*(Math.abs(u)**1.45)*W*.36*w + veinRidge;
      z+=(cfg.curl+life.dryness*.55)*(t-.15)*(t-.15)*L*.13;
      z+=cfg.surfaceRoughness*W*.05*Math.sin(5*t*Math.PI + u*6+hash(cfg.seed+19)*8);
      // Each cross-section twists progressively around its longitudinal axis.
      const torsion=(cfg.twist+life.dryness*26)*Math.PI/180*(t-.15)*.85;
      const temp=x;
      x=x*Math.cos(torsion)+z*Math.sin(torsion);
      z=z*Math.cos(torsion)-temp*Math.sin(torsion);
      // Base praticamente fixa: resposta aumenta com t². A onda viaja pelo limbo.
      const tip=t*t;
      const flexWave=(Math.sin(phase*2+randomPhase*.20+t*3.3)*.67+
           Math.sin(phase+randomPhase*.15+t*1.5)*.33);
      x+=L*.27*tip*wind.vx + L*.012*tip*wind.intensity*flexWave;
      y-=L*.21*tip*wind.vy;
      // Torcao da ponta e flutter: sensibilidade adicional as correntes locais.
      z+=W*.16*tip*(wind.flutter+wind.intensity*.22*flexWave)*(1+.20*u);
      // yaw and pitch rotate real spatial points; screen roll remains independent.
      const xp=x*cosY+z*sinY,zp=z*cosY-x*sinY;
      const yp=y*cosP-zp*sinP,z2=y*sinP+zp*cosP;
      return {x:S*.5+xp*cs+yp*sn, y:S*.5+xp*sn-yp*cs, z:z2, space:[xp,yp,z2],u,t};
    }
    const T=Math.min(86,Math.max(36,Math.ceil(S*.62)));
    const U=18;
    const grid=Array.from({length:T+1},(_,i)=>Array.from({length:U+1},(_,j)=>point(j*2/U-1,i/T)));
    // Vertex normals from parametric derivatives are used for per-pixel diffuse shading.
    for(let i=0;i<=T;i++)for(let j=0;j<=U;j++){
      const prevU=grid[i][Math.max(0,j-1)].space,nextU=grid[i][Math.min(U,j+1)].space;
      const prevT=grid[Math.max(0,i-1)][j].space,nextT=grid[Math.min(T,i+1)][j].space;
      const a=nextU.map((v,k)=>v-prevU[k]),b=nextT.map((v,k)=>v-prevT[k]);
      let nx=a[1]*b[2]-a[2]*b[1],ny=a[2]*b[0]-a[0]*b[2],nz=a[0]*b[1]-a[1]*b[0];
      const norm=Math.hypot(nx,ny,nz)||1;
      nx/=norm;ny/=norm;nz/=norm;
      // Shade both surfaces; a fully inverted blade is still a leaf and not black.
      const dot=(nx*light[0]+ny*light[1]+nz*light[2]);
      grid[i][j].brightness=.17+.38*Math.abs(dot)+.08*nz+.10*(1-Math.abs(grid[i][j].u));
    }
    const zbuffer=new Float32Array(S*S);zbuffer.fill(-Infinity);
    const alpha=new Uint8Array(S*S);
    const projectedX=W*.90,projectedY=L;
    // In UV space, estimate vein distance in pixels. The network stays pinned to the blade.
    function veinShade(u,t){
      if(!cfg.veins)return 0;
      let strength=0;
      for(const seg of venation){
        const vx=(seg.u1-seg.u0)*projectedX,vy=(seg.t1-seg.t0)*projectedY;
        const xx=(u-seg.u0)*projectedX, yy=(t-seg.t0)*projectedY;
        const len2=vx*vx+vy*vy;
        const f=clamp((xx*vx+yy*vy)/(len2||1),0,1);
        const dist=Math.hypot(xx-f*vx,yy-f*vy);
        const thickness=seg.u0===0&&seg.u1===0? .80:.47;
        if(dist<thickness+.45){strength=Math.max(strength,seg.w*(1-smoothstep(thickness*.20,thickness+.45,dist)));}
      }
      return strength*cfg.veinContrast;
    }
    function raster(a,b,d){
      const minX=Math.max(0,Math.floor(Math.min(a.x,b.x,d.x))),
        maxX=Math.min(S-1,Math.ceil(Math.max(a.x,b.x,d.x))),
        minY=Math.max(0,Math.floor(Math.min(a.y,b.y,d.y))),
        maxY=Math.min(S-1,Math.ceil(Math.max(a.y,b.y,d.y)));
      const denom=(b.y-d.y)*(a.x-d.x)+(d.x-b.x)*(a.y-d.y);
      if(Math.abs(denom)<.00001)return;
      const inv=1/denom;
      for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
        const px=x+.5,py=y+.5;
        const w0=((b.y-d.y)*(px-d.x)+(d.x-b.x)*(py-d.y))*inv;
        if(w0<-.00001)continue;
        const w1=((d.y-a.y)*(px-d.x)+(a.x-d.x)*(py-d.y))*inv;
        if(w1<-.00001)continue;
        const w2=1-w0-w1;
        if(w2<-.00001)continue;
        const z=w0*a.z+w1*b.z+w2*d.z;
        const id=y*S+x;if(z<zbuffer[id])continue;
        const u=w0*a.u+w1*b.u+w2*d.u,t=w0*a.t+w1*b.t+w2*d.t;
        const botanicalNoise=noise(Math.round(u*46+135),Math.round(t*97),cfg.seed+151);
        const flecks=noise(Math.round(u*120+700),Math.round(t*210+400),cfg.seed+21);
        const sample=lifePixels ? lifecycle()?.sample(u,t,life) : null;
        if(sample?.hole)continue;
        zbuffer[id]=z;alpha[id]=255;
        const lightness=w0*a.brightness+w1*b.brightness+w2*d.brightness;
        const texture=(botanicalNoise-.5)*.21*cfg.texture+(flecks-.5)*.25*cfg.texture;
        const ridge=veinShade(u,t);
        const q=(lightness+texture+ridge*.09 -u*.065 +(1-t)*.022)*7.8;
        const color=mixRamp(ramp,q);
        const idx=id*4;
        if(sample){
          // Seasonal gradients and stresses are pigments over existing lit pixel art.
          const cWarm=mixRamp(warmRamp,q),cDry=mixRamp(brownRamp,q);
          const autumn=sample.autumn,dry=sample.dry,lesion=sample.lesion;
          const rr=lerp(lerp(color[0],cWarm[0],autumn),cDry[0],dry);
          const gg=lerp(lerp(color[1],cWarm[1],autumn),cDry[1],dry);
          const bb=lerp(lerp(color[2],cWarm[2],autumn),cDry[2],dry);
          out[idx]=Math.round(rr*(1-lesion*.68));out[idx+1]=Math.round(gg*(1-lesion*.76));
          out[idx+2]=Math.round(bb*(1-lesion*.67));
        }else{out[idx]=color[0];out[idx+1]=color[1];out[idx+2]=color[2]}
        out[idx+3]=255;
      }
    }
    for(let i=0;i<T;i++)for(let j=0;j<U;j++){
      const a=grid[i][j],b=grid[i][j+1],d=grid[i+1][j],e=grid[i+1][j+1];
      raster(a,b,d);raster(b,e,d);
    }
    // Ink botanical veins in sprite pixels, not canvas antialiasing, and compare
    // depth against the rasterized surface so their branches bend with the limbo.
    // Slightly offset highlights on thick primaries imply embossed ribs.
    if(cfg.veins && shape!=='agulha'){
      function plot(ix,iy,z,color,opacity){
        if(ix<1||iy<1||ix>=S-1||iy>=S-1)return;
        const id=iy*S+ix;
        if(!alpha[id]||z+1.15<zbuffer[id])return;
        const q=id*4;
        out[q]=Math.round(out[q]*(1-opacity)+color[0]*opacity);
        out[q+1]=Math.round(out[q+1]*(1-opacity)+color[1]*opacity);
        out[q+2]=Math.round(out[q+2]*(1-opacity)+color[2]*opacity);
      }
      const dark=ramp[2],bright=ramp[5];
      for(const seg of venation){
        const n=Math.max(2,Math.ceil(Math.hypot((seg.u1-seg.u0)*W,(seg.t1-seg.t0)*L)*1.8));
        const alphaLine=clamp(cfg.veinContrast*(seg.w>.8?.77:.51),0,1);
        for(let k=0;k<=n;k++){
          const f=k/n,u=lerp(seg.u0,seg.u1,f),t=lerp(seg.t0,seg.t1,f);
          const v=point(u,t),ix=Math.round(v.x),iy=Math.round(v.y);
          plot(ix,iy,v.z,dark,alphaLine);
          if(seg.w>.8 && k%3!==0)plot(ix+1,iy,v.z,bright,alphaLine*.36);
        }
      }
    }
    // Edge pixels are shaded after surface rasterization for a clean, stylized border.
    for(let y=1;y<S-1;y++)for(let x=1;x<S-1;x++){
      const id=y*S+x;if(!alpha[id])continue;
      const edge=(!alpha[id-S]||!alpha[id+S]||!alpha[id-1]||!alpha[id+1]);
      if(edge){const col=ramp[1];const off=id*4;
        out[off]=Math.round(out[off]*.45+col[0]*.55);
        out[off+1]=Math.round(out[off+1]*.45+col[1]*.55);
        out[off+2]=Math.round(out[off+2]*.45+col[2]*.55);
      }
    }
    // The stalk uses the same 3D projection and is anchored at the botanical base.
    ctx.putImageData(img,0,0);
    if(cfg.stem){
      const start=point(0,-.10),mid=point(0,.02),end=point(0,.16);
      drawPixelLine(ctx,[[start.x,start.y],[mid.x,mid.y],[end.x,end.y]],
        (cfg.leafColorRamp||PALETTES[cfg.palette]||PALETTES.floresta)[1],Math.max(1,Math.round(S/90)));
    }
    return c;
  }
  function cleanConfig(options={}){
    const cfg={...DEFAULT,...options};
    if(options.windField && options.windStrength==null)cfg.windStrength=1;
    cfg.size=Math.max(16,Math.min(256,Math.round(Number(cfg.size)||96)));
    cfg.seed=(Number(cfg.seed)||0)|0;
    cfg.angle=((Number(cfg.angle)||0)%360+360)%360;
    cfg.tilt=clamp(Number(cfg.tilt)||0,-85,85);
    cfg.length=clamp(Number(cfg.length)||1,.3,1.6);
    cfg.width=clamp(Number(cfg.width)||1,.25,1.8);
    cfg.variation=clamp(Number(cfg.variation)||0,0,1);
    cfg.texture=clamp(Number(cfg.texture)||0,0,1);
    cfg.leafletCount=Math.round(clamp(Number(cfg.leafletCount)||9,3,17));
    cfg.leafletScale=clamp(Number(cfg.leafletScale)||1,.5,1.5);
    cfg.leafletSpread=clamp(Number(cfg.leafletSpread)||0,0,1);
    cfg.curvature=clamp(Number(cfg.curvature)||0,-1,1);
    cfg.curl=clamp(Number(cfg.curl)||0,-1,1);
    cfg.fold=clamp(Number(cfg.fold)||0,0,1);
    cfg.windStrength=clamp(Number(cfg.windStrength)||0,0,1);
    cfg.windDirection=((Number(cfg.windDirection)||0)%360+360)%360;
    cfg.time=((Number(cfg.time)||0)%1+1)%1;
    // Preserve the new G3/G4 parameters for composed leaflets.
    const geo=configureGeometry(cfg);
    for(const key of ['pitch','twist','lightAzimuth','lightElevation','margin','marginDetail',
      'veinPattern','veinDensity','veinContrast','surfaceRoughness',
      'worldX','worldY','windSeed','windStiffness','windMass','windDrag',
      'windShelter','windExposure','gustiness','turbulence','spatialScale','windSpeed'])cfg[key]=geo[key];
    cfg.structure=STRUCTURES.some(x=>x.id===cfg.structure)?cfg.structure:'simples';
    cfg.shape=SHAPES.some(x=>x.id===cfg.shape)?cfg.shape:'eliptica';
    return cfg;
  }
  function renderCompoundLeaf(options={}){
    const cfg=cleanConfig(options),size=cfg.size;
    const life=lifeState(cfg);
    if(life.detached)return makeCanvas(size);
    const c=makeCanvas(size),ctx=c.getContext('2d');
    ctx.imageSmoothingEnabled=false;
    const ramp=cfg.leafColorRamp||PALETTES[cfg.palette]||PALETTES.floresta;
    const stemWidth=Math.max(1,Math.round(size/95));
    const stalkAge=clamp(life.warm*.78+life.dryness*.38,0,1);
    const freshStalk=rgba(ramp[1]),oldStalk=rgba('#66452a');
    const stalkColor='#'+freshStalk.map((v,i)=>Math.round(lerp(v,oldStalk[i],stalkAge)).toString(16).padStart(2,'0')).join('');
    const angle=cfg.angle*Math.PI/180;
    const cs=Math.cos(angle),sn=Math.sin(angle);
    const windPhase=2*Math.PI*cfg.time;
    const rootPhase=hash(cfg.seed+219)*6.283;
    const wind=makeWindDynamics(cfg);
    const L=size*.50*cfg.length*life.growth;
    const cx=size/2,cy=size/2;
    // Each rachis sample is evaluated from botanical coordinates, then projected.
    // No branch or trunk is generated; the dark strokes are the petiole and rachis.
    function locate(u,t,offset=0){
      const f=clamp(t,0,1),progress=f*f;
      const flutter=.018*size*wind.intensity*progress*Math.sin(windPhase*2+rootPhase*.10+f*2.0);
      const bend=cfg.curvature*size*.14*progress + size*.21*wind.vx*progress+flutter;
      const px=u + bend;
      const py=(t-.5)*L + offset - cfg.curl*size*.065*progress-size*.12*wind.vy*progress;
      return [cx+px*cs+py*sn,cy+px*sn-py*cs];
    }
    function twig(from,to,w=stemWidth){
      const mid=[(from[0]+to[0])*.5,(from[1]+to[1])*.5];
      drawPixelLine(ctx,[from,mid,to],stalkColor,w);
    }
    function placeBlade(attach,leafAngle,scale,individual,shapeOverride){
      const bladeSize=Math.round(clamp(size*.47*scale,16,200));
      const leafPhase=rootPhase + individual*.1731;
      // A raque reage ao mesmo campo; folíolos têm diferenças pequenas de elasticidade.
      const leafRad=leafAngle*Math.PI/180;
      const normalPush=wind.vx*Math.cos(leafRad)+wind.vy*Math.sin(leafRad);
      const flutter=Math.sin(windPhase*2+leafPhase*.28)*wind.intensity;
      const leafFlutter=normalPush*15 + flutter*4;
      const a=leafAngle+leafFlutter;
      const individualTwist=cfg.twist+(hash(cfg.seed+individual*191)-.5)*cfg.variation*30;
      const options={...cfg,structure:'simples',shape:shapeOverride||cfg.shape,
        size:bladeSize,angle:a,seed:(cfg.seed+individual*773+101)|0,
        worldX:cfg.worldX+attach[0]-cx,worldY:cfg.worldY+attach[1]-cy,
        stem:false,fold:cfg.fold,curvature:cfg.curvature*.32,
        twist:individualTwist,pitch:cfg.pitch+(hash(cfg.seed+individual*503)-.5)*15*cfg.variation,
        curl:cfg.curl,windStrength:cfg.windStrength*.78,
        width:cfg.width*(.87+.22*hash(individual+cfg.seed+77)),
        length:cfg.length*(.90+.16*hash(individual+cfg.seed+161))};
      const blade=renderSimpleLeaf(options);
      const l=bladeSize*.62*options.length*life.growth;
      const ar=a*Math.PI/180;
      const attachX=bladeSize/2-(l/2)*Math.sin(ar);
      const attachY=bladeSize/2+(l/2)*Math.cos(ar);
      ctx.drawImage(blade,Math.round(attach[0]-attachX),Math.round(attach[1]-attachY));
    }
    // Draw stems first, then blades, so leaflets visually overlap their stalks.
    const queue=[];
    function enqueue(pos,deg,scale,serial,shape){queue.push({pos,deg,scale,serial,shape});}
    if(cfg.structure==='pinada'){
      const pairs=Math.floor(cfg.leafletCount/2);
      const base=locate(0,0),top=locate(0,.98);
      if(cfg.stem){twig(locate(0,-.16),base);}
      const axis=[];for(let i=0;i<=18;i++)axis.push(locate(0,i/18));
      drawPixelLine(ctx,axis,stalkColor,stemWidth);
      for(let p=0;p<pairs;p++){
        const t=.16+(pairs<=1?0:p/(pairs-1))*.65;
        const scale=cfg.leafletScale*(.92-.32*t);
        for(let side of [-1,1]){
          const deg=side*(46+cfg.leafletSpread*37)+cfg.angle;
          const junction=locate(0,t),tip=locate(side*size*.045*cfg.leafletSpread,t+.035);
          twig(junction,tip);
          enqueue(tip,deg,scale,(p*2+(side+1)/2)|0);
        }
      }
      enqueue(top,cfg.angle,cfg.leafletScale*.65,102);
    }else if(cfg.structure==='trifoliada'||cfg.structure==='palmada'){
      const joint=locate(0,.20);
      if(cfg.stem)twig(locate(0,-.20),joint,stemWidth+1);
      const n=cfg.structure==='trifoliada'?3:Math.min(9,cfg.leafletCount);
      for(let i=0;i<n;i++){
        const norm=(i-(n-1)/2)/((n-1)/2);
        const fan=norm*(42+cfg.leafletSpread*44);
        const petLength=size*life.growth*(cfg.structure==='trifoliada'?.09:.12)*(1-.20*Math.abs(norm));
        const a=fan*Math.PI/180;
        const attach=[joint[0]+petLength*Math.sin(angle+a),joint[1]-petLength*Math.cos(angle+a)];
        twig(joint,attach);
        enqueue(attach,cfg.angle+fan,cfg.leafletScale*(1-.23*Math.abs(norm))*(cfg.structure==='trifoliada'?1.10:(n>7?.82:.98)),i+24);
      }
    }else if(cfg.structure==='bipinada'){
      if(cfg.stem)twig(locate(0,-.17),locate(0,0),stemWidth+1);
      const axis=[];for(let i=0;i<=18;i++)axis.push(locate(0,i/18));
      drawPixelLine(ctx,axis,stalkColor,stemWidth);
      const branches=Math.round(clamp(cfg.leafletCount/3,2,5));
      let serial=1;
      for(let b=0;b<branches;b++)for(let side of [-1,1]){
        const t=.22+b/Math.max(1,branches-1)*.58;
        const start=locate(0,t);
        const length=size*.22*cfg.leafletScale*(1-.20*t);
        const spr=.18+cfg.leafletSpread*.18;
        const dir=[Math.sin(angle+side*(.70+spr)), -Math.cos(angle+side*(.70+spr))];
        const end=[start[0]+dir[0]*length,start[1]+dir[1]*length];
        twig(start,end);
        const leaflets=3;
        for(let j=0;j<leaflets;j++){
          const f=(j+.5)/(leaflets+.45);
          const a=[start[0]+(end[0]-start[0])*f,start[1]+(end[1]-start[1])*f];
          const g=side*(30+cfg.leafletSpread*40)+(j%2?26:-22);
          enqueue(a,cfg.angle+g,cfg.leafletScale*.41*(1-.15*f),serial++,'lanceolada');
        }
      }
      enqueue(locate(0,.99),cfg.angle,cfg.leafletScale*.43,333,'lanceolada');
    }
    // Pair ordering is deterministic. Leaf sprites are never rescaled with interpolation.
    queue.forEach(o=>placeBlade(o.pos,o.deg,o.scale,o.serial,o.shape));
    return c;
  }
  function renderLeaf(options={}){
    const cfg=cleanConfig(resolved(options));
    if(lifeState(cfg).detached)return makeCanvas(cfg.size);
    return cfg.structure==='simples' ? renderSimpleLeaf(cfg) : renderCompoundLeaf(cfg);
  }
  // Metadata attachment is expressed in local sprite pixels.
  // For compounds, the stalk starts near the base. A caller may use it as pivot.
  function attachmentPoint(cfg){
    const ang=cfg.angle*Math.PI/180;
    const g=lifeState(cfg).growth;
    const distance=cfg.structure==='simples' ? -.50*cfg.size*.55*cfg.length*g*Math.cos((cfg.pitch||0)*Math.PI/180) :
      -.5*cfg.size*.50*cfg.length*g;
    const extra=cfg.structure==='simples'?0:-.15*cfg.size*.50*cfg.length*g;
    const axial=distance+extra;
    return {x:cfg.size/2+axial*Math.sin(ang),y:cfg.size/2-axial*Math.cos(ang)};
  }
  function renderAtlas(config={}){
    const opt=cleanConfig(resolved(config));
    const directions=Array.isArray(config.directions)?config.directions:[0,45,90,135,180,225,270,315];
    const shapes=Array.isArray(config.shapes)?config.shapes:SHAPES.map(s=>s.id);
    const structures=Array.isArray(config.structures)?config.structures:null;
    const speciesList=Array.isArray(config.speciesList)?config.speciesList:null;
    const rows=speciesList?speciesList.map(species=>({species})):
      structures?structures.map(structure=>({structure,shape:opt.shape})):
      shapes.map(shape=>({shape,structure:opt.structure}));
    const cell=opt.size,c=makeCanvas(directions.length*cell);
    c.height=rows.length*cell;
    const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;
    const frames=[];
    rows.forEach((row,y)=>directions.forEach((angle,x)=>{
      const i=y*directions.length+x;
      const seed=opt.seed+(config.randomizePerSprite?i*313:0);
      let p={...opt,...row,angle,seed};
      if(speciesList || config.randomizePerSprite){
        // Species and seed determine the genome. Never reuse a resolved genome for a different individual.
        p=cleanConfig(resolved({...config,...row,angle,seed,genome:config.randomizePerSprite?undefined:config.genome}));
      }
      const sprite=renderLeaf(p);
      ctx.drawImage(sprite,x*cell,y*cell);
      frames.push({name:`${p.species||'livre'}_${p.structure}_${p.shape}_${String(angle).padStart(3,'0')}`,
        species:p.species||null,genomeSeed:p.genome?.seed??null,shape:p.shape,structure:p.structure,angle,x:x*cell,y:y*cell,w:cell,h:cell,
        anchor:{x:.5,y:.5},attachment:attachmentPoint(p),seed,life:lifecycle()?.summarize(lifeState(p))});
    }));
    return {canvas:c,metadata:{generator:' Leaf Engine',version:'6.0.0',
      cell_size:cell,dimensions:{width:c.width,height:c.height},columns:directions.length,
      rows:rows.length,alpha:true,filter:'nearest-neighbor',genetics:speciesList?{catalog:speciesList}:geneticSummary(opt),frames}};
  }
  // Full animation loop. Frames are placed in a single horizontal spritesheet.
  function renderAnimationAtlas(config={}){
    const cfg=cleanConfig(resolved(config));
    const count=Math.round(clamp(Number(config.frames)||8,2,32));
    const fps=clamp(Number(config.fps)||12,1,60);
    const canvas=makeCanvas(cfg.size*count);canvas.height=cfg.size;
    const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
    const frames=[];
    for(let i=0;i<count;i++){
      const t=i/count,p={...cfg,time:t};
      ctx.drawImage(renderLeaf(p),i*cfg.size,0);
      frames.push({index:i,x:i*cfg.size,y:0,w:cfg.size,h:cfg.size,
        time:t,delay_ms:1000/fps,attachment:attachmentPoint(p),life:lifecycle()?.summarize(lifeState(p))});
    }
    return {canvas,metadata:{generator:' Leaf Engine',version:'6.0.0',
      kind:'leaf-wind-cycle',structure:cfg.structure,shape:cfg.shape,
      fps,frame_count:count,loop:true,duration_seconds:count/fps,
      animation_period:1,alpha:true,filter:'nearest-neighbor',
      wind_field:cfg.windField?.toJSON?.() || {seed:cfg.windSeed,strength:cfg.windStrength,direction:cfg.windDirection,
        gustiness:cfg.gustiness,turbulence:cfg.turbulence,spatialScale:cfg.spatialScale,flowSpeed:cfg.windSpeed},
      world_position:{x:cfg.worldX,y:cfg.worldY},
      life:lifecycle()?.summarize(lifeState(cfg)),genetics:geneticSummary(cfg),
      biomechanics:{stiffness:cfg.windStiffness,mass:cfg.windMass,drag:cfg.windDrag,
        shelter:cfg.windShelter,exposure:cfg.windExposure},
      configuration:{...cfg,windField:undefined,time:0},dimensions:{width:canvas.width,height:canvas.height},frames}};
  }
  function renderLifecycleAtlas(config={}){
    const cfg=cleanConfig(resolved(config));
    const ages=Array.isArray(config.ages)&&config.ages.length ?
      config.ages.map(v=>clamp(Number(v)||0,0,1)):
      [.02,.09,.18,.28,.39,.53,.67,.79,.88,.94,.98,1];
    const cols=Math.min(6,ages.length),rows=Math.ceil(ages.length/cols);
    const canvas=makeCanvas(cols*cfg.size);canvas.height=rows*cfg.size;
    const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
    const frames=ages.map((progress,i)=>{
      const p={...cfg,lifeProgress:progress},x=(i%cols)*cfg.size,y=Math.floor(i/cols)*cfg.size;
      ctx.drawImage(renderLeaf(p),x,y);
      return {index:i,progress,x,y,w:cfg.size,h:cfg.size,life:lifecycle()?.summarize(lifeState(p)),attachment:attachmentPoint(p)};
    });
    return {canvas,metadata:{generator:' Leaf Engine',version:'6.0.0',
      kind:'leaf-lifecycle-stages',alpha:true,filter:'nearest-neighbor',
      dimensions:{width:canvas.width,height:canvas.height},
      columns:cols,rows,frames,genetics:geneticSummary(cfg),configuration:{...cfg,windField:undefined}}};
  }
export const LeafEngine = Object.freeze({SHAPES,STRUCTURES,MARGINS,VENATION,PALETTES,DEFAULT,
    makeWindDynamics,renderLeaf,renderAtlas,renderAnimationAtlas,renderLifecycleAtlas,
    renderSpeciesAtlas:(options={})=>renderAtlas({...options,speciesList:options.speciesList||genetics()?.SPECIES.map(s=>s.id)||[]}),
    resolveSpecies:resolved,describeGenetics:geneticSummary,
    evaluateLife:(options={})=>lifecycle()?.evaluate({...DEFAULT,...resolved(options)})});
