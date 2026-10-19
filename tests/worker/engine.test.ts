import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WorkerEngine } from '../../src/worker/engine';
import { validateWorkerRequest } from '../../src/worker/protocol';
import { logicalStateString } from '../../src/core/canonical-json';
import { drawFromSystem } from '../../src/core/rng';
import type { WorkerRequest, WorkerResponse } from '../../src/core/types';

const validCreate = JSON.parse(readFileSync(new URL('../../data/fixtures/spec-000/valid-create-world.json', import.meta.url), 'utf8')) as WorkerRequest;
const validSave = JSON.parse(readFileSync(new URL('../../data/fixtures/spec-000/valid-save.json', import.meta.url), 'utf8')) as Record<string, unknown>;

function request(requestId: number, body: Record<string, unknown>): unknown {
  return { protocolVersion: 1, requestId, ...body };
}

function expectError(response: WorkerResponse, code: string): Extract<WorkerResponse, { type: 'ERROR' }> {
  expect(response.type).toBe('ERROR');
  const error = response as Extract<WorkerResponse, { type: 'ERROR' }>;
  expect(error.code).toBe(code);
  return error;
}

describe('SPEC-000 · Worker protocol', () => {
  it('aceita fixture válida, cria um mundo e publica snapshot completo', () => {
    const engine = new WorkerEngine({ createWorldId: () => 'world-fixture' });
    expect(validateWorkerRequest(validCreate).ok).toBe(true);
    const ready = engine.handle(validCreate);
    expect(ready).toMatchObject({ type: 'READY', requestId: 1, worldId: 'world-fixture', tick: 0, seed: '0000000000000000' });
    const snapshot = engine.handle(request(2, { type: 'GET_SNAPSHOT', worldId: 'world-fixture' }));
    expect(snapshot).toMatchObject({ type: 'SNAPSHOT', requestId: 2, snapshot: { tick: 0, entities: [], metrics: {} } });
  });

  it('rejeita versões desconhecidas, mensagens malformadas e campos extras', () => {
    const engine = new WorkerEngine();
    expectError(engine.handle({ protocolVersion: 2, requestId: 1, type: 'GET_SNAPSHOT', worldId: 'world-x' }), 'UNSUPPORTED_PROTOCOL');
    expectError(engine.handle({ protocolVersion: 0, requestId: 2, type: 'GET_SNAPSHOT', worldId: 'world-x' }), 'INVALID_MESSAGE');
    const malformedEnvelope = expectError(engine.handle({ protocolVersion: 1, requestId: 0, type: 'GET_SNAPSHOT', worldId: 'world-x' }), 'INVALID_MESSAGE');
    expect(malformedEnvelope.requestId).toBe(0);
    const invalidExtra = JSON.parse(readFileSync(new URL('../../data/fixtures/spec-000/invalid-create-unknown-field.json', import.meta.url), 'utf8')) as unknown;
    expectError(engine.handle(invalidExtra), 'INVALID_MESSAGE');
    expectError(engine.handle({ protocolVersion: 1, requestId: 2, type: 'STEP', worldId: 'world-x', ticks: 1.5 }), 'INVALID_MESSAGE');
    const ready = engine.handle(request(3, { type: 'CREATE_WORLD', scenarioId: 'foundation:empty-world', scenarioVersion: '1.0.0', seed: '0000000000000000', config: {} }));
    expect(ready.type).toBe('READY');
  });

  it('aplica limite de 1–256 ticks e rejeita requestIds repetidos sem executar novamente', () => {
    const engine = new WorkerEngine();
    const ready = engine.handle(request(1, { type: 'CREATE_WORLD', scenarioId: 'foundation:empty-world', scenarioVersion: '1.0.0', seed: '0000000000000000', config: {} }));
    if (ready.type !== 'READY') throw new Error('READY esperado.');
    expectError(engine.handle(request(2, { type: 'STEP', worldId: ready.worldId, ticks: 0 })), 'STEP_LIMIT_EXCEEDED');
    expectError(engine.handle(request(3, { type: 'STEP', worldId: ready.worldId, ticks: 257 })), 'STEP_LIMIT_EXCEEDED');
    expectError(engine.handle(request(2, { type: 'STEP', worldId: ready.worldId, ticks: 1 })), 'DUPLICATE_REQUEST');
    expect(engine.handle(request(4, { type: 'GET_SNAPSHOT', worldId: ready.worldId })).type === 'SNAPSHOT').toBe(true);
  });

  it('não substitui o mundo ativo num CREATE_WORLD e permite LOAD atômico com novo worldId', () => {
    let worldNumber = 0;
    const engine = new WorkerEngine({ createWorldId: () => `world-${++worldNumber}` });
    const ready = engine.handle(request(1, { type: 'CREATE_WORLD', scenarioId: 'foundation:empty-world', scenarioVersion: '1.0.0', seed: '0000000000000000', config: {} }));
    if (ready.type !== 'READY') throw new Error('READY esperado.');
    expectError(engine.handle(request(2, { type: 'CREATE_WORLD', scenarioId: 'foundation:empty-world', scenarioVersion: '1.0.0', seed: '1111111111111111', config: {} })), 'WORLD_ALREADY_ACTIVE');
    const loaded = engine.handle(request(3, { type: 'LOAD', save: validSave }));
    expect(loaded).toMatchObject({ type: 'LOADED', worldId: 'world-2', tick: 0 });
    const stale = engine.handle(request(4, { type: 'GET_SNAPSHOT', worldId: ready.worldId }));
    expectError(stale, 'UNKNOWN_WORLD');
  });

  it('recusa save inválido sem alterar o mundo ativo e valida truncamento/versão', () => {
    const engine = new WorkerEngine();
    const ready = engine.handle(request(1, { type: 'CREATE_WORLD', scenarioId: 'foundation:empty-world', scenarioVersion: '1.0.0', seed: '0000000000000000', config: {} }));
    if (ready.type !== 'READY') throw new Error('READY esperado.');
    const truncated = JSON.parse(readFileSync(new URL('../../data/fixtures/spec-000/invalid-save-truncated.json', import.meta.url), 'utf8')) as unknown;
    expectError(engine.handle(request(2, { type: 'LOAD', save: truncated })), 'INVALID_SAVE');
    expectError(engine.handle(request(3, { type: 'LOAD', save: { ...validSave, saveSchemaVersion: 99 } })), 'UNSUPPORTED_SAVE_VERSION');
    const snapshot = engine.handle(request(4, { type: 'GET_SNAPSHOT', worldId: ready.worldId }));
    expect(snapshot).toMatchObject({ type: 'SNAPSHOT', worldId: ready.worldId, snapshot: { tick: 0, seed: '0000000000000000' } });
  });

  it('salva e restaura continuação, RNG, agenda e estado lógico', () => {
    const engine = new WorkerEngine();
    const ready = engine.handle(request(1, { type: 'CREATE_WORLD', scenarioId: 'foundation:empty-world', scenarioVersion: '1.0.0', seed: '0000000000000000', config: {} }));
    if (ready.type !== 'READY') throw new Error('READY esperado.');
    engine.handle(request(2, { type: 'STEP', worldId: ready.worldId, ticks: 12 }));
    const saved = engine.handle(request(3, { type: 'SAVE', worldId: ready.worldId }));
    if (saved.type !== 'SAVED') throw new Error('SAVED esperado.');
    const loaded = engine.handle(request(4, { type: 'LOAD', save: saved.save }));
    if (loaded.type !== 'LOADED') throw new Error('LOADED esperado.');
    expect(loaded.worldId).not.toBe(ready.worldId);
    expect(loaded.tick).toBe(12);
    const snapshot = engine.handle(request(5, { type: 'GET_SNAPSHOT', worldId: loaded.worldId }));
    expect(snapshot).toMatchObject({ type: 'SNAPSHOT', snapshot: { tick: 12, seed: '0000000000000000', rng: saved.save.rng } });
    const continued = engine.handle(request(6, { type: 'STEP', worldId: loaded.worldId, ticks: 5 }));
    expect(continued).toMatchObject({ type: 'ADVANCED', tickFrom: 12, tickTo: 17, completedTicks: 5 });
  });

  it('retoma do save com o mesmo fluxo aleatório e os mesmos resultados lógicos', () => {
    const systems = [{
      id: 'core:save-rng-fixture',
      order: 1,
      run: (draft: import('../../src/core/types').WorldState) => {
        const draw = drawFromSystem(draft.rng, draft.seed, 'core:save-rng-fixture');
        draft.metrics['drawSum'] = (draft.metrics['drawSum'] ?? 0) + draw;
      },
    }];
    const uninterrupted = new WorkerEngine({ systems });
    const ready = uninterrupted.handle(request(1, { type: 'CREATE_WORLD', scenarioId: 'foundation:empty-world', scenarioVersion: '1.0.0', seed: '0000000000000000', config: {} }));
    if (ready.type !== 'READY') throw new Error('READY esperado.');
    uninterrupted.handle(request(2, { type: 'STEP', worldId: ready.worldId, ticks: 4 }));
    const saved = uninterrupted.handle(request(3, { type: 'SAVE', worldId: ready.worldId }));
    if (saved.type !== 'SAVED') throw new Error('SAVED esperado.');
    const uninterruptedStep = uninterrupted.handle(request(4, { type: 'STEP', worldId: ready.worldId, ticks: 7 }));
    const uninterruptedSnapshot = uninterrupted.handle(request(5, { type: 'GET_SNAPSHOT', worldId: ready.worldId }));

    const resumed = new WorkerEngine({ systems });
    const loaded = resumed.handle(request(1, { type: 'LOAD', save: saved.save }));
    if (loaded.type !== 'LOADED') throw new Error('LOADED esperado.');
    const resumedStep = resumed.handle(request(2, { type: 'STEP', worldId: loaded.worldId, ticks: 7 }));
    const resumedSnapshot = resumed.handle(request(3, { type: 'GET_SNAPSHOT', worldId: loaded.worldId }));

    expect(uninterruptedStep).toMatchObject({ type: 'ADVANCED', tickFrom: 4, tickTo: 11 });
    expect(resumedStep).toMatchObject({ type: 'ADVANCED', tickFrom: 4, tickTo: 11 });
    if (uninterruptedSnapshot.type !== 'SNAPSHOT' || resumedSnapshot.type !== 'SNAPSHOT') throw new Error('SNAPSHOT esperado.');
    expect(logicalStateString(uninterruptedSnapshot.snapshot)).toBe(logicalStateString(resumedSnapshot.snapshot));
    expect(resumedSnapshot.snapshot.rng.streams['core:save-rng-fixture']?.draws).toBe(11);
  });

  it('marca falha de tick, conserva último estado válido e exige LOAD/DISPOSE para retomar', () => {
    const engine = new WorkerEngine({ systems: [{ id: 'core:fault-fixture', order: 1, run: (_draft, tick) => { if (tick === 4) throw new Error('fault injection'); } }] });
    const ready = engine.handle(request(1, { type: 'CREATE_WORLD', scenarioId: 'foundation:empty-world', scenarioVersion: '1.0.0', seed: '0000000000000000', config: {} }));
    if (ready.type !== 'READY') throw new Error('READY esperado.');
    const failure = expectError(engine.handle(request(2, { type: 'STEP', worldId: ready.worldId, ticks: 8 })), 'INVARIANT_VIOLATION');
    expect(failure).toMatchObject({ completedTicks: 3, lastValidTick: 3, systemId: 'core:fault-fixture', tick: 3, simulationVersion: '0.1.0', seed: '0000000000000000' });
    const snapshot = engine.handle(request(3, { type: 'GET_SNAPSHOT', worldId: ready.worldId }));
    expect(snapshot).toMatchObject({ type: 'SNAPSHOT', snapshot: { tick: 3 }, diagnostics: { faulted: true, systemId: 'core:fault-fixture' } });
    expectError(engine.handle(request(4, { type: 'STEP', worldId: ready.worldId, ticks: 1 })), 'WORLD_FAULTED');
    const saved = engine.handle(request(5, { type: 'SAVE', worldId: ready.worldId }));
    expect(saved).toMatchObject({ type: 'SAVED', tick: 3 });
  });

  it('descarta o mundo e libera a sessão para criar outro', () => {
    const engine = new WorkerEngine();
    const ready = engine.handle(request(1, { type: 'CREATE_WORLD', scenarioId: 'foundation:empty-world', scenarioVersion: '1.0.0', seed: '0000000000000000', config: {} }));
    if (ready.type !== 'READY') throw new Error('READY esperado.');
    expect(engine.handle(request(2, { type: 'DISPOSE', worldId: ready.worldId }))).toMatchObject({ type: 'DISPOSED' });
    expect(engine.handle(request(3, { type: 'CREATE_WORLD', scenarioId: 'foundation:empty-world', scenarioVersion: '1.0.0', seed: '1111111111111111', config: {} })).type).toBe('READY');
  });
});
