export type AsterraFamily = 'round' | 'block' | 'wedge' | 'plate' | 'column' | 'shard' | 'cluster' | 'vein';
export type AsterraBiome = 'temperate' | 'desert' | 'alpine' | 'volcanic' | 'coastal';
export type AsterraGeology = 'granite' | 'sandstone' | 'basalt' | 'slate' | 'limestone' | 'tuff';
export type AsterraRarity = 'normal' | 'rare' | 'epic';
export type AsterraTier = 'small' | 'normal' | 'large' | 'macro';
export type AsterraMaterial = 'pedra' | 'cobre' | 'ferro' | 'prata' | 'ouro' | 'quartzo'
  | 'quartzo_leitoso' | 'quartzo_fume' | 'quartzo_roseo' | 'quartzo_hialino'
  | 'carvao' | 'enxofre' | 'gemas' | 'rubi' | 'safira' | 'esmeralda' | 'ametista';
export type AsterraTerrain = 'grass' | 'dry' | 'mountain' | 'volcanic' | 'coast';
export interface AsterraSettings {
  biome: AsterraBiome;
  material: AsterraMaterial | 'mixed';
  rarity: AsterraRarity | 'mixed';
  forma: AsterraFamily | 'mixed';
  geology: AsterraGeology | 'mixed';
  terrain: AsterraTerrain;
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
export interface AsterraSizeProfile {
  tier: AsterraTier;
  tilesW: number;
  tilesH: number;
  scale: number;
  satellites: number;
  macro: boolean;
  large: boolean;
}
export interface AsterraDeposit {
  id: number;
  x: number;
  y: number;
  seed: number;
  grade: number;
  material: AsterraMaterial;
  geology: AsterraGeology;
  biome: AsterraBiome;
  family: AsterraFamily;
  forma: AsterraFamily;
  variant: number;
  rarity: AsterraRarity;
  tier: AsterraTier;
  tilesW: number;
  tilesH: number;
  satellites: number;
  large: boolean;
  macro: boolean;
}
export interface AsterraRect { x: number; y: number; w: number; h: number }
export const TILE: 16;
export const biomeProfiles: Record<AsterraBiome, {
  soil: AsterraTerrain;
  families: readonly (readonly [AsterraFamily, number])[];
  geologies: readonly (readonly [AsterraGeology, number])[];
  moss: number;
}>;
export const rarityProfiles: Record<AsterraRarity, { grade: readonly [number, number] }>;
export function rng(seed: number): () => number;
export function hash(a: number, b: number, c?: number): number;
export function weightedChoice<T extends string>(random: () => number, choices: readonly (readonly [T, number])[]): T;
export function chooseRarity(random: () => number, setting?: AsterraSettings['rarity']): AsterraRarity;
export function sizeProfile(family: AsterraFamily, grade: number, variant: number, random: () => number, macroRate?: number): AsterraSizeProfile;
export function footprintAt(x: number, y: number, deposit: Pick<AsterraDeposit, 'family' | 'grade' | 'rarity' | 'tier' | 'tilesW' | 'tilesH'>): AsterraRect;
export function depositData(settings: AsterraSettings): {
  deposits: AsterraDeposit[];
  grid: { tileSize: number; width: number; height: number; owner: number[] };
  attempts: number;
  target: number;
};
export function outcropSize(deposit: AsterraDeposit): { w: number; h: number };
export function rockSprite(deposit: AsterraDeposit, settings: AsterraSettings): HTMLCanvasElement;
export function drawOutcrop(context: CanvasRenderingContext2D, deposit: AsterraDeposit, settings: AsterraSettings): void;
