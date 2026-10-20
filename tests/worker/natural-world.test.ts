import { describe, expect, it } from 'vitest';
import { MAX_RESPONSE_BYTES, MAX_WORLD_BYTES, NATURAL_SCENARIO_VERSION } from '../../src/core/constants';
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
    snapshot.snapshot.tick = -1;
    const isolated = expectResponse(engine.handle(request(6, { type: 'GET_SNAPSHOT', worldId: loaded.worldId })), 'SNAPSHOT');
    expect(isolated.snapshot.tick).toBe(16);
  }, 30_000);

  it('usa a cópia do postMessage como fronteira do snapshot no Worker real', () => {
    const engine = new WorkerEngine({
      createWorldId: () => 'world-natural-transfer-test',
      snapshotOwnership: 'post-message',
    });
    const ready = expectResponse(engine.handle(request(1, {
      type: 'CREATE_WORLD',
      scenarioId: 'natural:temperate-valley',
      scenarioVersion: NATURAL_SCENARIO_VERSION,
      seed: '0123456789abcdef',
      config: {},
    })), 'READY');
    const workerResponse = expectResponse(engine.handle(request(2, { type: 'GET_SNAPSHOT', worldId: ready.worldId })), 'SNAPSHOT');
    const repeatedResponse = expectResponse(engine.handle(request(3, { type: 'GET_SNAPSHOT', worldId: ready.worldId })), 'SNAPSHOT');
    expect(repeatedResponse.snapshot).toBe(workerResponse.snapshot);

    const delivered = structuredClone(repeatedResponse);
    expect(utf8ByteLength(canonicalStringify(delivered))).toBeLessThan(MAX_RESPONSE_BYTES);
    delivered.snapshot.tick = 999;
    const nextResponse = expectResponse(engine.handle(request(4, { type: 'GET_SNAPSHOT', worldId: ready.worldId })), 'SNAPSHOT');
    expect(nextResponse.snapshot.tick).toBe(0);
  }, 30_000);
});
