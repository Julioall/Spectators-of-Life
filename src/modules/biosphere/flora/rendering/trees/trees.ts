import Phaser from 'phaser';
import { NATURAL_SCENARIO } from '../../../../../core/natural/parameters';
import type { NaturalWorldCellState, NaturalWorldEntity, PlantCohortState } from '../../../../../core/natural/types';
import type { TreeSpeciesId } from '../../domain/plant-state';
import { FLORA_TREE_SPECIES } from '../../domain/species';
import { worldObjectDepth } from '../../../../../render/z-order';
import { createCanvas } from '../leaves/index.js';
import { createTreeEngine, type TreeEngine } from './engine/engine.js';
import {
  TREE_FRAME_COUNT, TREE_FRAME_SIZE, TREE_GROWTH_STOPS, TREE_SENESCENT_FRAME,
  TREE_VARIANT_COUNT, treeEngineSpecies, treeFrameIndex, treeGrowthVisual, treeVariant,
} from './tree-art';
import type { WindField } from '../../../../atmosphere/wind/index.js';

/** One pair per visible tree: fixed wood under a wind-driven canopy projection. */
export type TreeSpritePair = {
  wood: Phaser.GameObjects.Image | null;
  canopy: Phaser.GameObjects.Image | null;
  species: TreeSpeciesId;
  seed: number;
  x: number;
  y: number;
  crownY: number;
  scale: number;
  growth: number;
};
export type TreeSprites = Record<TreeSpeciesId, TreeSpritePair>;

const TREE_WOOD_ATLAS_KEY = 'procedural-tree-wood-atlas';
const TREE_CANOPY_ATLAS_KEY = 'procedural-tree-canopy-atlas';
const TREE_ATLAS_COLUMNS = TREE_FRAME_COUNT * TREE_VARIANT_COUNT;
const TREE_MATURE_WIDTH_CELLS = 4.4;
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const TREE_PROFILE_BY_SPECIES = new Map(NATURAL_SCENARIO.plants
  .filter((profile) => FLORA_TREE_SPECIES.includes(profile.id as TreeSpeciesId))
  .map((profile) => [profile.id as TreeSpeciesId, profile]));
type TreeCanvas = ReturnType<typeof createCanvas>;
type AtlasState = {
  wood: Phaser.Textures.CanvasTexture;
  canopy: Phaser.Textures.CanvasTexture;
  source: TreeCanvas;
  rendered: Set<number>;
};
let sharedAtlas: AtlasState | null = null;
let treeEngine: TreeEngine | null = null;
const renderedTreeState = new WeakMap<Phaser.GameObjects.Image, string>();
const windTargets = new Set<TreeSpritePair>();
type TreeFrameRequest = { species: TreeSpeciesId; growthFrame: number; variant: number };
const pendingTreeFrames = new Map<number, TreeFrameRequest>();

function stress(plant: PlantCohortState): number {
  if (plant.stress !== undefined) return plant.stress;
  const factors = plant.limitingFactors;
  return factors === undefined ? 1 : Math.min(factors.water, factors.nitrogen, factors.temperature, factors.light);
}

function frameSeed(species: TreeSpeciesId, variant: number): number {
  return (0x51f15e5d + FLORA_TREE_SPECIES.indexOf(species) * 0x1f123bb5 + variant * 0x5f356495) >>> 0;
}

function requestTreeFrame(species: TreeSpeciesId, growthFrame: number, variant: number): number {
  const atlas = sharedAtlas;
  if (atlas === null) return 0;
  const frame = treeFrameIndex(species, growthFrame, variant);
  if (!atlas.rendered.has(frame) && !pendingTreeFrames.has(frame)) pendingTreeFrames.set(frame, { species, growthFrame, variant });
  return frame;
}

