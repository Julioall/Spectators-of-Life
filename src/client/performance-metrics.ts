export type PerformanceSnapshot = {
  fps: number | null;
  frameMs: number | null;
  phaserFps: number | null;
  renderMs: number | null;
  dynamicLayersMs: number | null;
  waterMotionMs: number | null;
  workerMs: number | null;
  ticksPerBatch: number | null;
  cells: number;
  memoryUsedMb: number | null;
  memoryTotalMb: number | null;
  memoryLimitMb: number | null;
};

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
  private waterMotionMs: number | null = null;
  private workerMs: number | null = null;
  private ticksPerBatch: number | null = null;
  private cells = 0;
  private memoryUsedMb: number | null = null;
  private memoryTotalMb: number | null = null;
  private memoryLimitMb: number | null = null;

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
  }

  recordDynamicLayers(elapsedMs: number): void {
    this.dynamicLayersMs = validDuration(elapsedMs, this.dynamicLayersMs);
  }

  recordWaterMotion(elapsedMs: number): void {
    this.waterMotionMs = validDuration(elapsedMs, this.waterMotionMs);
  }

  recordWorker(elapsedMs: number, ticks: number): void {
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return;
    if (!Number.isFinite(ticks) || ticks <= 0) return;
    this.workerMs = elapsedMs;
    this.ticksPerBatch = ticks;
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
      waterMotionMs: this.waterMotionMs,
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
    this.waterMotionMs = null;
    this.workerMs = null;
    this.ticksPerBatch = null;
    this.cells = 0;
    this.memoryUsedMb = null;
    this.memoryTotalMb = null;
    this.memoryLimitMb = null;
  }
}

function validDuration(value: number, previous: number | null): number | null {
  return Number.isFinite(value) && value >= 0 ? value : previous;
}

function validOptionalValue(value: number | null): number | null {
  return value !== null && Number.isFinite(value) && value >= 0 ? value : null;
}
