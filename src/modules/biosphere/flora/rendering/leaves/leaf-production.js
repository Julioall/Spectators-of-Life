/* Generated from the G9  procedural engines; modular ESM edition. */
import { LeafEngine } from './leaf-engine.js';
import { createCanvas } from './canvas.js';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const clock=()=>typeof performance!=='undefined'?performance.now():Date.now();
function hash32(input){let s=2166136261;for(const c of String(input)){s=Math.imul(s^c.charCodeAt(0),16777619)}return s>>>0}
function stable(value,seen=new WeakSet()){
  if(value===null || typeof value!=='object'){
    if(typeof value==='number')return Number.isFinite(value)?JSON.stringify(value):'null';
    if(value===undefined)return 'null';
    if(typeof value==='function')throw Error('Não serialize funções; use parâmetros de configuração imutáveis.');
    return JSON.stringify(value);
  }
  if(seen.has(value))throw Error('Configuração com referência circular');
  seen.add(value);
  let out;
  if(Array.isArray(value))out='['+value.map(v=>stable(v,seen)).join(',')+']';
  else out='{'+Object.keys(value).filter(k=>value[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+stable(value[k],seen)).join(',')+'}';
  seen.delete(value);return out;
}
const toKey=(options,lod=0)=>'G8|'+lod+'|'+stable(options);
function makeCanvas(w,h){return createCanvas(w,h)}
class ByteLRU{
  constructor(budgetBytes){this.budget=Math.max(1024,Math.floor(budgetBytes));this.items=new Map();this.bytes=0;
    this.evictions=0;this.pinSet=new Set();this.onEvict=null}
  get(key,{touch=true}={}){const entry=this.items.get(key);if(entry&&touch){this.items.delete(key);this.items.set(key,entry)}return entry||null}
  peek(key){return this.items.get(key)||null}
  beginFrame(){this.pinSet.clear()}
  pin(key){if(this.items.has(key))this.pinSet.add(key)}
  evict(key){const entry=this.items.get(key);if(!entry)return false;this.items.delete(key);this.bytes-=entry.bytes;this.pinSet.delete(key);
    this.evictions++;this.onEvict?.(key,entry);return true}
  free(required=0){for(const k of this.items.keys()){
    if(this.bytes+required<=this.budget)break;
    if(!this.pinSet.has(k))this.evict(k);
  }return this.bytes+required<=this.budget}
  put(key,canvas,kind='sprite'){
    const bytes=canvas.width*canvas.height*4;
    if(bytes>this.budget)return false;
    if(this.items.has(key))this.evict(key);
    if(!this.free(bytes))return false;
    this.items.set(key,{canvas,bytes,kind});this.bytes+=bytes;return true
  }
  resize(budget){this.budget=Math.max(1024,Math.floor(budget));this.free(0)}
  clear(){for(const k of [...this.items.keys()])this.evict(k);this.pinSet.clear()}
}
class LeafProductionRuntime{
  constructor({engine=LeafEngine,windField=null,memoryMB=48,spriteSize=96,
      maxPending=3000,variantCount=4,windFrames=6,windBins=3,windSectors=8,
      lodFactors=[1,.62,.36],lodThresholds=[70,30,7],hysteresis=.12}={}){
    if(!engine||typeof engine.renderLeaf!=='function')throw Error('LeafEngine deve ser carregado antes de leaf-production.js');
    this.engine=engine;this.windField=windField;this.spriteSize=clamp(Math.round(spriteSize),16,256);
    this.variantCount=clamp(Math.round(variantCount),1,32);
    this.windFrames=clamp(Math.round(windFrames),1,32);this.windBins=clamp(Math.round(windBins),1,8);
    this.windSectors=clamp(Math.round(windSectors),1,32);
    this.lodFactors=lodFactors;this.lodThresholds=lodThresholds;this.hysteresis=hysteresis;
    this.cache=new ByteLRU(memoryMB*1024*1024);this.maxPending=maxPending;
    this.queue=[];this.pending=new Set();this.atlasIndex=new Map();
    this.cache.onEvict=(key,entry)=>{if(entry.kind==='atlas'){
      for(const [spriteKey,ref] of this.atlasIndex)if(ref.page===key)this.atlasIndex.delete(spriteKey);
    }};
    this.metrics={requests:0,hits:0,misses:0,generated:0,failed:0,renderMs:0,
      batches:0,lastBatchMs:0,droppedRequests:0,atlasPages:0};
  }
  static key(options,lod=0){return toKey(options,lod)}
  selectLOD(screenPixels,previous=null){
    const [high,mid,visible]=this.lodThresholds;
    let result=screenPixels<visible?3:screenPixels<mid?2:screenPixels<high?1:0;
    if(previous===null||previous===undefined)return result;
    // Margens dos limiares: reduz alternância entre LODs durante zoom/câmera.
    const thresholds=[high,mid,visible];
    if(Math.abs(previous-result)===1){
      const boundary=thresholds[Math.min(previous,result)];
      if(Math.abs(screenPixels-boundary)<=boundary*this.hysteresis)return previous;
    }
    return result;
  }
  requestSprite(options,{lod=0,priority=0}={}){
    const o={...options,size:Math.max(16,Math.round((options.size||this.spriteSize)*(this.lodFactors[lod]||1)))};
    // Há uma única renderização pendente por chave (inclui genoma e todos os parâmetros visuais).
    // Configurações com windField devem passar apenas um objeto JSON serializável; veja docs.
    const key=toKey(o,lod);this.metrics.requests++;
    const item=this.cache.get(key);
    if(item){this.metrics.hits++;return {status:'ready',key,canvas:item.canvas,lod}}
    const atlas=this.atlasIndex.get(key);
    if(atlas){const page=this.cache.get(atlas.page);
      if(page){this.metrics.hits++;return {status:'atlas',key,canvas:page.canvas,rect:atlas.rect,lod}}
      this.atlasIndex.delete(key);
    }
    this.metrics.misses++;
    if(!this.pending.has(key)){
      if(this.queue.length>=this.maxPending){this.metrics.droppedRequests++;return {status:'deferred',key,lod}}
      this.pending.add(key);this.queue.push({key,options:o,lod,priority});
    }
    return {status:'pending',key,lod};
  }
  tick({timeBudgetMs=5,maxJobs=8}={}){
    const start=clock();let made=0;
    // Pré-classifica prioridades uma única vez por chamada, não a cada sprite.
    this.queue.sort((a,b)=>b.priority-a.priority);
    while(this.queue.length&&made<maxJobs&&(clock()-start<timeBudgetMs||made===0)){
      const task=this.queue.shift();this.pending.delete(task.key);
      if(this.cache.peek(task.key))continue;
      try{
        const begin=clock(),canvas=this.engine.renderLeaf(task.options);
        this.metrics.renderMs+=clock()-begin;
        if(!this.cache.put(task.key,canvas))this.metrics.droppedRequests++;
        this.metrics.generated++;
      }catch(e){this.metrics.failed++;this.lastError=e;}
      made++;
    }
    this.metrics.batches++;this.metrics.lastBatchMs=clock()-start;
    return {generated:made,pending:this.queue.length,milliseconds:this.metrics.lastBatchMs};
  }
  // Interface sem filas: conveniente para pré-gerar recursos durante carregamentos.
  prewarm(optionsList,{lod=0,timeBudgetMs=8,maxJobs=500}={}){
    for(const config of optionsList)this.requestSprite(config,{lod});
    return this.tick({timeBudgetMs,maxJobs});
  }
  beginFrame(){this.cache.beginFrame()}
  instanceOptions(instance,lod,time){
    const id=instance.id??instance.seed??0;
    const variants=instance.variants??this.variantCount;
    const variant=instance.variant??(hash32(id)%Math.max(1,variants));
    const variantSeed=instance.variantSeed??hash32(`${instance.species||instance.shape||'leaf'}:${variant}`);
    let intensity=0,direction=90,frame=0;
    if(this.windField && lod<2){
      const w=this.windField.sample(instance.x,instance.y,time);
      intensity=this.windBins===1?0:Math.round(clamp(w.strength,0,1)*(this.windBins-1))/(this.windBins-1);
      const step=360/this.windSectors;direction=(Math.round(w.direction/step)*step)%360;
      frame=intensity===0?0:Math.floor((((time%1)+1)%1)*this.windFrames)%this.windFrames;
    }
    const opts={...instance.config};
    if(instance.species)opts.species=instance.species;
    if(instance.shape)opts.shape=instance.shape;
    if(instance.structure)opts.structure=instance.structure;
    if(instance.genome)opts.genome=instance.genome; // atenção: genomas únicos aumentam cardinalidade
    opts.seed=variantSeed;opts.size=this.spriteSize;
    // A posição NÃO entra na chave: campo espacial externo é quantizado em classes de vento.
    opts.worldX=0;opts.worldY=0;
    opts.time=intensity===0?0:frame/this.windFrames;
    opts.windStrength=intensity;opts.windDirection=direction;
    return opts;
  }
  drawInstances(ctx,instances,camera,time,{background=null,sort=false}={}){
    const start=clock();this.beginFrame();ctx.imageSmoothingEnabled=false;
    if(background){ctx.fillStyle=background;ctx.fillRect(0,0,camera.width,camera.height)}
    let visible=0,culled=0,ready=0,queued=0,atlasDraws=0;
    const ordered=sort?[...instances].sort((a,b)=>a.y-b.y):instances;
    const zoom=camera.zoom??1;
    for(const leaf of ordered){
      const size=(leaf.worldSize??leaf.size??72)*zoom;
      const px=(leaf.x-camera.x)*zoom+camera.width/2;
      const py=(leaf.y-camera.y)*zoom+camera.height/2;
      const half=size/2;
      if(px+half<0||py+half<0||px-half>camera.width||py-half>camera.height){culled++;continue}
      const old=leaf._g8LOD??null;
      const lod=this.selectLOD(size,old);leaf._g8LOD=lod;
      if(lod===3){culled++;continue}
      visible++;
      const opts=this.instanceOptions(leaf,lod,time);
      const res=this.requestSprite(opts,{lod,priority:3-lod});
      if(res.status==='ready'){
        this.cache.pin(res.key);
        ctx.drawImage(res.canvas,Math.round(px-half),Math.round(py-half),Math.ceil(size),Math.ceil(size));ready++;
      }else if(res.status==='atlas'){
        this.cache.pin(this.atlasIndex.get(res.key).page);
        const r=res.rect;ctx.drawImage(res.canvas,r.x,r.y,r.w,r.h,Math.round(px-half),Math.round(py-half),Math.ceil(size),Math.ceil(size));
        ready++;atlasDraws++;
      }else queued++;
    }
    return {total:instances.length,visible,culled,ready,pending:queued,atlasDraws,drawMs:clock()-start};
  }
  /* Agrupa sprites PRONTOS em páginas sem escala, borda de 1px transparente.
   * Registra páginas no LRU apenas se persist=true. Pode liberar originais sem perder frames.
   * As páginas devolvidas por retorno são propriedade do chamador e NÃO contam no orçamento.
   */
  packAtlas(spriteKeys,{maxSize=1024,padding=1,persist=false,releaseSources=false}={}){
    maxSize=Math.max(32,Math.floor(maxSize));padding=Math.max(0,Math.floor(padding));
    const src=[];
    for(const key of spriteKeys){const entry=this.cache.peek(key);
      if(!entry||entry.kind!=='sprite')continue;
      if(entry.canvas.width+padding*2>maxSize||entry.canvas.height+padding*2>maxSize)throw Error('Sprite maior que página de atlas');
      src.push({key,canvas:entry.canvas});
    }
    const layouts=[];let current=[],x=0,y=0,rowH=0,pageW=0;
    const finish=()=>{if(current.length){layouts.push({items:current,width:Math.max(1,pageW),height:Math.max(1,y+rowH)});current=[];x=0;y=0;rowH=0;pageW=0;}};
    for(const item of src){const w=item.canvas.width+padding*2,h=item.canvas.height+padding*2;
      if(x+w>maxSize){y+=rowH;x=0;rowH=0;}
      if(y+h>maxSize)finish();
      current.push({...item,x:x+padding,y:y+padding,w:item.canvas.width,h:item.canvas.height});
      x+=w;rowH=Math.max(rowH,h);pageW=Math.max(pageW,x);
    }
    finish();const pages=[],frames=[];
    for(let i=0;i<layouts.length;i++){
      const lay=layouts[i],canvas=makeCanvas(lay.width,lay.height),c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
      const pageKey='ATLAS|'+hash32(lay.items.map(p=>p.key).join('|')+'|'+i+'|'+padding);
      for(const item of lay.items){c.drawImage(item.canvas,item.x,item.y);
        frames.push({key:item.key,page:i,x:item.x,y:item.y,w:item.w,h:item.h});}
      pages.push({key:pageKey,canvas,width:canvas.width,height:canvas.height});
    }
    if(persist){
      for(const page of pages){
        if(!this.cache.put(page.key,page.canvas,'atlas'))continue;
        for(const f of frames)if(pages[f.page].key===page.key)
          this.atlasIndex.set(f.key,{page:page.key,rect:{x:f.x,y:f.y,w:f.w,h:f.h}});
      }
      if(releaseSources){for(const frame of frames){if(this.atlasIndex.has(frame.key))this.cache.evict(frame.key)}}
      this.metrics.atlasPages+=pages.length;
    }
    return {pages,metadata:{schema:'leaf-atlas/1',filter:'nearest',padding,pages:pages.map((p,i)=>({index:i,key:p.key,width:p.width,height:p.height})),frames}};
  }
  stats(){const requests=this.metrics.requests;return {...this.metrics,
    hitRate:requests?this.metrics.hits/requests:0,
    memoryBytes:this.cache.bytes,budgetBytes:this.cache.budget,entries:this.cache.items.size,
    evictions:this.cache.evictions,queueLength:this.queue.length,atlasReferences:this.atlasIndex.size};}
  cancelPending(){this.queue.length=0;this.pending.clear()}
  setMemoryMB(value){this.cache.resize(Math.round(Math.max(.1,value)*1024*1024))}
  clear(){this.cache.clear();this.queue.length=0;this.pending.clear();this.atlasIndex.clear()}
}
export { LeafProductionRuntime, ByteLRU, stable, hash32 };
