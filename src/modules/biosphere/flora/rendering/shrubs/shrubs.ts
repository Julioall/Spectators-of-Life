import { NATURAL_SCENARIO } from '../../../../../core/natural/parameters';
import type { NaturalWorldCellState } from '../../../../../core/natural/types';

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const SHRUB_PROFILE = NATURAL_SCENARIO.plants.find((candidate) => candidate.id === 'shrub');
const PRESETS_BY_HABITAT: Record<string, readonly string[]> = {
  woodland: ['arbusto_denso', 'arbusto_florido'], wetland: ['arbusto_florido', 'arbusto_aromatico'],
  meadow: ['arbusto_florido', 'arbusto_denso'], dryland: ['arbusto_aromatico', 'arbusto_denso'],
  desert: ['arbusto_aromatico', 'arbusto_denso'], upland: ['arbusto_aromatico', 'arbusto_florido'],
};

function visualHash(seed: number, x: number, y: number, salt: number): number {
  let value = (seed ^ Math.imul(x, 0x9e3779b1) ^ Math.imul(y, 0x85ebca6b) ^ Math.imul(salt, 0xc2b2ae35)) | 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return (value ^ (value >>> 16)) >>> 0;
}

export type ShrubStand = {
  preset: string;
  seed: number;
  age: number;
  density: number;
  drought: number;
  season: 'verao' | 'outono';
  growth: number;
  offsetX: number;
  offsetY: number;
  scale: number;
  alpha: number;
};

/** Converts a shrub cohort into one stable render instance; it never creates biological plants. */
export function shrubStandForCell(seed: number, cell: NaturalWorldCellState, cellSize: number): ShrubStand | null {
  const shrub = cell.plants.find((plant) => plant.speciesId === 'shrub');
  if (!shrub || shrub.biomassGPerM2 <= 2 || cell.water.surfaceMm >= 7) return null;
  const maturity = Math.max(1, SHRUB_PROFILE?.maturityDays ?? 900);
  const age = clamp(shrub.ageDays / maturity, 0.05, 1);
  const biomassRatio = clamp(shrub.biomassGPerM2 / Math.max(1, SHRUB_PROFILE?.maximumBiomassGPerM2 ?? 180), 0, 1);
  const growth = Math.min(age, Math.sqrt(biomassRatio));
  const density = clamp(0.45 + Math.sqrt(biomassRatio) * 0.8, 0.35, 1.35);
  const drought = clamp(1 - (shrub.limitingFactors?.water ?? shrub.stress ?? 0.75), 0, 1);
  const season = shrub.stage === 'senescent' ? 'outono' : 'verao';
  const options = PRESETS_BY_HABITAT[cell.terrain.habitat] ?? PRESETS_BY_HABITAT['meadow']!;
  const choice = visualHash(seed, cell.x, cell.y, 0) % options.length;
  const preset = options[choice]!;
  const variant = visualHash(seed ^ 0x5f356495, cell.x, cell.y, 1) % 4;
  const growthStages = [0.17, 0.42, 0.67, 0.93] as const;
  const growthBand = clamp(Math.floor(growth * growthStages.length), 0, growthStages.length - 1);
  const random = visualHash(seed, cell.x, cell.y, 2) / 0x1_0000_0000;
  const randomY = visualHash(seed, cell.x, cell.y, 3) / 0x1_0000_0000;
  return {
    preset,
    seed: (0x6a09e667 + variant * 0x9e3779b9 + preset.length * 0x85ebca6b + cell.index) >>> 0,
    age: growthStages[growthBand]!,
    density: Math.round(density * 5) / 5,
    drought: Math.round(drought * 4) / 4,
    season,
    growth,
    offsetX: (random - 0.5) * cellSize * 0.14,
    offsetY: (randomY - 0.5) * cellSize * 0.08,
    scale: (cellSize / 224) * (1.1 + growth * 0.42),
    alpha: clamp(0.42 + biomassRatio * 0.58, 0.42, 1),
  };
}
