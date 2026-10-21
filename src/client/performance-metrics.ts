export type PerformanceSnapshot = {
  fps: number | null;
  frameMs: number | null;
  phaserFps: number | null;
  renderMs: number | null;
  dynamicLayersMs: number | null;
  renderLayerMs: Record<RenderLayerId, number | null>;
  vegetationDetailMs: { grass: number | null; objects: number | null; shadows: number | null };
  mineralDetailMs: {
    catalog: number | null;
    formations: number | null;
    visible: number | null;
    raster: number | null;
    sprites: number | null;
    created: number | null;
    pending: number | null;
  };
  waterMotionMs: number | null;
  waterDetailMs: { depth: number | null; geometry: number | null; surface: number | null };
  waterSurfaceDetailMs: { cache: number | null; mask: number | null; chunks: number | null; dirtyChunks: number | null };
  simulationMs: number | null;
  snapshotMs: number | null;
  renderSamples: TimingSamples | null;
  simulationSamples: TimingSamples | null;
  snapshotSamples: TimingSamples | null;
  workerMs: number | null;
  ticksPerBatch: number | null;
  cells: number;
  memoryUsedMb: number | null;
  memoryTotalMb: number | null;
  memoryLimitMb: number | null;
};

export type TimingSamples = { samples: number; p50Ms: number; p95Ms: number; maxMs: number };
export type RenderLayerId = 'relief' | 'geology' | 'water' | 'minerals' | 'vegetation';
type TimingName = 'render' | 'simulation' | 'snapshot' | 'dynamicLayers' | 'waterMotion' | 'worker';
const MAX_TIMING_SAMPLES = 120;

/**
 * Client-side presentation telemetry. It deliberately has no simulation or
 * browser dependencies so the rolling calculations can be checked headlessly.
 */
export class PerformanceTracker {
  private readonly frameDeltas: number[] = [];
  private lastFrameAt: number | null = null;
  private phaserFps: number | null = null;
  private renderMs: number | null = null;
  private dynamicLayersMs: number | null = null;
  private readonly renderLayerMs: Record<RenderLayerId, number | null> = {
    relief: null, geology: null, water: null, minerals: null, vegetation: null,
  };
  private vegetationDetailMs = { grass: null as number | null, objects: null as number | null, shadows: null as number | null };
  private mineralDetailMs = {
    catalog: null as number | null,
    formations: null as number | null,
    visible: null as number | null,
    raster: null as number | null,
    sprites: null as number | null,
    created: null as number | null,
    pending: null as number | null,
  };
  private waterMotionMs: number | null = null;
  private waterDetailMs = { depth: null as number | null, geometry: null as number | null, surface: null as number | null };
  private waterSurfaceDetailMs = {
    cache: null as number | null,
    mask: null as number | null,
    chunks: null as number | null,
    dirtyChunks: null as number | null,
  };
  private simulationMs: number | null = null;
  private snapshotMs: number | null = null;
  private workerMs: number | null = null;
  private ticksPerBatch: number | null = null;
  private cells = 0;
  private memoryUsedMb: number | null = null;
  private memoryTotalMb: number | null = null;
  private memoryLimitMb: number | null = null;
  private readonly timingSamples: Record<TimingName, number[]> = {
    render: [], simulation: [], snapshot: [], dynamicLayers: [], waterMotion: [], worker: [],
  };

  recordFrame(timestampMs: number): void {
    if (!Number.isFinite(timestampMs)) return;
    if (this.lastFrameAt !== null) {
      const deltaMs = timestampMs - this.lastFrameAt;
      if (deltaMs > 0 && Number.isFinite(deltaMs)) {
        this.frameDeltas.push(deltaMs);
        if (this.frameDeltas.length > 60) this.frameDeltas.shift();
      }
    }
    this.lastFrameAt = timestampMs;
  }

  recordPhaserFps(fps: number): void {
    if (Number.isFinite(fps) && fps > 0) this.phaserFps = fps;
  }

  recordRender(elapsedMs: number): void {
    this.renderMs = validDuration(elapsedMs, this.renderMs);
    this.recordTiming('render', elapsedMs);
  }

  recordDynamicLayers(elapsedMs: number): void {
    this.dynamicLayersMs = validDuration(elapsedMs, this.dynamicLayersMs);
    this.recordTiming('dynamicLayers', elapsedMs);
  }

  recordRenderLayer(layer: RenderLayerId, elapsedMs: number): void {
    this.renderLayerMs[layer] = validDuration(elapsedMs, this.renderLayerMs[layer]);
  }

  recordVegetationDetail(grass: number, objects: number, shadows: number): void {
    this.vegetationDetailMs = {
      grass: validDuration(grass, this.vegetationDetailMs.grass),
      objects: validDuration(objects, this.vegetationDetailMs.objects),
      shadows: validDuration(shadows, this.vegetationDetailMs.shadows),
    };
  }

  recordMineralCatalog(elapsedMs: number, formations: number, visible: number): void {
    this.mineralDetailMs = {
      ...this.mineralDetailMs,
      catalog: validDuration(elapsedMs, this.mineralDetailMs.catalog),
      formations: validCount(formations, this.mineralDetailMs.formations),
      visible: validCount(visible, this.mineralDetailMs.visible),
    };
  }

  recordMineralCreation(rasterMs: number, spriteMs: number, created: number, pending: number): void {
    this.mineralDetailMs = {
      ...this.mineralDetailMs,
      raster: validDuration(rasterMs, this.mineralDetailMs.raster),
      sprites: validDuration(spriteMs, this.mineralDetailMs.sprites),
      created: validCount(created, this.mineralDetailMs.created),
      pending: validCount(pending, this.mineralDetailMs.pending),
    };
  }

