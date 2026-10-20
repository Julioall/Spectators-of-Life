import Phaser from 'phaser';
import treeAtlasUrl from '../../data/assets/tree/Spritesheets/arvores_atlas_128.png?url';
import type { NaturalWorldCellState, NaturalWorldEntity, PlantCohortState, PlantSpeciesId, TreeSpeciesId } from '../core/natural/types';
import { NATURAL_SCENARIO } from '../core/natural/parameters';
import { naturalScenarioVersionAtLeast } from '../core/natural/versioning';
import { drawProceduralRock, generateProceduralRocks, ROCK_NATIVE_CELL_SIZE, treeBlockingCellsForRocks } from './procedural-rocks';
import {
  ALTITUDE_MAP_OVERLAY_ALPHA,
  altitudeMapColor,
  sampleTerrainPaletteColor,
  smoothTerrainPaletteField,
  terrainSurfaceField,
  type TerrainPaletteField,
  type TerrainSurface,
} from './terrain-palette';
import { hasNaturalLayerRevisionChanged, type NaturalLayerRevision } from './natural-layer-revision';
import {
  applyTerrainLightingToImageData,
  calculateTerrainLightingFactors,
  compositeInterpolatedColorFieldToImageData,
  createTerrainLightingDirtyMask,
  DEFAULT_TERRAIN_LIGHTING_SETTINGS,
  sampleCellFieldBilinear,
  sanitizeTerrainLightingSettings,
  smoothCellField,
  type TerrainLightingSettings,
} from './terrain-lighting';
import { worldObjectDepth } from './z-order';
import { buildWaterRibbon, organicWaterContour, smoothOpenWaterPath } from './water-mesh';

const CELL_SIZE = 40;
const MIN_ZOOM = 0.38;
const MAX_ZOOM = 1.55;
const TERRAIN_TEXTURE_KEY = 'natural-terrain-map';
const WATER_SURFACE_TEXTURE_KEY = 'natural-water-surface-shading';
const WATER_SURFACE_PIXELS_PER_CELL = 10;
const WATER_SURFACE_SHADING_ALPHA = 0.56;
const TREE_ATLAS_KEY = 'natural-tree-atlas';
const WATER_THRESHOLD_MM = 10;
const WATER_DEPTH_STOPS = [
  { depth: 0, color: 0x748d84 },
  { depth: 80, color: 0x708b83 },
  { depth: 180, color: 0x6c8982 },
  { depth: 500, color: 0x67857f },
  { depth: 1_800, color: 0x61807d },
  { depth: 5_000, color: 0x5b7a78 },
  { depth: 11_000, color: 0x557474 },
  { depth: 22_000, color: 0x4f6d70 },
] as const;
const RIVER_NEIGHBORS = [
  [-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1],
] as const;
const TREE_MATURE_WIDTH_CELLS = 4.4;
const TERRAIN_LIGHTING_ELEVATION_EPSILON_M = 0.25;
type MapLayers = { relief: boolean; water: boolean; vegetation: boolean; minerals: boolean; geology: boolean };
type TreeSprites = Record<TreeSpeciesId, Phaser.GameObjects.Image | null>;
type TilePoint = { x: number; y: number };
export type FoundationPerformanceHooks = {
  onDynamicLayersMs?: (elapsedMs: number) => void;
  onWaterMotionMs?: (elapsedMs: number) => void;
};

export class FoundationScene extends Phaser.Scene {
  private terrainImage: Phaser.GameObjects.Image | null = null;
  private terrainTexture: Phaser.Textures.CanvasTexture | null = null;
  private terrainSurfaces: TerrainSurface[] | null = null;
  private waterGraphics: Phaser.GameObjects.Graphics | null = null;
  private waterSurfaceTexture: Phaser.Textures.CanvasTexture | null = null;
  private waterSurfaceImage: Phaser.GameObjects.Image | null = null;
  private waterMotionGraphics: Phaser.GameObjects.Graphics | null = null;
  private plantGraphics: Phaser.GameObjects.Graphics | null = null;
  private treeShadowGraphics: Phaser.GameObjects.Graphics | null = null;
  private reliefGraphics: Phaser.GameObjects.Graphics | null = null;
  private geologyGraphics: Phaser.GameObjects.Graphics | null = null;
  private selectionGraphics: Phaser.GameObjects.Graphics | null = null;
  private naturalWorld: NaturalWorldEntity | null = null;
  private mapKey: string | null = null;
  private reliefWorldKey: string | null = null;
  private terrainElevationSnapshot: Float32Array | null = null;
  private terrainLightingFactors: Float32Array | null = null;
  private terrainLightingSettings: TerrainLightingSettings = { ...DEFAULT_TERRAIN_LIGHTING_SETTINGS };
  private altitudeMapVisible = true;
  private geologyWorldKey: string | null = null;
  private dynamicLayerRevision: NaturalLayerRevision | null = null;
  private treeSprites: TreeSprites[] = [];
  private mineralSprites: Phaser.GameObjects.Image[] = [];
  private mineralTextureKeys: string[] = [];
  private mineralSpritesWorldKey: string | null = null;
  private rockTreeBlockedCells = new Set<number>();
  private layers: MapLayers = { relief: true, water: true, vegetation: true, minerals: true, geology: false };
  private selectedCellIndex: number | null = null;
  private onCellSelected: (index: number | null) => void = () => undefined;
  private dragStart: { x: number; y: number; scrollX: number; scrollY: number; moved: boolean } | null = null;
  private cameraManuallyAdjusted = false;
  private waterAnimationClockMs = 0;
  private waterAnimationBucket = -1;
  private performanceHooks: FoundationPerformanceHooks = {};

  constructor() {
    super('foundation');
  }

  preload(): void {
    this.load.spritesheet(TREE_ATLAS_KEY, treeAtlasUrl, { frameWidth: 128, frameHeight: 128 });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#24392a');
    this.terrainImage = null;
    this.waterGraphics = this.add.graphics().setDepth(2.25);
    this.waterMotionGraphics = this.add.graphics().setDepth(2.32);
    this.plantGraphics = this.add.graphics().setDepth(2);
    this.treeShadowGraphics = this.add.graphics().setDepth(2.5);
    this.reliefGraphics = this.add.graphics().setDepth(0.55);
    this.geologyGraphics = this.add.graphics().setDepth(0.65);
    this.selectionGraphics = this.add.graphics().setDepth(5);
    this.scale.on('resize', this.resizeMap, this);
    this.input.on('pointerdown', this.beginPan, this);
    this.input.on('pointermove', this.movePan, this);
    this.input.on('pointerup', this.endPan, this);
    this.input.on('pointerupoutside', this.endPan, this);
    this.input.on('wheel', this.zoomAtPointer, this);
  }

  override update(_time: number, delta: number): void {
    if (this.naturalWorld === null || this.waterMotionGraphics === null) return;
    this.waterAnimationClockMs = (this.waterAnimationClockMs + delta) % 8_000;
    const bucket = Math.floor(this.waterAnimationClockMs / 120);
    if (bucket === this.waterAnimationBucket) return;
    this.waterAnimationBucket = bucket;
    this.drawWaterMotion();
  }

  showWorld(world: NaturalWorldEntity | null, worldKey = '', forceRefresh = false): void {
    if (world === null) {
      this.naturalWorld = null;
      this.mapKey = null;
      this.reliefWorldKey = null;
      this.terrainTexture = null;
      this.terrainElevationSnapshot = null;
      this.terrainLightingFactors = null;
      this.geologyWorldKey = null;
      this.dynamicLayerRevision = null;
      this.waterMotionGraphics?.clear();
      this.clearMap();
      return;
    }
    const previousWorld = this.naturalWorld;
    const needsRebuild = this.mapKey !== worldKey || previousWorld?.width !== world.width || previousWorld?.height !== world.height;
    const revision = { worldKey, daysSimulated: world.daysSimulated };
    const changedTerrainCells = needsRebuild ? null : significantlyChangedTerrainCells(world, this.terrainElevationSnapshot);
    const terrainChanged = changedTerrainCells !== null;
    const needsDynamicRefresh = forceRefresh || needsRebuild || terrainChanged || hasNaturalLayerRevisionChanged(this.dynamicLayerRevision, revision);
    this.naturalWorld = world;
    if (needsRebuild) {
      this.mapKey = worldKey;
      this.selectedCellIndex = null;
      this.onCellSelected(null);
      this.cameraManuallyAdjusted = false;
      this.buildTerrain();
    } else if (terrainChanged) {
      this.renderTerrainTexture(createTerrainLightingDirtyMask(world.width, world.height, changedTerrainCells));
      this.reliefWorldKey = null;
    }
    if (needsDynamicRefresh) {
      if (forceRefresh) {
        this.reliefWorldKey = null;
        this.geologyWorldKey = null;
        this.mineralSpritesWorldKey = null;
      }
      this.updateDynamicLayers();
      this.drawSelection();
      this.dynamicLayerRevision = revision;
    }
  }

  setLayers(layers: Partial<MapLayers>): void {
    const reliefChanged = layers.relief !== undefined && layers.relief !== this.layers.relief;
    this.layers = { ...this.layers, ...layers };
    if (reliefChanged) this.renderTerrainTexture();
    this.updateDynamicLayers();
  }

  setAltitudeMapVisible(visible: boolean): void {
    if (this.altitudeMapVisible === visible) return;
    this.altitudeMapVisible = visible;
    this.reliefWorldKey = null;
    this.renderTerrainTexture();
    this.updateDynamicLayers();
  }

  setTerrainLightingSettings(settings: TerrainLightingSettings): void {
    const next = sanitizeTerrainLightingSettings(settings);
    if (next.enabled === this.terrainLightingSettings.enabled
      && next.sunAngle === this.terrainLightingSettings.sunAngle
      && next.reliefStrength === this.terrainLightingSettings.reliefStrength) return;
    this.terrainLightingSettings = next;
    this.renderTerrainTexture();
  }

  setOnCellSelected(handler: (index: number | null) => void): void {
    this.onCellSelected = handler;
  }

  setPerformanceHooks(hooks: FoundationPerformanceHooks): void {
    this.performanceHooks = hooks;
  }

  setCameraView(x: number, y: number, zoom: number): void {
    this.cameraManuallyAdjusted = true;
    this.cameras.main.setScroll(x, y).setZoom(zoom);
  }

