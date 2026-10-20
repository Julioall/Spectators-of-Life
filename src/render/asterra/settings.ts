import defaults from './defaults.json';
import { biomeProfiles, type AsterraBiome, type AsterraGeology, type AsterraMaterial, type AsterraSettings, type AsterraTerrain } from './engine.js';

/** Defaults extracted from the supplied HTML; only world-linked controls are overridden. */
export function createAsterraSettings(
  biome: AsterraBiome = 'temperate',
  material: AsterraMaterial = 'cobre',
  geology: AsterraGeology | 'mixed' = 'mixed',
  seed = defaults.seed,
  terrain: AsterraTerrain = biomeProfiles[biome].soil,
  mossMultiplier = 1,
): AsterraSettings {
  return {
    ...defaults,
    biome,
    material,
    geology,
    terrain,
    moss: Math.min(1, defaults.moss * biomeProfiles[biome].moss * Math.max(0, mossMultiplier)),
    seed: seed >>> 0,
  } as AsterraSettings;
}
