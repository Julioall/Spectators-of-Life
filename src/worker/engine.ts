import { MAX_RESPONSE_BYTES, MAX_WORLD_BYTES, PROTOCOL_VERSION, SAVE_SCHEMA_VERSION } from '../core/constants';
import { canonicalStringify, cloneJson, utf8ByteLength } from '../core/canonical-json';
import { ContractError, StepFaultError } from '../core/errors';
import { createEmptyWorld, stepWorld, toSaveDocument, worldFromSave } from '../core/world';
import type { FaultDiagnostic, SaveDocument, TickSystem, WorkerRequest, WorkerResponse, WorldState } from '../core/types';
import { validateWorkerRequest } from './protocol';

type EngineOptions = {
  systems?: readonly TickSystem[];
  createWorldId?: () => string;
};

type FaultState = { faulted: true; diagnostic: FaultDiagnostic } | null;

export class WorkerEngine {
  private world: WorldState | null = null;
  private worldId: string | null = null;
  private fault: FaultState = null;
  private highestRequestId = 0;
  private generatedWorldNumber = 0;
  private readonly systems: readonly TickSystem[];
  private readonly makeWorldId: () => string;

  constructor(options: EngineOptions = {}) {
    this.systems = options.systems ?? [];
    this.makeWorldId = options.createWorldId ?? (() => {
      this.generatedWorldNumber += 1;
      return `world-${this.generatedWorldNumber.toString(36)}`;
    });
  }

  handle(raw: unknown): WorkerResponse {
    const validation = validateWorkerRequest(raw);
    const hasVersionOneEnvelope = isRecord(raw) && raw['protocolVersion'] === PROTOCOL_VERSION;
    if (validation.requestId > 0 && validation.protocolVersion === PROTOCOL_VERSION && hasVersionOneEnvelope) {
      if (validation.requestId <= this.highestRequestId) {
        return this.error(validation.requestId, validation.protocolVersion, 'DUPLICATE_REQUEST', 'requestId deve ser estritamente crescente nesta sessão.', true, this.world?.tick ?? null, this.worldId ?? undefined);
      }
      this.highestRequestId = validation.requestId;
    }
    if (!validation.ok) return this.error(validation.requestId, validation.protocolVersion, validation.code, validation.message, true, this.world?.tick ?? null, this.worldId ?? undefined);

    const request = validation.request;

    try {
      let response: WorkerResponse;
      switch (request.type) {
        case 'CREATE_WORLD':
          response = this.create(request);
          break;
        case 'STEP':
          response = this.step(request);
          break;
        case 'GET_SNAPSHOT':
          response = this.snapshot(request);
          break;
        case 'SAVE':
          response = this.save(request);
          break;
        case 'LOAD':
          response = this.load(request);
          break;
        case 'DISPOSE':
          response = this.dispose(request);
          break;
      }
      return this.limitResponse(response, request);
    } catch (error) {
      if (error instanceof ContractError) {
        const requestedWorldId = 'worldId' in request ? request.worldId : this.worldId ?? undefined;
        return this.error(request.requestId, request.protocolVersion, error.code, error.message, error.recoverable, this.world?.tick ?? null, requestedWorldId);
      }
      const message = error instanceof Error ? error.message : 'Falha interna ao processar o pedido.';
      const requestedWorldId = 'worldId' in request ? request.worldId : this.worldId ?? undefined;
      return this.error(request.requestId, request.protocolVersion, 'INTERNAL_ERROR', message, false, this.world?.tick ?? null, requestedWorldId);
    }
  }

  private create(request: Extract<WorkerRequest, { type: 'CREATE_WORLD' }>): WorkerResponse {
    if (this.world !== null) throw new ContractError('WORLD_ALREADY_ACTIVE', 'Já existe um mundo ativo; use LOAD para substituí-lo ou DISPOSE para liberá-lo.');
    const world: WorldState = createEmptyWorld({
      scenarioId: request.scenarioId,
      scenarioVersion: request.scenarioVersion,
      seed: request.seed,
      config: request.config,
    });
    const worldId = this.makeWorldId();
    this.world = world;
    this.worldId = worldId;
    this.fault = null;
    return {
      protocolVersion: PROTOCOL_VERSION,
      requestId: request.requestId,
      type: 'READY',
      worldId,
      simulationVersion: world.simulationVersion,
      scenarioId: world.scenarioId,
      scenarioVersion: world.scenarioVersion,
      seed: world.seed,
      tick: world.tick,
    };
  }

  private step(request: Extract<WorkerRequest, { type: 'STEP' }>): WorkerResponse {
    this.requireWorld(request.worldId);
    if (this.fault?.faulted === true) {
      return this.error(request.requestId, request.protocolVersion, 'WORLD_FAULTED', 'O mundo está faulted; carregue um save válido, descarte-o ou recrie-o.', false, this.world?.tick ?? null, this.worldId ?? undefined, this.fault.diagnostic);
    }
    const initial = this.world as WorldState;
    const startedAt = clockNow();
    try {
      const result = stepWorld(initial, request.ticks, this.systems);
      this.world = result.state;
      return {
        protocolVersion: PROTOCOL_VERSION,
        requestId: request.requestId,
        type: 'ADVANCED',
        worldId: this.worldId as string,
        tickFrom: result.tickFrom,
        tickTo: result.tickTo,
        completedTicks: result.completedTicks,
        events: result.events,
        eventsOmitted: result.eventsOmitted,
        diagnostics: { durationMs: roundDiagnostic(clockNow() - startedAt), simulationVersion: result.state.simulationVersion, seed: result.state.seed },
      };
    } catch (error) {
      if (error instanceof StepFaultError) {
        this.world = error.lastValidState;
        this.fault = { faulted: true, diagnostic: error.diagnostic };
        return this.error(request.requestId, request.protocolVersion, 'INVARIANT_VIOLATION', error.message, false, this.world.tick, this.worldId ?? undefined, error.diagnostic, error.completedTicks, this.world.tick);
      }
      throw error;
    }
  }

