import Phaser from 'phaser';
import type { FloraSnapshot } from '../../../../contracts/flora-snapshot';
import { createWindField, type WindField } from '../../../../../../atmosphere/wind/index.js';
import { createVegetationEngine, type Plant, type VegetationEngine } from '../../../vegetation/index.js';
import { grassCoverFromCohorts, grassStandLayout } from '../../grass-stands';
import { shrubStandForCell } from '../../../shrubs/shrubs';

const CELL_SIZE = 40;
const CHUNK_CELLS = 8;
const CHUNK_WORLD_SIZE = CELL_SIZE * CHUNK_CELLS;
const WIND_REFRESH_MS = 120;
const MAX_TEXTURE_CHUNKS = 48;
const GRASS_PROJECTION_BUDGET_MS = 2.5;
const GRASS_PROJECTION_SOURCE_BATCH = 32;
const GRASS_TEXTURE_CHUNKS_PER_FRAME = 4;
const MAX_PLANT_MODELS = 8192;

type PlantModel = { plant: Plant; used: number };
type GrassChunk = {
  key: number;
  x: number;
  y: number;
  width: number;
  height: number;
  textureKey: string;
  texture: Phaser.Textures.CanvasTexture;
  image: Phaser.GameObjects.Image;
  dirty: boolean;
  rendered: boolean;
  lastUsed: number;
};

function renderNow(): number { return globalThis.performance?.now() ?? Date.now(); }

function grassAmount(cell: FloraSnapshot['cells'][number]): { biomass: number; density: number } {
  let biomass = 0;
  for (const plant of cell.plants) {
    if (plant.speciesId !== 'grass') continue;
    biomass += Math.max(0, plant.biomassGPerM2 || 0) * Math.max(0.1, Math.min(1.5, plant.densityPerM2 || 1));
  }
  return { biomass, density: biomass > 0 ? 1 : 0 };
}

function cellSignature(cell: FloraSnapshot['cells'][number], blocked: boolean, seed: number): string {
  const { biomass, density } = grassAmount(cell);
  const light = Math.max(0, Math.min(1, (cell.climate.solarMjPerM2Day || 0) / 18));
  const cover = grassCoverFromCohorts({ biomassGPerM2: biomass, densityPerM2: density, light });
  const shrub = shrubStandForCell(seed, cell, CELL_SIZE);
  return [
    cell.terrain.habitat,
    cell.terrain.waterBody ?? 'none',
    cell.terrain.exposedRock,
    blocked,
    Math.round(cover * 255),
    shrub === null ? 'no-shrub' : [shrub.preset, shrub.age, shrub.density, shrub.drought, shrub.season, Math.round(shrub.scale * 100), Math.round(shrub.alpha * 50)].join(':'),
  ].join('|');
}

