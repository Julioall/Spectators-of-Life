export type GrassEnvironment = {moisture?:number;nutrients?:number;light?:number;shade?:number};
export type GrassCoverOptions = {width:number;height:number;tileSize?:number;seed?:number;biome?:string;initialise?:boolean;sample?:(wx:number,wy:number,tileX:number,tileY:number)=>GrassEnvironment};
export declare class GrassCoverField {constructor(options:GrassCoverOptions);width:number;height:number;tileSize:number;cols:number;rows:number;seed:number;biome:string;tick:number;epoch:number;cover:Uint8Array;type:Uint8Array;seedBank:Uint8Array;patch:Float32Array;
 get(x:number,y:number,options?:{density?:number}):{cover:number;type:number;state:number;x:number;y:number};mask(x:number,y:number,options?:{density?:number;threshold?:number}):number;
 advance(options?:{sample?:(wx:number,wy:number,x:number,y:number)=>GrassEnvironment;steps?:number}):this;
 applyCoverage(values:ArrayLike<number>):this;toJSON():Record<string,unknown>;static fromJSON(value:unknown):GrassCoverField;}
export declare function createGrassCover(options:GrassCoverOptions):GrassCoverField;
export declare function updateGrassCover(field:GrassCoverField,options?:{sample?:(wx:number,wy:number,x:number,y:number)=>GrassEnvironment;steps?:number}):GrassCoverField;
export declare function grassMaskAt(field:GrassCoverField,x:number,y:number,options?:{density?:number;threshold?:number}):number;
export declare function grassTileState(cover:number,type?:number,density?:number):number;
export declare function coverageAt(field:GrassCoverField,x:number,y:number,options?:{density?:number}):ReturnType<GrassCoverField['get']>;
export declare function serializeGrassCover(field:GrassCoverField):Record<string,unknown>;
export declare function restoreGrassCover(input:unknown):GrassCoverField;
export declare class GrassCoverRenderer {constructor(options?:{chunkTiles?:number;maxChunks?:number;windSampler?:(x:number,y:number,time:number)=>unknown});chunkTiles:number;maxChunks:number;clear():void;draw(ctx:any,field:GrassCoverField,options?:{cameraX?:number;cameraY?:number;zoom?:number;viewportWidth?:number;viewportHeight?:number;density?:number;time?:number;wind?:number;quality?:string}):{chunks:number;cacheEntries:number};}
export declare function biomeForHabitat(habitat:string):string;
export declare function naturalCellToGrassEnv(cell:unknown):GrassEnvironment;
export declare function projectCohortsToCover(options:{seed?:number;width:number;height:number;cells:unknown[];biome?:string;tileSize?:number;cellSize?:number;grassBiomassForFullCover?:number;blockedCells?:Set<number>}):GrassCoverField;
export declare function updateCohortsInCover(field:GrassCoverField,options:{seed?:number;width:number;height:number;cells:unknown[];tileSize?:number;cellSize?:number;grassBiomassForFullCover?:number;blockedCells?:Set<number>;dirtyCellIndices?:ReadonlySet<number>;onTileChanged?:(index:number,x:number,y:number)=>void}):GrassCoverField;
