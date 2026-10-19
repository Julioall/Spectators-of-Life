import {
  EMPTY_SCENARIO_ID,
  EMPTY_SCENARIO_VERSION,
  RNG_ALGORITHM,
  RNG_SEED_DERIVATION,
  SAVE_FORMAT,
  SAVE_SCHEMA_VERSION,
  SIMULATION_VERSION,
} from './constants';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type RandomStreamState = {
  state: [number, number, number, number];
  draws: number;
};

export type RandomState = {
  algorithm: typeof RNG_ALGORITHM;
  derivation: typeof RNG_SEED_DERIVATION;
  streams: Record<string, RandomStreamState>;
};

export type ActiveModule = {
  id: string;
  version: string;
  checksum: string;
};

export type SystemSchedule = {
  systemId: string;
  periodTicks: number;
  nextTick: number;
};

export type EntityState = {
  id: string;
  kind: string;
  [key: string]: JsonValue;
};

export type SimulationEvent = {
  tick: number;
  systemId: string;
  eventType: string;
  actorIds: string[];
  data: { [key: string]: JsonValue };
};

export type WorldState = {
  simulationVersion: typeof SIMULATION_VERSION;
  scenarioId: typeof EMPTY_SCENARIO_ID;
  scenarioVersion: typeof EMPTY_SCENARIO_VERSION;
  seed: string;
  tick: number;
  config: Record<string, never>;
  activeModules: ActiveModule[];
  rng: RandomState;
  schedules: SystemSchedule[];
  entities: EntityState[];
  metrics: Record<string, number>;
};

export type SaveDocument = {
  format: typeof SAVE_FORMAT;
  saveSchemaVersion: typeof SAVE_SCHEMA_VERSION;
  simulationVersion: typeof SIMULATION_VERSION;
  scenarioId: typeof EMPTY_SCENARIO_ID;
  scenarioVersion: typeof EMPTY_SCENARIO_VERSION;
  seed: string;
  tick: number;
  config: Record<string, never>;
  activeModules: ActiveModule[];
  rng: RandomState;
  schedules: SystemSchedule[];
  entities: EntityState[];
  metrics: Record<string, number>;
};

export type WorkerRequest =
  | {
      protocolVersion: 1;
      requestId: number;
      type: 'CREATE_WORLD';
      scenarioId: string;
      scenarioVersion: string;
      seed: string;
      config: Record<string, unknown>;
    }
  | {
      protocolVersion: 1;
      requestId: number;
      type: 'STEP';
      worldId: string;
      ticks: number;
    }
  | { protocolVersion: 1; requestId: number; type: 'GET_SNAPSHOT'; worldId: string }
  | { protocolVersion: 1; requestId: number; type: 'SAVE'; worldId: string }
  | { protocolVersion: 1; requestId: number; type: 'LOAD'; save: unknown }
  | { protocolVersion: 1; requestId: number; type: 'DISPOSE'; worldId: string };

export type WorkerResponse =
  | {
      protocolVersion: number;
      requestId: number;
      type: 'READY';
      worldId: string;
      simulationVersion: string;
      scenarioId: string;
      scenarioVersion: string;
      seed: string;
      tick: number;
    }
  | {
      protocolVersion: number;
      requestId: number;
      type: 'ADVANCED';
      worldId: string;
      tickFrom: number;
      tickTo: number;
      completedTicks: number;
      events: SimulationEvent[];
      eventsOmitted: number;
      diagnostics: { durationMs: number; simulationVersion: string; seed: string };
    }
  | {
      protocolVersion: number;
      requestId: number;
      type: 'SNAPSHOT';
      worldId: string;
      snapshot: WorldState;
      diagnostics?: { faulted: true; message: string; systemId?: string; entityId?: string };
    }
  | {
      protocolVersion: number;
      requestId: number;
      type: 'SAVED';
      worldId: string;
      save: SaveDocument;
      saveSchemaVersion: number;
      tick: number;
    }
  | {
      protocolVersion: number;
      requestId: number;
      type: 'LOADED';
      worldId: string;
      simulationVersion: string;
      scenarioId: string;
      scenarioVersion: string;
      seed: string;
      tick: number;
    }
  | { protocolVersion: number; requestId: number; type: 'DISPOSED'; worldId: string }
  | {
      protocolVersion: number;
      requestId: number;
      type: 'ERROR';
      code: string;
      message: string;
      recoverable: boolean;
      tick: number | null;
      simulationVersion?: string;
      seed?: string;
      systemId?: string;
      entityId?: string;
      completedTicks?: number;
      lastValidTick?: number;
      worldId?: string;
    };

export type TickSystem = {
  id: string;
  order: number;
  run: (draft: WorldState, tick: number) => readonly SimulationEvent[] | void;
};

export type StepResult = {
  state: WorldState;
  tickFrom: number;
  tickTo: number;
  completedTicks: number;
  events: SimulationEvent[];
  eventsOmitted: number;
};

export type FaultDiagnostic = {
  message: string;
  systemId?: string;
  entityId?: string;
};

export type LogicalStateEnvelope = {
  worldId?: string;
  state: WorldState;
};
