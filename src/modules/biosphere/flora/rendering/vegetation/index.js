/** vegetation-engine — shrubs, herbaceous species, groundcover and 8-neighbour autotiles. */
export { createVegetationEngine } from './create-engine.js';
export { PRESETS, makePlant, PlantRenderer } from './internal/vegetation-engine.js';
export { VegetationWorld } from './internal/vegetation-world.js';
export { VegetationBridge } from './internal/vegetation-bridge.js';
export { GrassCoverField, createGrassCover, updateGrassCover, grassMaskAt,
  coverageAt, serializeGrassCover, restoreGrassCover, grassTileState } from './grass/grass-cover.js';
export { GrassCoverRenderer } from './grass/grass-renderer.js';
export { naturalCellToGrassEnv, projectCohortsToCover, biomeForHabitat } from './grass/game-bridge.js';
/** Old imports stay available for migration, but leaves-engine owns the implementation. */
export { createCanvas, setCanvasFactory, LeafEngine, LeafProductionRuntime, ByteLRU,
  LeafGenetics, LeafLifecycle } from '../leaves/index.js';
export { WindField, createWindField } from '../../../../atmosphere/wind/index.js';
export const VERSION = '0.2.0';
