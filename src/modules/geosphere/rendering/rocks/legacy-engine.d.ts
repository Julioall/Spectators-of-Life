export type RockFamily = 'round' | 'block' | 'wedge' | 'plate' | 'column' | 'shard' | 'cluster' | 'vein';
export type RockBiome = 'temperate' | 'desert' | 'alpine' | 'volcanic' | 'coastal';
export type RockGeology = 'granite' | 'sandstone' | 'basalt' | 'slate' | 'limestone' | 'tuff';
export type RockRarity = 'normal' | 'rare' | 'epic';
export type RockTier = 'small' | 'normal' | 'large' | 'macro';
export type RockMaterial = 'pedra' | 'cobre' | 'ferro' | 'prata' | 'ouro' | 'quartzo'
  | 'quartzo_leitoso' | 'quartzo_fume' | 'quartzo_roseo' | 'quartzo_hialino'
  | 'carvao' | 'enxofre' | 'gemas' | 'rubi' | 'safira' | 'esmeralda' | 'ametista';
export type RockTerrain = 'grass' | 'dry' | 'mountain' | 'volcanic' | 'coast';
export interface RockSettings {
  biome: RockBiome;
  material: RockMaterial | 'mixed';
  rarity: RockRarity | 'mixed';
  forma: RockFamily | 'mixed';
  geology: RockGeology | 'mixed';
  terrain: RockTerrain;
  paletteMode: 'reference' | 'v14';
  pixelStyle: 'realistic' | 'pixel' | 'detailed' | 'retro' | 'original';
  pixelSize: 'fine' | 'normal' | 'coarse';
  burial: number;
  density: number;
  fractures: number;
  moss: number;
  mineralization: number;
  macroRate: number;
  surfaceDetail: number;
  erosion: number;
  weathering: number;
  geologicalAge: number;
  coalPurity: number;
  coalDepth: number;
  autoTile: boolean;
  showGrid: boolean;
  seed: number;
}
export interface RockSizeProfile {
  tier: RockTier;
  tilesW: number;
  tilesH: number;
  scale: number;
  satellites: number;
  macro: boolean;
  large: boolean;
}
export interface RockDeposit {
  id: number;
  x: number;
  y: number;
  seed: number;
  grade: number;
  material: RockMaterial;
  geology: RockGeology;
  biome: RockBiome;
  family: RockFamily;
  forma: RockFamily;
  variant: number;
  rarity: RockRarity;
  tier: RockTier;
  tilesW: number;
  tilesH: number;
  satellites: number;
  large: boolean;
  macro: boolean;
}
export interface RockRect { x: number; y: number; w: number; h: number }
export const TILE: 16;
export const biomeProfiles: Record<RockBiome, {
  soil: RockTerrain;
  families: readonly (readonly [RockFamily, number])[];
  geologies: readonly (readonly [RockGeology, number])[];
  moss: number;
}>;
export const rarityProfiles: Record<RockRarity, { grade: readonly [number, number] }>;
export function rng(seed: number): () => number;
export function hash(a: number, b: number, c?: number): number;
export function weightedChoice<T extends string>(random: () => number, choices: readonly (readonly [T, number])[]): T;
export function chooseRarity(random: () => number, setting?: RockSettings['rarity']): RockRarity;
export function sizeProfile(family: RockFamily, grade: number, variant: number, random: () => number, macroRate?: number): RockSizeProfile;
export function footprintAt(x: number, y: number, deposit: Pick<RockDeposit, 'family' | 'grade' | 'rarity' | 'tier' | 'tilesW' | 'tilesH'>): RockRect;
export function depositData(settings: RockSettings): {
  deposits: RockDeposit[];
  grid: { tileSize: number; width: number; height: number; owner: number[] };
  attempts: number;
  target: number;
};
export function outcropSize(deposit: RockDeposit): { w: number; h: number };
export function rockSprite(deposit: RockDeposit, settings: RockSettings): HTMLCanvasElement;
export function drawOutcrop(context: CanvasRenderingContext2D, deposit: RockDeposit, settings: RockSettings): void;
