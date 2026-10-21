import Phaser from 'phaser';
import { NATURAL_SCENARIO } from '../core/natural/parameters';
import type { NaturalWorldCellState, NaturalWorldEntity, TreeSpeciesId } from '../core/natural/types';
import { naturalScenarioVersionAtLeast } from '../core/natural/versioning';
import { createWindField } from '../modules/atmosphere/wind/index.js';
import {
  drawProceduralRock,
  generateProceduralRocks,
  ROCK_NATIVE_CELL_SIZE,
  treeBlockingCellsForRocks,
  type ProceduralRock,
} from '../modules/geosphere/rendering/rocks/procedural-rocks';
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
import {
  buildMineralSpatialIndex,
  mineralZoomLevel,
  mineralUsesDetailedRaster,
  queryVisibleMineralFormations,
  MINERAL_SPATIAL_CHUNK_CELLS,
} from './mineral-spatial-index';
import { GrassRenderer, Trees, type TreeSprites } from '../modules/biosphere/flora/rendering';
import { FLORA_TREE_SPECIES } from '../modules/biosphere/flora';
import { treeGrowthVisual } from '../modules/biosphere/flora/rendering/trees/tree-art';
import { buildWaterRibbon, organicWaterContour, smoothOpenWaterPath } from './water-mesh';
import {
  createWaterSurfaceCache,
  takeWaterSurfaceChunkBatch,
  updateWaterSurfaceCache,
  waterSurfaceMaskCode,
  WATER_SURFACE_CHUNK_CELLS,
  type WaterSurfaceCache,
} from './water-surface-cache';
import { buildRainStreaks, meanPrecipitationMm, rainOpacity, RAIN_VISUAL_THRESHOLD_MM } from './rain-effect';
import type { RenderLayerId } from '../client/performance-metrics';

const CELL_SIZE = 40;
const MIN_ZOOM = 0.38;
const MAX_ZOOM = 1.55;
const TERRAIN_TEXTURE_KEY = 'natural-terrain-map';
const WATER_SURFACE_TEXTURE_KEY = 'natural-water-surface-shading';
const WATER_SURFACE_PIXELS_PER_CELL = 5;
const WATER_SURFACE_SHADING_ALPHA = 0.56;
const WATER_THRESHOLD_MM = 10;
const VEGETATION_SHADOW_CHUNK_CELLS = 8;
const HABITAT_CODES: Record<string, number> = { upland: 1, woodland: 2, meadow: 3, wetland: 4, dryland: 5, desert: 6 };
const PLANT_PROFILE_BY_ID = new Map(NATURAL_SCENARIO.plants.map((profile) => [profile.id, profile]));
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
const TERRAIN_LIGHTING_ELEVATION_EPSILON_M = 0.25;
type MapLayers = { relief: boolean; water: boolean; vegetation: boolean; minerals: boolean; geology: boolean };
type TilePoint = { x: number; y: number };
type VegetationRefreshRequest = {
  world: NaturalWorldEntity;
  visualSeed: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  cursor: number;
  grassMs: number;
  visibleShadowChunks: Set<number>;
};
type WaterSurfaceRefreshRequest = {
  world: NaturalWorldEntity;
  waterDepthField: ArrayLike<number>;
  lightingFactors: ArrayLike<number>;
  cacheMs: number;
  maskMs: number;
};
export type FoundationPerformanceHooks = {
  onDynamicLayersMs?: (elapsedMs: number) => void;
  onRenderLayerMs?: (layer: RenderLayerId, elapsedMs: number) => void;
  onVegetationCostsMs?: (grassMs: number, objectsMs: number, shadowsMs: number) => void;
  onWaterMotionMs?: (elapsedMs: number) => void;
  onWaterCostsMs?: (depthMs: number, geometryMs: number, surfaceMs: number) => void;
  onWaterSurfaceCostsMs?: (cacheMs: number, maskMs: number, chunkMs: number, dirtyChunks: number) => void;
  onMineralCatalogMs?: (elapsedMs: number, formationCount: number, visibleCount: number) => void;
  onMineralCreationMs?: (rasterMs: number, spriteMs: number, created: number, pending: number) => void;
};

export class FoundationScene extends Phaser.Scene {
  private terrainImage: Phaser.GameObjects.Image | null = null;
  private terrainTexture: Phaser.Textures.CanvasTexture | null = null;
  private terrainSurfaces: TerrainSurface[] | null = null;
  private waterGraphics: Phaser.GameObjects.Graphics | null = null;
  private waterSurfaceTexture: Phaser.Textures.CanvasTexture | null = null;
  private waterSurfaceImage: Phaser.GameObjects.Image | null = null;
  private waterSurfaceCache: WaterSurfaceCache | null = null;
  private waterSurfaceMaskPath: Path2D | null = null;
  private waterSurfaceMaskCanvas: HTMLCanvasElement | null = null;
  private waterSurfaceMaskContext: CanvasRenderingContext2D | null = null;
  private waterSurfaceChunkCanvas: HTMLCanvasElement | null = null;
  private waterSurfaceChunkContext: CanvasRenderingContext2D | null = null;
  private waterSurfaceNeedsClear = true;
  private waterSurfaceForceRefresh = true;
  private readonly dirtyWaterSurfaceChunks = new Set<number>();
  private waterSurfaceRefreshRequest: WaterSurfaceRefreshRequest | null = null;
  private waterMotionGraphics: Phaser.GameObjects.Graphics | null = null;
  private rainGraphics: Phaser.GameObjects.Graphics | null = null;
  private grassRenderer: GrassRenderer | null = null;
  private readonly windField = createWindField({ seed: 0x51f15e5d, strength: 0.28, direction: 32, gustiness: 0.65, turbulence: 0.42, flowSpeed: 1.1 });
  private readonly treeShadowGraphics = new Map<number, Phaser.GameObjects.Graphics>();
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
  private mineralSprites = new Map<number, Phaser.GameObjects.Image | Phaser.GameObjects.Graphics>();
  private mineralTextureKeys = new Map<number, string>();
  private mineralFormations: ProceduralRock[] = [];
  private mineralSpatialChunks = new Map<number, number[]>();
  private mineralVisibleIndices = new Set<number>();
  private mineralRefreshQueue: number[] = [];
  private mineralRefreshCursor = 0;
  private mineralViewportKey = '';
  private mineralVisualSeed = 0;
  private mineralSpritesWorldKey: string | null = null;
  private rockTreeBlockedCells = new Set<number>();
  private layers: MapLayers = { relief: true, water: true, vegetation: true, minerals: true, geology: false };
  private selectedCellIndex: number | null = null;
  private onCellSelected: (index: number | null) => void = () => undefined;
  private dragStart: { x: number; y: number; scrollX: number; scrollY: number; moved: boolean } | null = null;
  private cameraManuallyAdjusted = false;
  private waterAnimationClockMs = 0;
  private waterAnimationBucket = -1;
  private waterMotionCellIndices: number[] = [];
  private vegetationViewportKey = '';
  private vegetationCellSignatures: number[] = [];
  private vegetationShadowCellSignatures: number[] = [];
  private readonly dirtyVegetationShadowChunks = new Set<number>();
  private vegetationShadowChunkColumns = 0;
  private vegetationRefreshRequest: VegetationRefreshRequest | null = null;
  private rainAnimationClockMs = 0;
  private rainAnimationBucket = -1;
  private meanRainMm = 0;
  private performanceHooks: FoundationPerformanceHooks = {};

