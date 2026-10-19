import { describe, expect, it, vi } from 'vitest';
import { WorkerEngine } from '../../src/worker/engine';
import type { WorkerRequest, WorkerResponse } from '../../src/core/types';
import { SimulationClient, type WorkerPort } from '../../src/client/worker-transport';
import { StepDriver, type DriverState } from '../../src/client/step-driver';

class FakeWorker implements WorkerPort {
  private readonly listeners = new Set<(event: MessageEvent<WorkerResponse>) => void>();
  readonly pending: WorkerRequest[] = [];
  maxInFlight = 0;
  holdResponses = false;
  private readonly engine = new WorkerEngine();

  postMessage(message: WorkerRequest): void {
    this.pending.push(message);
    this.maxInFlight = Math.max(this.maxInFlight, this.pending.length);
    if (!this.holdResponses) queueMicrotask(() => this.respondNext());
  }

  addEventListener(_type: 'message', listener: (event: MessageEvent<WorkerResponse>) => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'message', listener: (event: MessageEvent<WorkerResponse>) => void): void {
    this.listeners.delete(listener);
  }

  respondNext(): WorkerRequest | undefined {
    const request = this.pending.shift();
    if (request === undefined) return undefined;
    const response = this.engine.handle(request);
    const event = new MessageEvent<WorkerResponse>('message', { data: response });
    for (const listener of this.listeners) listener(event);
    return request;
  }
}

describe('cliente serial e driver de ticks', () => {
  it('mantém no máximo um pedido em voo e correlaciona a fila pelo requestId', async () => {
    const worker = new FakeWorker();
    const client = new SimulationClient(worker);
    await client.createWorld('0000000000000000');
    const [advanced, snapshot, saved] = await Promise.all([client.step(5), client.getSnapshot(), client.save()]);
    expect(advanced.tickTo).toBe(5);
    expect(snapshot.snapshot.tick).toBe(5);
    expect(saved.tick).toBe(5);
    expect(worker.maxInFlight).toBe(1);
    client.close();
  });

  it('confirma pausa somente depois de concluir o lote já enviado e sua leitura', async () => {
    vi.useFakeTimers();
    try {
      const worker = new FakeWorker();
      const client = new SimulationClient(worker);
      await client.createWorld('0000000000000000');
      worker.holdResponses = true;
      const states: DriverState[] = [];
      const driver = new StepDriver(client, {
        onState: (state) => states.push(state),
        onAdvanced: async () => { await client.getSnapshot(); },
        onError: (error) => { throw error; },
      });
      driver.resume(32);
      await vi.advanceTimersByTimeAsync(250);
      expect(worker.pending).toHaveLength(1);
      expect(worker.pending[0]?.type).toBe('STEP');

      const pause = driver.pause();
      expect(states).toEqual(['running', 'pausing']);
      worker.respondNext();
      for (let index = 0; index < 20 && worker.pending.length === 0; index += 1) await Promise.resolve();
      expect(worker.pending).toHaveLength(1);
      expect(worker.pending[0]?.type).toBe('GET_SNAPSHOT');
      expect(states).toEqual(['running', 'pausing']);
      worker.respondNext();
      await pause;

      expect(states.at(-1)).toBe('paused');
      expect(worker.pending).toHaveLength(0);
      expect(worker.maxInFlight).toBe(1);
      expect(vi.getTimerCount()).toBe(0);
      client.close();
    } finally {
      vi.useRealTimers();
    }
  });
});
