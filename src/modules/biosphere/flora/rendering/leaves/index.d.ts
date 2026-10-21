import type { WindOptions } from '../../../../atmosphere/wind/index.js';
export { WindField, createWindField } from '../../../../atmosphere/wind/index.js';
export type CanvasLike = { width: number; height: number; getContext(type: string): any };
export type LeafConfig = Record<string, unknown>;
export declare function setCanvasFactory(factory: ((width: number, height: number) => CanvasLike) | null): void;
export declare function createCanvas(width: number, height: number): CanvasLike;
export declare class ByteLRU { constructor(budgetBytes: number); budget: number; bytes: number; get(key: string, options?: { touch?: boolean }): unknown; put(key: string, canvas: CanvasLike, kind?: string): boolean; peek(key: string): unknown; beginFrame(): void; pin(key: string): void; free(required?: number): boolean; clear(): void; }
export declare class LeafProductionRuntime { constructor(options?: Record<string, unknown>); queue: unknown[]; tick(options?: { timeBudgetMs?: number; maxJobs?: number }): { generated: number; pending: number; milliseconds: number }; requestSprite(options: LeafConfig, config?: { lod?: number; priority?: number }): { status: string; key: string; canvas?: CanvasLike }; clear(): void; stats(): Record<string, number>; }
export declare const LeafEngine: { renderLeaf(options?: LeafConfig): CanvasLike; renderAtlas(options?: LeafConfig): { canvas: CanvasLike; metadata: unknown }; renderAnimationAtlas(options?: LeafConfig): { canvas: CanvasLike; metadata: unknown }; renderLifecycleAtlas(options?: LeafConfig): { canvas: CanvasLike; metadata: unknown }; [key: string]: unknown };
export declare const LeafGenetics: { createGenome(species: string, seed?: number, diversity?: number): unknown; breed(mother: unknown, father: unknown, seed?: number): unknown; phenotype(genome: unknown, environment?: unknown): any; getSpecies(id: string): unknown; [key: string]: unknown };
export declare const LeafLifecycle: { evaluate(config: Record<string, unknown>): unknown; [key: string]: unknown };
export declare function createWindField(options?: WindOptions): InstanceType<typeof import('../../../../atmosphere/wind/index.js').WindField>;