  private buildTerrain(): void {
    const world = this.naturalWorld;
    if (world === null) return;
    this.terrainImage?.destroy();
    this.terrainImage = null;
    this.terrainTexture = null;
    this.terrainSurfaces = null;
    this.terrainElevationSnapshot = null;
    if (this.textures.exists(TERRAIN_TEXTURE_KEY)) this.textures.remove(TERRAIN_TEXTURE_KEY);
    this.destroyTreeSprites();
    this.destroyMineralSprites();
    const elevations = world.cells.map((cell) => cell.terrain.elevationM);
    const [minimum, maximum] = elevationRange(elevations);
    this.terrainSurfaces = terrainSurfaceField(world, minimum, maximum);
    const texture = this.textures.createCanvas(TERRAIN_TEXTURE_KEY, world.width * CELL_SIZE, world.height * CELL_SIZE);
    if (texture === null) return;
    this.terrainTexture = texture;
    this.terrainImage = this.add.image(0, 0, TERRAIN_TEXTURE_KEY).setOrigin(0, 0).setDepth(0);
    this.renderTerrainTexture();
    this.treeSprites = world.cells.map(emptyTreeSprites);
    const mapWidth = world.width * CELL_SIZE;
    const mapHeight = world.height * CELL_SIZE;
    this.cameras.main.setBounds(-mapWidth * 0.45, -mapHeight * 0.45, mapWidth * 1.9, mapHeight * 1.9);
    if (!this.cameraManuallyAdjusted) this.setInitialZoom();
  }

  private updateDynamicLayers(): void {
    const world = this.naturalWorld;
    if (world === null) return;
    const startedAt = this.performanceHooks.onDynamicLayersMs === undefined ? null : renderNow();
    try {
      this.drawRelief();
      this.drawGeologyPotential();
      this.drawWater();
      this.drawWaterMotion();
      this.drawMinerals();
      this.drawVegetation();
    } finally {
      if (startedAt !== null) this.performanceHooks.onDynamicLayersMs?.(Math.max(0, renderNow() - startedAt));
    }
  }

  private renderTerrainTexture(dirtyCells?: Uint8Array): void {
    const world = this.naturalWorld;
    const texture = this.terrainTexture;
    if (world === null || texture === null) return;
    const elevations = world.cells.map((cell) => cell.terrain.elevationM);
    const surfaces = this.terrainSurfaces ?? terrainSurfaceField(world, ...elevationRange(elevations));
    this.terrainSurfaces = surfaces;
    const factors = calculateTerrainLightingFactors(
      world.width,
      world.height,
      world.cellSizeM,
      elevations,
      this.terrainLightingSettings,
    );
    texture.context.imageSmoothingEnabled = false;
    drawTerrainTexture(texture.context, world, surfaces, hashText(this.mapKey ?? 'natural-world'), dirtyCells);
    this.terrainLightingFactors = factors;
    if (this.terrainLightingSettings.enabled || this.altitudeMapVisible || this.layers.relief) {
      const imageData = texture.context.getImageData(0, 0, texture.width, texture.height);
      if (this.altitudeMapVisible || this.layers.relief) {
        const [minimum, maximum] = elevationRange(elevations);
        const elevationRangeM = Math.max(1, maximum - minimum);
        const relativeElevations = Float32Array.from(elevations, (elevation) => clamp((elevation - minimum) / elevationRangeM, 0, 1));
        const smoothedElevations = smoothCellField(world.width, world.height, relativeElevations);
        compositeInterpolatedColorFieldToImageData(
          imageData,
          world.width,
          world.height,
          CELL_SIZE,
          smoothedElevations,
          altitudeMapColor,
          this.altitudeMapVisible ? ALTITUDE_MAP_OVERLAY_ALPHA : 0.28,
          dirtyCells,
        );
      }
      if (this.terrainLightingSettings.enabled) {
        applyTerrainLightingToImageData(imageData, world.width, world.height, CELL_SIZE, factors, dirtyCells);
      }
      texture.context.putImageData(imageData, 0, 0);
    }
    texture.refresh();
    this.terrainElevationSnapshot = Float32Array.from(elevations);
  }

  private drawRelief(): void {
    const world = this.naturalWorld;
    const graphics = this.reliefGraphics;
    if (world === null || graphics === null) return;
    if (!this.layers.relief && !this.altitudeMapVisible) {
      graphics.setVisible(false);
      return;
    }
    const revisionKey = `${this.mapKey}:${world.daysSimulated}`;
    if (this.reliefWorldKey === revisionKey) {
      graphics.setVisible(true);
      return;
    }
    graphics.clear();
    const elevations = world.cells.map((cell) => cell.terrain.elevationM);
    const minimum = Math.min(...elevations);
    const maximum = Math.max(...elevations);
    drawElevationContours(graphics, world, minimum, maximum);
    graphics.setVisible(true);
    this.reliefWorldKey = revisionKey;
  }

