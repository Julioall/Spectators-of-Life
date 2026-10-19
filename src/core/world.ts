import {
  EMPTY_SCENARIO_ID,
  EMPTY_SCENARIO_VERSION,
  MAX_EVENTS_PER_RESPONSE,
  MAX_ENTITIES,
  MAX_WORLD_STATE_BYTES,
  MAX_MODULES,
  MAX_SAFE_TICK,
  MAX_SCHEDULES,
  MAX_STEP_TICKS,
  SIMULATION_VERSION,
} from './constants';
import { canonicalStringify, cloneJson, utf8ByteLength } from './canonical-json';
import { ContractError, StepFaultError } from './errors';
import { createRandomState, validateRandomState } from './rng';
import type { SaveDocument, SimulationEvent, StepResult, TickSystem, WorldState } from './types';

export type CreateWorldInput = {
  scenarioId: string;
  scenarioVersion: string;
  seed: string;
  config: unknown;
};

export function createEmptyWorld(input: CreateWorldInput): WorldState {
  if (input.scenarioId !== EMPTY_SCENARIO_ID || input.scenarioVersion !== EMPTY_SCENARIO_VERSION) {
    throw new ContractError('INVALID_SCENARIO', `Cenário não suportado: ${input.scenarioId}@${input.scenarioVersion}.`);
  }
  if (!/^[0-9a-f]{16}$/.test(input.seed)) {
    throw new ContractError('INVALID_SCENARIO', 'A seed deve conter 16 dígitos hexadecimais minúsculos.');
  }
  if (!isEmptyObject(input.config)) {
    throw new ContractError('INVALID_SCENARIO', 'O cenário vazio não aceita parâmetros adicionais.');
  }
  return {
    simulationVersion: SIMULATION_VERSION,
    scenarioId: EMPTY_SCENARIO_ID,
    scenarioVersion: EMPTY_SCENARIO_VERSION,
    seed: input.seed,
    tick: 0,
    config: {},
    activeModules: [],
    rng: createRandomState(),
    schedules: [],
    entities: [],
    metrics: {},
  };
}

export function isEmptyObject(value: unknown): value is Record<string, never> {
  return isRecord(value) && Object.keys(value).length === 0;
}

export function validateWorldState(value: unknown): value is WorldState {
  if (!isRecord(value)) return false;
  const world = value as Record<string, unknown>;
  const expectedKeys = ['activeModules', 'config', 'entities', 'metrics', 'rng', 'scenarioId', 'scenarioVersion', 'schedules', 'seed', 'simulationVersion', 'tick'];
  if (Object.keys(world).sort().join(',') !== expectedKeys.join(',')) return false;
  if (!isJsonValue(world)) return false;
  if (world['simulationVersion'] !== SIMULATION_VERSION || world['scenarioId'] !== EMPTY_SCENARIO_ID || world['scenarioVersion'] !== EMPTY_SCENARIO_VERSION) return false;
  if (typeof world['seed'] !== 'string' || !/^[0-9a-f]{16}$/.test(world['seed'])) return false;
  if (!Number.isSafeInteger(world['tick']) || (world['tick'] as number) < 0) return false;
  if (!isEmptyObject(world['config'])) return false;
  if (!Array.isArray(world['activeModules']) || world['activeModules'].length > MAX_MODULES) return false;
  if (!Array.isArray(world['schedules']) || world['schedules'].length > MAX_SCHEDULES) return false;
  if (!Array.isArray(world['entities']) || world['entities'].length > MAX_ENTITIES) return false;
  if (world['metrics'] === null || typeof world['metrics'] !== 'object' || Array.isArray(world['metrics'])) return false;
  if (!isJsonValue(world['metrics'])) return false;
  if (!validateRandomState(world['rng'])) return false;
  try {
    assertSortedUniqueModules(world['activeModules']);
    assertSortedUniqueSchedules(world['schedules']);
    assertSortedUniqueEntities(world['entities']);
  } catch {
    return false;
  }
  for (const metric of Object.values(world['metrics'] as Record<string, unknown>)) {
    if (typeof metric !== 'number' || !Number.isFinite(metric)) return false;
  }
  if (!world['entities'].every((entity) => isJsonValue(entity))) return false;
  return true;
}

export function assertWorldState(value: unknown): asserts value is WorldState {
  if (!validateWorldState(value)) {
    throw new ContractError('INVALID_SAVE', 'O estado lógico não satisfaz os invariantes F0.');
  }
}

function assertSortedUniqueModules(value: unknown[]): void {
  let previous = '';
  for (const raw of value) {
    if (!isRecord(raw) || Object.keys(raw).sort().join(',') !== 'checksum,id,version') throw new Error('Módulo inválido.');
    if (typeof raw['id'] !== 'string' || !isStableId(raw['id'])) throw new Error('ID de módulo inválido.');
    if (typeof raw['version'] !== 'string' || !/^\d+\.\d+\.\d+$/.test(raw['version'])) throw new Error('Versão de módulo inválida.');
    if (typeof raw['checksum'] !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(raw['checksum'])) throw new Error('Checksum de módulo inválido.');
    if (raw['id'] <= previous) throw new Error('Módulos fora de ordem ou duplicados.');
    previous = raw['id'];
  }
}

