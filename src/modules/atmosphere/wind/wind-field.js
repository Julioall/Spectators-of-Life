/* Generated from the G9  procedural engines; modular ESM edition. */

 const TAU=Math.PI*2;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function hash(n){let x=n|0;x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);return ((x^(x>>>16))>>>0)/4294967296;}
 function noise(ix,iy,seed){return hash(Math.imul(ix|0,374761393)^Math.imul(iy|0,668265263)^Math.imul(seed|0,2246822519));}
 function smooth(v){return v*v*(3-2*v);}
 function valueNoise(x,y,s){
  const ix=Math.floor(x),iy=Math.floor(y),u=smooth(x-ix),v=smooth(y-iy);
  const a=noise(ix,iy,s),b=noise(ix+1,iy,s),c=noise(ix,iy+1,s),d=noise(ix+1,iy+1,s);
  return (a+(b-a)*u)+((c+(d-c)*u)-(a+(b-a)*u))*v;
 }
 const DEFAULT=Object.freeze({seed:47261,strength:.52,direction:90,gustiness:.60,
  turbulence:.38,spatialScale:190,flowSpeed:1,periodSeconds:4});
 class WindField{
  constructor(config={}){
   this.config=Object.freeze({
    seed:(Number(config.seed??DEFAULT.seed)||0)|0,
    strength:clamp(Number(config.strength??DEFAULT.strength)||0,0,1),
    direction:((Number(config.direction??DEFAULT.direction)||0)%360+360)%360,
    gustiness:clamp(Number(config.gustiness??DEFAULT.gustiness)||0,0,1),
    turbulence:clamp(Number(config.turbulence??DEFAULT.turbulence)||0,0,1),
    spatialScale:clamp(Number(config.spatialScale??DEFAULT.spatialScale)||190,24,2000),
    flowSpeed:clamp(Number(config.flowSpeed??DEFAULT.flowSpeed)||0,0,3),
    periodSeconds:clamp(Number(config.periodSeconds??DEFAULT.periodSeconds)||4,.2,60)
   });
  }
  sample(worldX=0,worldY=0,time=0){
   const o=this.config;
   const x=(Number(worldX)||0)/o.spatialScale,y=(Number(worldY)||0)/o.spatialScale;
   const t=((Number(time)||0)%1+1)%1;
   if(o.strength===0)return {vx:0,vy:0,strength:0,pressure:0,direction:o.direction,gust:0,turbulence:0};
   const phase=t*TAU,angle=o.direction*Math.PI/180;
   const dx=Math.sin(angle),dy=-Math.cos(angle); // Angulo de movimento: 0 para cima, 90 para direita.
   const forward=x*dx+y*dy,across=x*dy-y*dx;
   const s=o.seed;
   const h1=hash(s+107)*TAU,h2=hash(s+207)*TAU,h3=hash(s+307)*TAU;
   // Harmônicos de frequência temporal inteira: fecho perfeito no ciclo (t=1 -> t=0).
   const advect=Math.max(0,Math.round(o.flowSpeed));
   const travelling=Math.sin(forward*2.9+across*.35-phase*advect+h1);
   // A velocidade de advecção quantizada em número de voltas por ciclo garante a periodicidade.
   const gustWave=.62*Math.sin(forward*2.25-across*.5-phase*advect+h1)
                  +.27*Math.sin(forward*5.15+across*1.4-phase*(advect+1)+h2)
                  +.11*Math.sin(forward*.84-across*2.1-phase*2+h3);
   // Deslocar coordenadas de ruído num círculo também garante continuidade no loop.
   const swirlRadius=.45+.14*advect;
   const cloud=valueNoise(x*.78+Math.cos(phase)*swirlRadius+13,
                y*.78+Math.sin(phase)*swirlRadius-7,s+911);
   const localGust=clamp((gustWave*.5+.5)*.73+cloud*.27,0,1);
   const gustMultiplier=1+o.gustiness*(localGust*1.65-.42);
   const eddy1=Math.sin(across*3.25+forward*.46+phase*2+h2);
   const eddy2=Math.sin(x*5.3-y*2.8-phase*3+h3);
   const turbulence=clamp(.57*eddy1+.43*eddy2,-1,1)*o.turbulence;
   const direction=angle+turbulence*.44;
   const speed=Math.max(0,o.strength*gustMultiplier*(.95+.12*travelling));
   const vx=Math.sin(direction)*speed,vy=-Math.cos(direction)*speed;
   return {vx,vy,strength:Math.hypot(vx,vy),pressure:speed*speed,
    direction:((direction*180/Math.PI)%360+360)%360,gust:localGust,turbulence};
  }
  sampleGrid({x=0,y=0,columns=8,rows=5,step=64,time=0}={}){
   const out=[];
   for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){
    const px=x+i*step,py=y+j*step;
    out.push({x:px,y:py,...this.sample(px,py,time)});
   }
   return out;
  }
  toJSON(){return {...this.config};}
 }
 const createWindField=options=>new WindField(options);
export { WindField, createWindField, DEFAULT as WIND_DEFAULT };