  private drawGeologyPotential(): void {
    const world = this.naturalWorld;
    const graphics = this.geologyGraphics;
    if (world === null || graphics === null) return;
    if (!this.layers.geology) {
      graphics.setVisible(false);
      return;
    }
    if (this.geologyWorldKey === this.mapKey) {
      graphics.setVisible(true);
      return;
    }
    graphics.clear();
    for (const cell of world.cells) {
      const potential = cell.terrain.mineralPotential ?? 0;
      if (potential < 0.18) continue;
      const color = potential >= 0.76 ? 0xdba54f : potential >= 0.5 ? 0xb58f55 : 0x7c8761;
      const alpha = clamp(0.06 + (potential - 0.18) * 0.36, 0.06, 0.34);
      graphics.fillStyle(color, alpha);
      graphics.fillRect(cell.x * CELL_SIZE, cell.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }
    graphics.setVisible(true);
    this.geologyWorldKey = this.mapKey;
  }

  private drawWater(): void {
    const world = this.naturalWorld;
    const graphics = this.waterGraphics;
    if (world === null || graphics === null) return;
    graphics.clear();
    this.waterSurfaceImage?.setVisible(false);
    if (!this.layers.water) return;
    const waterDepthField = buildWaterDepthField(world);
    const lightingFactors = this.terrainLightingFactors ?? new Float32Array(world.cells.length).fill(1);
    const lakeCells: NaturalWorldCellState[] = [];
    const ephemeralWaterCells: NaturalWorldCellState[] = [];
    for (const cell of world.cells) {
      const surface = cell.water.surfaceMm;
      if (cell.terrain.waterBody === 'lake' && surface > WATER_THRESHOLD_MM) {
        lakeCells.push(cell);
        continue;
      }
      if (surface > WATER_THRESHOLD_MM && cell.terrain.waterBody !== 'river') {
        ephemeralWaterCells.push(cell);
        continue;
      }
    }
    drawDryLakeBeds(graphics, world);
    drawLakeSurfaces(graphics, lakeCells, world, waterDepthField, lightingFactors);
    drawEphemeralWaterSurfaces(graphics, ephemeralWaterCells, world, waterDepthField, lightingFactors);
    drawRiverBeds(graphics, world);
    drawRiverSurfaces(graphics, world, waterDepthField, lightingFactors);
    drawRiverNetwork(graphics, world, waterDepthField, lightingFactors);
    drawRunoffNetwork(graphics, world, waterDepthField, lightingFactors);
    this.drawWaterSurfaceShading(world, waterDepthField, lightingFactors);
  }

  private drawWaterSurfaceShading(world: NaturalWorldEntity, waterDepthField: ArrayLike<number>, lightingFactors: ArrayLike<number>): void {
    const width = world.width * WATER_SURFACE_PIXELS_PER_CELL;
    const height = world.height * WATER_SURFACE_PIXELS_PER_CELL;
    let texture = this.waterSurfaceTexture;
    if (texture === null || texture.width !== width || texture.height !== height) {
      this.waterSurfaceImage?.destroy();
      this.waterSurfaceImage = null;
      if (this.textures.exists(WATER_SURFACE_TEXTURE_KEY)) this.textures.remove(WATER_SURFACE_TEXTURE_KEY);
      texture = this.textures.createCanvas(WATER_SURFACE_TEXTURE_KEY, width, height) ?? null;
      this.waterSurfaceTexture = texture;
      if (texture === null) return;
      texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
      this.waterSurfaceImage = this.add.image(0, 0, WATER_SURFACE_TEXTURE_KEY)
        .setOrigin(0, 0)
        .setDisplaySize(world.width * CELL_SIZE, world.height * CELL_SIZE)
        .setDepth(2.26);
    }
    const image = this.waterSurfaceImage;
    if (image === null) return;
    image.setDisplaySize(world.width * CELL_SIZE, world.height * CELL_SIZE).setVisible(true);
    const context = texture.context;
    context.clearRect(0, 0, width, height);
    context.save();
    context.scale(WATER_SURFACE_PIXELS_PER_CELL / CELL_SIZE, WATER_SURFACE_PIXELS_PER_CELL / CELL_SIZE);
    context.fillStyle = '#ffffff';
    drawWaterSurfaceMask(context, world);
    context.restore();

    const pixels = context.getImageData(0, 0, width, height);
    for (let y = 0; y < height; y += 1) {
      const cellY = (y + 0.5) / WATER_SURFACE_PIXELS_PER_CELL - 0.5;
      let pixelIndex = y * width * 4;
      for (let x = 0; x < width; x += 1) {
        const maskAlpha = pixels.data[pixelIndex + 3] ?? 0;
        if (maskAlpha > 0) {
          const cellX = (x + 0.5) / WATER_SURFACE_PIXELS_PER_CELL - 0.5;
          const depth = sampleCellFieldBilinear(world.width, world.height, waterDepthField, cellX, cellY);
          const light = sampleCellFieldBilinear(world.width, world.height, lightingFactors, cellX, cellY);
          const color = shadeWaterColor(waterDepthColor(depth), light);
          pixels.data[pixelIndex] = (color >>> 16) & 0xff;
          pixels.data[pixelIndex + 1] = (color >>> 8) & 0xff;
          pixels.data[pixelIndex + 2] = color & 0xff;
          pixels.data[pixelIndex + 3] = Math.round(maskAlpha * WATER_SURFACE_SHADING_ALPHA);
        }
        pixelIndex += 4;
      }
    }
    context.putImageData(pixels, 0, 0);
    texture.refresh();
  }

  private drawWaterMotion(): void {
    const world = this.naturalWorld;
    const graphics = this.waterMotionGraphics;
    if (world === null || graphics === null) return;
    const startedAt = this.performanceHooks.onWaterMotionMs === undefined ? null : renderNow();
    try {
      graphics.clear();
      if (!this.layers.water) return;
      const phase = this.waterAnimationClockMs / 8_000;
      const seed = hashText(world.id);
      for (const cell of world.cells) {
        const runoffOut = cell.water.lastFlows.runoffOutMm ?? 0;
        const permanentRiverFlow = cell.terrain.waterBody === 'river' && isActiveRiverCell(cell);
        if (permanentRiverFlow || runoffOut > 0.35) {
          if (cell.index % (permanentRiverFlow ? 2 : 3) !== 0) continue;
          const downstreamIndex = cell.water.lastFlowTo ?? cell.terrain.flowTo;
          const downstream = downstreamIndex >= 0 ? world.cells[downstreamIndex] : undefined;
          if (downstream === undefined) continue;
          const downstreamHasFlow = (downstream.water.lastFlows.runoffInMm ?? 0) > 0.35
            || (downstream.water.lastFlows.runoffOutMm ?? 0) > 0.35
            || downstream.terrain.waterBody === 'river'
            || downstream.terrain.waterBody === 'lake';
          if (!downstreamHasFlow) continue;
          const startX = (cell.x + 0.5) * CELL_SIZE;
          const startY = (cell.y + 0.5) * CELL_SIZE;
          const endX = (downstream.x + 0.5) * CELL_SIZE;
          const endY = (downstream.y + 0.5) * CELL_SIZE;
          const offset = coordinateNoise(seed, cell.x, cell.y, 1_203);
          const progress = (phase * clamp(0.65 + Math.sqrt(Math.max(0, runoffOut)) * 0.24, 0.65, 1.35) + offset) % 1;
          const x = startX + (endX - startX) * progress;
          const y = startY + (endY - startY) * progress;
          const length = permanentRiverFlow
            ? 3.2 + coordinateNoise(seed, cell.x, cell.y, 1_207) * 2.2
            : 2.2 + coordinateNoise(seed, cell.x, cell.y, 1_207) * 1.8;
          const directionLength = Math.max(1, Math.hypot(endX - startX, endY - startY));
          const dx = (endX - startX) / directionLength;
          const dy = (endY - startY) / directionLength;
          if (!permanentRiverFlow && cell.index % 11 !== 0) continue;
          if (!permanentRiverFlow) {
            graphics.fillStyle(0xd1e6d8, clamp(0.08 + Math.sqrt(runoffOut) * 0.02, 0.08, 0.16));
            graphics.fillEllipse(x, y, 2.4, 1.4);
            continue;
          }
          graphics.lineStyle(
            1,
            0xd1e6d8,
            0.2,
          );
          graphics.lineBetween(x - dx * length, y - dy * length, x + dx * length, y + dy * length);
        } else if (cell.terrain.waterBody === 'lake' && cell.water.surfaceMm > WATER_THRESHOLD_MM && cell.index % 19 === 0) {
          const offset = coordinateNoise(seed, cell.x, cell.y, 1_231);
          const x = cell.x * CELL_SIZE + 8 + ((offset + phase * 0.7) % 1) * 20;
          const y = cell.y * CELL_SIZE + 10 + ((offset * 0.6 + phase * 0.35) % 1) * 18;
          graphics.lineStyle(1.1, 0xd1e6d8, 0.18);
          graphics.lineBetween(x, y, x + 5, y);
        }
      }
    } finally {
      if (startedAt !== null) this.performanceHooks.onWaterMotionMs?.(Math.max(0, renderNow() - startedAt));
    }
  }

  private drawVegetation(): void {
    const world = this.naturalWorld;
    const graphics = this.plantGraphics;
    if (world === null || graphics === null) return;
    graphics.clear();
    const hasGeomorphology = naturalScenarioVersionAtLeast(world.scenarioVersion, '1.6.0');
    this.treeShadowGraphics?.clear();
    for (const cell of world.cells) {
      const waterBody = cell.terrain.waterBody ?? 'none';
      const rockBlocksCell = this.rockTreeBlockedCells.has(cell.index);
      const treesAllowed = waterBody === 'none' && !cell.terrain.exposedRock && !rockBlocksCell;
      const groundcoverAllowed = !rockBlocksCell && (treesAllowed || (hasGeomorphology && cell.water.surfaceMm < 8));
      const sprites = this.treeSprites[cell.index];
      const trees = new Map<TreeSpeciesId, NaturalWorldCellState['plants'][number]>();
      for (const plant of cell.plants) if (isTreeSpecies(plant.speciesId)) trees.set(plant.speciesId, plant);
      for (const speciesId of TREE_SPECIES) {
        const plant = trees.get(speciesId);
        this.updateTreeSprite(sprites, speciesId, plant, cell, this.layers.vegetation && treesAllowed);
      }
      if (!this.layers.vegetation || !groundcoverAllowed) continue;
      for (const speciesId of TREE_SPECIES) this.drawTreeShadow(trees.get(speciesId), cell, speciesId);
      const grass = cohort(cell, 'grass');
      const shrub = cohort(cell, 'shrub');
      const cx = (cell.x + 0.5) * CELL_SIZE;
      const cy = (cell.y + 0.5) * CELL_SIZE;
      if (grass !== undefined && grass.biomassGPerM2 > 1 && cell.water.surfaceMm < 5) {
        const grassAmount = clamp(grass.biomassGPerM2 / 240, 0.2, 1);
        const nudge = (cell.index * 17 % 9) - 4;
        graphics.fillStyle(0xc1cf78, 0.34 + grassAmount * 0.32);
        graphics.fillCircle(cx - 8 + nudge * 0.35, cy + 5, 1.4 + grassAmount);
        graphics.fillCircle(cx + 7 - nudge * 0.25, cy + 8, 1.3 + grassAmount * 0.8);
        graphics.fillStyle(0x657c42, 0.56);
        graphics.fillCircle(cx + nudge * 0.3, cy + 10, 1.2 + grassAmount * 0.5);
      }
      if (shrub !== undefined && shrub.biomassGPerM2 > 2 && cell.water.surfaceMm < 7) {
        const radius = clamp(4 + Math.sqrt(shrub.biomassGPerM2) * 0.22, 4, 10);
        graphics.fillStyle(0x526f38, 0.88);
        graphics.fillCircle(cx + 7, cy + 5, radius);
        graphics.fillStyle(0x819453, 0.85);
        graphics.fillCircle(cx + 5, cy + 2, radius * 0.62);
        graphics.fillStyle(0xc2d275, 0.52);
        graphics.fillCircle(cx + 5, cy + 1, radius * 0.24);
      }
    }
  }

  private updateTreeSprite(sprites: TreeSprites | undefined, speciesId: TreeSpeciesId, plant: NaturalWorldCellState['plants'][number] | undefined, cell: NaturalWorldCellState, visible: boolean): void {
    if (sprites === undefined) return;
    const world = this.naturalWorld;
    if (plant === undefined || !visible || plant.biomassGPerM2 < 0.5 || world === null) {
      sprites[speciesId]?.setVisible(false);
      return;
    }
    let sprite = sprites[speciesId];
    if (sprite === null) {
      sprite = this.add.image((cell.x + 0.5) * CELL_SIZE, (cell.y + 1) * CELL_SIZE, TREE_ATLAS_KEY);
      sprite.setOrigin(0.5, 123 / 128);
      sprites[speciesId] = sprite;
    }
    const profile = NATURAL_SCENARIO.plants.find((candidate) => candidate.id === speciesId)!;
    const growthFrame = clamp(Math.ceil(plant.ageDays / profile.maturityDays * 8), 1, 8);
    const stressed = plantStress(plant) < 0.12;
    const deadStanding = plant.stage === 'senescent'
      && plant.biomassGPerM2 < profile.initialBiomassGPerM2 * 0.12
      && stressed;
    const row = TREE_SPECIES.indexOf(speciesId);
    const frame = row * 12 + (deadStanding || plant.stage === 'senescent' ? 8 : growthFrame - 1);
    // Atlas growth frames already encode the tree's changing size; keep one scale
    // so saplings stay small and mature canopies occupy several map cells.
    const scale = CELL_SIZE * TREE_MATURE_WIDTH_CELLS / 128;
    const depth = worldObjectDepth(cell.y + 1, world.height);
    sprite.setPosition((cell.x + 0.5) * CELL_SIZE, (cell.y + 1) * CELL_SIZE)
      .setDepth(depth)
      .setFrame(frame)
      .setScale(scale)
      .setVisible(true)
      .setAlpha(deadStanding ? 0.92 : clamp(0.74 + Math.sqrt(plant.biomassGPerM2 / profile.maximumBiomassGPerM2) * 0.26, 0.78, 1));
  }

  private drawTreeShadow(plant: NaturalWorldCellState['plants'][number] | undefined, cell: NaturalWorldCellState, speciesId: TreeSpeciesId): void {
    const graphics = this.treeShadowGraphics;
    if (!this.layers.vegetation || graphics === null || plant === undefined || plant.biomassGPerM2 < 0.5) return;
    const profile = NATURAL_SCENARIO.plants.find((candidate) => candidate.id === speciesId)!;
    const stage = clamp(Math.ceil(plant.ageDays / profile.maturityDays * 8), 1, 8);
    const stressed = plantStress(plant) < 0.12;
    const deadStanding = plant.stage === 'senescent'
      && plant.biomassGPerM2 < profile.initialBiomassGPerM2 * 0.12
      && stressed;
    const width = CELL_SIZE * (deadStanding ? 0.7 : 0.42 + (stage / 8) * (TREE_MATURE_WIDTH_CELLS - 0.42));
    const x = (cell.x + 0.5) * CELL_SIZE;
    const y = (cell.y + 1) * CELL_SIZE - 4;
    graphics.fillStyle(0x18251b, deadStanding ? 0.07 : 0.08 + stage * 0.008);
    graphics.fillEllipse(x, y, width, width * 0.24);
  }

  private drawMinerals(): void {
    const world = this.naturalWorld;
    if (world === null) return;
    const worldKey = this.mapKey ?? 'natural-world';
    if (this.mineralSpritesWorldKey !== worldKey) this.buildMineralFormations(world, hashText(worldKey));
    for (const sprite of this.mineralSprites) sprite.setVisible(this.layers.minerals);
  }

  private buildMineralFormations(world: NaturalWorldEntity, visualSeed: number): void {
    this.destroyMineralSprites();
    this.mineralSpritesWorldKey = this.mapKey ?? 'natural-world';
    const rocks = generateProceduralRocks(world, visualSeed);
    this.rockTreeBlockedCells = treeBlockingCellsForRocks(rocks, world.width, world.height);
    for (const [index, rock] of rocks.entries()) {
      const textureKey = `natural-asterra-v23-${visualSeed}-${index}`;
      const texture = this.textures.createCanvas(textureKey, rock.raster.width, rock.raster.height);
      const context = texture?.getContext();
      if (texture === null || context === undefined) continue;
      drawProceduralRock(context, rock);
      texture.refresh();
      this.mineralTextureKeys.push(textureKey);
      const sprite = this.add.image(rock.xCell * CELL_SIZE, rock.yCell * CELL_SIZE, textureKey);
      sprite.setOrigin(rock.raster.anchorX / rock.raster.width, rock.raster.anchorY / rock.raster.height)
        .setDepth(worldObjectDepth(rock.yCell, world.height, 0.002))
        .setScale((CELL_SIZE / ROCK_NATIVE_CELL_SIZE) * rock.visualScale);
      this.mineralSprites.push(sprite);
    }
  }

  private drawSelection(): void {
    const world = this.naturalWorld;
    const graphics = this.selectionGraphics;
    if (graphics === null) return;
    graphics.clear();
    if (world === null || this.selectedCellIndex === null) return;
    const cell = world.cells[this.selectedCellIndex];
    if (cell === undefined) return;
    graphics.lineStyle(2.4, 0xffe39a, 1);
    graphics.strokeRect(cell.x * CELL_SIZE + 1.5, cell.y * CELL_SIZE + 1.5, CELL_SIZE - 3, CELL_SIZE - 3);
    graphics.lineStyle(1, 0x453a25, 0.86);
    graphics.strokeRect(cell.x * CELL_SIZE + 3.5, cell.y * CELL_SIZE + 3.5, CELL_SIZE - 7, CELL_SIZE - 7);
  }

  private beginPan(pointer: Phaser.Input.Pointer): void {
    if (pointer.button !== 0) return;
    this.dragStart = { x: pointer.x, y: pointer.y, scrollX: this.cameras.main.scrollX, scrollY: this.cameras.main.scrollY, moved: false };
  }

  private movePan(pointer: Phaser.Input.Pointer): void {
    if (this.dragStart === null || !pointer.isDown) return;
    const dx = pointer.x - this.dragStart.x;
    const dy = pointer.y - this.dragStart.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) this.dragStart.moved = true;
    if (this.dragStart.moved) {
      this.cameraManuallyAdjusted = true;
      this.cameras.main.setScroll(this.dragStart.scrollX - dx / this.cameras.main.zoomX, this.dragStart.scrollY - dy / this.cameras.main.zoomY);
    }
  }

