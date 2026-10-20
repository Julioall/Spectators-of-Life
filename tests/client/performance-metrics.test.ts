import { describe, expect, it } from 'vitest';
import { PerformanceTracker } from '../../src/client/performance-metrics';

describe('métricas de desempenho da apresentação', () => {
  it('calcula FPS e tempo médio de frame com amostras determinísticas', () => {
    const tracker = new PerformanceTracker();
    for (const timestamp of [0, 16, 32, 48]) tracker.recordFrame(timestamp);
    tracker.recordPhaserFps(59.5);
    tracker.recordRender(3.2);
    tracker.recordDynamicLayers(1.8);
    tracker.recordWaterMotion(0.4);
    tracker.recordSimulation(7.1);
    tracker.recordSnapshot(9.4);
    tracker.recordWorker(12.5, 4);
    tracker.setCells(128);
    tracker.setMemory(128, 256, 4096);

    expect(tracker.read()).toEqual({
      fps: 62.5,
      frameMs: 16,
      phaserFps: 59.5,
      renderMs: 3.2,
      dynamicLayersMs: 1.8,
      waterMotionMs: 0.4,
      simulationMs: 7.1,
      snapshotMs: 9.4,
      renderSamples: { samples: 1, p50Ms: 3.2, p95Ms: 3.2, maxMs: 3.2 },
      simulationSamples: { samples: 1, p50Ms: 7.1, p95Ms: 7.1, maxMs: 7.1 },
      snapshotSamples: { samples: 1, p50Ms: 9.4, p95Ms: 9.4, maxMs: 9.4 },
      workerMs: 12.5,
      ticksPerBatch: 4,
      cells: 128,
      memoryUsedMb: 128,
      memoryTotalMb: 256,
      memoryLimitMb: 4096,
    });
  });

  it('ignora amostras inválidas e permite reiniciar o painel', () => {
    const tracker = new PerformanceTracker();
    tracker.recordFrame(Number.NaN);
    tracker.recordFrame(10);
    tracker.recordFrame(10);
    tracker.recordPhaserFps(0);
    tracker.recordRender(-1);
    tracker.recordDynamicLayers(Number.NaN);
    tracker.recordWaterMotion(Number.POSITIVE_INFINITY);
    tracker.recordWorker(-1, 0);
    tracker.setCells(-2);
    tracker.setMemory(-1, Number.NaN, null);
    expect(tracker.read()).toEqual({
      fps: null,
      frameMs: null,
      phaserFps: null,
      renderMs: null,
      dynamicLayersMs: null,
      waterMotionMs: null,
      simulationMs: null,
      snapshotMs: null,
      renderSamples: null,
      simulationSamples: null,
      snapshotSamples: null,
      workerMs: null,
      ticksPerBatch: null,
      cells: 0,
      memoryUsedMb: null,
      memoryTotalMb: null,
      memoryLimitMb: null,
    });

    tracker.recordWorker(4, 2);
    tracker.setCells(3.9);
    tracker.reset();
    expect(tracker.read()).toEqual({
      fps: null,
      frameMs: null,
      phaserFps: null,
      renderMs: null,
      dynamicLayersMs: null,
      waterMotionMs: null,
      simulationMs: null,
      snapshotMs: null,
      renderSamples: null,
      simulationSamples: null,
      snapshotSamples: null,
      workerMs: null,
      ticksPerBatch: null,
      cells: 0,
      memoryUsedMb: null,
      memoryTotalMb: null,
      memoryLimitMb: null,
    });
  });

  it('mantém P50/P95/max separados numa janela móvel de 120 medições', () => {
    const tracker = new PerformanceTracker();
    for (let value = 1; value <= 121; value += 1) tracker.recordRender(value);
    expect(tracker.read().renderSamples).toEqual({ samples: 120, p50Ms: 61, p95Ms: 115, maxMs: 121 });
  });
});
