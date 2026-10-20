import { describe, expect, it } from 'vitest';
import { MAX_SAFE_TICK } from '../../src/core/constants';
import { ContractError, StepFaultError } from '../../src/core/errors';
import { drawFromSystem, nextUint32, deriveStreamState, splitMix64Outputs } from '../../src/core/rng';
import { createEmptyWorld, stepWorld, toSaveDocument, validateSaveDocument, worldFromSave } from '../../src/core/world';
import { canonicalStringify, cloneValidatedJson, logicalStateString } from '../../src/core/canonical-json';
import type { TickSystem } from '../../src/core/types';

function emptyWorld(seed = '0000000000000000', systems: readonly TickSystem[] = []) {
  return createEmptyWorld({ scenarioId: 'foundation:empty-world', scenarioVersion: '1.0.0', seed, config: {}, systems });
}

describe('SPEC-000 · core headless', () => {
  it('clona estado JSON validado sem mudar semântica canônica nem compartilhar objetos', () => {
    const source = { elevation: -0, cells: [{ water: -0, biomass: 3 }] };
    const copy = cloneValidatedJson(source);
    expect(copy).not.toBe(source);
    expect(copy.cells).not.toBe(source.cells);
    expect(copy.cells[0]).not.toBe(source.cells[0]);
    expect(Object.is(copy.elevation, -0)).toBe(false);
    expect(Object.is(copy.cells[0]!.water, -0)).toBe(false);
    expect(canonicalStringify(copy)).toBe(canonicalStringify(source));
    copy.cells[0]!.biomass = 8;
    expect(source.cells[0]!.biomass).toBe(3);
  });

  it('cria o mundo vazio no tick zero e avança exatamente a quantidade pedida', () => {
    const world = emptyWorld();
    expect(world.tick).toBe(0);
    expect(world.entities).toEqual([]);
    expect(stepWorld(world, 17).state.tick).toBe(17);
    expect(world.tick).toBe(0);
  });

  it('produz o mesmo estado e eventos para passos particionados ou contínuos', () => {
    const systems = [{
      id: 'core:fixture-counter',
      order: 1,
      periodTicks: 1,
      phaseOffsetTicks: 0,
      run: (draft: ReturnType<typeof emptyWorld>, tick: number) => {
        draft.metrics['counter'] = (draft.metrics['counter'] ?? 0) + 1;
        return [{ tick, systemId: 'core:fixture-counter', eventType: 'fixture:tick', actorIds: [], data: { counter: draft.metrics['counter'] } }];
      },
    }];
    const combined = stepWorld(emptyWorld('0000000000000000', systems), 100, systems);
    const first = stepWorld(emptyWorld('0000000000000000', systems), 40, systems);
    const second = stepWorld(first.state, 60, systems);
    expect(logicalStateString(combined.state)).toBe(logicalStateString(second.state));
    expect([...first.events, ...second.events]).toEqual(combined.events);
    expect(combined.eventsOmitted).toBe(0);
  });

  it('repete snapshots canônicos para a mesma seed e sequência de comandos', () => {
    const systems = [{
      id: 'core:replay-fixture',
      order: 1,
      periodTicks: 1,
      phaseOffsetTicks: 0,
      run: (draft: ReturnType<typeof emptyWorld>, tick: number) => {
        const draw = drawFromSystem(draft.rng, draft.seed, 'core:replay-fixture');
        draft.metrics['drawTotal'] = (draft.metrics['drawTotal'] ?? 0) + draw;
        return [{ tick, systemId: 'core:replay-fixture', eventType: 'fixture:draw', actorIds: [], data: { draw } }];
      },
    }];
    const replay = () => {
      let state = emptyWorld('0123456789abcdef', systems);
      const events = [];
      for (const ticks of [3, 8, 1]) {
        const result = stepWorld(state, ticks, systems);
        state = result.state;
        events.push(...result.events);
      }
      return { state, events };
    };
    const first = replay();
    const second = replay();
    expect(logicalStateString(first.state)).toBe(logicalStateString(second.state));
    expect(first.events).toEqual(second.events);
  });

  it('reproduz os fluxos por seed e systemId, e registra o cursor no save', () => {
    const worldA = emptyWorld();
    const worldB = emptyWorld();
    const drawsA = Array.from({ length: 6 }, () => drawFromSystem(worldA.rng, worldA.seed, 'core:foundation'));
    const drawsB = Array.from({ length: 6 }, () => drawFromSystem(worldB.rng, worldB.seed, 'core:foundation'));
    expect(drawsA).toEqual(drawsB);
    expect(deriveStreamState('0000000000000000', 'core:foundation')).toEqual({
      state: [372660700, 1130640584, 3951875994, 232408429],
      draws: 0,
    });
    const save = toSaveDocument(worldA);
    expect(validateSaveDocument(save).ok).toBe(true);
    const resumed = worldFromSave(save);
    expect(drawFromSystem(worldA.rng, worldA.seed, 'core:foundation')).toBe(drawFromSystem(resumed.rng, resumed.seed, 'core:foundation'));
    expect(resumed.rng.streams['core:foundation']?.draws).toBe(7);
  });

  it('segue os vetores de referência SplitMix64 e xoshiro128** 1.1', () => {
    expect(splitMix64Outputs(0n, 2).map((value) => value.toString(16).padStart(16, '0'))).toEqual([
      'e220a8397b1dcdaf', '6e789e6aa1b965f4',
    ]);
    expect(deriveStreamState('0000000000000000', 'core:foundation').state).toEqual([372660700, 1130640584, 3951875994, 232408429]);
    const stream = { state: [1, 2, 3, 4] as [number, number, number, number], draws: 0 };
    expect(Array.from({ length: 8 }, () => nextUint32(stream))).toEqual([
      11520, 0, 5927040, 70819200, 2031721883, 1637235492, 1287239034, 3734860849,
    ]);
  });

  it('preserva o último tick completo em uma falha no meio do lote', () => {
    const systems = [{
      id: 'core:fault-fixture',
      order: 1,
      periodTicks: 1,
      phaseOffsetTicks: 0,
      run: (draft: ReturnType<typeof emptyWorld>, tick: number) => {
        draft.metrics['lastCommitted'] = tick;
        if (tick === 4) throw Object.assign(new Error('falha fixture'), { entityId: 'fixture:entity-1' });
      },
    }];
    let failure: unknown;
    try {
      stepWorld(emptyWorld('0000000000000000', systems), 8, systems);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(StepFaultError);
    const fault = failure as StepFaultError;
    expect(fault.completedTicks).toBe(3);
    expect(fault.lastValidState.tick).toBe(3);
    expect(fault.lastValidState.metrics['lastCommitted']).toBe(3);
    expect(fault.diagnostic).toEqual({ message: 'falha fixture', systemId: 'core:fault-fixture', entityId: 'fixture:entity-1' });
  });

  it('recusa overflow e lotes inválidos antes de alterar o estado', () => {
    const nearLimit = { ...emptyWorld(), tick: MAX_SAFE_TICK - 1 };
    expect(() => stepWorld(nearLimit, 2)).toThrowError(ContractError);
    expect(nearLimit.tick).toBe(MAX_SAFE_TICK - 1);
    expect(() => stepWorld(emptyWorld(), 0)).toThrowError(/1 a 256/);
    expect(() => stepWorld(emptyWorld(), 257)).toThrowError(/1 a 256/);
    expect(() => emptyWorld('ABCDEF0000000000')).toThrowError(/16 dígitos hexadecimais minúsculos/);
  });
});