  private endPan(pointer: Phaser.Input.Pointer): void {
    if (this.dragStart === null) return;
    const wasDrag = this.dragStart.moved;
    this.dragStart = null;
    if (wasDrag || this.naturalWorld === null) return;
    const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const x = Math.floor(point.x / CELL_SIZE);
    const y = Math.floor(point.y / CELL_SIZE);
    const index = y * this.naturalWorld.width + x;
    if (x < 0 || x >= this.naturalWorld.width || y < 0 || y >= this.naturalWorld.height) return;
    this.selectedCellIndex = index;
    this.drawSelection();
    this.onCellSelected(index);
  }

  private zoomAtPointer(pointer: Phaser.Input.Pointer, _objects: Phaser.GameObjects.GameObject[], _deltaX: number, deltaY: number): void {
    if (this.naturalWorld === null) return;
    const before = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const nextZoom = clamp(this.cameras.main.zoomX * (deltaY > 0 ? 0.9 : 1.1), MIN_ZOOM, MAX_ZOOM);
    this.cameras.main.setZoom(nextZoom);
    this.cameraManuallyAdjusted = true;
    const after = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.cameras.main.setScroll(this.cameras.main.scrollX + before.x - after.x, this.cameras.main.scrollY + before.y - after.y);
  }

  private setInitialZoom(): void {
    const world = this.naturalWorld;
    if (world === null) return;
    const desired = Math.min(0.78, this.scale.width / (world.width * CELL_SIZE * 0.92), this.scale.height / (world.height * CELL_SIZE * 0.92));
    this.cameras.main.setZoom(clamp(desired, MIN_ZOOM, 0.78));
    this.cameras.main.centerOn(world.width * CELL_SIZE / 2, world.height * CELL_SIZE / 2);
  }

  private resizeMap(): void {
    if (this.naturalWorld !== null && !this.cameraManuallyAdjusted) this.setInitialZoom();
  }

  private clearMap(): void {
    this.terrainImage?.destroy();
    this.terrainImage = null;
    this.terrainTexture = null;
    this.terrainSurfaces = null;
    this.terrainElevationSnapshot = null;
    this.terrainLightingFactors = null;
    if (this.textures.exists(TERRAIN_TEXTURE_KEY)) this.textures.remove(TERRAIN_TEXTURE_KEY);
    this.waterSurfaceImage?.destroy();
    this.waterSurfaceImage = null;
    this.waterSurfaceTexture = null;
    if (this.textures.exists(WATER_SURFACE_TEXTURE_KEY)) this.textures.remove(WATER_SURFACE_TEXTURE_KEY);
    this.reliefGraphics?.clear();
    this.reliefGraphics?.setVisible(false);
    this.waterMotionGraphics?.clear();
    this.waterGraphics?.clear();
    this.plantGraphics?.clear();
    this.treeShadowGraphics?.clear();
    this.geologyGraphics?.clear();
    this.selectionGraphics?.clear();
    this.destroyTreeSprites();
    this.destroyMineralSprites();
    this.naturalWorld = null;
    this.mapKey = null;
    this.selectedCellIndex = null;
    this.onCellSelected(null);
  }

  private destroyTreeSprites(): void {
    for (const group of this.treeSprites) {
      for (const sprite of Object.values(group)) sprite?.destroy();
    }
    this.treeSprites = [];
  }

  private destroyMineralSprites(): void {
    for (const sprite of this.mineralSprites) sprite?.destroy();
    this.mineralSprites = [];
    for (const key of this.mineralTextureKeys) if (this.textures.exists(key)) this.textures.remove(key);
    this.mineralTextureKeys = [];
    this.mineralSpritesWorldKey = null;
    this.rockTreeBlockedCells.clear();
  }
}

const TREE_SPECIES: TreeSpeciesId[] = ['oak', 'pine', 'birch', 'autumnal', 'willow'];
function emptyTreeSprites(): TreeSprites {
  return { oak: null, pine: null, birch: null, autumnal: null, willow: null };
}

function isTreeSpecies(speciesId: PlantSpeciesId): speciesId is TreeSpeciesId {
  return TREE_SPECIES.includes(speciesId as TreeSpeciesId);
}

function drawTerrainTexture(
  context: CanvasRenderingContext2D,
  world: NaturalWorldEntity,
  surfaces: TerrainSurface[],
  visualSeed: number,
  dirtyCells?: Uint8Array,
): void {
  const palette = smoothTerrainPaletteField(world.width, world.height, surfaces);
  drawSmoothedTerrainPalette(context, world.width, world.height, palette, dirtyCells);
  for (const cell of world.cells) {
    if (dirtyCells !== undefined && dirtyCells[cell.index] !== 1) continue;
    const x = cell.x * CELL_SIZE;
    const y = cell.y * CELL_SIZE;
    const surface = surfaces[cell.index] ?? 'loam';
    const baseColor = sampleTerrainPaletteColor(palette, cell.x, cell.y);
    drawSurfaceTexture(context, x, y, cell, surface, baseColor, visualSeed);
  }
}

function drawSmoothedTerrainPalette(
  context: CanvasRenderingContext2D,
  worldWidth: number,
  worldHeight: number,
  palette: TerrainPaletteField,
  dirtyCells?: Uint8Array,
): void {
  const source = document.createElement('canvas');
  source.width = worldWidth;
  source.height = worldHeight;
  const sourceContext = source.getContext('2d');
  if (sourceContext === null) return;
  const image = sourceContext.createImageData(worldWidth, worldHeight);
  for (let index = 0; index < worldWidth * worldHeight; index += 1) {
    const offset = index * 4;
    image.data[offset] = palette.red[index] ?? 0;
    image.data[offset + 1] = palette.green[index] ?? 0;
    image.data[offset + 2] = palette.blue[index] ?? 0;
    image.data[offset + 3] = 255;
  }
  sourceContext.putImageData(image, 0, 0);

  context.save();
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  if (dirtyCells !== undefined && dirtyCells.length === worldWidth * worldHeight) {
    context.beginPath();
    for (let index = 0; index < dirtyCells.length; index += 1) {
      if (dirtyCells[index] !== 1) continue;
      const x = index % worldWidth;
      const y = Math.floor(index / worldWidth);
      context.rect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }
    context.clip();
  }
  context.drawImage(source, 0, 0, worldWidth * CELL_SIZE, worldHeight * CELL_SIZE);
  context.restore();
}

function elevationRange(elevations: readonly number[]): [number, number] {
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  for (const elevation of elevations) {
    if (!Number.isFinite(elevation)) continue;
    minimum = Math.min(minimum, elevation);
    maximum = Math.max(maximum, elevation);
  }
  return Number.isFinite(minimum) && Number.isFinite(maximum) ? [minimum, maximum] : [0, 0];
}

function significantlyChangedTerrainCells(world: NaturalWorldEntity, previous: Float32Array | null): number[] | null {
  if (previous === null || previous.length !== world.cells.length) return world.cells.map((cell) => cell.index);
  const changed: number[] = [];
  for (let index = 0; index < world.cells.length; index += 1) {
    const cell = world.cells[index];
    const before = previous[index];
    if (cell === undefined || before === undefined || !Number.isFinite(cell.terrain.elevationM)
      || Math.abs(cell.terrain.elevationM - before) >= TERRAIN_LIGHTING_ELEVATION_EPSILON_M) changed.push(index);
  }
  return changed.length === 0 ? null : changed;
}

function drawElevationContours(graphics: Phaser.GameObjects.Graphics, world: NaturalWorldEntity, minimum: number, maximum: number): void {
  const contourInterval = Math.max(30, Math.round((maximum - minimum) / 10 / 10) * 10);
  const startLevel = Math.ceil(minimum / contourInterval) * contourInterval;
  graphics.lineStyle(1.1, 0x3d3527, 0.58);
  for (let y = 0; y < world.height - 1; y += 1) {
    for (let x = 0; x < world.width - 1; x += 1) {
      const left = world.cells[y * world.width + x];
      const right = world.cells[y * world.width + x + 1];
      const bottomRight = world.cells[(y + 1) * world.width + x + 1];
      const bottomLeft = world.cells[(y + 1) * world.width + x];
      if (left === undefined || right === undefined || bottomRight === undefined || bottomLeft === undefined) continue;
      const corners = [
        { x: (x + 0.5) * CELL_SIZE, y: (y + 0.5) * CELL_SIZE, elevation: left.terrain.elevationM },
        { x: (x + 1.5) * CELL_SIZE, y: (y + 0.5) * CELL_SIZE, elevation: right.terrain.elevationM },
        { x: (x + 1.5) * CELL_SIZE, y: (y + 1.5) * CELL_SIZE, elevation: bottomRight.terrain.elevationM },
        { x: (x + 0.5) * CELL_SIZE, y: (y + 1.5) * CELL_SIZE, elevation: bottomLeft.terrain.elevationM },
      ];
      const localMinimum = Math.min(...corners.map((corner) => corner.elevation));
      const localMaximum = Math.max(...corners.map((corner) => corner.elevation));
      for (let level = Math.max(contourInterval, startLevel); level <= Math.min(maximum, localMaximum); level += contourInterval) {
        if (level <= localMinimum) continue;
        const intersections: TilePoint[] = [];
        for (let edge = 0; edge < corners.length; edge += 1) {
          const from = corners[edge]!;
          const to = corners[(edge + 1) % corners.length]!;
          if ((from.elevation < level) === (to.elevation < level)) continue;
          const amount = (level - from.elevation) / (to.elevation - from.elevation);
          intersections.push({ x: from.x + (to.x - from.x) * amount, y: from.y + (to.y - from.y) * amount });
        }
        for (let point = 0; point + 1 < intersections.length; point += 2) {
          const from = intersections[point]!;
          const to = intersections[point + 1]!;
          graphics.lineBetween(from.x, from.y, to.x, to.y);
        }
      }
    }
  }
}

