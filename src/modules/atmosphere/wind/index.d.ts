export interface WindOptions { seed?: number; strength?: number; direction?: number; [key: string]: unknown; }
export declare class WindField { constructor(options?: WindOptions); sample(x:number,y:number,time:number):{vx:number;vy:number;strength:number;[key:string]:number}; }
export declare function createWindField(options?: WindOptions):WindField;
export declare const WIND_DEFAULT: WindOptions;
export declare const VERSION: string;
