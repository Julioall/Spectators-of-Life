import type { WindField, WindOptions } from '../../../../atmosphere/wind/index.js';
import type { LeafProductionRuntime, CanvasLike } from '../leaves/index.js';
export { WindField,createWindField } from '../../../../atmosphere/wind/index.js';
export { setCanvasFactory,createCanvas,ByteLRU,LeafProductionRuntime,LeafEngine,LeafGenetics,LeafLifecycle } from '../leaves/index.js';
export type Season='primavera'|'verao'|'outono'|'inverno';
export type Group='arbustos'|'herbaceas'|'rasteiras';
export interface PlantOptions {preset?:string;seed?:number;age?:number;density?:number;drought?:number;season?:Season;worldX?:number;worldY?:number;}
export interface Stem {x0:number;y0:number;x1:number;y1:number;w:number;shade:number}
export interface LeafAnchor {x:number;y:number;w:number;h:number;angle:number;variant:number;depth:number;flex:number;phase:number}
export interface FlowerAnchor {x:number;y:number;size:number;phase:number}
export interface PlantProfile {id:string;name:string;group:Group;mode:string;shape:string;structure:string;leafCount:number;leafW:number;leafH:number;spread:number;height:number;[key:string]:unknown}
export interface Plant {id:string;preset:string;group:Group;profile:PlantProfile;seed:number;season:Season;density:number;age:number;drought:number;worldX:number;worldY:number;stems:Stem[];leaves:LeafAnchor[];flowers:FlowerAnchor[];width:number;height:number;pivot:{x:number;y:number};metadata:Record<string,unknown>}
export interface Camera {x:number;y:number;width:number;height:number;zoom:number}
export interface DrawOptions {x?:number;y?:number;scale?:number;time?:number;wind?:number;guide?:boolean}
export interface TickOptions {timeBudgetMs?:number;maxJobs?:number}
export interface PlantInstance {id:string;preset:string;x:number;y:number;worldSize?:number;seed?:number;age?:number;density?:number;drought?:number}
export interface RenderResult {ready:number;pending:number;total:number}
export interface EngineOptions {canvasFactory?:(width:number,height:number)=>CanvasLike;wind?:WindOptions;windField?:WindField;memoryMB?:number;spriteSize?:number;variantCount?:number;windFrames?:number;maxPending?:number;lodFactors?:number[];lodThresholds?:number[]}
export declare const VERSION:string;
export declare const PRESETS: readonly PlantProfile[];
export declare function makePlant(options?:PlantOptions):Plant;
export declare class PlantRenderer {constructor(options?:{runtime?:LeafProductionRuntime;windField?:WindField});prepare(plant:Plant):void;draw(ctx:any,plant:Plant,options?:DrawOptions):RenderResult;renderToCanvas(plant:Plant,options?:{width?:number;height?:number;wind?:number;time?:number}):CanvasLike}
export declare class VegetationWorld {constructor(options:{renderer:PlantRenderer;cellSize?:number;spriteBudgetMB?:number;variantCount?:number;season?:Season});insert(instance:PlantInstance):PlantInstance;remove(id:string):boolean;clear():void;setSeason(season:Season):void;query(camera:Camera,overscan?:number):PlantInstance[];draw(ctx:any,camera:Camera,time?:number,options?:{windStrength?:number}):Record<string,number>;tick(options?:TickOptions):unknown;stats():Record<string,number>}
export declare class VegetationBridge {constructor(options?:Record<string,unknown>);instancesFromAnchors(plant:unknown,anchors:unknown[],options?:unknown):unknown[];serialize(plant:unknown,anchors:unknown[]):unknown}
export interface VegetationEngine {windField:WindField;runtime:LeafProductionRuntime;renderer:PlantRenderer;presets:readonly PlantProfile[];createPlant(options?:PlantOptions):Plant;prepare(plant:Plant):void;tick(options?:TickOptions):unknown;draw(ctx:any,plant:Plant,options?:DrawOptions):RenderResult;createWorld(options?:{cellSize?:number;spriteBudgetMB?:number;variantCount?:number;season?:Season}):VegetationWorld;flush(options?:{timeBudgetMs?:number;maxJobs?:number;maxIterations?:number}):{generated:number;iterations:number;pending:number;stats:unknown};renderPlant(plant:Plant,options?:{width?:number;height?:number;wind?:number;time?:number}):{canvas:CanvasLike;result:RenderResult};stats():Record<string,number>;clearCache():void;dispose():void}
export declare function createVegetationEngine(options?:EngineOptions):VegetationEngine;
export * from './grass/index.js';
