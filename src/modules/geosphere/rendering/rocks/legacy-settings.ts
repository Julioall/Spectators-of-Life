import defaults from './legacy-defaults.json';
import { biomeProfiles, type RockBiome, type RockGeology, type RockMaterial, type RockSettings, type RockTerrain } from './legacy-engine.js';

/** Defaults extracted from the supplied HTML; only world-linked controls are overridden. */
export function createRockSettings(
  biome: RockBiome = 'temperate',
  material: RockMaterial = 'cobre',
  geology: RockGeology | 'mixed' = 'mixed',
  seed = defaults.seed,
  terrain: RockTerrain = biomeProfiles[biome].soil,
  mossMultiplier = 1,
): RockSettings {
  return {
    ...defaults,
    biome,
    material,
    geology,
    terrain,
    moss: Math.min(1, defaults.moss * biomeProfiles[biome].moss * Math.max(0, mossMultiplier)),
    seed: seed >>> 0,
  } as RockSettings;
}
