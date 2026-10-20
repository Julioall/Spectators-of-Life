import Phaser from 'phaser';
import treeAtlasUrl from '../../data/assets/tree/Spritesheets/arvores_atlas_128.png?url';
import type { NaturalWorldCellState, NaturalWorldEntity, PlantCohortState, PlantSpeciesId, TreeSpeciesId } from '../core/natural/types';
import { NATURAL_SCENARIO } from '../core/natural/parameters';
import { naturalScenarioVersionAtLeast } from '../core/natural/versioning';
import { drawProceduralRock, generateProceduralRocks, ROCK_NATIVE_CELL_SIZE, treeBlockingCellsForRocks } from './procedural-rocks';
import { TERRAIN_SURFACE_COLORS, terrainSurfaceField, type TerrainSurface } from './terrain-palette';
import { hasNaturalLayerRevisionChanged, type NaturalLayerRevision } from './natural-layer-revision';
import { reliefShadeForNeighbors } from './relief-shading';
import { worldObjectDepth } from './z-order';

const CELL_SIZE = 40;
const MIN_ZOOM = 0.38;
const MAX_ZOOM = 1.55;
const TERRAIN_TEXTURE_KEY = 'natural-terrain-map';
const TREE_ATLAS_KEY = 'natural-tree-atlas';
const WATER_THRESHOLD_MM = 10;
const WATER_EDGE_INSET = 4;
const WATER_CORNER_RADIUS = 9;
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
type MapLayers = { relief: boolean; water: boolean; vegetation: boolean; minerals: boolean; geology: boolean };
type TreeSprites = Record<TreeSpeciesId, Phaser.GameObjects.Image | null>;
type TilePoint = { x: number; y: number };
export type FoundationPerformanceHooks = {
  onDynamicLayersMs?: (elapsedMs: number) => void;
  onWaterMotionMs?: (elapsedMs: number) => void;
};