function drawSurfaceTexture(context: CanvasRenderingContext2D, x: number, y: number, cell: NaturalWorldCellState, surface: TerrainSurface, color: number, visualSeed: number): void {
  const patchSize = 4;
  const threshold = surface === 'sand' ? 0.22 : surface === 'rock' ? 0.19 : 0.14;
  for (let py = 2; py < CELL_SIZE; py += patchSize) {
    for (let px = 2; px < CELL_SIZE; px += patchSize) {
      const grain = coordinateNoise(visualSeed, cell.x * CELL_SIZE + px, cell.y * CELL_SIZE + py, surface.length * 31);
      if (grain < threshold) {
        const offset = grain < threshold * 0.42 ? -7 : 6;
        context.fillStyle = cssColor(shiftColor(color, offset));
        context.fillRect(x + px, y + py, 2, 2);
      }
    }
  }
}

function waterDepthColor(surfaceMm: number): number {
  const depth = Math.max(0, surfaceMm);
  for (let index = 1; index < WATER_DEPTH_STOPS.length; index += 1) {
    const previous = WATER_DEPTH_STOPS[index - 1]!;
    const next = WATER_DEPTH_STOPS[index]!;
    if (depth > next.depth) continue;
    const fraction = (depth - previous.depth) / (next.depth - previous.depth);
    return mixColor(previous.color, next.color, fraction);
  }
  return WATER_DEPTH_STOPS[WATER_DEPTH_STOPS.length - 1]!.color;
}

function buildWaterDepthField(world: NaturalWorldEntity): Float32Array {
  const values = new Float32Array(world.cells.length);
  const active = new Uint8Array(world.cells.length);
  const lakes: NaturalWorldCellState[] = [];
  for (const cell of world.cells) {
    if (cell.water.surfaceMm <= WATER_THRESHOLD_MM && !(cell.terrain.waterBody === 'river' && isActiveRiverCell(cell))) continue;
    values[cell.index] = Math.max(0, cell.water.surfaceMm);
    active[cell.index] = 1;
    if (cell.terrain.waterBody === 'lake') lakes.push(cell);
  }
  for (const component of connectedWaterComponents(lakes, world)) {
    const indices = new Set(component.map((cell) => cell.index));
    const shoreDistance = lakeDistanceFromShore(component, indices, world);
    const maximumDistance = Math.max(0, ...shoreDistance.values());
    const averageSurface = component.reduce((sum, cell) => sum + cell.water.surfaceMm, 0) / component.length;
    const centerDepth = clamp(Math.max(averageSurface, 900), 900, 4_500);
    for (const cell of component) {
      const distance = shoreDistance.get(cell.index) ?? 0;
      const depthFraction = maximumDistance === 0 ? 0.5 : distance / maximumDistance;
      values[cell.index] = 40 + (centerDepth - 40) * depthFraction;
    }
  }
  return smoothCellField(world.width, world.height, values, active);
}

function connectedWaterComponents(cells: NaturalWorldCellState[], world: NaturalWorldEntity): NaturalWorldCellState[][] {
  const remaining = new Set(cells.map((cell) => cell.index));
  const components: NaturalWorldCellState[][] = [];
  while (remaining.size > 0) {
    const first = remaining.values().next().value as number;
    const queue = [first];
    const component: NaturalWorldCellState[] = [];
    remaining.delete(first);
    while (queue.length > 0) {
      const index = queue.pop() as number;
      const cell = world.cells[index];
      if (cell === undefined) continue;
      component.push(cell);
      for (const neighborIndex of [index - world.width, index + 1, index + world.width, index - 1]) {
        if (neighborIndex < 0 || neighborIndex >= world.cells.length) continue;
        const neighbor = world.cells[neighborIndex]!;
        if (Math.abs(neighbor.x - cell.x) + Math.abs(neighbor.y - cell.y) !== 1 || !remaining.has(neighborIndex)) continue;
        remaining.delete(neighborIndex);
        queue.push(neighborIndex);
      }
    }
    components.push(component);
  }
  return components;
}

function averageCellField(cells: NaturalWorldCellState[], values: ArrayLike<number>, fallback = 1): number {
  if (cells.length === 0) return fallback;
  let sum = 0;
  let count = 0;
  for (const cell of cells) {
    const value = values[cell.index];
    if (value === undefined || !Number.isFinite(value)) continue;
    sum += value;
    count += 1;
  }
  return count > 0 ? sum / count : fallback;
}

function sampleLightingAtWorldPoint(world: NaturalWorldEntity, factors: ArrayLike<number>, x: number, y: number): number {
  return sampleCellFieldBilinear(world.width, world.height, factors, x / CELL_SIZE - 0.5, y / CELL_SIZE - 0.5);
}

function shadeWaterColor(color: number, lightFactor: number): number {
  const factor = clamp(Number.isFinite(lightFactor) ? lightFactor : 1, 0.62, 1.38);
  const channel = (shift: number): number => clamp(Math.round(((color >> shift) & 0xff) * factor), 0, 255);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

function drawLakeSurfaces(
  graphics: Phaser.GameObjects.Graphics,
  cells: NaturalWorldCellState[],
  world: NaturalWorldEntity,
  waterDepthField: ArrayLike<number>,
  lightingFactors: ArrayLike<number>,
): void {
  const remaining = new Set(cells.map((cell) => cell.index));
  const components: NaturalWorldCellState[][] = [];
  while (remaining.size > 0) {
    const first = remaining.values().next().value as number;
    const queue = [first];
    const component: NaturalWorldCellState[] = [];
    remaining.delete(first);
    while (queue.length > 0) {
      const index = queue.pop() as number;
      const cell = world.cells[index]!;
      component.push(cell);
      for (const neighbor of [index - world.width, index + 1, index + world.width, index - 1]) {
        if (neighbor < 0 || neighbor >= world.cells.length) continue;
        const candidate = world.cells[neighbor]!;
        if (Math.abs(candidate.x - cell.x) + Math.abs(candidate.y - cell.y) !== 1 || !remaining.has(neighbor)) continue;
        remaining.delete(neighbor);
        queue.push(neighbor);
      }
    }
    components.push(component);
  }

  for (const component of components) {
    const cellIndices = new Set(component.map((cell) => cell.index));
    const averageDepth = averageCellField(component, waterDepthField);
    const averageLight = averageCellField(component, lightingFactors);
    const shoreDistance = lakeDistanceFromShore(component, cellIndices, world);
    const maximumDepth = [...shoreDistance.values()].reduce((maximum, depth) => Math.max(maximum, depth), 0);
    const centerDepthMm = clamp(Math.max(averageDepth, 900), 900, 4_500);
    const featherContours: Array<{ points: TilePoint[]; color: number }> = [];

    for (let layer = 0; layer <= maximumDepth; layer += 1) {
      const layerCells = new Set(component
        .filter((cell) => (shoreDistance.get(cell.index) ?? 0) >= layer)
        .map((cell) => cell.index));
      const depthFraction = maximumDepth === 0 ? 0 : layer / maximumDepth;
      const visualDepthMm = 40 + (centerDepthMm - 40) * depthFraction;
      for (const contour of traceLakeContours(layerCells, world.width, world.height)) {
        const smooth = organicWaterContour(
          contour,
          organicContourSeed(world, component, layer),
          layer === 0 ? 6 : 3.4,
          3,
        );
        const color = shadeWaterColor(waterDepthColor(visualDepthMm), averageCellField(
          component.filter((cell) => layerCells.has(cell.index)),
          lightingFactors,
          averageLight,
        ));
        graphics.fillStyle(color, layer === 0 ? 0.9 : 0.28);
        graphics.fillPoints(smooth as unknown as Phaser.Math.Vector2[], true);
        if (layer === 0) {
          graphics.lineStyle(1.8, 0xa3b09a, 0.28);
          graphics.strokePoints(smooth as unknown as Phaser.Math.Vector2[], true);
        } else {
          featherContours.push({ points: smooth, color });
        }
      }
    }
    for (const contour of featherContours) drawLakeFeatherBrush(graphics, contour.points, contour.color);
    for (const cell of component) {
      if (cell.index % 11 === 0) drawWaterGlints(graphics, cell.x * CELL_SIZE, cell.y * CELL_SIZE, cell.water.surfaceMm, cell.index);
    }
  }
}

function drawRiverSurfaces(
  graphics: Phaser.GameObjects.Graphics,
  world: NaturalWorldEntity,
  waterDepthField: ArrayLike<number>,
  lightingFactors: ArrayLike<number>,
): void {
  const riverCells = world.cells.filter((cell) => cell.terrain.waterBody === 'river' && isActiveRiverCell(cell));
  const remaining = new Set(riverCells.map((cell) => cell.index));
  while (remaining.size > 0) {
    const first = remaining.values().next().value as number;
    const queue = [first];
    const component: NaturalWorldCellState[] = [];
    remaining.delete(first);
    while (queue.length > 0) {
      const index = queue.pop() as number;
      const cell = world.cells[index]!;
      component.push(cell);
      for (const neighbor of [index - world.width, index + 1, index + world.width, index - 1]) {
        if (neighbor < 0 || neighbor >= world.cells.length) continue;
        const candidate = world.cells[neighbor]!;
        if (Math.abs(candidate.x - cell.x) + Math.abs(candidate.y - cell.y) !== 1 || !remaining.has(neighbor)) continue;
        remaining.delete(neighbor);
        queue.push(neighbor);
      }
    }
    const indices = new Set(component.map((cell) => cell.index));
    const contours = traceLakeContours(indices, world.width, world.height);
    const surface = averageCellField(component, waterDepthField);
    const lightFactor = averageCellField(component, lightingFactors);
    for (const contour of contours) {
      const smooth = organicWaterContour(contour, organicContourSeed(world, component, 401), 4.2, 3);
      graphics.fillStyle(shadeWaterColor(waterDepthColor(surface), lightFactor), 0.86);
      graphics.fillPoints(smooth as unknown as Phaser.Math.Vector2[], true);
      graphics.lineStyle(1.1, 0xa3b09a, 0.18);
      graphics.strokePoints(smooth as unknown as Phaser.Math.Vector2[], true);
    }
  }
}

function drawLakeFeatherBrush(graphics: Phaser.GameObjects.Graphics, contour: TilePoint[], color: number): void {
  const brushPasses = [
    { width: CELL_SIZE * 0.58, alpha: 0.028 },
    { width: CELL_SIZE * 0.34, alpha: 0.035 },
    { width: CELL_SIZE * 0.16, alpha: 0.042 },
  ];
  for (const pass of brushPasses) {
    graphics.lineStyle(pass.width, color, pass.alpha);
    graphics.strokePoints(contour as unknown as Phaser.Math.Vector2[], true);
  }
}

function drawWaterSurfaceMask(context: CanvasRenderingContext2D, world: NaturalWorldEntity): void {
  const lakeIndices = new Set<number>();
  const riverIndices = new Set<number>();
  const ephemeralWaterIndices = new Set<number>();
  for (const cell of world.cells) {
    if (cell.terrain.waterBody === 'lake' && cell.water.surfaceMm > WATER_THRESHOLD_MM) lakeIndices.add(cell.index);
    else if (cell.terrain.waterBody === 'river' && isActiveRiverCell(cell)) riverIndices.add(cell.index);
    else if (cell.terrain.waterBody !== 'lake' && cell.terrain.waterBody !== 'river' && cell.water.surfaceMm > WATER_THRESHOLD_MM) {
      ephemeralWaterIndices.add(cell.index);
    }
  }
  fillWaterComponentMask(context, lakeIndices, world, 0, 6);
  fillWaterComponentMask(context, riverIndices, world, 401, 4.2);
  fillWaterComponentMask(context, ephemeralWaterIndices, world, 809, 6);
}

function drawEphemeralWaterSurfaces(
  graphics: Phaser.GameObjects.Graphics,
  cells: NaturalWorldCellState[],
  world: NaturalWorldEntity,
  waterDepthField: ArrayLike<number>,
  lightingFactors: ArrayLike<number>,
): void {
  const remaining = new Set(cells.map((cell) => cell.index));
  while (remaining.size > 0) {
    const first = remaining.values().next().value as number;
    const queue = [first];
    const component: NaturalWorldCellState[] = [];
    remaining.delete(first);
    while (queue.length > 0) {
      const index = queue.pop() as number;
      const cell = world.cells[index]!;
      component.push(cell);
      for (const neighborIndex of [index - world.width, index + 1, index + world.width, index - 1]) {
        if (neighborIndex < 0 || neighborIndex >= world.cells.length || !remaining.has(neighborIndex)) continue;
        const neighbor = world.cells[neighborIndex]!;
        if (Math.abs(neighbor.x - cell.x) + Math.abs(neighbor.y - cell.y) !== 1) continue;
        remaining.delete(neighborIndex);
        queue.push(neighborIndex);
      }
    }
    const indices = new Set(component.map((cell) => cell.index));
    const surfaceMm = averageCellField(component, waterDepthField, 0);
    const color = shadeWaterColor(waterDepthColor(surfaceMm), averageCellField(component, lightingFactors));
    for (const contour of traceLakeContours(indices, world.width, world.height)) {
      const smooth = organicWaterContour(contour, organicContourSeed(world, component, 809), 6, 3);
      graphics.fillStyle(color, clamp(0.36 + Math.log1p(surfaceMm) * 0.035, 0.38, 0.64));
      graphics.fillPoints(smooth as unknown as Phaser.Math.Vector2[], true);
      graphics.lineStyle(1, 0xb5c7b5, 0.12);
      graphics.strokePoints(smooth as unknown as Phaser.Math.Vector2[], true);
    }
    for (const cell of component) {
      if (cell.index % 4 === 0) drawWaterGlints(graphics, cell.x * CELL_SIZE, cell.y * CELL_SIZE, cell.water.surfaceMm, cell.index);
    }
  }
}

function fillWaterComponentMask(
  context: CanvasRenderingContext2D,
  indices: Set<number>,
  world: NaturalWorldEntity,
  salt: number,
  amplitude: number,
): void {
  if (indices.size === 0) return;
  let firstIndex = Number.POSITIVE_INFINITY;
  for (const index of indices) firstIndex = Math.min(firstIndex, index);
  const visualSeed = hashText(world.id) ^ Math.imul(Number.isFinite(firstIndex) ? firstIndex : 0, 31) ^ salt;
  for (const contour of traceLakeContours(indices, world.width, world.height)) {
    const smooth = organicWaterContour(contour, visualSeed, amplitude, 3);
    fillCanvasPolygon(context, smooth, true);
  }
}

function fillCanvasPolygon(context: CanvasRenderingContext2D, points: TilePoint[], feather = false): void {
  if (points.length < 3) return;
  context.beginPath();
  context.moveTo(points[0]!.x, points[0]!.y);
  for (let index = 1; index < points.length; index += 1) context.lineTo(points[index]!.x, points[index]!.y);
  context.closePath();
  if (feather) {
    context.save();
    context.filter = 'blur(1.25px)';
    context.fill();
    context.restore();
  }
  context.fill();
}

function lakeDistanceFromShore(component: NaturalWorldCellState[], cellIndices: Set<number>, world: NaturalWorldEntity): Map<number, number> {
  const distance = new Map<number, number>();
  const queue: number[] = [];
  for (const cell of component) {
    const neighbors = [cell.index - world.width, cell.index + 1, cell.index + world.width, cell.index - 1];
    const isShore = neighbors.some((index) => {
      if (index < 0 || index >= world.cells.length) return true;
      const neighbor = world.cells[index]!;
      return Math.abs(neighbor.x - cell.x) + Math.abs(neighbor.y - cell.y) !== 1 || !cellIndices.has(index);
    });
    if (isShore) {
      distance.set(cell.index, 0);
      queue.push(cell.index);
    }
  }
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor]!;
    const cell = world.cells[index]!;
    const nextDistance = (distance.get(index) ?? 0) + 1;
    for (const neighborIndex of [index - world.width, index + 1, index + world.width, index - 1]) {
      if (neighborIndex < 0 || neighborIndex >= world.cells.length || !cellIndices.has(neighborIndex)) continue;
      const neighbor = world.cells[neighborIndex]!;
      if (Math.abs(neighbor.x - cell.x) + Math.abs(neighbor.y - cell.y) !== 1 || distance.has(neighborIndex)) continue;
      distance.set(neighborIndex, nextDistance);
      queue.push(neighborIndex);
    }
  }
  return distance;
}

