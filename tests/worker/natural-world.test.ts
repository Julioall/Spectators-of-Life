import { describe, expect, it } from 'vitest';
import { MAX_WORLD_BYTES, NATURAL_SCENARIO_VERSION } from '../../src/core/constants';
import { canonicalStringify, utf8ByteLength } from '../../src/core/canonical-json';
import { WorkerEngine } from '../../src/worker/engine';
import type { WorkerResponse } from '../../src/core/types';

function request(requestId: number, body: Record<string, unknown>): unknown {
  return { protocolVersion: 1, requestId, ...body };
}

function expectResponse<Type extends WorkerResponse['type']>(response: WorkerResponse, type: Type): Extract<WorkerResponse, { type: Type }> {
  expect(response.type).toBe(type);
  return response as Extract<WorkerResponse, { type: Type }>;
}

describe('cenário natural no Worker', () => {
  it('cria, avança, salva e retoma um mundo com estado ambiental completo', () => {
    const engine = new WorkerEngine({ createWorldId: () => 'world-natural-test' });
    const ready = expectResponse(engine.handle(request(1, {
      type: 'CREATE_WORLD',
      scenarioId: 'natural:temperate-valley',
      scenarioVersion: NATURAL_SCENARIO_VERSION,
      seed: '0000000000000006',
      config: {},
    })), 'READY');
    expect(ready).toMatchObject({ scenarioId: 'natural:temperate-valley', scenarioVersion: NATURAL_SCENARIO_VERSION, simulationVersion: '0.2.0', tick: 0 });

    const advanced = expectResponse(engine.handle(request(2, { type: 'STEP', worldId: ready.worldId, ticks: 16 })), 'ADVANCED');
    expect(advanced.tickTo).toBe(16);
    const saved = expectResponse(engine.handle(request(3, { type: 'SAVE', worldId: ready.worldId })), 'SAVED');
    expect(utf8ByteLength(canonicalStringify(saved.save))).toBeLessThan(MAX_WORLD_BYTES);

    const loaded = expectResponse(engine.handle(request(4, { type: 'LOAD', save: saved.save })), 'LOADED');
    expect(loaded.scenarioId).toBe('natural:temperate-valley');
    const snapshot = expectResponse(engine.handle(request(5, { type: 'GET_SNAPSHOT', worldId: loaded.worldId })), 'SNAPSHOT');
    expect(snapshot.snapshot.entities[0]?.kind).toBe('natural-world');
    expect(snapshot.snapshot.entities[0]?.['cells']).toHaveLength(80 * 56);
  }, 30_000);
});