function splitTreeFrame(source: TreeCanvas): { wood: TreeCanvas; canopy: TreeCanvas } {
  const sourceContext = source.getContext('2d');
  const image = sourceContext.getImageData(0, 0, TREE_FRAME_SIZE, TREE_FRAME_SIZE);
  const wood = createCanvas(TREE_FRAME_SIZE, TREE_FRAME_SIZE);
  const canopy = createCanvas(TREE_FRAME_SIZE, TREE_FRAME_SIZE);
  const woodContext = wood.getContext('2d');
  const canopyContext = canopy.getContext('2d');
  const woodPixels = woodContext.createImageData(TREE_FRAME_SIZE, TREE_FRAME_SIZE);
  const canopyPixels = canopyContext.createImageData(TREE_FRAME_SIZE, TREE_FRAME_SIZE);
  const input = image.data;
  for (let y = 0; y < TREE_FRAME_SIZE; y += 1) for (let x = 0; x < TREE_FRAME_SIZE; x += 1) {
    const index = (y * TREE_FRAME_SIZE + x) * 4;
    const alpha = input[index + 3]!;
    if (alpha < 4) continue;
    const red = input[index]!;
    const green = input[index + 1]!;
    const blue = input[index + 2]!;
    const greenFoliage = green > red * 0.86 && green > blue * 1.08 && red + green + blue > 67;
    const autumnFoliage = red > green * 0.92 && green > blue * 1.3 && y < 181 && Math.abs(x - 128) > 18;
    const isCanopy = y < 220 && (greenFoliage || autumnFoliage) && !(y > 196 && Math.abs(x - 128) < 16);
    const output = isCanopy ? canopyPixels.data : woodPixels.data;
    output[index] = red;
    output[index + 1] = green;
    output[index + 2] = blue;
    output[index + 3] = alpha;
  }
  woodContext.putImageData(woodPixels, 0, 0);
  canopyContext.putImageData(canopyPixels, 0, 0);
  return { wood, canopy };
}

function renderTreeFrame(request: TreeFrameRequest): number {
  const atlas = sharedAtlas;
  if (atlas === null) return 0;
  const { species, growthFrame, variant } = request;
  const frame = treeFrameIndex(species, growthFrame, variant);
  if (atlas.rendered.has(frame)) return frame;
  treeEngine ??= createTreeEngine();
  const tree = treeEngine.create({ species: treeEngineSpecies(species), seed: frameSeed(species, variant) });
  const growth = growthFrame === TREE_SENESCENT_FRAME ? 1 : TREE_GROWTH_STOPS[growthFrame] ?? 1;
  treeEngine.render(atlas.source, {
    tree,
    growth,
    quality: 'g244',
    renderSize: TREE_FRAME_SIZE,
    referencePalette: true,
    paletteStrength: 0.91,
    density: 0.83,
    detail: 0.7,
    openness: 0.32,
    branchComplexity: 0.85,
    organDensity: 0.5,
    crownLeafModule: true,
    windStrength: 0,
    time: 0,
    angle: 42,
    season: growthFrame === TREE_SENESCENT_FRAME || species === 'autumnal' ? 'outono' : 'verao',
  });
  const parts = splitTreeFrame(atlas.source);
  const x = (growthFrame * TREE_VARIANT_COUNT + variant) * TREE_FRAME_SIZE;
  const y = FLORA_TREE_SPECIES.indexOf(species) * TREE_FRAME_SIZE;
  atlas.wood.getContext().drawImage(parts.wood as HTMLCanvasElement, x, y, TREE_FRAME_SIZE, TREE_FRAME_SIZE);
  atlas.canopy.getContext().drawImage(parts.canopy as HTMLCanvasElement, x, y, TREE_FRAME_SIZE, TREE_FRAME_SIZE);
  atlas.wood.refresh();
  atlas.canopy.refresh();
  atlas.rendered.add(frame);
  return frame;
}

function makePair(species: TreeSpeciesId): TreeSpritePair {
  return { wood: null, canopy: null, species, seed: 0, x: 0, y: 0, crownY: 0, scale: 1, growth: 0 };
}

