import { MAX_STEP_TICKS } from '../core/constants';
import type { WorkerResponse } from '../core/types';
import { SimulationClient } from './worker-transport';

export type DriverState = 'paused' | 'running' | 'pausing';
export type DriverCallbacks = {
  onState: (state: DriverState) => void;
  onAdvanced: (response: Extract<WorkerResponse, { type: 'ADVANCED' }>) => void | Promise<void>;
  onStepTiming?: (timing: { elapsedMs: number; ticks: number }) => void;
  onError: (error: Error) => void;
};

export class StepDriver {
  private running = false;
  private timer: ReturnType<typeof globalThis.setTimeout> | null = null;
  private inFlight: Promise<void> | null = null;
  private ticksPerSecond = 1;

  constructor(private readonly client: SimulationClient, private readonly callbacks: DriverCallbacks) {}

  resume(ticksPerSecond = this.ticksPerSecond): void {
    if (!Number.isFinite(ticksPerSecond) || ticksPerSecond <= 0 || ticksPerSecond > MAX_STEP_TICKS * 4) {
      throw new RangeError('A velocidade deve estar entre 0 e 1.024 ticks por segundo.');
    }
    this.ticksPerSecond = ticksPerSecond;
    if (this.running) {
      this.cancelTimer();
      this.scheduleNext();
      return;
    }
    this.running = true;
    this.callbacks.onState('running');
    this.scheduleNext();
  }

  setSpeed(ticksPerSecond: number): void {
    if (!Number.isFinite(ticksPerSecond) || ticksPerSecond <= 0 || ticksPerSecond > MAX_STEP_TICKS * 4) {
      throw new RangeError('A velocidade deve estar entre 0 e 1.024 ticks por segundo.');
    }
    this.ticksPerSecond = ticksPerSecond;
    if (this.running) {
      this.cancelTimer();
      this.scheduleNext();
    }
  }

  async pause(): Promise<void> {
    if (!this.running && this.inFlight === null) {
      this.callbacks.onState('paused');
      return;
    }
    this.running = false;
    this.cancelTimer();
    this.callbacks.onState('pausing');
    await this.inFlight;
    this.callbacks.onState('paused');
  }

  isRunning(): boolean {
    return this.running;
  }

  private scheduleNext(): void {
    if (!this.running || this.inFlight !== null || this.timer !== null) return;
    const ticks = Math.min(MAX_STEP_TICKS, Math.max(1, Math.round(this.ticksPerSecond * 0.25)));
    const delayMs = Math.max(10, Math.round((ticks / this.ticksPerSecond) * 1000));
    this.timer = globalThis.setTimeout(() => {
      this.timer = null;
      if (!this.running) return;
      const operation = this.runScheduledStep(ticks);
      this.inFlight = operation;
      void operation.finally(() => {
        if (this.inFlight === operation) this.inFlight = null;
        if (this.running) this.scheduleNext();
      });
    }, delayMs);
  }

  private async runScheduledStep(ticks: number): Promise<void> {
    try {
      const startedAt = now();
      const response = await this.client.step(ticks);
      this.callbacks.onStepTiming?.({ elapsedMs: Math.max(0, now() - startedAt), ticks });
      await this.callbacks.onAdvanced(response);
    } catch (error) {
      this.running = false;
      this.cancelTimer();
      this.callbacks.onState('paused');
      this.callbacks.onError(error instanceof Error ? error : new Error('Falha no driver da simulação.'));
    }
  }

  private cancelTimer(): void {
    if (this.timer !== null) {
      globalThis.clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

function now(): number {
  return globalThis.performance?.now() ?? Date.now();
}