function assertSortedUniqueSchedules(value: unknown[]): void {
  let previous = '';
  for (const raw of value) {
    if (!isRecord(raw) || Object.keys(raw).sort().join(',') !== 'nextTick,periodTicks,systemId') throw new Error('Agenda inválida.');
    if (typeof raw['systemId'] !== 'string' || !isStableId(raw['systemId']) || raw['systemId'] <= previous) throw new Error('systemId da agenda inválido ou duplicado.');
    if (!Number.isSafeInteger(raw['periodTicks']) || (raw['periodTicks'] as number) <= 0) throw new Error('periodTicks inválido.');
    if (!Number.isSafeInteger(raw['nextTick']) || (raw['nextTick'] as number) < 0) throw new Error('nextTick inválido.');
    previous = raw['systemId'];
  }
}

function assertSortedUniqueEntities(value: unknown[]): void {
  let previous = '';
  for (const raw of value) {
    if (!isRecord(raw) || typeof raw['id'] !== 'string' || raw['id'].length === 0 || raw['id'].length > 128) throw new Error('Entidade inválida.');
    if (raw['id'] <= previous) throw new Error('Entidades fora de ordem ou duplicadas.');
    if (typeof raw['kind'] !== 'string' || raw['kind'].length === 0) throw new Error('Tipo de entidade inválido.');
    previous = raw['id'];
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isStableId(value: string): boolean {
  return value.length > 0 && value.length <= 128 && /^[a-z][a-z0-9]*(?:[.:/_-][a-z0-9]+)*$/.test(value);
}

export function toSaveDocument(world: WorldState): SaveDocument {
  assertWorldState(world);
  return {
    format: 'spectators-of-life-save',
    saveSchemaVersion: 1,
    simulationVersion: world.simulationVersion,
    scenarioId: world.scenarioId,
    scenarioVersion: world.scenarioVersion,
    seed: world.seed,
    tick: world.tick,
    config: cloneJson(world.config),
    activeModules: cloneJson(world.activeModules),
    rng: cloneJson(world.rng),
    schedules: cloneJson(world.schedules),
    entities: cloneJson(world.entities),
    metrics: cloneJson(world.metrics),
  };
}

export function worldFromSave(save: SaveDocument): WorldState {
  const world: WorldState = {
    simulationVersion: save.simulationVersion,
    scenarioId: save.scenarioId,
    scenarioVersion: save.scenarioVersion,
    seed: save.seed,
    tick: save.tick,
    config: cloneJson(save.config),
    activeModules: cloneJson(save.activeModules),
    rng: cloneJson(save.rng),
    schedules: cloneJson(save.schedules),
    entities: cloneJson(save.entities),
    metrics: cloneJson(save.metrics),
  };
  assertWorldState(world);
  return world;
}

export type SaveValidationResult = { ok: true; save: SaveDocument } | { ok: false; code: 'INVALID_SAVE' | 'UNSUPPORTED_SAVE_VERSION'; message: string };

export function validateSaveDocument(value: unknown): SaveValidationResult {
  if (!isRecord(value)) return { ok: false, code: 'INVALID_SAVE', message: 'O save deve ser um objeto JSON.' };
  if (value['saveSchemaVersion'] !== 1) {
    return { ok: false, code: 'UNSUPPORTED_SAVE_VERSION', message: `Versão de save não suportada: ${String(value['saveSchemaVersion'])}.` };
  }
  const expectedKeys = ['activeModules', 'config', 'entities', 'format', 'metrics', 'rng', 'saveSchemaVersion', 'scenarioId', 'scenarioVersion', 'schedules', 'seed', 'simulationVersion', 'tick'];
  if (Object.keys(value).sort().join(',') !== expectedKeys.join(',')) return { ok: false, code: 'INVALID_SAVE', message: 'O save contém campos ausentes ou desconhecidos.' };
  if (value['format'] !== 'spectators-of-life-save' || value['simulationVersion'] !== SIMULATION_VERSION) {
    return { ok: false, code: 'INVALID_SAVE', message: 'Formato ou versão de simulação incompatível.' };
  }
  if (value['scenarioId'] !== EMPTY_SCENARIO_ID || value['scenarioVersion'] !== EMPTY_SCENARIO_VERSION) {
    return { ok: false, code: 'INVALID_SAVE', message: 'Cenário do save não suportado.' };
  }
  const state: unknown = {
    simulationVersion: value['simulationVersion'],
    scenarioId: value['scenarioId'],
    scenarioVersion: value['scenarioVersion'],
    seed: value['seed'],
    tick: value['tick'],
    config: value['config'],
    activeModules: value['activeModules'],
    rng: value['rng'],
    schedules: value['schedules'],
    entities: value['entities'],
    metrics: value['metrics'],
  };
  if (!validateWorldState(state)) return { ok: false, code: 'INVALID_SAVE', message: 'O estado do save é inválido ou viola limites/invariantes.' };
  return { ok: true, save: cloneJson(value) as SaveDocument };
}

export function stepWorld(initial: WorldState, ticks: number, systems: readonly TickSystem[] = []): StepResult {
  assertWorldState(initial);
  if (!Number.isSafeInteger(ticks) || ticks < 1 || ticks > MAX_STEP_TICKS) {
    throw new ContractError('STEP_LIMIT_EXCEEDED', `STEP aceita de 1 a ${MAX_STEP_TICKS} ticks inteiros.`);
  }
  if (initial.tick > MAX_SAFE_TICK - ticks) {
    throw new ContractError('TICK_OVERFLOW', 'O avanço excederia o maior tick inteiro seguro.', true);
  }
  const orderedSystems = [...systems].sort((left, right) => left.order - right.order || compareAscii(left.id, right.id));
  const seenSystemIds = new Set<string>();
  for (const system of orderedSystems) {
    if (!isStableId(system.id) || !Number.isSafeInteger(system.order) || seenSystemIds.has(system.id)) {
      throw new ContractError('INVARIANT_VIOLATION', 'Lista de sistemas inválida ou com IDs duplicados.', false);
    }
    seenSystemIds.add(system.id);
  }

  let committed = initial;
  const events: SimulationEvent[] = [];
  let eventsOmitted = 0;
  for (let index = 0; index < ticks; index += 1) {
    const nextTick = committed.tick + 1;
    const draft = cloneJson(committed);
    draft.tick = nextTick;
    try {
      for (const system of orderedSystems) {
        let produced: readonly SimulationEvent[] | void;
        try {
          produced = system.run(draft, nextTick);
        } catch (error) {
          throw makeSystemFault(error, system.id);
        }
        if (produced !== undefined) {
          if (!Array.isArray(produced)) throw makeSystemFault(new Error('Sistema deve retornar uma lista de eventos.'), system.id);
          for (const event of produced) {
            if (!isEvent(event, nextTick, system.id)) throw makeSystemFault(new Error('Sistema retornou evento fora do contrato.'), system.id);
            try {
              if (events.length < MAX_EVENTS_PER_RESPONSE) events.push(cloneJson(event));
              else eventsOmitted += 1;
            } catch (error) {
              throw makeSystemFault(error, system.id);
            }
          }
        }
      }
      try {
        assertWorldState(draft);
        if (utf8ByteLength(canonicalStringify(draft)) > MAX_WORLD_STATE_BYTES) {
          throw new ContractError('INVARIANT_VIOLATION', `O estado lógico excede o limite F0 de ${MAX_WORLD_STATE_BYTES} bytes.`, false);
        }
      } catch (error) {
        const lastSystem = orderedSystems.at(-1);
        throw makeSystemFault(error, lastSystem?.id ?? 'core:invariant-validation');
      }
      committed = draft;
    } catch (error) {
      const diagnostic = error instanceof FaultCarrier ? error.diagnostic : { message: error instanceof Error ? error.message : 'Falha de simulação.' };
      throw new StepFaultError(committed, index, diagnostic);
    }
  }
  return { state: committed, tickFrom: initial.tick, tickTo: committed.tick, completedTicks: ticks, events, eventsOmitted };
}

class FaultCarrier extends Error {
  readonly diagnostic: { message: string; systemId?: string; entityId?: string };

  constructor(message: string, systemId?: string, entityId?: string) {
    super(message);
    this.name = 'FaultCarrier';
    this.diagnostic = {
      message,
      ...(systemId === undefined ? {} : { systemId }),
      ...(entityId === undefined ? {} : { entityId }),
    };
  }
}

function makeSystemFault(error: unknown, systemId: string): FaultCarrier {
  const message = (error instanceof Error ? error.message : 'Sistema lançou erro não textual.').slice(0, 512);
  const entityId = error !== null && typeof error === 'object' && 'entityId' in error && typeof error.entityId === 'string' ? error.entityId : undefined;
  return new FaultCarrier(message, systemId, entityId);
}

function isEvent(value: unknown, tick: number, systemId: string): value is SimulationEvent {
  if (!isRecord(value)) return false;
  return value['tick'] === tick
    && value['systemId'] === systemId
    && typeof value['eventType'] === 'string'
    && value['eventType'].length > 0
    && value['eventType'].length <= 128
    && Array.isArray(value['actorIds'])
    && value['actorIds'].length <= 256
    && value['actorIds'].every((actorId) => typeof actorId === 'string' && actorId.length <= 128)
    && isRecord(value['data'])
    && isJsonValue(value['data']);
}

function isJsonValue(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype || Object.keys(value).length !== value.length) return false;
    if (seen.has(value)) return false;
    seen.add(value);
    const valid = value.every((item) => isJsonValue(item, seen));
    seen.delete(value);
    return valid;
  }
  if (value !== null && typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    if (seen.has(value)) return false;
    seen.add(value);
    const valid = Object.values(value as Record<string, unknown>).every((item) => item !== undefined && isJsonValue(item, seen));
    seen.delete(value);
    return valid;
  }
  return false;
}

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
