import { MAX_PENDING_CLIENT_REQUESTS, PROTOCOL_VERSION } from '../core/constants';
import type { WorkerRequest, WorkerResponse } from '../core/types';

export interface WorkerPort {
  postMessage(message: WorkerRequest): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<WorkerResponse>) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent<WorkerResponse>) => void): void;
  terminate?: () => void;
}

type RequestBody = WorkerRequest extends infer Request
  ? Request extends WorkerRequest
    ? Omit<Request, 'protocolVersion' | 'requestId'>
    : never
  : never;

export class SimulationRequestError extends Error {
  readonly code: string;
  readonly tick: number | null;
  readonly recoverable: boolean;

  constructor(response: Extract<WorkerResponse, { type: 'ERROR' }>) {
    super(response.message);
    this.name = 'SimulationRequestError';
    this.code = response.code;
    this.tick = response.tick;
    this.recoverable = response.recoverable;
  }
}

export class WorkerTransport {
  private nextRequestId = 1;
  private pending: { requestId: number; resolve: (response: WorkerResponse) => void; reject: (error: Error) => void } | null = null;
  private readonly listener: (event: MessageEvent<WorkerResponse>) => void;
  private closed = false;

  constructor(private readonly worker: WorkerPort) {
    this.listener = (event) => {
      const response = event.data;
      if (this.pending === null || response.requestId !== this.pending.requestId) return;
      const pending = this.pending;
      this.pending = null;
      if (response.type === 'ERROR') {
        pending.reject(new SimulationRequestError(response));
      } else if (response.protocolVersion !== PROTOCOL_VERSION) {
        pending.reject(new Error(`Resposta usa protocolo não suportado: ${response.protocolVersion}.`));
      } else {
        pending.resolve(response);
      }
    };
    this.worker.addEventListener('message', this.listener);
  }

  send(body: RequestBody): Promise<WorkerResponse> {
    if (this.closed) return Promise.reject(new Error('O transporte do Worker foi encerrado.'));
    if (this.pending !== null) return Promise.reject(new Error('Tentativa de enviar mais de um pedido ao Worker simultaneamente.'));
    if (this.nextRequestId > Number.MAX_SAFE_INTEGER) return Promise.reject(new Error('A sessão do Worker esgotou os requestId seguros.'));
    const request = { protocolVersion: PROTOCOL_VERSION, requestId: this.nextRequestId, ...body } as WorkerRequest;
    this.nextRequestId += 1;
    return new Promise((resolve, reject) => {
      this.pending = { requestId: request.requestId, resolve, reject };
      try {
        this.worker.postMessage(request);
      } catch (error) {
        this.pending = null;
        reject(error instanceof Error ? error : new Error('Falha ao enviar mensagem ao Worker.'));
      }
    });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.worker.removeEventListener('message', this.listener);
    this.worker.terminate?.();
    this.pending?.reject(new Error('O transporte do Worker foi encerrado.'));
    this.pending = null;
  }
}

export class SimulationClient {
  private readonly transport: WorkerTransport;
  private queueLength = 0;
  private serial: Promise<void> = Promise.resolve();
  private worldId: string | null = null;

  constructor(worker: WorkerPort) {
    this.transport = new WorkerTransport(worker);
  }

  createWorld(seed: string): Promise<Extract<WorkerResponse, { type: 'READY' }>> {
    return this.enqueue(async () => {
      const response = await this.transport.send({
        type: 'CREATE_WORLD',
        scenarioId: 'foundation:empty-world',
        scenarioVersion: '1.0.0',
        seed,
        config: {},
      });
      const ready = expectType(response, 'READY');
      this.worldId = ready.worldId;
      return ready;
    });
  }

  step(ticks: number): Promise<Extract<WorkerResponse, { type: 'ADVANCED' }>> {
    return this.enqueue(async () => expectType(await this.transport.send({ type: 'STEP', worldId: this.requireWorldId(), ticks }), 'ADVANCED'));
  }

  getSnapshot(): Promise<Extract<WorkerResponse, { type: 'SNAPSHOT' }>> {
    return this.enqueue(async () => expectType(await this.transport.send({ type: 'GET_SNAPSHOT', worldId: this.requireWorldId() }), 'SNAPSHOT'));
  }

  save(): Promise<Extract<WorkerResponse, { type: 'SAVED' }>> {
    return this.enqueue(async () => expectType(await this.transport.send({ type: 'SAVE', worldId: this.requireWorldId() }), 'SAVED'));
  }

  load(save: unknown): Promise<Extract<WorkerResponse, { type: 'LOADED' }>> {
    return this.enqueue(async () => {
      const loaded = expectType(await this.transport.send({ type: 'LOAD', save }), 'LOADED');
      this.worldId = loaded.worldId;
      return loaded;
    });
  }

  dispose(): Promise<Extract<WorkerResponse, { type: 'DISPOSED' }>> {
    return this.enqueue(async () => {
      const disposed = expectType(await this.transport.send({ type: 'DISPOSE', worldId: this.requireWorldId() }), 'DISPOSED');
      this.worldId = null;
      return disposed;
    });
  }

  close(): void {
    this.transport.close();
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    if (this.queueLength >= MAX_PENDING_CLIENT_REQUESTS) {
      return Promise.reject(new Error(`A fila do cliente atingiu o limite de ${MAX_PENDING_CLIENT_REQUESTS} operações.`));
    }
    this.queueLength += 1;
    const result = this.serial.then(operation);
    this.serial = result.then(() => undefined, () => undefined).finally(() => {
      this.queueLength -= 1;
    });
    return result;
  }

  private requireWorldId(): string {
    if (this.worldId === null) throw new Error('Crie ou carregue um mundo antes de usar esta operação.');
    return this.worldId;
  }
}

function expectType<Type extends WorkerResponse['type']>(response: WorkerResponse, type: Type): Extract<WorkerResponse, { type: Type }> {
  if (response.type !== type) throw new Error(`Resposta inesperada: ${response.type}; esperado ${type}.`);
  return response as Extract<WorkerResponse, { type: Type }>;
}