  recordWaterMotion(elapsedMs: number): void {
    this.waterMotionMs = validDuration(elapsedMs, this.waterMotionMs);
    this.recordTiming('waterMotion', elapsedMs);
  }

  recordWaterDetail(depth: number, geometry: number, surface: number): void {
    this.waterDetailMs = {
      depth: validDuration(depth, this.waterDetailMs.depth),
      geometry: validDuration(geometry, this.waterDetailMs.geometry),
      surface: validDuration(surface, this.waterDetailMs.surface),
    };
  }

  recordWaterSurfaceDetail(cache: number, mask: number, chunks: number, dirtyChunks: number): void {
    this.waterSurfaceDetailMs = {
      cache: validDuration(cache, this.waterSurfaceDetailMs.cache),
      mask: validDuration(mask, this.waterSurfaceDetailMs.mask),
      chunks: validDuration(chunks, this.waterSurfaceDetailMs.chunks),
      dirtyChunks: validDuration(dirtyChunks, this.waterSurfaceDetailMs.dirtyChunks),
    };
  }

  recordSimulation(elapsedMs: number): void {
    this.simulationMs = validDuration(elapsedMs, this.simulationMs);
    this.recordTiming('simulation', elapsedMs);
  }

  recordSnapshot(elapsedMs: number): void {
    this.snapshotMs = validDuration(elapsedMs, this.snapshotMs);
    this.recordTiming('snapshot', elapsedMs);
  }

  recordWorker(elapsedMs: number, ticks: number): void {
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return;
    if (!Number.isFinite(ticks) || ticks <= 0) return;
    this.workerMs = elapsedMs;
    this.ticksPerBatch = ticks;
    this.recordTiming('worker', elapsedMs);
  }

  setCells(cells: number): void {
    this.cells = Number.isFinite(cells) && cells >= 0 ? Math.floor(cells) : 0;
  }

  setMemory(usedMb: number | null, totalMb: number | null, limitMb: number | null): void {
    this.memoryUsedMb = validOptionalValue(usedMb);
    this.memoryTotalMb = validOptionalValue(totalMb);
    this.memoryLimitMb = validOptionalValue(limitMb);
  }

  read(): PerformanceSnapshot {
    const frameMs = this.frameDeltas.length === 0
      ? null
      : this.frameDeltas.reduce((sum, deltaMs) => sum + deltaMs, 0) / this.frameDeltas.length;
    return {
      fps: frameMs === null ? null : 1000 / frameMs,
      frameMs,
      phaserFps: this.phaserFps,
      renderMs: this.renderMs,
      dynamicLayersMs: this.dynamicLayersMs,
      renderLayerMs: { ...this.renderLayerMs },
      vegetationDetailMs: { ...this.vegetationDetailMs },
      mineralDetailMs: { ...this.mineralDetailMs },
      waterMotionMs: this.waterMotionMs,
      waterDetailMs: { ...this.waterDetailMs },
      waterSurfaceDetailMs: { ...this.waterSurfaceDetailMs },
      simulationMs: this.simulationMs,
      snapshotMs: this.snapshotMs,
      renderSamples: summarize(this.timingSamples.render),
      simulationSamples: summarize(this.timingSamples.simulation),
      snapshotSamples: summarize(this.timingSamples.snapshot),
      workerMs: this.workerMs,
      ticksPerBatch: this.ticksPerBatch,
      cells: this.cells,
      memoryUsedMb: this.memoryUsedMb,
      memoryTotalMb: this.memoryTotalMb,
      memoryLimitMb: this.memoryLimitMb,
    };
  }

  reset(): void {
    this.frameDeltas.length = 0;
    this.lastFrameAt = null;
    this.phaserFps = null;
    this.renderMs = null;
    this.dynamicLayersMs = null;
    for (const layer of Object.keys(this.renderLayerMs) as RenderLayerId[]) this.renderLayerMs[layer] = null;
    this.vegetationDetailMs = { grass: null, objects: null, shadows: null };
    this.mineralDetailMs = { catalog: null, formations: null, visible: null, raster: null, sprites: null, created: null, pending: null };
    this.waterMotionMs = null;
    this.waterDetailMs = { depth: null, geometry: null, surface: null };
    this.waterSurfaceDetailMs = { cache: null, mask: null, chunks: null, dirtyChunks: null };
    this.simulationMs = null;
    this.snapshotMs = null;
    this.workerMs = null;
    this.ticksPerBatch = null;
    this.cells = 0;
    this.memoryUsedMb = null;
    this.memoryTotalMb = null;
    this.memoryLimitMb = null;
    for (const samples of Object.values(this.timingSamples)) samples.length = 0;
  }

  private recordTiming(name: TimingName, value: number): void {
    if (!Number.isFinite(value) || value < 0) return;
    const samples = this.timingSamples[name];
    samples.push(value);
    if (samples.length > MAX_TIMING_SAMPLES) samples.shift();
  }
}

function summarize(samples: readonly number[]): TimingSamples | null {
  if (samples.length === 0) return null;
  const ordered = [...samples].sort((left, right) => left - right);
  const percentile = (fraction: number): number => ordered[Math.max(0, Math.ceil(ordered.length * fraction) - 1)]!;
  return {
    samples: ordered.length,
    p50Ms: percentile(0.5),
    p95Ms: percentile(0.95),
    maxMs: ordered[ordered.length - 1]!,
  };
}

function validDuration(value: number, previous: number | null): number | null {
  return Number.isFinite(value) && value >= 0 ? value : previous;
}

function validOptionalValue(value: number | null): number | null {
  return value !== null && Number.isFinite(value) && value >= 0 ? value : null;
}

function validCount(value: number, previous: number | null): number | null {
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : previous;
}