function traceLakeContours(cellIndices: Set<number>, width: number, height: number): TilePoint[][] {
  type Edge = { startKey: number; endKey: number; direction: number; start: TilePoint };
  const edges: Edge[] = [];
  const outgoing = new Map<number, Edge[]>();
  const addEdge = (startX: number, startY: number, endX: number, endY: number, direction: number): void => {
    const startKey = startY * (width + 1) + startX;
    const endKey = endY * (width + 1) + endX;
    const edge = { startKey, endKey, direction, start: { x: startX * CELL_SIZE, y: startY * CELL_SIZE } };
    edges.push(edge);
    const siblings = outgoing.get(startKey) ?? [];
    siblings.push(edge);
    outgoing.set(startKey, siblings);
  };
  for (const index of cellIndices) {
    const x = index % width;
    const y = Math.floor(index / width);
    if (y === 0 || !cellIndices.has(index - width)) addEdge(x, y, x + 1, y, 0);
    if (x === width - 1 || !cellIndices.has(index + 1)) addEdge(x + 1, y, x + 1, y + 1, 1);
    if (y === height - 1 || !cellIndices.has(index + width)) addEdge(x + 1, y + 1, x, y + 1, 2);
    if (x === 0 || !cellIndices.has(index - 1)) addEdge(x, y + 1, x, y, 3);
  }

  const visited = new Set<Edge>();
  const contours: TilePoint[][] = [];
  for (const first of edges) {
    if (visited.has(first)) continue;
    const contour: TilePoint[] = [];
    const startKey = first.startKey;
    let edge: Edge | undefined = first;
    for (let step = 0; edge !== undefined && step <= edges.length; step += 1) {
      if (visited.has(edge)) break;
      visited.add(edge);
      contour.push(edge.start);
      if (edge.endKey === startKey) break;
      const previousDirection = edge.direction;
      const candidates: Edge[] = (outgoing.get(edge.endKey) ?? []).filter((candidate) => !visited.has(candidate));
      const turnRank = (direction: number): number => {
        const turn = (direction - previousDirection + 4) % 4;
        return turn === 1 ? 0 : turn === 0 ? 1 : turn === 3 ? 2 : 3;
      };
      edge = candidates.sort((left, right) => turnRank(left.direction) - turnRank(right.direction))[0];
    }
    if (contour.length >= 4) contours.push(contour);
  }
  return contours;
}

function organicContourSeed(world: NaturalWorldEntity, component: NaturalWorldCellState[], salt: number): number {
  let firstIndex = Number.POSITIVE_INFINITY;
  for (const cell of component) firstIndex = Math.min(firstIndex, cell.index);
  return hashText(world.id) ^ Math.imul(Number.isFinite(firstIndex) ? firstIndex : 0, 31) ^ salt;
}