  private snapshot(request: Extract<WorkerRequest, { type: 'GET_SNAPSHOT' }>): WorkerResponse {
    this.requireWorld(request.worldId);
    const snapshot = cloneJson(this.world as WorldState);
    const response = {
      protocolVersion: PROTOCOL_VERSION,
      requestId: request.requestId,
      type: 'SNAPSHOT' as const,
      worldId: this.worldId as string,
      snapshot,
      ...(this.fault === null ? {} : { diagnostics: { faulted: true as const, ...this.fault.diagnostic } }),
    };
    if (encodedSize(response) > MAX_RESPONSE_BYTES) {
      return this.error(request.requestId, request.protocolVersion, 'RESPONSE_TOO_LARGE', 'O snapshot excede o limite de resposta.', false, snapshot.tick, this.worldId ?? undefined);
    }
    return response;
  }

  private save(request: Extract<WorkerRequest, { type: 'SAVE' }>): WorkerResponse {
    this.requireWorld(request.worldId);
    const save = toSaveDocument(this.world as WorldState);
    if (encodedSize(save) > MAX_WORLD_BYTES) throw new ContractError('SAVE_TOO_LARGE', 'O save excede o limite de bytes definido para F0.');
    return {
      protocolVersion: PROTOCOL_VERSION,
      requestId: request.requestId,
      type: 'SAVED',
      worldId: this.worldId as string,
      save,
      saveSchemaVersion: SAVE_SCHEMA_VERSION,
      tick: save.tick,
    };
  }

  private load(request: Extract<WorkerRequest, { type: 'LOAD' }>): WorkerResponse {
    const save = request.save as SaveDocument;
    if (encodedSize(save) > MAX_WORLD_BYTES) throw new ContractError('INVALID_SAVE', 'O save excede o limite de bytes definido para F0.');
    const world = worldFromSave(save);
    const worldId = this.makeWorldId();
    this.world = world;
    this.worldId = worldId;
    this.fault = null;
    return {
      protocolVersion: PROTOCOL_VERSION,
      requestId: request.requestId,
      type: 'LOADED',
      worldId,
      simulationVersion: world.simulationVersion,
      scenarioId: world.scenarioId,
      scenarioVersion: world.scenarioVersion,
      seed: world.seed,
      tick: world.tick,
    };
  }

  private dispose(request: Extract<WorkerRequest, { type: 'DISPOSE' }>): WorkerResponse {
    this.requireWorld(request.worldId);
    const worldId = this.worldId as string;
    this.world = null;
    this.worldId = null;
    this.fault = null;
    return { protocolVersion: PROTOCOL_VERSION, requestId: request.requestId, type: 'DISPOSED', worldId };
  }

  private requireWorld(expectedWorldId: string): void {
    if (this.world === null || this.worldId !== expectedWorldId) throw new ContractError('UNKNOWN_WORLD', 'worldId não corresponde ao mundo ativo.');
  }

  private error(
    requestId: number,
    protocolVersion: number,
    code: string,
    message: string,
    recoverable: boolean,
    tick: number | null = this.world?.tick ?? null,
    worldId?: string,
    diagnostic?: FaultDiagnostic,
    completedTicks?: number,
    lastValidTick?: number,
  ): WorkerResponse {
    return {
      protocolVersion,
      requestId,
      type: 'ERROR',
      code,
      message: message.slice(0, 1024),
      recoverable,
      tick,
      ...(this.world === null ? {} : { simulationVersion: this.world.simulationVersion, seed: this.world.seed }),
      ...(worldId === undefined ? {} : { worldId }),
      ...(diagnostic?.systemId === undefined ? {} : { systemId: diagnostic.systemId }),
      ...(diagnostic?.entityId === undefined ? {} : { entityId: diagnostic.entityId }),
      ...(completedTicks === undefined ? {} : { completedTicks }),
      ...(lastValidTick === undefined ? {} : { lastValidTick }),
    };
  }

  private limitResponse(response: WorkerResponse, request: WorkerRequest): WorkerResponse {
    if (encodedSize(response) <= MAX_RESPONSE_BYTES) return response;
    if (response.type === 'ADVANCED') {
      const events = [...response.events];
      let omitted = response.eventsOmitted;
      let candidate: WorkerResponse = response;
      while (events.length > 0 && encodedSize(candidate) > MAX_RESPONSE_BYTES) {
        events.pop();
        omitted += 1;
        candidate = { ...response, events, eventsOmitted: omitted };
      }
      if (encodedSize(candidate) <= MAX_RESPONSE_BYTES) return candidate;
    }
    return this.error(request.requestId, request.protocolVersion, 'RESPONSE_TOO_LARGE', 'A resposta excede o limite de bytes definido para F0.', false, this.world?.tick ?? null, this.worldId ?? undefined);
  }
}

function encodedSize(value: unknown): number {
  return utf8ByteLength(canonicalStringify(value));
}

function clockNow(): number {
  return globalThis.performance?.now() ?? 0;
}

function roundDiagnostic(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * 1000) / 1000;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