export class Trees {
  static createProceduralAtlas(scene: Phaser.Scene): void {
    if (scene.textures.exists(TREE_WOOD_ATLAS_KEY) || scene.textures.exists(TREE_CANOPY_ATLAS_KEY)) return;
    const columns = TREE_ATLAS_COLUMNS;
    const rows = FLORA_TREE_SPECIES.length;
    const width = columns * TREE_FRAME_SIZE;
    const height = rows * TREE_FRAME_SIZE;
    const wood = scene.textures.createCanvas(TREE_WOOD_ATLAS_KEY, width, height);
    const canopy = scene.textures.createCanvas(TREE_CANOPY_ATLAS_KEY, width, height);
    if (wood === null || canopy === null) return;
    for (let row = 0; row < rows; row += 1) {
      for (let stage = 0; stage < TREE_FRAME_COUNT; stage += 1) {
        for (let variant = 0; variant < TREE_VARIANT_COUNT; variant += 1) {
          const frame = (row * TREE_FRAME_COUNT + stage) * TREE_VARIANT_COUNT + variant;
          const x = (stage * TREE_VARIANT_COUNT + variant) * TREE_FRAME_SIZE;
          const y = row * TREE_FRAME_SIZE;
          wood.add(frame, 0, x, y, TREE_FRAME_SIZE, TREE_FRAME_SIZE);
          canopy.add(frame, 0, x, y, TREE_FRAME_SIZE, TREE_FRAME_SIZE);
        }
      }
    }
    sharedAtlas = { wood, canopy, source: createCanvas(TREE_FRAME_SIZE, TREE_FRAME_SIZE), rendered: new Set() };
  }

  static emptySprites(): TreeSprites {
    return { oak: makePair('oak'), pine: makePair('pine'), birch: makePair('birch'), autumnal: makePair('autumnal'), willow: makePair('willow') };
  }

  static processFrameQueue(budgetMs: number): { elapsedMs: number; renderedFrames: number; pendingFrames: number } {
    if (sharedAtlas === null) return { elapsedMs: 0, renderedFrames: 0, pendingFrames: pendingTreeFrames.size };
    const startedAt = performance.now();
    let renderedFrames = 0;
    for (const [frame, request] of pendingTreeFrames) {
      pendingTreeFrames.delete(frame);
      renderTreeFrame(request);
      renderedFrames += 1;
      if (renderedFrames > 0 && performance.now() - startedAt >= budgetMs) break;
    }
    return { elapsedMs: Math.max(0, performance.now() - startedAt), renderedFrames, pendingFrames: pendingTreeFrames.size };
  }

  static update(
    scene: Phaser.Scene,
    world: NaturalWorldEntity,
    sprites: TreeSprites | undefined,
    speciesId: TreeSpeciesId,
    plant: NaturalWorldCellState['plants'][number] | undefined,
    cell: NaturalWorldCellState,
    visible: boolean,
    cellSize: number,
    visualSeed: number,
  ): void {
    if (!sprites) return;
    const pair = sprites[speciesId];
    if (!plant || !visible || plant.biomassGPerM2 < 0.5) {
      pair.wood?.setVisible(false);
      pair.canopy?.setVisible(false);
      windTargets.delete(pair);
      return;
    }
    const profile = TREE_PROFILE_BY_SPECIES.get(speciesId);
    if (!profile) return;
    const growthVisual = treeGrowthVisual(plant.ageDays, plant.biomassGPerM2, profile.maturityDays, profile.maximumBiomassGPerM2);
    const deadStanding = plant.stage === 'senescent'
      && plant.biomassGPerM2 < profile.initialBiomassGPerM2 * 0.12 && stress(plant) < 0.12;
    const stage = deadStanding || plant.stage === 'senescent' ? TREE_SENESCENT_FRAME : growthVisual.frame;
    const variant = treeVariant(visualSeed, cell.x, cell.y, speciesId);
    const frame = requestTreeFrame(speciesId, stage, variant);
    const scale = cellSize * TREE_MATURE_WIDTH_CELLS / TREE_FRAME_SIZE * growthVisual.scaleFactor;
    const rawAlpha = deadStanding ? 0.92 : clamp(0.74 + Math.sqrt(plant.biomassGPerM2 / profile.maximumBiomassGPerM2) * 0.26, 0.78, 1);
    const alpha = Math.round(rawAlpha * 50) / 50;
    const x = (cell.x + 0.5) * cellSize;
    const y = (cell.y + 1) * cellSize;
    const crownY = y - 118 * scale;
    const depth = worldObjectDepth(cell.y + 1, world.height);
    pair.seed = frameSeed(speciesId, variant);
    pair.x = x;
    pair.y = y;
    pair.crownY = crownY;
    pair.scale = scale;
    pair.growth = growthVisual.growth;
    if (pair.wood === null || pair.canopy === null) {
      pair.wood = scene.add.image(x, y, TREE_WOOD_ATLAS_KEY, frame).setOrigin(0.5, (TREE_FRAME_SIZE - 10) / TREE_FRAME_SIZE);
      pair.canopy = scene.add.image(x, crownY, TREE_CANOPY_ATLAS_KEY, frame).setOrigin(0.5, 0.5);
    }
    const visualState = [frame, scale.toFixed(4), alpha, x, y, depth].join(':');
    if (!pair.wood.visible || renderedTreeState.get(pair.wood) !== visualState) {
      pair.wood.setPosition(x, y).setDepth(depth).setFrame(frame).setScale(scale).setVisible(true).setAlpha(alpha);
      pair.canopy.setPosition(x, crownY).setDepth(depth + 0.001).setFrame(frame).setScale(scale).setRotation(0).setVisible(true).setAlpha(alpha);
      renderedTreeState.set(pair.wood, visualState);
    }
    windTargets.add(pair);
  }