function drawRiverNetwork(
  graphics: Phaser.GameObjects.Graphics,
  world: NaturalWorldEntity,
  waterDepthField: ArrayLike<number>,
  lightingFactors: ArrayLike<number>,
): void {
  const riverCandidates = world.cells.map((cell) => cell.terrain.waterBody === 'river' && isActiveRiverCell(cell));
  const contributingCells = riverCatchmentCells(world);
  const isRiver = riverCandidates.map((candidate, index) => {
    if (!candidate) return false;
    const downstream = world.cells[index]!.terrain.flowTo;
    if (downstream < 0 || downstream >= world.cells.length || !riverCandidates[downstream]) return true;
    return (contributingCells[index] as number) >= (contributingCells[downstream] as number) * 0.12;
  });
  const upstreamCount = new Uint8Array(world.cells.length);
  const lakeOutlets = new Map<number, NaturalWorldCellState>();
  for (const cell of world.cells) {
    if (isRiver[cell.index]) {
      const downstream = cell.terrain.flowTo;
      if (downstream >= 0 && downstream < world.cells.length && isRiver[downstream]) upstreamCount[downstream] = (upstreamCount[downstream] ?? 0) + 1;
    }
    if (cell.terrain.waterBody !== 'lake') continue;
    for (const [dx, dy] of RIVER_NEIGHBORS) {
      const x = cell.x + dx;
      const y = cell.y + dy;
      if (x < 0 || x >= world.width || y < 0 || y >= world.height) continue;
      const downstream = y * world.width + x;
      if (!riverCandidates[downstream]) continue;
      const current = lakeOutlets.get(downstream);
      if (current === undefined || (cell.water.lastFlows.runoffOutMm ?? 0) > (current.water.lastFlows.runoffOutMm ?? 0)) lakeOutlets.set(downstream, cell);
    }
  }

  for (const source of world.cells) {
    if (!isRiver[source.index] || upstreamCount[source.index] === 1) continue;
    const path: Array<{ x: number; y: number; surfaceMm: number; contributingCells: number; widthScale: number }> = [];
    const lakeSource = upstreamCount[source.index] === 0 ? lakeOutlets.get(source.index) : undefined;
    if (lakeSource !== undefined) {
      path.push({
        x: ((lakeSource.x + source.x + 1) / 2) * CELL_SIZE,
        y: ((lakeSource.y + source.y + 1) / 2) * CELL_SIZE,
        surfaceMm: waterDepthField[source.index] ?? source.water.surfaceMm,
        contributingCells: contributingCells[source.index] as number,
        widthScale: riverWidthScale(source, world, contributingCells[source.index] as number, upstreamCount[source.index] ?? 0),
      });
    }
    const seen = new Set<number>();
    let current = source;
    while (!seen.has(current.index)) {
      seen.add(current.index);
      path.push({
        x: (current.x + 0.5) * CELL_SIZE,
        y: (current.y + 0.5) * CELL_SIZE,
        surfaceMm: waterDepthField[current.index] ?? current.water.surfaceMm,
        contributingCells: contributingCells[current.index] as number,
        widthScale: riverWidthScale(current, world, contributingCells[current.index] as number, upstreamCount[current.index] ?? 0),
      });
      const downstreamIndex = current.terrain.flowTo;
      if (downstreamIndex < 0) break;
      const downstream = world.cells[downstreamIndex];
      if (downstream === undefined) break;
      if (isRiver[downstreamIndex]) {
        current = downstream;
        if (upstreamCount[downstreamIndex] !== 1) {
          path.push({
            x: (downstream.x + 0.5) * CELL_SIZE,
            y: (downstream.y + 0.5) * CELL_SIZE,
            surfaceMm: waterDepthField[downstreamIndex] ?? downstream.water.surfaceMm,
            contributingCells: contributingCells[downstreamIndex] as number,
            widthScale: riverWidthScale(downstream, world, contributingCells[downstreamIndex] as number, upstreamCount[downstreamIndex] ?? 0),
          });
          break;
        }
        continue;
      }
      if (downstream.terrain.waterBody === 'lake' && downstream.water.surfaceMm > WATER_THRESHOLD_MM) {
        path.push({
          x: ((current.x + downstream.x + 1) / 2) * CELL_SIZE,
          y: ((current.y + downstream.y + 1) / 2) * CELL_SIZE,
          surfaceMm: waterDepthField[current.index] ?? current.water.surfaceMm,
          contributingCells: contributingCells[current.index] as number,
          widthScale: riverWidthScale(current, world, contributingCells[current.index] as number, upstreamCount[current.index] ?? 0),
        });
      }
      break;
    }
    const adjacentLake = lakeOutlets.get(current.index);
    if (adjacentLake !== undefined && path.length > 0 && path.at(-1)!.x === (current.x + 0.5) * CELL_SIZE) {
      path.push({
        x: ((adjacentLake.x + current.x + 1) / 2) * CELL_SIZE,
        y: ((adjacentLake.y + current.y + 1) / 2) * CELL_SIZE,
        surfaceMm: waterDepthField[current.index] ?? current.water.surfaceMm,
        contributingCells: contributingCells[current.index] as number,
        widthScale: riverWidthScale(current, world, contributingCells[current.index] as number, upstreamCount[current.index] ?? 0),
      });
    }
    drawSmoothedRiverPath(graphics, path, world, lightingFactors);
  }
  drawLakeRiverConnections(graphics, world, lakeOutlets, contributingCells, waterDepthField, lightingFactors);
  drawRiverConfluencePools(graphics, world, isRiver, upstreamCount, contributingCells, waterDepthField, lightingFactors);
}

function drawRunoffNetwork(
  graphics: Phaser.GameObjects.Graphics,
  world: NaturalWorldEntity,
  waterDepthField: ArrayLike<number>,
  lightingFactors: ArrayLike<number>,
): void {
  const isFlowing = world.cells.map((cell) => (cell.water.lastFlows.runoffOutMm ?? 0) > 0.35
    && (cell.water.lastFlowTo ?? cell.terrain.flowTo) >= 0);
  const upstreamCount = new Uint8Array(world.cells.length);
  for (const cell of world.cells) {
    if (!isFlowing[cell.index]) continue;
    const downstream = cell.water.lastFlowTo ?? cell.terrain.flowTo;
    if (isFlowing[downstream]) upstreamCount[downstream] = (upstreamCount[downstream] ?? 0) + 1;
  }

  for (const source of world.cells) {
    if (!isFlowing[source.index] || upstreamCount[source.index] === 1) continue;
    const path: NaturalWorldCellState[] = [];
    const seen = new Set<number>();
    let current = source;
    while (!seen.has(current.index)) {
      seen.add(current.index);
      path.push(current);
      const downstreamIndex = current.water.lastFlowTo ?? current.terrain.flowTo;
      if (downstreamIndex < 0 || downstreamIndex >= world.cells.length) break;
      const downstream = world.cells[downstreamIndex]!;
      if (downstream.terrain.waterBody === 'lake' || downstream.terrain.waterBody === 'river') {
        path.push(downstream);
        break;
      }
      if (!isFlowing[downstreamIndex]) break;
      current = downstream;
      if (upstreamCount[current.index] !== 1) {
        path.push(current);
        break;
      }
    }
    if (path.length < 2) continue;
    const maximumRunoff = path.reduce((maximum, cell) => Math.max(maximum, cell.water.lastFlows.runoffOutMm ?? 0), 0);
    if (path.length < 4 && maximumRunoff < 0.85) continue;

    const points = smoothOpenWaterPath(
      path.map((cell, index) => ({
        x: (cell.x + 0.5) * CELL_SIZE,
        y: (cell.y + 0.5) * CELL_SIZE,
        progress: index,
      })),
      2,
    );
    const flowAt = (progress: number): number => {
      const leftIndex = Math.min(path.length - 1, Math.floor(progress));
      const rightIndex = Math.min(path.length - 1, leftIndex + 1);
      const fraction = clamp(progress - leftIndex, 0, 1);
      const left = path[leftIndex]!.water.lastFlows.runoffOutMm ?? 0;
      const right = path[rightIndex]!.water.lastFlows.runoffOutMm ?? 0;
      return left + (right - left) * fraction;
    };
    const widthAt = (progress: number, x: number, y: number): number => {
      const widthVariation = 0.88 + coordinateNoise(
        hashText(world.id),
        Math.floor(x / CELL_SIZE),
        Math.floor(y / CELL_SIZE),
        2_441,
      ) * 0.22;
      return clamp((7 + Math.sqrt(Math.max(0, flowAt(progress))) * 1.8) * widthVariation, 7, 17);
    };
    const ribbonPoints = points.map((point) => ({
      x: point.x,
      y: point.y,
      width: widthAt(point.progress, point.x, point.y),
    }));
    const bankMesh = buildWaterRibbon(ribbonPoints, 3.8);
    const center = ribbonPoints[Math.floor(ribbonPoints.length / 2)]!;
    const middleCell = path[Math.min(path.length - 1, Math.floor(points[Math.floor(points.length / 2)]!.progress))]!;
    const depth = Math.max(20, waterDepthField[middleCell.index] ?? 0);
    const color = shadeWaterColor(
      waterDepthColor(depth),
      sampleLightingAtWorldPoint(world, lightingFactors, center.x, center.y),
    );
    if (bankMesh.length >= 3) {
      graphics.fillStyle(0x405d5a, 0.06);
      graphics.fillPoints(bankMesh as unknown as Phaser.Math.Vector2[], true);
      graphics.lineStyle(0.7, 0x405d5a, 0.1);
      graphics.strokePoints(bankMesh as unknown as Phaser.Math.Vector2[], true);
    }
    const waterMesh = buildWaterRibbon(ribbonPoints);
    graphics.fillStyle(color, 0.22);
    graphics.fillPoints(waterMesh as unknown as Phaser.Math.Vector2[], true);
    graphics.lineStyle(0.8, 0xd1e6d8, 0.05);
    graphics.beginPath();
    graphics.moveTo(points[0]!.x, points[0]!.y);
    for (let index = 1; index < points.length; index += 1) graphics.lineTo(points[index]!.x, points[index]!.y);
    graphics.strokePath();
  }
}

function drawLakeRiverConnections(
  graphics: Phaser.GameObjects.Graphics,
  world: NaturalWorldEntity,
  lakeOutlets: Map<number, NaturalWorldCellState>,
  contributingCells: number[],
  waterDepthField: ArrayLike<number>,
  lightingFactors: ArrayLike<number>,
): void {
  for (const [riverIndex, lake] of lakeOutlets) {
    const river = world.cells[riverIndex];
    if (river === undefined) continue;
    const midpoint = {
      x: ((lake.x + river.x + 1) / 2) * CELL_SIZE,
      y: ((lake.y + river.y + 1) / 2) * CELL_SIZE,
    };
    const lakeCenter = { x: (lake.x + 0.5) * CELL_SIZE, y: (lake.y + 0.5) * CELL_SIZE };
    const mouth = {
      x: midpoint.x + (lakeCenter.x - midpoint.x) * 0.55,
      y: midpoint.y + (lakeCenter.y - midpoint.y) * 0.55,
    };
    const x = (river.x + 0.5) * CELL_SIZE;
    const y = (river.y + 0.5) * CELL_SIZE;
    const width = clamp(6.5 + Math.sqrt(Math.max(1, contributingCells[riverIndex] as number)) * 0.42, 7, 30);
    const color = shadeWaterColor(waterDepthColor(waterDepthField[riverIndex] ?? river.water.surfaceMm), sampleLightingAtWorldPoint(world, lightingFactors, x, y));
    const connection = smoothOpenWaterPath([
      { x: mouth.x, y: mouth.y, progress: 0 },
      { x, y, progress: 1 },
    ], 2);
    const ribbon = connection.map((point) => ({ x: point.x, y: point.y, width }));
    const bankMesh = buildWaterRibbon(ribbon, 2.2);
    graphics.fillStyle(0x405d5a, 0.12);
    graphics.fillPoints(bankMesh as unknown as Phaser.Math.Vector2[], true);
    graphics.lineStyle(0.8, 0x405d5a, 0.18);
    graphics.strokePoints(bankMesh as unknown as Phaser.Math.Vector2[], true);
    const waterMesh = buildWaterRibbon(ribbon);
    graphics.fillStyle(color, 0.82);
    graphics.fillPoints(waterMesh as unknown as Phaser.Math.Vector2[], true);
    graphics.fillStyle(color, 0.9);
    graphics.fillCircle(mouth.x, mouth.y, width * 0.5);
  }
}

function riverCatchmentCells(world: NaturalWorldEntity): number[] {
  const contributing = new Uint32Array(world.cells.length);
  contributing.fill(1);
  const downhill = world.cells.map((cell) => cell.index)
    .sort((left, right) => world.cells[right]!.terrain.elevationM - world.cells[left]!.terrain.elevationM || left - right);
  for (const index of downhill) {
    const cell = world.cells[index]!;
    const downstream = cell.terrain.flowTo;
    if (downstream >= 0 && downstream < world.cells.length && cell.terrain.elevationM > world.cells[downstream]!.terrain.elevationM) {
      contributing[downstream] = (contributing[downstream] ?? 0) + (contributing[index] ?? 0);
    }
  }
  return Array.from(contributing);
}