export class FoundationScene extends Phaser.Scene {
  private terrainImage: Phaser.GameObjects.Image | null = null;
  private waterGraphics: Phaser.GameObjects.Graphics | null = null;
  private waterMotionGraphics: Phaser.GameObjects.Graphics | null = null;
  private plantGraphics: Phaser.GameObjects.Graphics | null = null;
  private treeShadowGraphics: Phaser.GameObjects.Graphics | null = null;
  private reliefGraphics: Phaser.GameObjects.Graphics | null = null;
  private geologyGraphics: Phaser.GameObjects.Graphics | null = null;
  private selectionGraphics: Phaser.GameObjects.Graphics | null = null;
  private naturalWorld: NaturalWorldEntity | null = null;
  private mapKey: string | null = null;
  private reliefWorldKey: string | null = null;
  private geologyWorldKey: string | null = null;
  private dynamicLayerRevision: NaturalLayerRevision | null = null;
  private treeSprites: TreeSprites[] = [];
  private mineralSprites: Phaser.GameObjects.Image[] = [];
  private mineralTextureKeys: string[] = [];
  private mineralSpritesWorldKey: string | null = null;
  private rockTreeBlockedCells = new Set<number>();
  private layers: MapLayers = { relief: false, water: true, vegetation: true, minerals: true, geology: false };
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
      this.geologyWorldKey = null;
      this.dynamicLayerRevision = null;
      this.waterMotionGraphics?.clear();
      this.clearMap();
      return;
    }
    const previousWorld = this.naturalWorld;
    const needsRebuild = this.mapKey !== worldKey || previousWorld?.width !== world.width || previousWorld?.height !== world.height;
    const revision = { worldKey, daysSimulated: world.daysSimulated };
    const needsDynamicRefresh = forceRefresh || needsRebuild || hasNaturalLayerRevisionChanged(this.dynamicLayerRevision, revision);
    this.naturalWorld = world;
    if (needsRebuild) {
      this.mapKey = worldKey;
      this.selectedCellIndex = null;
      this.onCellSelected(null);
      this.cameraManuallyAdjusted = false;
      this.buildTerrain();
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
    this.layers = { ...this.layers, ...layers };
    this.updateDynamicLayers();
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
    if (this.textures.exists(TERRAIN_TEXTURE_KEY)) this.textures.remove(TERRAIN_TEXTURE_KEY);
    this.destroyTreeSprites();
    this.destroyMineralSprites();
    const elevations = world.cells.map((cell) => cell.terrain.elevationM);
    const minElevation = Math.min(...elevations);
    const maxElevation = Math.max(...elevations);
    const texture = this.textures.createCanvas(TERRAIN_TEXTURE_KEY, world.width * CELL_SIZE, world.height * CELL_SIZE);
    if (texture === null) return;
    const context = texture.getContext();
    context.imageSmoothingEnabled = false;
    drawTerrainTexture(context, world, minElevation, maxElevation, hashText(this.mapKey ?? 'natural-world'));
    texture.refresh();
    this.terrainImage = this.add.image(0, 0, TERRAIN_TEXTURE_KEY).setOrigin(0, 0).setDepth(0);
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

  private drawRelief(): void {
    const world = this.naturalWorld;
    const graphics = this.reliefGraphics;
    if (world === null || graphics === null) return;
    if (!this.layers.relief) {
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
    const range = Math.max(1, maximum - minimum);
    for (const cell of world.cells) {
      const relative = clamp((cell.terrain.elevationM - minimum) / range, 0, 1);
      const center = cell.terrain.elevationM;
      const west = neighborAt(world, cell.x, cell.y, -1, 0)?.terrain.elevationM ?? center;
      const east = neighborAt(world, cell.x, cell.y, 1, 0)?.terrain.elevationM ?? center;
      const north = neighborAt(world, cell.x, cell.y, 0, -1)?.terrain.elevationM ?? center;
      const south = neighborAt(world, cell.x, cell.y, 0, 1)?.terrain.elevationM ?? center;
      const shade = reliefShadeForNeighbors(west, east, north, south, world.cellSizeM);
      const x = cell.x * CELL_SIZE;
      const y = cell.y * CELL_SIZE;
      graphics.fillStyle(reliefBandColor(relative), 0.28);
      graphics.fillRect(x, y, CELL_SIZE, CELL_SIZE);
      if (Math.abs(shade) >= 0.025) {
        const shadeColor = shade > 0 ? 0xfff1cf : 0x202b29;
        const shadeAlpha = clamp(0.05 + Math.abs(shade) * 0.22, 0.05, 0.21);
        graphics.fillStyle(shadeColor, shadeAlpha);
        graphics.fillRect(x, y, CELL_SIZE, CELL_SIZE);
      }
    }
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
    if (!this.layers.water) return;
    const lakeCells: NaturalWorldCellState[] = [];
    for (const cell of world.cells) {
      const x = cell.x * CELL_SIZE;
      const y = cell.y * CELL_SIZE;
      const surface = cell.water.surfaceMm;
      if (cell.terrain.waterBody === 'lake' && surface > WATER_THRESHOLD_MM) {
        lakeCells.push(cell);
        continue;
      }
      if (surface > WATER_THRESHOLD_MM && cell.terrain.waterBody !== 'river') {
        const mask = waterAutotileMask(cell, world);
        const edgeInset = surface < 90 ? 6 : surface < 280 ? 4.5 : WATER_EDGE_INSET;
        const points = waterTilePoints(x, y, mask, edgeInset);
        const alpha = clamp(0.62 + Math.log1p(surface) * 0.038, 0.68, 0.88);
        graphics.fillStyle(waterDepthColor(surface), alpha);
        graphics.fillPoints(points as unknown as Phaser.Math.Vector2[], true);
        graphics.lineStyle(1.15, 0xa7aa91, clamp(0.28 + surface / 9000, 0.32, 0.43));
        if ((mask & 1) === 0) graphics.lineBetween(x + WATER_CORNER_RADIUS, y + edgeInset, x + CELL_SIZE - WATER_CORNER_RADIUS, y + edgeInset);
        if ((mask & 4) === 0) graphics.lineBetween(x + WATER_CORNER_RADIUS, y + CELL_SIZE - edgeInset, x + CELL_SIZE - WATER_CORNER_RADIUS, y + CELL_SIZE - edgeInset);
        if ((mask & 16) === 0) graphics.lineBetween(x + CELL_SIZE - edgeInset, y + WATER_CORNER_RADIUS, x + CELL_SIZE - edgeInset, y + CELL_SIZE - WATER_CORNER_RADIUS);
        if ((mask & 64) === 0) graphics.lineBetween(x + edgeInset, y + WATER_CORNER_RADIUS, x + edgeInset, y + CELL_SIZE - WATER_CORNER_RADIUS);
        if (cell.index % 4 === 0) drawWaterGlints(graphics, x, y, surface, cell.index);
      }
      if (surface > WATER_THRESHOLD_MM && cell.terrain.waterBody === 'river') continue;
      const flow = cell.water.lastFlows.runoffOutMm ?? 0;
      const flowTo = cell.water.lastFlowTo ?? cell.terrain.flowTo;
      if (flow > 0.35 && flowTo >= 0) {
        const destination = world.cells[flowTo];
        if (destination !== undefined) {
          graphics.lineStyle(clamp(0.7 + flow * 0.02, 0.7, 1.15), 0x95a89a, clamp(0.07 + flow * 0.012, 0.08, 0.17));
          graphics.lineBetween((cell.x + 0.5) * CELL_SIZE, (cell.y + 0.5) * CELL_SIZE, (destination.x + 0.5) * CELL_SIZE, (destination.y + 0.5) * CELL_SIZE);
        }
      }
    }
    drawDryLakeBeds(graphics, world);
    drawLakeSurfaces(graphics, lakeCells, world);
    drawRiverBeds(graphics, world);
    drawRiverSurfaces(graphics, world);
    drawRiverNetwork(graphics, world);
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
        if (cell.terrain.waterBody === 'river' && isActiveRiverCell(cell)) {
          if (cell.index % 2 !== 0) continue;
          const downstreamIndex = cell.water.lastFlowTo ?? cell.terrain.flowTo;
          const downstream = downstreamIndex >= 0 ? world.cells[downstreamIndex] : undefined;
          if (downstream === undefined || downstream.terrain.waterBody !== 'river') continue;
          const startX = (cell.x + 0.5) * CELL_SIZE;
          const startY = (cell.y + 0.5) * CELL_SIZE;
          const endX = (downstream.x + 0.5) * CELL_SIZE;
          const endY = (downstream.y + 0.5) * CELL_SIZE;
          const offset = coordinateNoise(seed, cell.x, cell.y, 1_203);
          const progress = (phase * 0.9 + offset) % 1;
          const x = startX + (endX - startX) * progress;
          const y = startY + (endY - startY) * progress;
          const length = 3.5 + coordinateNoise(seed, cell.x, cell.y, 1_207) * 3;
          const directionLength = Math.max(1, Math.hypot(endX - startX, endY - startY));
          const dx = (endX - startX) / directionLength;
          const dy = (endY - startY) / directionLength;
          graphics.lineStyle(1.35, 0xd1e6d8, 0.24);
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
    if (this.textures.exists(TERRAIN_TEXTURE_KEY)) this.textures.remove(TERRAIN_TEXTURE_KEY);
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

function drawTerrainTexture(context: CanvasRenderingContext2D, world: NaturalWorldEntity, minElevation: number, maxElevation: number, visualSeed: number): void {
  const surfaces = terrainSurfaceField(world, minElevation, maxElevation);
  for (const cell of world.cells) {
    const x = cell.x * CELL_SIZE;
    const y = cell.y * CELL_SIZE;
    const surface = surfaces[cell.index] ?? 'loam';
    const baseColor = TERRAIN_SURFACE_COLORS[surface];
    context.fillStyle = cssColor(baseColor);
    context.fillRect(x, y, CELL_SIZE, CELL_SIZE);
    drawSurfaceTexture(context, x, y, cell, surface, baseColor, visualSeed);
  }
  for (const cell of world.cells) {
    const mask = terrainNeighborMask(cell, world, surfaces);
    drawTerrainTransitions(context, cell, world, surfaces, mask, visualSeed);
  }
  drawElevationShading(context, world);
}

function drawElevationShading(context: CanvasRenderingContext2D, world: NaturalWorldEntity): void {
  for (const cell of world.cells) {
    const center = cell.terrain.elevationM;
    const west = neighborAt(world, cell.x, cell.y, -1, 0)?.terrain.elevationM ?? center;
    const east = neighborAt(world, cell.x, cell.y, 1, 0)?.terrain.elevationM ?? center;
    const north = neighborAt(world, cell.x, cell.y, 0, -1)?.terrain.elevationM ?? center;
    const south = neighborAt(world, cell.x, cell.y, 0, 1)?.terrain.elevationM ?? center;
    const shade = reliefShadeForNeighbors(west, east, north, south, world.cellSizeM);
    const alpha = clamp(Math.abs(shade) * 0.18, 0, 0.13);
    if (alpha < 0.018) continue;
    context.fillStyle = shade > 0
      ? `rgba(255, 245, 213, ${alpha})`
      : `rgba(24, 31, 25, ${alpha})`;
    context.fillRect(cell.x * CELL_SIZE, cell.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
  }
}

function reliefBandColor(relative: number): number {
  if (relative < 0.12) return 0x456f67;
  if (relative < 0.28) return 0x5f8158;
  if (relative < 0.46) return 0x819655;
  if (relative < 0.64) return 0xa6a05b;
  if (relative < 0.8) return 0xb18a5d;
  if (relative < 0.92) return 0x8d7562;
  return 0xc8c3ae;
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

const TERRAIN_NEIGHBORS = [
  { dx: 0, dy: -1 }, { dx: 1, dy: -1 }, { dx: 1, dy: 0 }, { dx: 1, dy: 1 },
  { dx: 0, dy: 1 }, { dx: -1, dy: 1 }, { dx: -1, dy: 0 }, { dx: -1, dy: -1 },
] as const;

function terrainNeighborMask(cell: NaturalWorldCellState, world: NaturalWorldEntity, surfaces: TerrainSurface[]): number {
  let mask = 0;
  TERRAIN_NEIGHBORS.forEach(({ dx, dy }, bit) => {
    const neighbor = neighborAt(world, cell.x, cell.y, dx, dy);
    if (neighbor !== undefined && surfaces[neighbor.index] !== surfaces[cell.index]) mask |= 1 << bit;
  });
  return mask;
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

function drawTerrainTransitions(context: CanvasRenderingContext2D, cell: NaturalWorldCellState, world: NaturalWorldEntity, surfaces: TerrainSurface[], mask: number, visualSeed: number): void {
  const x = cell.x * CELL_SIZE;
  const y = cell.y * CELL_SIZE;
  const band = 7;
  for (const bit of [0, 2, 4, 6] as const) {
    if ((mask & (1 << bit)) === 0) continue;
    const { dx, dy } = TERRAIN_NEIGHBORS[bit]!;
    const neighbor = neighborAt(world, cell.x, cell.y, dx, dy);
    if (neighbor === undefined) continue;
    const neighborColor = TERRAIN_SURFACE_COLORS[surfaces[neighbor.index] ?? 'loam'];
    for (let depth = 0; depth < band; depth += 2) {
      const influence = ((band - depth) / band) * 0.64;
      for (let position = 0; position < CELL_SIZE; position += 2) {
        let px: number;
        let py: number;
        if (bit === 0) { px = position; py = depth; }
        else if (bit === 2) { px = CELL_SIZE - depth - 2; py = position; }
        else if (bit === 4) { px = position; py = CELL_SIZE - depth - 2; }
        else { px = depth; py = position; }
        if (coordinateNoise(visualSeed, x + px, y + py, 300 + bit) < influence) {
          context.fillStyle = cssColor(neighborColor);
          context.fillRect(x + px, y + py, 2, 2);
        }
      }
    }
  }
  const diagonalCorners = [
    { bit: 1, sides: [0, 2], x: x + CELL_SIZE - band, y },
    { bit: 3, sides: [2, 4], x: x + CELL_SIZE - band, y: y + CELL_SIZE - band },
    { bit: 5, sides: [4, 6], x, y: y + CELL_SIZE - band },
    { bit: 7, sides: [6, 0], x, y },
  ] as const;
  for (const corner of diagonalCorners) {
    if ((mask & (1 << corner.bit)) === 0 || corner.sides.some((side) => (mask & (1 << side)) !== 0)) continue;
    const { dx, dy } = TERRAIN_NEIGHBORS[corner.bit]!;
    const neighbor = neighborAt(world, cell.x, cell.y, dx, dy);
    if (neighbor === undefined) continue;
    context.fillStyle = cssColor(TERRAIN_SURFACE_COLORS[surfaces[neighbor.index] ?? 'loam']);
    for (let oy = 0; oy < band; oy += 2) {
      for (let ox = 0; ox < band; ox += 2) {
        const influence = (1 - (ox + oy) / (2 * band)) * 0.5;
        const px = corner.x + ox;
        const py = corner.y + oy;
        if (coordinateNoise(visualSeed, px, py, 500 + corner.bit) < influence) context.fillRect(px, py, 2, 2);
      }
    }
  }
}

function neighborAt(world: NaturalWorldEntity, x: number, y: number, dx: number, dy: number): NaturalWorldCellState | undefined {
  const neighborX = x + dx;
  const neighborY = y + dy;
  if (neighborX < 0 || neighborX >= world.width || neighborY < 0 || neighborY >= world.height) return undefined;
  return world.cells[neighborY * world.width + neighborX];
}

function waterAutotileMask(cell: NaturalWorldCellState, world: NaturalWorldEntity): number {
  let mask = 1 << 8;
  TERRAIN_NEIGHBORS.forEach(({ dx, dy }, bit) => {
    const neighbor = neighborAt(world, cell.x, cell.y, dx, dy);
    if (neighbor !== undefined && neighbor.water.surfaceMm > WATER_THRESHOLD_MM) mask |= 1 << bit;
  });
  return mask;
}

function waterTilePoints(x: number, y: number, mask: number, edgeInset = WATER_EDGE_INSET): TilePoint[] {
  const has = (bit: number) => (mask & (1 << bit)) !== 0;
  const left = x + (has(6) ? 0 : edgeInset);
  const right = x + CELL_SIZE - (has(2) ? 0 : edgeInset);
  const top = y + (has(0) ? 0 : edgeInset);
  const bottom = y + CELL_SIZE - (has(4) ? 0 : edgeInset);
  const rounded = {
    topLeft: !has(0) && !has(6) && !has(7),
    topRight: !has(0) && !has(2) && !has(1),
    bottomRight: !has(2) && !has(4) && !has(3),
    bottomLeft: !has(4) && !has(6) && !has(5),
  };
  const points: TilePoint[] = [];
  const radius = WATER_CORNER_RADIUS;
  appendWaterCorner(points, left + (rounded.topLeft ? radius : 0), top + (rounded.topLeft ? radius : 0), rounded.topLeft ? radius : 0, 180, 270);
  appendWaterCorner(points, right - (rounded.topRight ? radius : 0), top + (rounded.topRight ? radius : 0), rounded.topRight ? radius : 0, 270, 360);
  appendWaterCorner(points, right - (rounded.bottomRight ? radius : 0), bottom - (rounded.bottomRight ? radius : 0), rounded.bottomRight ? radius : 0, 0, 90);
  appendWaterCorner(points, left + (rounded.bottomLeft ? radius : 0), bottom - (rounded.bottomLeft ? radius : 0), rounded.bottomLeft ? radius : 0, 90, 180);
  return points;
}

function appendWaterCorner(points: TilePoint[], x: number, y: number, radius: number, startAngle: number, endAngle: number): void {
  if (radius <= 0) {
    points.push({ x, y });
    return;
  }
  const steps = 3;
  for (let step = 0; step <= steps; step += 1) {
    const angle = ((startAngle + (endAngle - startAngle) * (step / steps)) * Math.PI) / 180;
    points.push({ x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius });
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

function drawLakeSurfaces(graphics: Phaser.GameObjects.Graphics, cells: NaturalWorldCellState[], world: NaturalWorldEntity): void {
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
    const averageDepth = component.reduce((sum, cell) => sum + cell.water.surfaceMm, 0) / component.length;
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
        const smooth = smoothClosedPolygon(contour, 3);
        const color = waterDepthColor(visualDepthMm);
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

function drawRiverSurfaces(graphics: Phaser.GameObjects.Graphics, world: NaturalWorldEntity): void {
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
    const surface = component.reduce((total, cell) => total + cell.water.surfaceMm, 0) / component.length;
    for (const contour of contours) {
      const smooth = smoothClosedPolygon(contour, 3);
      graphics.fillStyle(waterDepthColor(surface), 0.86);
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

function smoothClosedPolygon(points: TilePoint[], iterations: number): TilePoint[] {
  let result = points;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const smoothed: TilePoint[] = [];
    for (let index = 0; index < result.length; index += 1) {
      const current = result[index]!;
      const next = result[(index + 1) % result.length]!;
      smoothed.push({ x: current.x * 0.75 + next.x * 0.25, y: current.y * 0.75 + next.y * 0.25 });
      smoothed.push({ x: current.x * 0.25 + next.x * 0.75, y: current.y * 0.25 + next.y * 0.75 });
    }
    result = smoothed;
  }
  return result;
}

function drawRiverNetwork(graphics: Phaser.GameObjects.Graphics, world: NaturalWorldEntity): void {
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
        surfaceMm: source.water.surfaceMm,
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
        surfaceMm: current.water.surfaceMm,
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
            surfaceMm: downstream.water.surfaceMm,
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
          surfaceMm: current.water.surfaceMm,
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
        surfaceMm: current.water.surfaceMm,
        contributingCells: contributingCells[current.index] as number,
        widthScale: riverWidthScale(current, world, contributingCells[current.index] as number, upstreamCount[current.index] ?? 0),
      });
    }
    drawSmoothedRiverPath(graphics, path);
  }
  drawLakeRiverConnections(graphics, world, lakeOutlets, contributingCells);
  drawRiverConfluencePools(graphics, world, isRiver, upstreamCount, contributingCells);
}

function drawLakeRiverConnections(
  graphics: Phaser.GameObjects.Graphics,
  world: NaturalWorldEntity,
  lakeOutlets: Map<number, NaturalWorldCellState>,
  contributingCells: number[],
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
    const color = waterDepthColor(river.water.surfaceMm);
    graphics.lineStyle(width, color, 0.9);
    graphics.lineBetween(mouth.x, mouth.y, x, y);
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

function drawSmoothedRiverPath(graphics: Phaser.GameObjects.Graphics, path: Array<{ x: number; y: number; surfaceMm: number; contributingCells: number; widthScale: number }>): void {
  if (path.length === 0) return;
  const points: Array<{ x: number; y: number; progress: number }> = [{ x: path[0]!.x, y: path[0]!.y, progress: 0 }];
  for (let index = 0; index < path.length - 1; index += 1) {
    const start = path[index]!;
    const end = path[index + 1]!;
    points.push({ x: start.x * 0.75 + end.x * 0.25, y: start.y * 0.75 + end.y * 0.25, progress: index + 0.25 });
    points.push({ x: start.x * 0.25 + end.x * 0.75, y: start.y * 0.25 + end.y * 0.75, progress: index + 0.75 });
  }
  if (path.length > 1) {
    const last = path[path.length - 1]!;
    points.push({ x: last.x, y: last.y, progress: path.length - 1 });
  }

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
    const flowWidth = clamp(6.5 + Math.sqrt(Math.max(1, catchmentAt(progress))) * 0.42, 7, 30);
    return clamp(flowWidth * widthScaleAt(progress), 6, 35);
  };
  const stroke = (bank: boolean): void => {
    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index]!;
      const end = points[index + 1]!;
      const progress = (start.progress + end.progress) * 0.5;
      const surfaceMm = surfaceAt(progress);
      const width = widthAt(progress) + (bank ? 1.4 : 0);
      const color = bank ? 0x52675e : waterDepthColor(surfaceMm);
      const alpha = bank ? 0.14 : 0.9;
      graphics.lineStyle(width, color, alpha);
      graphics.lineBetween(start.x, start.y, end.x, end.y);
      graphics.fillStyle(color, alpha);
      graphics.fillCircle(start.x, start.y, width * 0.5);
    }
    if (points.length === 1) {
      const surfaceMm = path[0]!.surfaceMm;
      const width = widthAt(0) + (bank ? 1.4 : 0);
      graphics.fillStyle(bank ? 0x52675e : waterDepthColor(surfaceMm), bank ? 0.14 : 0.9);
      graphics.fillCircle(points[0]!.x, points[0]!.y, width * 0.5);
    } else {
      const last = points[points.length - 1]!;
      const width = widthAt(last.progress) + (bank ? 1.4 : 0);
      graphics.fillStyle(bank ? 0x52675e : waterDepthColor(surfaceAt(last.progress)), bank ? 0.14 : 0.9);
      graphics.fillCircle(last.x, last.y, width * 0.5);
    }
  };
  stroke(true);
  stroke(false);
}

function drawRiverConfluencePools(
  graphics: Phaser.GameObjects.Graphics,
  world: NaturalWorldEntity,
  isRiver: boolean[],
  upstreamCount: Uint8Array,
  contributingCells: number[],
): void {
  for (const cell of world.cells) {
    if (!isRiver[cell.index] || (upstreamCount[cell.index] ?? 0) < 2) continue;
    const diameter = clamp(36 + Math.sqrt(contributingCells[cell.index] as number) * 1.05, 44, 78);
    const x = (cell.x + 0.5) * CELL_SIZE;
    const y = (cell.y + 0.5) * CELL_SIZE;
    graphics.fillStyle(0x52675e, 0.2);
    graphics.fillEllipse(x, y, diameter * 1.18, diameter * 0.88);
    graphics.fillStyle(waterDepthColor(cell.water.surfaceMm), 0.86);
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
  for (const cell of world.cells) {
    if (cell.terrain.waterBody !== 'lake' || cell.water.surfaceMm > WATER_THRESHOLD_MM) continue;
    const x = cell.x * CELL_SIZE;
    const y = cell.y * CELL_SIZE;
    const moisture = clamp(cell.water.soilMm / Math.max(1, cell.water.capacityMm), 0, 1);
    const color = mixColor(0x766f5b, 0x526452, moisture);
    graphics.fillStyle(color, 0.34);
    graphics.fillRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4);
    if (cell.index % 3 === 0) {
      graphics.lineStyle(0.7, 0x4c4b3f, 0.26);
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