/** Projects living grass cohorts as individual G4 plant clumps; no autotile or new ecology. */
export class GrassRenderer {
  private readonly chunks = new Map<number, GrassChunk>();
  private readonly cellSignatures: string[] = [];
  private readonly modelCache = new Map<string, PlantModel>();
  private readonly visibleKeys = new Set<number>();
  private lastWorld: FloraSnapshot | null = null;
  private lastBlocked: Set<number> | null = null;
  private lastSeed = -1;
  private worldWidth = 0;
  private worldHeight = 0;
  private chunkColumns = 0;
  private elapsedSinceWind = 0;
  private windPhase = 0;
  private useCounter = 0;
  private modelCounter = 0;
  private visible = true;
  private readonly windField: WindField;
  private readonly engine: VegetationEngine;
  private pendingWorld: FloraSnapshot | null = null;
  private scanCursor = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly cellSize: number, windField?: WindField) {
    this.windField = windField ?? createWindField({ strength: 0.28, direction: 32, gustiness: 0.65, turbulence: 0.42, flowSpeed: 1.1 });
    this.engine = createVegetationEngine({ windField: this.windField, memoryMB: 32, spriteSize: 96, variantCount: 4, windFrames: 1 });
  }

  sync(world: FloraSnapshot, seed: number, blocked: Set<number>, visible: boolean): void {
    if (!visible) {
      this.visible = false;
      for (const chunk of this.chunks.values()) chunk.image.setVisible(false);
      return;
    }
    this.visible = true;
    if (world.width !== this.worldWidth || world.height !== this.worldHeight || this.cellSize !== CELL_SIZE) {
      this.disposeChunks();
      this.cellSignatures.length = 0;
      this.lastWorld = null;
      this.pendingWorld = null;
      this.worldWidth = world.width;
      this.worldHeight = world.height;
      this.chunkColumns = Math.ceil(world.width / CHUNK_CELLS);
    }
    if (this.lastWorld === world && this.lastBlocked === blocked && this.lastSeed === seed) return;
    if (this.lastSeed !== seed) {
      this.cellSignatures.length = 0;
      this.modelCache.clear();
      for (const chunk of this.chunks.values()) chunk.dirty = true;
    }
    this.lastSeed = seed;
    this.lastWorld = world;
    this.lastBlocked = blocked;
    this.pendingWorld = world;
    this.scanCursor = 0;
  }

  updateWind(deltaMs: number, timeMs: number): void {
    if (!this.visible || this.lastWorld === null) return;
    const startedAt = renderNow();
    const world = this.pendingWorld;
    if (world !== null) {
      let scannedSinceCheck = 0;
      while (this.scanCursor < world.cells.length) {
        const index = this.scanCursor++;
        const cell = world.cells[index];
        if (cell !== undefined) {
          const signature = cellSignature(cell, this.lastBlocked?.has(cell.index) ?? false, this.lastSeed);
          if (signature !== this.cellSignatures[index]) {
            this.cellSignatures[index] = signature;
            const cx = cell.x / CHUNK_CELLS | 0;
            const cy = cell.y / CHUNK_CELLS | 0;
            const chunk = this.chunks.get(cy * this.chunkColumns + cx);
            if (chunk !== undefined) chunk.dirty = true;
          }
        }
        scannedSinceCheck += 1;
        if (scannedSinceCheck >= GRASS_PROJECTION_SOURCE_BATCH) {
          scannedSinceCheck = 0;
          if (renderNow() - startedAt >= GRASS_PROJECTION_BUDGET_MS * 0.5) break;
        }
      }
      if (this.scanCursor >= world.cells.length) this.pendingWorld = null;
    }

    const generated = (this.engine.tick({ timeBudgetMs: 1.2, maxJobs: 1 }) as { generated: number }).generated;
    this.elapsedSinceWind += Math.max(0, deltaMs);
    let windChanged = false;
    if (this.elapsedSinceWind >= WIND_REFRESH_MS) {
      this.elapsedSinceWind %= WIND_REFRESH_MS;
      this.windPhase = ((timeMs / 4000) % 1 + 1) % 1;
      windChanged = true;
    }
    if (generated > 0 || windChanged) {
      for (const key of this.visibleKeys) {
        const chunk = this.chunks.get(key);
        if (chunk !== undefined) chunk.dirty = true;
      }
    }
    this.drawVisibleChunks(GRASS_TEXTURE_CHUNKS_PER_FRAME);
  }

  private drawVisibleChunks(maxRedraws: number): void {
    if (!this.visible || this.chunkColumns === 0) return;
    const view = this.scene.cameras.main.worldView;
    const rows = Math.ceil(this.worldHeight / CHUNK_CELLS);
    const minX = Math.max(0, Math.floor(view.x / CHUNK_WORLD_SIZE));
    const maxX = Math.min(this.chunkColumns - 1, Math.floor(Math.max(view.x, view.right - 1) / CHUNK_WORLD_SIZE));
    const minY = Math.max(0, Math.floor(view.y / CHUNK_WORLD_SIZE));
    const maxY = Math.min(rows - 1, Math.floor(Math.max(view.y, view.bottom - 1) / CHUNK_WORLD_SIZE));
    this.visibleKeys.clear();
    const visible = new Set<number>();
    let redrawn = 0;
    for (let cy = minY; cy <= maxY; cy += 1) for (let cx = minX; cx <= maxX; cx += 1) {
      const key = cy * this.chunkColumns + cx;
      visible.add(key);
      this.visibleKeys.add(key);
      const chunk = this.ensureChunk(key, cx, cy);
      if (chunk === null) continue;
      chunk.lastUsed = ++this.useCounter;
      chunk.image.setVisible(true);
      if ((chunk.dirty || !chunk.rendered) && redrawn < maxRedraws) {
        this.renderChunk(chunk);
        redrawn += 1;
      }
    }
    this.evictHiddenChunks(visible);
  }

  private ensureChunk(key: number, cx: number, cy: number): GrassChunk | null {
    const cached = this.chunks.get(key);
    if (cached !== undefined) return cached;
    const width = Math.min(CHUNK_CELLS, this.worldWidth - cx * CHUNK_CELLS) * this.cellSize;
    const height = Math.min(CHUNK_CELLS, this.worldHeight - cy * CHUNK_CELLS) * this.cellSize;
    const textureKey = `natural-grass-clumps-${cx}-${cy}`;
    if (this.scene.textures.exists(textureKey)) this.scene.textures.remove(textureKey);
    const texture = this.scene.textures.createCanvas(textureKey, width, height);
    if (texture === null) return null;
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    const image = this.scene.add.image(cx * CHUNK_WORLD_SIZE, cy * CHUNK_WORLD_SIZE, textureKey)
      .setOrigin(0, 0).setDepth(1.99).setVisible(false);
    const chunk = { key, x: cx, y: cy, width, height, textureKey, texture, image, dirty: true, rendered: false, lastUsed: ++this.useCounter };
    this.chunks.set(key, chunk);
    return chunk;
  }

  private renderChunk(chunk: GrassChunk): void {
    const world = this.lastWorld;
    if (world === null) return;
    const context = chunk.texture.getContext();
    context.clearRect(0, 0, chunk.width, chunk.height);
    context.imageSmoothingEnabled = false;
    const startX = chunk.x * CHUNK_CELLS;
    const startY = chunk.y * CHUNK_CELLS;
    const endX = Math.min(world.width, startX + CHUNK_CELLS);
    const endY = Math.min(world.height, startY + CHUNK_CELLS);
    for (let y = startY; y < endY; y += 1) for (let x = startX; x < endX; x += 1) {
      const cell = world.cells[y * world.width + x];
      if (cell === undefined || cell.terrain.waterBody && cell.terrain.waterBody !== 'none' || cell.terrain.exposedRock || this.lastBlocked?.has(cell.index)) continue;
      const amount = grassAmount(cell);
      const originX = (x - startX) * this.cellSize + this.cellSize * 0.5;
      const originY = (y - startY) * this.cellSize + this.cellSize * 0.94;
      if (amount.biomass > 0 && amount.density > 0) {
        const light = Math.max(0, Math.min(1, (cell.climate.solarMjPerM2Day || 0) / 18));
        const stands = grassStandLayout({
          seed: this.lastSeed,
          x,
          y,
          biomassGPerM2: amount.biomass,
          densityPerM2: amount.density,
          light,
          cellSize: this.cellSize,
        });
        for (const stand of stands) this.drawPlant(context, stand.preset, stand.seed, 1, 1, 0, 'verao',
          originX + stand.offsetX, originY + stand.offsetY, stand.scale, stand.alpha, x, y);
      }
      const shrub = shrubStandForCell(this.lastSeed, cell, this.cellSize);
      if (shrub !== null) this.drawPlant(context, shrub.preset, shrub.seed, shrub.age, shrub.density, shrub.drought, shrub.season,
        originX + shrub.offsetX, originY + shrub.offsetY, shrub.scale, shrub.alpha, x, y);
    }
    context.globalAlpha = 1;
    chunk.texture.refresh();
    chunk.dirty = false;
    chunk.rendered = true;
  }

  private drawPlant(
    context: CanvasRenderingContext2D,
    preset: string,
    seed: number,
    age: number,
    density: number,
    drought: number,
    season: 'verao' | 'outono',
    x: number,
    y: number,
    scale: number,
    alpha: number,
    cellX: number,
    cellY: number,
  ): void {
    const key = [preset, seed, age, density, drought, season].join(':');
    let model = this.modelCache.get(key);
    if (model === undefined) {
      model = { plant: this.engine.createPlant({
        preset, seed, age, density, drought, season,
        worldX: cellX * this.cellSize + 1,
        worldY: cellY * this.cellSize + 1,
      }), used: 0 };
      this.modelCache.set(key, model);
      this.trimPlantModels();
    }
    model.used = ++this.modelCounter;
    context.globalAlpha = alpha;
    this.engine.draw(context, model.plant, { x, y, scale, time: this.windPhase, wind: 1 });
  }

  private trimPlantModels(): void {
    while (this.modelCache.size > MAX_PLANT_MODELS) {
      let oldestKey: string | null = null;
      let oldestUsed = Infinity;
      for (const [key, value] of this.modelCache) {
        if (value.used < oldestUsed) { oldestKey = key; oldestUsed = value.used; }
      }
      if (oldestKey === null) break;
      this.modelCache.delete(oldestKey);
    }
  }

  private evictHiddenChunks(visible: Set<number>): void {
    if (this.chunks.size <= MAX_TEXTURE_CHUNKS) return;
    const hidden = [...this.chunks.values()].filter((chunk) => !visible.has(chunk.key)).sort((a, b) => a.lastUsed - b.lastUsed);
    while (this.chunks.size > MAX_TEXTURE_CHUNKS && hidden.length > 0) {
      const chunk = hidden.shift()!;
      chunk.image.destroy();
      if (this.scene.textures.exists(chunk.textureKey)) this.scene.textures.remove(chunk.textureKey);
      this.chunks.delete(chunk.key);
    }
  }

  private disposeChunks(): void {
    for (const chunk of this.chunks.values()) {
      chunk.image.destroy();
      if (this.scene.textures.exists(chunk.textureKey)) this.scene.textures.remove(chunk.textureKey);
    }
    this.chunks.clear();
    this.visibleKeys.clear();
  }

  dispose(): void {
    this.disposeChunks();
    this.engine.dispose();
    this.modelCache.clear();
    this.lastWorld = null;
    this.lastBlocked = null;
    this.cellSignatures.length = 0;
    this.lastSeed = -1;
  }
}