  constructor() {
    super('foundation');
  }

  create(): void {
    Trees.createProceduralAtlas(this);
    this.cameras.main.setBackgroundColor('#24392a');
    this.terrainImage = null;
    this.waterGraphics = this.add.graphics().setDepth(2.25);
    this.waterMotionGraphics = this.add.graphics().setDepth(2.32);
    this.rainGraphics = this.add.graphics().setDepth(4.8).setVisible(false);
    this.grassRenderer = new GrassRenderer(this, CELL_SIZE, this.windField);
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

  override update(time: number, delta: number): void {
    if (this.naturalWorld === null) return;
    this.grassRenderer?.updateWind(delta, time);
    Trees.updateWind(time, this.windField, this.cameras.main.worldView);
    const nextVegetationViewportKey = this.currentVegetationViewportKey();
    if (nextVegetationViewportKey !== this.vegetationViewportKey) {
      this.vegetationViewportKey = nextVegetationViewportKey;
      this.measureLayer('vegetation', () => this.drawVegetation());
    }
    if (this.vegetationRefreshRequest !== null) {
      this.measureLayer('vegetation', () => this.processVegetationRefresh(3));
    }
    const treeFrameWork = Trees.processFrameQueue(3);
    if (treeFrameWork.renderedFrames > 0) this.performanceHooks.onVegetationCostsMs?.(0, treeFrameWork.elapsedMs, 0);
    if (this.naturalWorld !== null && this.mineralSpritesWorldKey === this.mapKey) {
      const mineralViewportKey = this.currentMineralViewportKey();
      if (mineralViewportKey !== this.mineralViewportKey) this.syncMineralViewport(this.naturalWorld);
      if (this.layers.minerals && this.mineralRefreshCursor < this.mineralRefreshQueue.length) {
        this.measureLayer('minerals', () => this.processMineralRefresh(3));
      }
    }
    if (this.layers.water && this.waterSurfaceRefreshRequest !== null) {
      this.measureLayer('water', () => this.processWaterSurfaceChunks(3));
    }
    this.waterAnimationClockMs = (this.waterAnimationClockMs + delta) % 8_000;
    this.rainAnimationClockMs += Math.max(0, delta);
    const rainBucket = Math.floor(this.rainAnimationClockMs / 72);
    if (rainBucket !== this.rainAnimationBucket) {
      this.rainAnimationBucket = rainBucket;
      if (this.meanRainMm > RAIN_VISUAL_THRESHOLD_MM || this.rainGraphics?.visible) this.drawRain();
    }
    if (this.waterMotionGraphics === null) return;
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
      this.meanRainMm = 0;
      this.rainGraphics?.clear().setVisible(false);
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
    this.meanRainMm = meanPrecipitationMm(world.cells);
    if (this.meanRainMm <= RAIN_VISUAL_THRESHOLD_MM) this.rainGraphics?.clear().setVisible(false);
    if (needsRebuild) {
      this.mapKey = worldKey;
      this.selectedCellIndex = null;
      this.onCellSelected(null);
      this.cameraManuallyAdjusted = false;
      this.buildTerrain();
    } else if (terrainChanged) {
      this.renderTerrainTexture(createTerrainLightingDirtyMask(world.width, world.height, changedTerrainCells));
      this.reliefWorldKey = null;
      this.waterSurfaceForceRefresh = true;
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
    if (layers.water !== undefined && layers.water !== this.layers.water) {
      this.waterSurfaceForceRefresh = true;
      if (!layers.water) {
        this.dirtyWaterSurfaceChunks.clear();
        this.waterSurfaceRefreshRequest = null;
      }
    }
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
    this.waterSurfaceForceRefresh = true;
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
    this.waterSurfaceCache = null;
    this.waterSurfaceMaskPath = null;
    this.dirtyWaterSurfaceChunks.clear();
    this.waterSurfaceRefreshRequest = null;
    this.waterSurfaceNeedsClear = true;
    this.waterSurfaceForceRefresh = true;
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
    this.destroyVegetationShadowGraphics();
    this.vegetationCellSignatures = new Array(world.cells.length).fill(-1);
    this.vegetationShadowCellSignatures = new Array(world.cells.length).fill(-1);
    this.vegetationShadowChunkColumns = Math.ceil(world.width / VEGETATION_SHADOW_CHUNK_CELLS);
    this.dirtyVegetationShadowChunks.clear();
    this.treeSprites = world.cells.map(Trees.emptySprites);
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
      this.measureLayer('relief', () => this.drawRelief());
      this.measureLayer('geology', () => this.drawGeologyPotential());
      this.measureLayer('water', () => this.drawWater());
      this.drawWaterMotion();
      this.measureLayer('minerals', () => this.drawMinerals());
      this.measureLayer('vegetation', () => this.drawVegetation());
    } finally {
      if (startedAt !== null) this.performanceHooks.onDynamicLayersMs?.(Math.max(0, renderNow() - startedAt));
    }
  }

  private measureLayer(layer: RenderLayerId, draw: () => void): void {
    const hook = this.performanceHooks.onRenderLayerMs;
    if (hook === undefined) {
      draw();
      return;
    }
    const startedAt = renderNow();
    try {
      draw();
    } finally {
      hook(layer, Math.max(0, renderNow() - startedAt));
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
    const revisionKey = `${this.mapKey}:${world.width}x${world.height}`;
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
    if (!this.layers.water) {
      this.waterMotionCellIndices = [];
      return;
    }
    const waterCostHook = this.performanceHooks.onWaterCostsMs;
    const depthStartedAt = waterCostHook === undefined ? null : renderNow();
    const waterDepthField = buildWaterDepthField(world);
    const depthMs = depthStartedAt === null ? 0 : Math.max(0, renderNow() - depthStartedAt);
    const lightingFactors = this.terrainLightingFactors ?? new Float32Array(world.cells.length).fill(1);
    const geometryStartedAt = waterCostHook === undefined ? null : renderNow();
    const lakeCells: NaturalWorldCellState[] = [];
    const ephemeralWaterCells: NaturalWorldCellState[] = [];
    const waterMotionCellIndices: number[] = [];
    for (const cell of world.cells) {
      const surface = cell.water.surfaceMm;
      const runoffOut = cell.water.lastFlows.runoffOutMm ?? 0;
      const permanentRiverFlow = cell.terrain.waterBody === 'river' && isActiveRiverCell(cell);
      if ((permanentRiverFlow && cell.index % 2 === 0)
        || (!permanentRiverFlow && runoffOut > 0.35 && cell.index % 3 === 0 && cell.index % 11 === 0)
        || (cell.terrain.waterBody === 'lake' && surface > WATER_THRESHOLD_MM && cell.index % 19 === 0)) {
        waterMotionCellIndices.push(cell.index);
      }
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
    const geometryMs = geometryStartedAt === null ? 0 : Math.max(0, renderNow() - geometryStartedAt);
    const surfaceStartedAt = waterCostHook === undefined ? null : renderNow();
    this.drawWaterSurfaceShading(world, waterDepthField, lightingFactors);
    if (surfaceStartedAt !== null) waterCostHook?.(depthMs, geometryMs, Math.max(0, renderNow() - surfaceStartedAt));
    this.waterMotionCellIndices = waterMotionCellIndices;
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
      this.waterSurfaceCache = null;
      this.waterSurfaceMaskPath = null;
      this.waterSurfaceNeedsClear = true;
    }
    const image = this.waterSurfaceImage;
    if (image === null) return;
    image.setDisplaySize(world.width * CELL_SIZE, world.height * CELL_SIZE).setVisible(true);
    const wasCleared = this.waterSurfaceNeedsClear;
    if (this.waterSurfaceNeedsClear) {
      texture.context.clearRect(0, 0, width, height);
      this.waterSurfaceNeedsClear = false;
    }
    const cache = this.waterSurfaceCache ?? createWaterSurfaceCache(world.width, world.height);
    this.waterSurfaceCache = cache;
    const surfaceCacheStartedAt = this.performanceHooks.onWaterSurfaceCostsMs === undefined ? null : renderNow();
    const dirty = updateWaterSurfaceCache(
      cache,
      world.cells,
      waterDepthField,
      lightingFactors,
      this.waterSurfaceForceRefresh,
    );
    const cacheMs = surfaceCacheStartedAt === null ? 0 : Math.max(0, renderNow() - surfaceCacheStartedAt);
    this.waterSurfaceForceRefresh = false;
    const maskStartedAt = this.performanceHooks.onWaterSurfaceCostsMs === undefined ? null : renderNow();
    if (dirty.maskChanged || this.waterSurfaceMaskPath === null) {
      this.waterSurfaceMaskPath = buildWaterSurfaceMaskPath(world);
      this.refreshWaterSurfaceMask(width, height, this.waterSurfaceMaskPath);
    }
    const maskMs = maskStartedAt === null ? 0 : Math.max(0, renderNow() - maskStartedAt);
    if (this.waterSurfaceMaskCanvas === null) {
      if (wasCleared) texture.refresh();
      return;
    }
    for (const chunk of dirty.dirtyChunks) this.dirtyWaterSurfaceChunks.add(chunk);
    if (this.dirtyWaterSurfaceChunks.size > 0) {
      this.waterSurfaceRefreshRequest = { world, waterDepthField, lightingFactors, cacheMs, maskMs };
    } else {
      this.waterSurfaceRefreshRequest = null;
      if (wasCleared) texture.refresh();
      this.performanceHooks.onWaterSurfaceCostsMs?.(cacheMs, maskMs, 0, 0);
    }
  }

  private processWaterSurfaceChunks(budgetMs: number): void {
    const request = this.waterSurfaceRefreshRequest;
    const texture = this.waterSurfaceTexture;
    const maskCanvas = this.waterSurfaceMaskCanvas;
    if (request === null || texture === null || maskCanvas === null || this.dirtyWaterSurfaceChunks.size === 0) {
      this.waterSurfaceRefreshRequest = null;
      return;
    }
    const startedAt = renderNow();
    const batch = takeWaterSurfaceChunkBatch(this.dirtyWaterSurfaceChunks, 4);
    let processedCount = 0;
    const processed = this.drawWaterSurfaceChunks(
      texture.context,
      request.world,
      request.waterDepthField,
      request.lightingFactors,
      batch,
      maskCanvas,
      () => processedCount === 0 || renderNow() - startedAt < budgetMs,
      () => { processedCount += 1; },
    );
    for (let index = 0; index < processed; index += 1) {
      const chunk = batch[index];
      if (chunk !== undefined) this.dirtyWaterSurfaceChunks.delete(chunk);
    }
    if (processed > 0) texture.refresh();
    const elapsedMs = Math.max(0, renderNow() - startedAt);
    this.performanceHooks.onWaterSurfaceCostsMs?.(request.cacheMs, request.maskMs, elapsedMs, processed);
    if (this.dirtyWaterSurfaceChunks.size === 0) this.waterSurfaceRefreshRequest = null;
  }

  private refreshWaterSurfaceMask(width: number, height: number, maskPath: Path2D): void {
    if (this.waterSurfaceMaskCanvas === null || this.waterSurfaceMaskContext === null
      || this.waterSurfaceMaskCanvas.width !== width || this.waterSurfaceMaskCanvas.height !== height) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const maskContext = canvas.getContext('2d');
      if (maskContext === null) return;
      this.waterSurfaceMaskCanvas = canvas;
      this.waterSurfaceMaskContext = maskContext;
    }
    const context = this.waterSurfaceMaskContext;
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#ffffff';
    context.save();
    context.filter = `blur(${1.25 * WATER_SURFACE_PIXELS_PER_CELL / 10}px)`;
    context.fill(maskPath);
    context.restore();
    context.fillStyle = '#ffffff';
    context.fill(maskPath);
  }

  private drawWaterSurfaceChunks(
    context: CanvasRenderingContext2D,
    world: NaturalWorldEntity,
    waterDepthField: ArrayLike<number>,
    lightingFactors: ArrayLike<number>,
    dirtyChunks: readonly number[],
    maskCanvas: HTMLCanvasElement,
    canDrawNextChunk: () => boolean = () => true,
    onChunkDrawn: () => void = () => undefined,
  ): number {
    if (this.waterSurfaceChunkCanvas === null || this.waterSurfaceChunkContext === null) {
      const canvas = document.createElement('canvas');
      canvas.width = WATER_SURFACE_CHUNK_CELLS * WATER_SURFACE_PIXELS_PER_CELL;
      canvas.height = WATER_SURFACE_CHUNK_CELLS * WATER_SURFACE_PIXELS_PER_CELL;
      const chunkContext = canvas.getContext('2d');
      if (chunkContext === null) return 0;
      this.waterSurfaceChunkCanvas = canvas;
      this.waterSurfaceChunkContext = chunkContext;
    }
    const chunkCanvas = this.waterSurfaceChunkCanvas;
    const chunkContext = this.waterSurfaceChunkContext;
    const chunkColumns = Math.ceil(world.width / WATER_SURFACE_CHUNK_CELLS);
    let drawnChunks = 0;
    for (const chunk of dirtyChunks) {
      if (!canDrawNextChunk()) break;
      const chunkX = chunk % chunkColumns;
      const chunkY = Math.floor(chunk / chunkColumns);
      const minCellX = chunkX * WATER_SURFACE_CHUNK_CELLS;
      const minCellY = chunkY * WATER_SURFACE_CHUNK_CELLS;
      const maxCellX = Math.min(world.width, minCellX + WATER_SURFACE_CHUNK_CELLS);
      const maxCellY = Math.min(world.height, minCellY + WATER_SURFACE_CHUNK_CELLS);
      const pixelX = minCellX * WATER_SURFACE_PIXELS_PER_CELL;
      const pixelY = minCellY * WATER_SURFACE_PIXELS_PER_CELL;
      const pixelWidth = (maxCellX - minCellX) * WATER_SURFACE_PIXELS_PER_CELL;
      const pixelHeight = (maxCellY - minCellY) * WATER_SURFACE_PIXELS_PER_CELL;
      chunkContext.clearRect(0, 0, pixelWidth, pixelHeight);
      const chunkPixels = chunkContext.createImageData(pixelWidth, pixelHeight);
      for (let cellY = minCellY; cellY < maxCellY; cellY += 1) {
        for (let cellX = minCellX; cellX < maxCellX; cellX += 1) {
          const cell = world.cells[cellY * world.width + cellX];
          if (cell === undefined || waterSurfaceMaskCode(cell) === 0) continue;
          const quadrantColors: number[] = [];
          for (let quadrantY = 0; quadrantY < 2; quadrantY += 1) {
            const sampleY = cellY + (quadrantY === 0 ? -0.25 : 0.25);
            for (let quadrantX = 0; quadrantX < 2; quadrantX += 1) {
              const sampleX = cellX + (quadrantX === 0 ? -0.25 : 0.25);
              const depth = sampleCellFieldBilinear(world.width, world.height, waterDepthField, sampleX, sampleY);
              const light = sampleCellFieldBilinear(world.width, world.height, lightingFactors, sampleX, sampleY);
              quadrantColors.push(shadeWaterColor(waterDepthColor(depth), light));
            }
          }
          for (let subY = 0; subY < WATER_SURFACE_PIXELS_PER_CELL; subY += 1) {
            for (let subX = 0; subX < WATER_SURFACE_PIXELS_PER_CELL; subX += 1) {
              const quadrant = (subY < WATER_SURFACE_PIXELS_PER_CELL / 2 ? 0 : 2)
                + (subX < WATER_SURFACE_PIXELS_PER_CELL / 2 ? 0 : 1);
              const color = quadrantColors[quadrant] ?? quadrantColors[3] ?? 0;
              const localX = (cellX - minCellX) * WATER_SURFACE_PIXELS_PER_CELL + subX;
              const localY = (cellY - minCellY) * WATER_SURFACE_PIXELS_PER_CELL + subY;
              const offset = (localY * pixelWidth + localX) * 4;
              chunkPixels.data[offset] = (color >>> 16) & 0xff;
              chunkPixels.data[offset + 1] = (color >>> 8) & 0xff;
              chunkPixels.data[offset + 2] = color & 0xff;
              chunkPixels.data[offset + 3] = Math.round(255 * WATER_SURFACE_SHADING_ALPHA);
            }
          }
        }
      }
      chunkContext.putImageData(chunkPixels, 0, 0);
      chunkContext.globalCompositeOperation = 'destination-in';
      chunkContext.drawImage(maskCanvas, pixelX, pixelY, pixelWidth, pixelHeight, 0, 0, pixelWidth, pixelHeight);
      chunkContext.globalCompositeOperation = 'source-over';
      context.clearRect(pixelX, pixelY, pixelWidth, pixelHeight);
      context.drawImage(chunkCanvas, 0, 0, pixelWidth, pixelHeight, pixelX, pixelY, pixelWidth, pixelHeight);
      drawnChunks += 1;
      onChunkDrawn();
    }
    return drawnChunks;
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
      const view = this.cameras.main.worldView;
      for (const cellIndex of this.waterMotionCellIndices) {
        const cell = world.cells[cellIndex];
        if (cell === undefined) continue;
        const cellWorldX=cell.x*CELL_SIZE,cellWorldY=cell.y*CELL_SIZE;
        if (cellWorldX < view.x - CELL_SIZE || cellWorldY < view.y - CELL_SIZE
          || cellWorldX > view.right + CELL_SIZE || cellWorldY > view.bottom + CELL_SIZE) continue;
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

  private drawRain(): void {
    const world = this.naturalWorld;
    const graphics = this.rainGraphics;
    if (world === null || graphics === null) return;

    graphics.clear();
    const streaks = buildRainStreaks(
      world.width * CELL_SIZE,
      world.height * CELL_SIZE,
      CELL_SIZE,
      hashText(world.id),
      this.rainAnimationClockMs,
      this.meanRainMm,
    );
    if (streaks.length === 0) {
      graphics.setVisible(false);
      return;
    }

    graphics.setVisible(true);
    for (const opacityBand of [0, 1, 2] as const) {
      graphics.lineStyle(2.5, 0xc8eff7, rainOpacity(this.meanRainMm, opacityBand));
      for (const streak of streaks) {
        if (streak.opacityBand !== opacityBand) continue;
        graphics.lineBetween(streak.x, streak.y, streak.endX, streak.endY);
      }
    }
  }

  private drawVegetation(): void {
    const world = this.naturalWorld;
    if (world === null) return;
    const visualSeed = hashText(this.mapKey ?? 'natural-world');
    const grassStarted = renderNow();
    this.grassRenderer?.sync(world, visualSeed, this.rockTreeBlockedCells, this.layers.vegetation);
    const grassMs = Math.max(0, renderNow() - grassStarted);
    const cameraView = this.cameras.main.worldView;
    this.vegetationRefreshRequest = {
      world,
      visualSeed,
      minX: Math.max(0, Math.floor(cameraView.x / CELL_SIZE) - 3),
      maxX: Math.min(world.width - 1, Math.ceil(cameraView.right / CELL_SIZE) + 3),
      minY: Math.max(0, Math.floor(cameraView.y / CELL_SIZE) - 5),
      maxY: Math.min(world.height - 1, Math.ceil(cameraView.bottom / CELL_SIZE) + 2),
      cursor: 0,
      grassMs,
      visibleShadowChunks: new Set<number>(),
    };
    this.vegetationViewportKey = this.currentVegetationViewportKey();
  }

  private processVegetationRefresh(budgetMs: number): void {
    const request = this.vegetationRefreshRequest;
    if (request === null || request.world !== this.naturalWorld) return;
    const world = request.world;
    const hasGeomorphology = naturalScenarioVersionAtLeast(world.scenarioVersion, '1.6.0');
    const objectsStarted = renderNow();
    const treePlants: Array<NaturalWorldCellState['plants'][number] | undefined> = new Array(FLORA_TREE_SPECIES.length);
    const columns = Math.max(1, request.maxX - request.minX + 1);
    const total = columns * Math.max(0, request.maxY - request.minY + 1);
    while (request.cursor < total) {
      const localIndex = request.cursor++;
      const x = request.minX + localIndex % columns;
      const y = request.minY + Math.floor(localIndex / columns);
      const cell = world.cells[y * world.width + x];
      if (cell !== undefined) {
        const waterBody = cell.terrain.waterBody ?? 'none';
        const rockBlocksCell = this.rockTreeBlockedCells.has(cell.index);
        const treesAllowed = waterBody === 'none' && !cell.terrain.exposedRock && !rockBlocksCell;
        const groundcoverAllowed = !rockBlocksCell && (treesAllowed || (hasGeomorphology && cell.water.surfaceMm < 8));
        const visibleTrees = this.layers.vegetation && treesAllowed;
        const visibleGroundcover = this.layers.vegetation && groundcoverAllowed;
        const chunkX = Math.floor(x / VEGETATION_SHADOW_CHUNK_CELLS);
        const chunkY = Math.floor(y / VEGETATION_SHADOW_CHUNK_CELLS);
        const shadowChunkKey = chunkY * this.vegetationShadowChunkColumns + chunkX;
        fillFloraPlantsForCell(cell, treePlants);
        const visualSignature = vegetationCellVisualSignature(cell, treePlants, visibleTrees, visibleGroundcover);
        const previousSignature = this.vegetationCellSignatures[cell.index];
        if (previousSignature !== visualSignature) {
          this.vegetationCellSignatures[cell.index] = visualSignature;
          const sprites = this.treeSprites[cell.index];
          for (let treeIndex = 0; treeIndex < FLORA_TREE_SPECIES.length; treeIndex += 1) {
            const speciesId = FLORA_TREE_SPECIES[treeIndex]!;
            Trees.update(this, world, sprites, speciesId, treePlants[treeIndex], cell, visibleTrees, CELL_SIZE, request.visualSeed);
          }
          const shadowSignature = visibleGroundcover ? treeShadowVisualCode(treePlants, visibleTrees) : 0;
          if (this.vegetationShadowCellSignatures[cell.index] !== shadowSignature) {
            this.vegetationShadowCellSignatures[cell.index] = shadowSignature;
            this.dirtyVegetationShadowChunks.add(shadowChunkKey);
          }
        }
        if (visibleGroundcover || this.dirtyVegetationShadowChunks.has(shadowChunkKey)) request.visibleShadowChunks.add(shadowChunkKey);
      }
      if (renderNow() - objectsStarted >= budgetMs) break;
    }
    const objectsMs = Math.max(0, renderNow() - objectsStarted);
    const shadowsStarted = renderNow();
    let shadowChunksRendered = 0;
    for (const chunkKey of request.visibleShadowChunks) {
      if (!this.dirtyVegetationShadowChunks.has(chunkKey)) continue;
      this.drawVegetationShadowChunk(chunkKey);
      shadowChunksRendered += 1;
      if (shadowChunksRendered > 0 && renderNow() - shadowsStarted >= budgetMs) break;
    }
    const shadowsMs = Math.max(0, renderNow() - shadowsStarted);
    this.performanceHooks.onVegetationCostsMs?.(request.grassMs, objectsMs, shadowsMs);
    request.grassMs = 0;
    if (request.cursor >= total && ![...request.visibleShadowChunks].some((chunkKey) => this.dirtyVegetationShadowChunks.has(chunkKey))) {
      this.vegetationRefreshRequest = null;
    }
  }

  private drawVegetationShadowChunk(chunkKey: number): void {
    const world = this.naturalWorld;
    if (world === null || this.vegetationShadowChunkColumns === 0) return;
    let graphics = this.treeShadowGraphics.get(chunkKey);
    if (graphics === undefined) {
      graphics = this.add.graphics().setDepth(2.5);
      this.treeShadowGraphics.set(chunkKey, graphics);
    }
    graphics.clear();
    const chunkX = chunkKey % this.vegetationShadowChunkColumns;
    const chunkY = Math.floor(chunkKey / this.vegetationShadowChunkColumns);
    const startX = chunkX * VEGETATION_SHADOW_CHUNK_CELLS;
    const startY = chunkY * VEGETATION_SHADOW_CHUNK_CELLS;
    const endX = Math.min(world.width, startX + VEGETATION_SHADOW_CHUNK_CELLS);
    const endY = Math.min(world.height, startY + VEGETATION_SHADOW_CHUNK_CELLS);
    if (!this.layers.vegetation) {
      this.dirtyVegetationShadowChunks.delete(chunkKey);
      return;
    }
    const hasGeomorphology = naturalScenarioVersionAtLeast(world.scenarioVersion, '1.6.0');
    const trees: Array<NaturalWorldCellState['plants'][number] | undefined> = new Array(FLORA_TREE_SPECIES.length);
    for (let y = startY; y < endY; y += 1) {
      for (let x = startX; x < endX; x += 1) {
        const cell = world.cells[y * world.width + x];
        if (cell === undefined) continue;
        const waterBody = cell.terrain.waterBody ?? 'none';
        const rockBlocksCell = this.rockTreeBlockedCells.has(cell.index);
        const treesAllowed = waterBody === 'none' && !cell.terrain.exposedRock && !rockBlocksCell;
        const groundcoverAllowed = !rockBlocksCell && (treesAllowed || (hasGeomorphology && cell.water.surfaceMm < 8));
        if (!groundcoverAllowed) continue;
        fillFloraPlantsForCell(cell, trees);
        for (let treeIndex = 0; treeIndex < FLORA_TREE_SPECIES.length; treeIndex += 1) {
          Trees.shadow(graphics, trees[treeIndex], cell, FLORA_TREE_SPECIES[treeIndex]!, CELL_SIZE);
        }
      }
    }
    this.dirtyVegetationShadowChunks.delete(chunkKey);
  }

  private drawMinerals(): void {
    const world = this.naturalWorld;
    if (world === null) return;
    const worldKey = this.mapKey ?? 'natural-world';
    if (this.mineralSpritesWorldKey !== worldKey) this.buildMineralFormations(world, hashText(worldKey));
    this.syncMineralViewport(world);
  }

  private currentMineralViewportKey(): string {
    const view = this.cameras.main.worldView;
    const zoomLevel = mineralZoomLevel(this.cameras.main.zoomX);
    return [
      Math.floor(view.x / CELL_SIZE), Math.floor(view.y / CELL_SIZE),
      Math.ceil(view.right / CELL_SIZE), Math.ceil(view.bottom / CELL_SIZE),
      zoomLevel, mineralUsesDetailedRaster(this.cameras.main.zoomX) ? 1 : 0, this.layers.minerals ? 1 : 0,
    ].join(':');
  }

  private syncMineralViewport(world: NaturalWorldEntity): void {
    const viewportKey = this.currentMineralViewportKey();
    if (viewportKey === this.mineralViewportKey) return;
    const nextVisible = this.layers.minerals ? this.visibleMineralFormations(world) : new Set<number>();
    for (const index of this.mineralVisibleIndices) {
      if (nextVisible.has(index)) continue;
      this.mineralSprites.get(index)?.setVisible(false);
    }
    const missingTextureIndices: number[] = [];
    const useDetailedRaster = mineralUsesDetailedRaster(this.cameras.main.zoomX);
    for (const index of nextVisible) {
      let sprite = this.mineralSprites.get(index);
      const hasDetailedTexture = this.mineralTextureKeys.has(index);
      if (sprite !== undefined && useDetailedRaster && !hasDetailedTexture) {
        sprite.destroy();
        this.mineralSprites.delete(index);
        sprite = undefined;
      }
      if (sprite !== undefined) {
        sprite.setVisible(true);
      } else if (!useDetailedRaster) {
        const rock = this.mineralFormations[index];
        if (rock !== undefined) this.mineralSprites.set(index, this.createMineralLodSprite(rock, world));
      } else if (!this.mineralTextureKeys.has(index)) {
        missingTextureIndices.push(index);
      }
    }
    this.mineralVisibleIndices = nextVisible;
    this.mineralRefreshQueue = missingTextureIndices;
    this.mineralRefreshCursor = 0;
    this.mineralViewportKey = viewportKey;
  }

  private createMineralLodSprite(rock: ProceduralRock, world: NaturalWorldEntity): Phaser.GameObjects.Graphics {
    const graphics = this.add.graphics();
    const scale = (CELL_SIZE / ROCK_NATIVE_CELL_SIZE) * rock.visualScale;
    const width = rock.raster.width * scale;
    const height = rock.raster.height * scale;
    graphics.setPosition(
      rock.xCell * CELL_SIZE - rock.raster.anchorX * scale,
      rock.yCell * CELL_SIZE - rock.raster.anchorY * scale,
    ).setDepth(worldObjectDepth(rock.yCell, world.height, 0.002));
    const palette = mineralLodPalette(rock.resourceId);
    const points: Array<[number, number]> = rock.deposit.family === 'column' || rock.deposit.family === 'shard'
      ? [[0.50, 0.04], [0.73, 0.46], [0.91, 0.82], [0.79, 0.94], [0.19, 0.94], [0.08, 0.82], [0.31, 0.42]]
      : rock.deposit.family === 'plate'
        ? [[0.11, 0.63], [0.26, 0.24], [0.61, 0.20], [0.89, 0.55], [0.96, 0.83], [0.82, 0.94], [0.12, 0.91]]
        : [[0.49, 0.13], [0.76, 0.30], [0.91, 0.65], [0.78, 0.91], [0.27, 0.95], [0.09, 0.72], [0.21, 0.43]];
    graphics.fillStyle(palette.base, 1);
    graphics.beginPath();
    const [firstX, firstY] = points[0] ?? [0, 0];
    graphics.moveTo(width * firstX, height * firstY);
    for (const [pointX, pointY] of points.slice(1)) graphics.lineTo(width * pointX, height * pointY);
    graphics.closePath();
    graphics.fillPath();
    graphics.fillStyle(palette.light, 0.9);
    graphics.beginPath();
    graphics.moveTo(width * 0.50, height * 0.13);
    graphics.lineTo(width * 0.32, height * 0.45);
    graphics.lineTo(width * 0.52, height * 0.69);
    graphics.lineTo(width * 0.64, height * 0.39);
    graphics.closePath();
    graphics.fillPath();
    graphics.lineStyle(Math.max(1, scale * 0.7), palette.shadow, 0.88);
    graphics.beginPath();
    graphics.moveTo(width * 0.10, height * 0.80);
    graphics.lineTo(width * 0.22, height * 0.42);
    graphics.lineTo(width * 0.50, height * 0.10);
    graphics.lineTo(width * 0.78, height * 0.38);
    graphics.lineTo(width * 0.92, height * 0.79);
    graphics.strokePath();
    return graphics;
  }

  private visibleMineralFormations(world: NaturalWorldEntity): Set<number> {
    const view = this.cameras.main.worldView;
    return queryVisibleMineralFormations(
      this.mineralFormations,
      this.mineralSpatialChunks,
      world.width,
      world.height,
      {
        left: Math.floor(view.x / CELL_SIZE) - 1,
        top: Math.floor(view.y / CELL_SIZE) - 1,
        right: Math.ceil(view.right / CELL_SIZE) + 1,
        bottom: Math.ceil(view.bottom / CELL_SIZE) + 1,
      },
      this.cameras.main.zoomX,
      ROCK_NATIVE_CELL_SIZE,
    );
  }

  private processMineralRefresh(budgetMs: number): void {
    const world = this.naturalWorld;
    if (world === null || !this.layers.minerals) return;
    const startedAt = renderNow();
    let rasterMs = 0;
    let spriteMs = 0;
    let created = 0;
    while (this.mineralRefreshCursor < this.mineralRefreshQueue.length) {
      const index = this.mineralRefreshQueue[this.mineralRefreshCursor++]!;
      if (!this.mineralVisibleIndices.has(index) || this.mineralSprites.has(index)) continue;
      const rock = this.mineralFormations[index];
      if (rock === undefined) continue;
      const textureKey = `natural-rock-v23-${this.mineralVisualSeed}-${index}`;
      const texture = this.textures.createCanvas(textureKey, rock.raster.width, rock.raster.height);
      const context = texture?.getContext();
      if (texture === null || context === undefined) continue;
      const rasterStarted = renderNow();
      drawProceduralRock(context, rock);
      texture.refresh();
      rasterMs += Math.max(0, renderNow() - rasterStarted);
      this.mineralTextureKeys.set(index, textureKey);
      const spriteStarted = renderNow();
      const sprite = this.add.image(rock.xCell * CELL_SIZE, rock.yCell * CELL_SIZE, textureKey);
      sprite.setOrigin(rock.raster.anchorX / rock.raster.width, rock.raster.anchorY / rock.raster.height)
        .setDepth(worldObjectDepth(rock.yCell, world.height, 0.002))
        .setScale((CELL_SIZE / ROCK_NATIVE_CELL_SIZE) * rock.visualScale);
      this.mineralSprites.set(index, sprite);
      spriteMs += Math.max(0, renderNow() - spriteStarted);
      created += 1;
      if (created > 0 && renderNow() - startedAt >= budgetMs) break;
    }
    this.performanceHooks.onMineralCreationMs?.(rasterMs, spriteMs, created, this.mineralRefreshQueue.length - this.mineralRefreshCursor);
    if (this.mineralRefreshCursor >= this.mineralRefreshQueue.length) {
      this.mineralRefreshQueue = [];
      this.mineralRefreshCursor = 0;
    }
  }

  private currentVegetationViewportKey(): string {
    const view = this.cameras.main.worldView;
    return [
      Math.floor(view.x / CELL_SIZE), Math.floor(view.y / CELL_SIZE),
      Math.ceil(view.right / CELL_SIZE), Math.ceil(view.bottom / CELL_SIZE),
    ].join(':');
  }

  private buildMineralFormations(world: NaturalWorldEntity, visualSeed: number): void {
    this.destroyMineralSprites();
    this.mineralSpritesWorldKey = this.mapKey ?? 'natural-world';
    this.mineralVisualSeed = visualSeed;
    const catalogStarted = renderNow();
    this.mineralFormations = generateProceduralRocks(world, visualSeed);
    this.rockTreeBlockedCells = treeBlockingCellsForRocks(this.mineralFormations, world.width, world.height);
    this.mineralSpatialChunks = buildMineralSpatialIndex(
      this.mineralFormations,
      world.width,
      world.height,
      ROCK_NATIVE_CELL_SIZE,
      MINERAL_SPATIAL_CHUNK_CELLS,
    );
    this.mineralViewportKey = '';
    this.syncMineralViewport(world);
    const catalogMs = Math.max(0, renderNow() - catalogStarted);
    this.performanceHooks.onMineralCatalogMs?.(catalogMs, this.mineralFormations.length, this.mineralVisibleIndices.size);
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
    this.waterSurfaceCache = null;
    this.waterSurfaceMaskPath = null;
    this.dirtyWaterSurfaceChunks.clear();
    this.waterSurfaceRefreshRequest = null;
    this.waterSurfaceMaskCanvas = null;
    this.waterSurfaceMaskContext = null;
    this.waterSurfaceChunkCanvas = null;
    this.waterSurfaceChunkContext = null;
    this.waterSurfaceNeedsClear = true;
    this.waterSurfaceForceRefresh = true;
    if (this.textures.exists(WATER_SURFACE_TEXTURE_KEY)) this.textures.remove(WATER_SURFACE_TEXTURE_KEY);
    this.reliefGraphics?.clear();
    this.reliefGraphics?.setVisible(false);
    this.waterMotionGraphics?.clear();
    this.waterMotionCellIndices = [];
    this.rainGraphics?.clear().setVisible(false);
    this.waterGraphics?.clear();
    this.grassRenderer?.dispose();
    this.destroyVegetationShadowGraphics();
    this.vegetationCellSignatures = [];
    this.vegetationShadowCellSignatures = [];
    this.vegetationShadowChunkColumns = 0;
    this.dirtyVegetationShadowChunks.clear();
    this.vegetationRefreshRequest = null;
    this.geologyGraphics?.clear();
    this.selectionGraphics?.clear();
    this.destroyTreeSprites();
    this.destroyMineralSprites();
    this.naturalWorld = null;
    this.mapKey = null;
    this.vegetationViewportKey = '';
    this.selectedCellIndex = null;
    this.onCellSelected(null);
  }

  private destroyTreeSprites(): void {
    for (const group of this.treeSprites) {
      for (const pair of Object.values(group)) {
        pair.wood?.destroy();
        pair.canopy?.destroy();
      }
    }
    this.treeSprites = [];
  }

  private destroyVegetationShadowGraphics(): void {
    for (const graphics of this.treeShadowGraphics.values()) graphics.destroy();
    this.treeShadowGraphics.clear();
  }

  private destroyMineralSprites(): void {
    for (const sprite of this.mineralSprites.values()) sprite.destroy();
    this.mineralSprites.clear();
    for (const key of this.mineralTextureKeys.values()) if (this.textures.exists(key)) this.textures.remove(key);
    this.mineralTextureKeys.clear();
    this.mineralFormations = [];
    this.mineralSpatialChunks.clear();
    this.mineralVisibleIndices.clear();
    this.mineralRefreshQueue = [];
    this.mineralRefreshCursor = 0;
    this.mineralViewportKey = '';
    this.mineralSpritesWorldKey = null;
    this.rockTreeBlockedCells.clear();
  }
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

function buildWaterSurfaceMaskPath(world: NaturalWorldEntity): Path2D {
  const path = new Path2D();
  const lakeIndices = new Set<number>();
  const riverIndices = new Set<number>();
  const ephemeralWaterIndices = new Set<number>();
  for (const cell of world.cells) {
    const maskCode = waterSurfaceMaskCode(cell);
    if (maskCode === 1) lakeIndices.add(cell.index);
    else if (maskCode === 2) riverIndices.add(cell.index);
    else if (maskCode === 3) ephemeralWaterIndices.add(cell.index);
  }
  appendWaterMaskContours(path, lakeIndices, world, 0, 6);
  appendWaterMaskContours(path, riverIndices, world, 401, 4.2);
  appendWaterMaskContours(path, ephemeralWaterIndices, world, 809, 6);
  return path;
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

function appendWaterMaskContours(
  path: Path2D,
  indices: Set<number>,
  world: NaturalWorldEntity,
  salt: number,
  amplitude: number,
): void {
  if (indices.size === 0) return;
  let firstIndex = Number.POSITIVE_INFINITY;
  for (const index of indices) firstIndex = Math.min(firstIndex, index);
  const visualSeed = hashText(world.id) ^ Math.imul(Number.isFinite(firstIndex) ? firstIndex : 0, 31) ^ salt;
  const scale = WATER_SURFACE_PIXELS_PER_CELL / CELL_SIZE;
  for (const contour of traceLakeContours(indices, world.width, world.height)) {
    const smooth = organicWaterContour(contour, visualSeed, amplitude, 3);
    const first = smooth[0];
    if (first === undefined) continue;
    path.moveTo(first.x * scale, first.y * scale);
    for (let index = 1; index < smooth.length; index += 1) {
      const point = smooth[index]!;
      path.lineTo(point.x * scale, point.y * scale);
    }
    path.closePath();
  }
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

function fillFloraPlantsForCell(
  cell: NaturalWorldCellState,
  trees: Array<NaturalWorldCellState['plants'][number] | undefined>,
): NaturalWorldCellState['plants'][number] | undefined {
  trees.fill(undefined);
  let shrub: NaturalWorldCellState['plants'][number] | undefined;
  for (const plant of cell.plants) {
    if (plant.speciesId === 'shrub') {
      shrub ??= plant;
      continue;
    }
    const index = FLORA_TREE_SPECIES.indexOf(plant.speciesId as TreeSpeciesId);
    if (index >= 0) trees[index] ??= plant;
  }
  return shrub;
}

function vegetationCellVisualSignature(
  cell: NaturalWorldCellState,
  trees: Array<NaturalWorldCellState['plants'][number] | undefined>,
  treesVisible: boolean,
  groundcoverVisible: boolean,
): number {
  let hash = 2_166_136_261;
  const add = (value: number): void => { hash = Math.imul(hash ^ (value | 0), 16_777_619) >>> 0; };
  add(habitatCode(cell.terrain.habitat));
  add(waterBodyCode(cell.terrain.waterBody ?? 'none'));
  add(cell.terrain.exposedRock ? 1 : 0);
  add(cell.water.surfaceMm >= 7 ? 1 : 0);
  add(treesVisible ? 1 : 0);
  add(groundcoverVisible ? 1 : 0);
  for (let index = 0; index < FLORA_TREE_SPECIES.length; index += 1) add(treePlantVisualCode(FLORA_TREE_SPECIES[index]!, trees[index]));
  return hash;
}

function treePlantVisualCode(
  speciesId: TreeSpeciesId,
  plant: NaturalWorldCellState['plants'][number] | undefined,
): number {
  if (plant === undefined || plant.biomassGPerM2 < 0.5) return 0;
  const profile = PLANT_PROFILE_BY_ID.get(speciesId);
  if (profile === undefined) return -1;
  const growthVisual = treeGrowthVisual(plant.ageDays, plant.biomassGPerM2, profile.maturityDays, profile.maximumBiomassGPerM2);
  const alpha = Math.round(clamp(0.74 + Math.sqrt(plant.biomassGPerM2 / profile.maximumBiomassGPerM2) * 0.26, 0.78, 1) * 50) / 50;
  const shadowStage = Math.ceil(growthVisual.growth * 8);
  const deadStanding = isDeadStandingTree(plant, profile.initialBiomassGPerM2);
  const alphaBucket = Math.round(alpha * 50);
  const scaleBucket = Math.round(growthVisual.scaleFactor * 200);
  return ((((growthVisual.frame * 51 + alphaBucket) * 10 + clamp(shadowStage, 0, 9)) * 2 + (deadStanding ? 1 : 0)) * 200) + scaleBucket;
}

function treeShadowVisualCode(
  trees: Array<NaturalWorldCellState['plants'][number] | undefined>,
  visible: boolean,
): number {
  if (!visible) return 0;
  let hash = 2_166_136_261;
  for (let index = 0; index < FLORA_TREE_SPECIES.length; index += 1) {
    const speciesId = FLORA_TREE_SPECIES[index]!;
    const plant = trees[index];
    let code = 0;
    if (plant !== undefined && plant.biomassGPerM2 >= 0.5) {
      const profile = PLANT_PROFILE_BY_ID.get(speciesId);
      if (profile !== undefined) {
        const growth = treeGrowthVisual(plant.ageDays, plant.biomassGPerM2, profile.maturityDays, profile.maximumBiomassGPerM2).growth;
        const stage = clamp(Math.ceil(growth * 8), 1, 8);
        code = stage * 2 + (isDeadStandingTree(plant, profile.initialBiomassGPerM2) ? 1 : 0);
      }
    }
    hash = Math.imul(hash ^ code, 16_777_619) >>> 0;
  }
  return hash;
}

function isDeadStandingTree(plant: NaturalWorldCellState['plants'][number], initialBiomass: number): boolean {
  const stress = plant.stress ?? (plant.limitingFactors === undefined
    ? 1
    : Math.min(plant.limitingFactors.water, plant.limitingFactors.nitrogen, plant.limitingFactors.temperature, plant.limitingFactors.light));
  return plant.stage === 'senescent' && plant.biomassGPerM2 < initialBiomass * 0.12 && stress < 0.12;
}

function habitatCode(habitat: string): number {
  return HABITAT_CODES[habitat] ?? 0;
}

function waterBodyCode(waterBody: string): number {
  return waterBody === 'lake' ? 2 : waterBody === 'river' ? 1 : 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function mineralLodPalette(resourceId: ProceduralRock['resourceId']): { base: number; light: number; shadow: number } {
  switch (resourceId) {
    case 'copper': return { base: 0x9a5f3e, light: 0xd29861, shadow: 0x4b392f };
    case 'iron': return { base: 0x65544a, light: 0xa17b65, shadow: 0x332d2b };
    case 'silver': return { base: 0x858d91, light: 0xc4cbd0, shadow: 0x454b50 };
    case 'gold': return { base: 0xa88736, light: 0xe1c66f, shadow: 0x514526 };
    default: return { base: 0x858174, light: 0xbab19c, shadow: 0x403e39 };
  }
}

function renderNow(): number {
  return globalThis.performance?.now() ?? Date.now();
}