function riverWidthScale(cell: NaturalWorldCellState, world: NaturalWorldEntity, catchmentCells: number, upstreamCount: number): number {
  const seed = hashText(world.id);
  const bankDetail = coordinateNoise(seed, cell.x, cell.y, 887);
  const accumulation = clamp(Math.log2(Math.max(1, catchmentCells / 32)) * 0.065, 0, 0.22);
  const junction = upstreamCount >= 2 ? 0.12 : 0;
  return clamp(0.88 + accumulation + junction + (bankDetail - 0.5) * 0.1, 0.84, 1.28);
}

function drawSmoothedRiverPath(
  graphics: Phaser.GameObjects.Graphics,
  path: Array<{ x: number; y: number; surfaceMm: number; contributingCells: number; widthScale: number }>,
  world: NaturalWorldEntity,
  lightingFactors: ArrayLike<number>,
): void {
  if (path.length === 0) return;
  const points = smoothOpenWaterPath(
    path.map((point, index) => ({ x: point.x, y: point.y, progress: index })),
    2,
  );

  const surfaceAt = (progress: number): number => {
    const leftIndex = Math.min(path.length - 1, Math.floor(progress));
    const rightIndex = Math.min(path.length - 1, leftIndex + 1);
    const fraction = clamp(progress - leftIndex, 0, 1);
    return path[leftIndex]!.surfaceMm + (path[rightIndex]!.surfaceMm - path[leftIndex]!.surfaceMm) * fraction;
  };
  const widthScaleAt = (progress: number): number => {
    const leftIndex = Math.min(path.length - 1, Math.floor(progress));
    const rightIndex = Math.min(path.length - 1, leftIndex + 1);
    const fraction = clamp(progress - leftIndex, 0, 1);
    return path[leftIndex]!.widthScale + (path[rightIndex]!.widthScale - path[leftIndex]!.widthScale) * fraction;
  };
  const catchmentAt = (progress: number): number => {
    const leftIndex = Math.min(path.length - 1, Math.floor(progress));
    const rightIndex = Math.min(path.length - 1, leftIndex + 1);
    const fraction = clamp(progress - leftIndex, 0, 1);
    return path[leftIndex]!.contributingCells + (path[rightIndex]!.contributingCells - path[leftIndex]!.contributingCells) * fraction;
  };
  const widthAt = (progress: number): number => {
    const flowWidth = clamp(9 + Math.sqrt(Math.max(1, catchmentAt(progress))) * 0.5, 9, 34);
    return clamp(flowWidth * widthScaleAt(progress), 8, 40);
  };
  const ribbonPoints = points.map((point) => ({ x: point.x, y: point.y, width: widthAt(point.progress) }));
  const bankMesh = buildWaterRibbon(ribbonPoints, 3.2);
  if (bankMesh.length >= 3) {
    const bankColor = shadeWaterColor(0x52675e, sampleLightingAtWorldPoint(
      world,
      lightingFactors,
      ribbonPoints[Math.floor(ribbonPoints.length / 2)]!.x,
      ribbonPoints[Math.floor(ribbonPoints.length / 2)]!.y,
    ));
    graphics.fillStyle(bankColor, 0.2);
    graphics.fillPoints(bankMesh as unknown as Phaser.Math.Vector2[], true);
    graphics.lineStyle(0.9, bankColor, 0.32);
    graphics.strokePoints(bankMesh as unknown as Phaser.Math.Vector2[], true);
  }
  const center = ribbonPoints[Math.floor(ribbonPoints.length / 2)]!;
  const color = shadeWaterColor(
    waterDepthColor(surfaceAt(points[Math.floor(points.length / 2)]!.progress)),
    sampleLightingAtWorldPoint(world, lightingFactors, center.x, center.y),
  );
  const waterMesh = buildWaterRibbon(ribbonPoints);
  if (waterMesh.length >= 3) {
    graphics.fillStyle(color, 0.92);
    graphics.fillPoints(waterMesh as unknown as Phaser.Math.Vector2[], true);
  }
  if (points.length > 1) {
    graphics.lineStyle(1.05, 0xd1e6d8, 0.2);
    graphics.beginPath();
    graphics.moveTo(points[0]!.x, points[0]!.y);
    for (let index = 1; index < points.length; index += 1) graphics.lineTo(points[index]!.x, points[index]!.y);
    graphics.strokePath();
  }
}

function drawRiverConfluencePools(
  graphics: Phaser.GameObjects.Graphics,
  world: NaturalWorldEntity,
  isRiver: boolean[],
  upstreamCount: Uint8Array,
  contributingCells: number[],
  waterDepthField: ArrayLike<number>,
  lightingFactors: ArrayLike<number>,
): void {
  for (const cell of world.cells) {
    if (!isRiver[cell.index] || (upstreamCount[cell.index] ?? 0) < 2) continue;
    const diameter = clamp(36 + Math.sqrt(contributingCells[cell.index] as number) * 1.05, 44, 78);
    const x = (cell.x + 0.5) * CELL_SIZE;
    const y = (cell.y + 0.5) * CELL_SIZE;
    graphics.fillStyle(0x52675e, 0.2);
    graphics.fillEllipse(x, y, diameter * 1.18, diameter * 0.88);
    graphics.fillStyle(shadeWaterColor(waterDepthColor(waterDepthField[cell.index] ?? cell.water.surfaceMm), lightingFactors[cell.index] ?? 1), 0.86);
    graphics.fillEllipse(x, y, diameter, diameter * 0.72);
  }
}

function drawWaterGlints(graphics: Phaser.GameObjects.Graphics, x: number, y: number, surfaceMm: number, cellIndex: number): void {
  const alpha = clamp(0.14 + Math.log1p(surfaceMm) * 0.018, 0.18, 0.32);
  const offsetX = (cellIndex * 13) % 14;
  const offsetY = (cellIndex * 7) % 13;
  graphics.lineStyle(1.2, 0xc6d9cd, alpha);
  graphics.lineBetween(x + 9 + offsetX, y + 12 + offsetY, x + 15 + (cellIndex % 5) + offsetX, y + 12 + offsetY);
  if (surfaceMm > 180) {
    const secondX = x + 21 - offsetX * 0.35;
    const secondY = y + 27 - offsetY * 0.3;
    graphics.lineBetween(secondX, secondY, secondX + 4 + (cellIndex % 4), secondY);
  }
}

function isActiveRiverCell(cell: NaturalWorldCellState): boolean {
  return cell.water.surfaceMm > WATER_THRESHOLD_MM
    || (cell.water.lastFlows.runoffOutMm ?? 0) > 0.35
    || (cell.water.lastFlows.runoffInMm ?? 0) > 0.35;
}

function drawRiverBeds(graphics: Phaser.GameObjects.Graphics, world: NaturalWorldEntity): void {
  for (const cell of world.cells) {
    if (cell.terrain.waterBody !== 'river') continue;
    const downstreamIndex = cell.water.lastFlowTo ?? cell.terrain.flowTo;
    const downstream = downstreamIndex >= 0 ? world.cells[downstreamIndex] : undefined;
    const incision = cell.terrain.channelIncisionM ?? 0;
    const width = clamp(8 + Math.sqrt(incision * 100) * 1.7 + cell.terrain.slope * 18, 8, 22);
    const active = isActiveRiverCell(cell);
    const bedColor = active ? 0x435c57 : 0x625e4d;
    const bedAlpha = active ? 0.62 : 0.86;
    const x = (cell.x + 0.5) * CELL_SIZE;
    const y = (cell.y + 0.5) * CELL_SIZE;
    graphics.lineStyle(width, bedColor, bedAlpha);
    graphics.fillStyle(bedColor, bedAlpha);
    graphics.fillCircle(x, y, width * 0.5);
    if (!active && downstream !== undefined && (downstream.terrain.waterBody === 'river' || downstream.terrain.waterBody === 'lake')
      && cell.index < downstream.index) {
      graphics.lineBetween(x, y, (downstream.x + 0.5) * CELL_SIZE, (downstream.y + 0.5) * CELL_SIZE);
    }
  }
}

function drawDryLakeBeds(graphics: Phaser.GameObjects.Graphics, world: NaturalWorldEntity): void {
  const dryCells = world.cells.filter((cell) => cell.terrain.waterBody === 'lake' && cell.water.surfaceMm <= WATER_THRESHOLD_MM);
  for (const component of connectedWaterComponents(dryCells, world)) {
    const indices = new Set(component.map((cell) => cell.index));
    const moisture = component.length === 0
      ? 0
      : component.reduce((sum, cell) => sum + clamp(cell.water.soilMm / Math.max(1, cell.water.capacityMm), 0, 1), 0) / component.length;
    const color = mixColor(0x766f5b, 0x526452, moisture);
    const seed = organicContourSeed(world, component, 1_307);
    for (const contour of traceLakeContours(indices, world.width, world.height)) {
      const smooth = organicWaterContour(contour, seed, 5, 3);
      graphics.fillStyle(color, 0.34);
      graphics.fillPoints(smooth as unknown as Phaser.Math.Vector2[], true);
      graphics.lineStyle(0.8, 0x4c4b3f, 0.24);
      graphics.strokePoints(smooth as unknown as Phaser.Math.Vector2[], true);
    }
    for (const cell of component) {
      if (cell.index % 3 !== 0) continue;
      const x = cell.x * CELL_SIZE;
      const y = cell.y * CELL_SIZE;
      graphics.lineStyle(0.7, 0x4c4b3f, 0.22);
      graphics.lineBetween(x + 5, y + CELL_SIZE * 0.62, x + CELL_SIZE - 5, y + CELL_SIZE * 0.62);
    }
  }
}

function cssColor(color: number): string { return `#${color.toString(16).padStart(6, '0')}`; }

function shiftColor(color: number, offset: number): number {
  const red = clamp(((color >> 16) & 0xff) + offset, 0, 255);
  const green = clamp(((color >> 8) & 0xff) + offset, 0, 255);
  const blue = clamp((color & 0xff) + offset, 0, 255);
  return (red << 16) | (green << 8) | blue;
}

function mixColor(start: number, end: number, fraction: number): number {
  const amount = clamp(fraction, 0, 1);
  const channel = (shift: number): number => Math.round(((start >> shift) & 0xff) * (1 - amount) + ((end >> shift) & 0xff) * amount);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

function coordinateNoise(seed: number, x: number, y: number, salt: number): number {
  let value = (seed ^ Math.imul(x + salt * 17, 0x45d9f3b) ^ Math.imul(y - salt * 11, 0x27d4eb2d)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = (value ^ (value >>> 16)) >>> 0;
  return value / 0x1_0000_0000;
}

function hashText(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return hash >>> 0;
}

function cohort(cell: NaturalWorldCellState, speciesId: PlantSpeciesId): NaturalWorldCellState['plants'][number] | undefined {
  return cell.plants.find((plant) => plant.speciesId === speciesId);
}

function plantStress(plant: PlantCohortState): number {
  if (plant.stress !== undefined) return plant.stress;
  const factors = plant.limitingFactors;
  return factors === undefined ? 1 : Math.min(factors.water, factors.nitrogen, factors.temperature, factors.light);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function renderNow(): number {
  return globalThis.performance?.now() ?? Date.now();
}
