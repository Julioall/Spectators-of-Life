export interface TreeOptions { species?: string; seed?: number; [key: string]: unknown; }
export interface TreeData { species: string; seed: number; branches: unknown[]; trunk: unknown[]; morphology: Record<string, unknown>; [key: string]: unknown; }
export interface TreeRenderOptions { tree?: TreeData; species?: string; seed?: number; growth?: number; quality?: string; renderSize?: number; referencePalette?: boolean; paletteStrength?: number; crownLeafModule?: boolean; time?: number; windStrength?: number; [key: string]: unknown; }
export interface TreeCanvas { width: number; height: number; getContext(type: string, options?: unknown): any; }
export interface TreeEngine {
  readonly version: string;
  readonly catalog: readonly string[];
  create(options?: TreeOptions): TreeData;
  render(canvas: TreeCanvas, options?: TreeRenderOptions): Record<string, unknown>;
  exportState(options?: TreeRenderOptions): Record<string, unknown>;
  buildCamera(angle?: number): unknown;
  hash(...args: unknown[]): number;
  [key: string]: unknown;
}
export declare function createTreeEngine(options?: { canvasFactory?: (width: number, height: number) => TreeCanvas }): TreeEngine;