  static updateWind(timeMs: number, field: WindField, view?: { x: number; y: number; right: number; bottom: number }): void {
    const phase = ((timeMs / 4000) % 1 + 1) % 1;
    for (const pair of windTargets) {
      if (!pair.wood?.active || !pair.canopy?.active || !pair.wood.visible) {
        windTargets.delete(pair);
        continue;
      }
      if (view && (pair.x < view.x - 256 || pair.x > view.right + 256 || pair.y < view.y - 256 || pair.y > view.bottom + 256)) continue;
      const wind = field.sample(pair.x, pair.y, phase);
      const stiffness = pair.species === 'pine' ? 0.79 : pair.species === 'willow' ? 0.26 : 0.5;
      const response = (1 - stiffness * 0.79) * (0.35 + 0.65 * pair.growth);
      const phaseOffset = (pair.seed % 997) * 0.015;
      const flutter = Math.sin(phase * Math.PI * 2 * 1.68 + phaseOffset) * wind.strength * 1.5;
      const dx = (wind.vx * 15 + flutter) * response * pair.scale;
      const dy = wind.vy * 2.2 * response * pair.scale;
      const rotation = clamp(wind.vx * 0.055 * response, -0.035, 0.035);
      pair.canopy.setPosition(pair.x + dx, pair.crownY + dy).setRotation(rotation);
    }
  }

  static shadow(
    graphics: Phaser.GameObjects.Graphics | null,
    plant: NaturalWorldCellState['plants'][number] | undefined,
    cell: NaturalWorldCellState,
    speciesId: TreeSpeciesId,
    cellSize: number,
  ): void {
    if (!graphics || !plant || plant.biomassGPerM2 < 0.5) return;
    const profile = TREE_PROFILE_BY_SPECIES.get(speciesId);
    if (!profile) return;
    const growth = treeGrowthVisual(plant.ageDays, plant.biomassGPerM2, profile.maturityDays, profile.maximumBiomassGPerM2).growth;
    const deadStanding = plant.stage === 'senescent'
      && plant.biomassGPerM2 < profile.initialBiomassGPerM2 * 0.12 && stress(plant) < 0.12;
    const width = cellSize * (deadStanding ? 0.7 : 0.42 + growth * (TREE_MATURE_WIDTH_CELLS - 0.42));
    graphics.fillStyle(0x18251b, deadStanding ? 0.07 : 0.08 + growth * 0.064);
    graphics.fillEllipse((cell.x + 0.5) * cellSize, (cell.y + 1) * cellSize - 4, width, width * 0.24);
  }
}
