import { describe, expect, it } from 'vitest';
import { MAX_EVENTS_PER_RESPONSE } from '../../src/core/constants';
import { logicalStateString } from '../../src/core/canonical-json';
import { recordFoodMetricTransition, summarizeFoodCounterWindow, summarizeFoodSeedRuns, summarizeFoodTransitions, summarizeLegacyDiscreteFoodMetric, type FeedingTransition } from '../../src/core/food-metrics';
import { createEmptyWorld, createSystemSchedules, stepWorld, toSaveDocument, worldFromSave } from '../../src/core/world';
import type { TickSystem } from '../../src/core/types';

const foodFilter = { speciesId: 'fixture:herbivore', lifeStageId: 'adult' };
const foodWindow = { fromTickExclusive: 0, toTickInclusive: 3 };

function world(systems: readonly TickSystem[] = []) {
  return createEmptyWorld({
    scenarioId: 'foundation:empty-world',
    scenarioVersion: '1.0.0',
    seed: '0123456789abcdef',
    config: {},
    systems,
  });
}

function knownFoodTransitions(): FeedingTransition[] {
  return [
    {
      tick: 1,
      eligibleAtStart: [{ individualId: 'animal:a', ...foodFilter }],
      ingestion: [{ individualId: 'animal:a', dryMatterGrams: 2 }],
      attempts: [{ individualId: 'animal:a', status: 'completed', consumed: true }],
    },
    {
      tick: 2,
      eligibleAtStart: [
        { individualId: 'animal:a', ...foodFilter },
        { individualId: 'animal:b', ...foodFilter },
      ],
      ingestion: [
        { individualId: 'animal:a', dryMatterGrams: 1 },
        { individualId: 'animal:b', dryMatterGrams: 3 },
      ],
      attempts: [
        { individualId: 'animal:a', status: 'completed', consumed: false },
        { individualId: 'animal:b', status: 'pending' },
      ],
    },
    {
      tick: 3,
      eligibleAtStart: [{ individualId: 'animal:b', ...foodFilter }],
      ingestion: [{ individualId: 'animal:b', dryMatterGrams: 2 }],
      attempts: [{ individualId: 'animal:b', status: 'completed', consumed: true }],
    },
  ];
}

describe('SPEC-001 · relógio lógico e métricas de alimentação', () => {
  it('recusa tick inicial inválido e definições de sistema sem callback executável', () => {
    expect(() => createSystemSchedules([], -1)).toThrow(/tick inicial/i);
    expect(() => createSystemSchedules([], Number.NaN)).toThrow(/tick inicial/i);
    expect(() => createSystemSchedules([{
      id: 'fixture:missing-run',
      order: 1,
      periodTicks: 1,
      phaseOffsetTicks: 0,
      run: undefined,
    } as unknown as TickSystem], 0)).toThrow(/lista de sistemas inválida/i);
  });

  it('agenda sistemas por período/fase e mantém STEP particionado equivalente', () => {
    const makeSystems = (): TickSystem[] => [{
      id: 'fixture:climate',
      order: 1,
      periodTicks: 5,
      phaseOffsetTicks: 2,
      run: (draft, tick, context) => {
        draft.metrics['updates'] = (draft.metrics['updates'] ?? 0) + 1;
        draft.metrics['elapsedTicks'] = (draft.metrics['elapsedTicks'] ?? 0) + context.elapsedTicks;
        return [{
          tick,
          systemId: 'fixture:climate',
          eventType: 'fixture:cadence',
          actorIds: [],
          data: { elapsedTicks: context.elapsedTicks, periodTicks: context.periodTicks, phaseOffsetTicks: context.phaseOffsetTicks },
        }];
      },
    }];
    const combinedSystems = makeSystems();
    const combined = stepWorld(world(combinedSystems), 12, combinedSystems);
    const splitSystems = makeSystems();
    const first = stepWorld(world(splitSystems), 4, splitSystems);
    const second = stepWorld(first.state, 8, splitSystems);

    expect(logicalStateString(combined.state)).toBe(logicalStateString(second.state));
    expect([...first.events, ...second.events]).toEqual(combined.events);
    expect(combined.events.map((event) => event.tick)).toEqual([2, 7, 12]);
    expect(combined.events.map((event) => event.data['elapsedTicks'])).toEqual([2, 5, 5]);
    expect(combined.state.metrics['elapsedTicks']).toBe(12);
    expect(combined.state.schedules).toEqual([{ systemId: 'fixture:climate', periodTicks: 5, nextTick: 17 }]);
  });

  it('persiste o cursor de cadência em save/load e recusa uma agenda incompatível', () => {
    const systems: TickSystem[] = [{
      id: 'fixture:seasonal',
      order: 1,
      periodTicks: 5,
      phaseOffsetTicks: 2,
      run: (draft, tick, context) => {
        draft.metrics['elapsed'] = (draft.metrics['elapsed'] ?? 0) + context.elapsedTicks;
        return [{ tick, systemId: 'fixture:seasonal', eventType: 'fixture:update', actorIds: [], data: { elapsedTicks: context.elapsedTicks } }];
      },
    }];
    const initial = world(systems);
    const prefix = stepWorld(initial, 4, systems);
    const restored = worldFromSave(toSaveDocument(prefix.state));
    const resumed = stepWorld(restored, 8, systems);
    const uninterrupted = stepWorld(initial, 12, systems);

    expect(logicalStateString(resumed.state)).toBe(logicalStateString(uninterrupted.state));
    expect(resumed.events).toEqual(uninterrupted.events.filter((event) => event.tick > 4));
    expect(resumed.events.map((event) => event.data['elapsedTicks'])).toEqual([5, 5]);
    expect(() => stepWorld(restored, 1, [{ ...systems[0]!, periodTicks: 4, phaseOffsetTicks: 2 }])).toThrow(/agenda|cursor/i);
  });

  it('calcula ingestão, tentativas e distribuição individual para a janela (t0, t1]', () => {
    const summary = summarizeFoodTransitions(knownFoodTransitions(), foodWindow, foodFilter);
    expect(summary.ingestion).toMatchObject({
      unit: 'g_dry_matter_per_1000_animal_ticks',
      consumedDryMatterGrams: 8,
      animalTicks: 4,
      value: 2000,
      nullReason: null,
      individualDistribution: { sampleCount: 2, mean: 2000, minimum: 1500, q25: 1750, median: 2000, q75: 2250, q90: 2400, maximum: 2500 },
    });
    expect(summary.feedingSuccess).toEqual({
      unit: 'fraction',
      successfulAttempts: 2,
      completedEligibleAttempts: 3,
      pendingAttempts: 1,
      value: 2 / 3,
      nullReason: null,
    });
    expect(summary.individuals.map((row) => [row.individualId, row.animalTicks, row.consumedDryMatterGrams, row.intakeGramsPer1000AnimalTicks])).toEqual([
      ['animal:a', 2, 3, 1500],
      ['animal:b', 2, 5, 2500],
    ]);
    const seedSummary = summarizeFoodSeedRuns([
      { seed: '0123456789abcdef', summary },
      { seed: '1123456789abcdef', summary },
    ]);
    expect(seedSummary.acrossSeeds).toMatchObject({ sampleCount: 2, mean: 2000, minimum: 2000, maximum: 2000 });
    expect(seedSummary.acrossIndividuals).toMatchObject({ sampleCount: 4, mean: 2000, minimum: 1500, maximum: 2500 });
    expect(seedSummary.runs.map((run) => run.individualDistribution.sampleCount)).toEqual([2, 2]);
  });

  it('mantém o benchmark legado de itens em unidade discreta separada', () => {
    expect(summarizeLegacyDiscreteFoodMetric(3, { fromTickExclusive: 10, toTickInclusive: 40 })).toEqual({
      metricId: 'food.legacy-events-per-100-ticks',
      unit: 'discrete_food_events_per_100_logical_ticks',
      window: { fromTickExclusive: 10, toTickInclusive: 40 },
      consumedEvents: 3,
      logicalTicks: 30,
      value: 10,
    });
  });

  it('retorna null com motivo em janelas sem exposição ou sem tentativas elegíveis', () => {
    const emptyTransitions = [1, 2, 3].map((tick) => ({ tick, eligibleAtStart: [], ingestion: [], attempts: [] })) satisfies FeedingTransition[];
    const summary = summarizeFoodTransitions(emptyTransitions, foodWindow, foodFilter);
    expect(summary.ingestion).toMatchObject({ animalTicks: 0, consumedDryMatterGrams: 0, value: null, nullReason: 'no-exposure' });
    expect(summary.feedingSuccess).toMatchObject({ completedEligibleAttempts: 0, value: null, nullReason: 'no-eligible-completed-attempts' });
  });

  it('rejeita ingestão atribuída a recém-nascido antes da transição seguinte', () => {
    const newbornOnBirthTick: FeedingTransition = {
      tick: 1,
      eligibleAtStart: [],
      ingestion: [{ individualId: 'animal:newborn', dryMatterGrams: 0.5 }],
      attempts: [],
    };
    expect(() => summarizeFoodTransitions([newbornOnBirthTick], { fromTickExclusive: 0, toTickInclusive: 1 }, foodFilter)).toThrow(/censo inicial/);
  });

  it('persiste contadores acumulados e produz a mesma janela após save/load', () => {
    const transitions = knownFoodTransitions();
    const system: TickSystem = {
      id: 'fixture:food-counters',
      order: 1,
      periodTicks: 1,
      phaseOffsetTicks: 0,
      run: (draft, tick) => {
        const transition = transitions[tick - 1];
        if (transition === undefined) throw new Error(`Transição ausente: ${tick}.`);
        recordFoodMetricTransition(draft.metrics, transition);
      },
    };
    const initial = world([system]);
    const prefix = stepWorld(initial, 1, [system]);
    const baseline = structuredClone(prefix.state.metrics);
    const restored = worldFromSave(toSaveDocument(prefix.state));
    const resumed = stepWorld(restored, 2, [system]);
    const savedCounterSummary = summarizeFoodCounterWindow(
      baseline,
      resumed.state.metrics,
      { fromTickExclusive: 1, toTickInclusive: 3 },
      foodFilter,
    );
    const replaySummary = summarizeFoodTransitions(transitions.slice(1), { fromTickExclusive: 1, toTickInclusive: 3 }, foodFilter);

    expect(resumed.state.metrics).toEqual(stepWorld(stepWorld(initial, 2, [system]).state, 1, [system]).state.metrics);
    expect(savedCounterSummary.ingestion).toMatchObject({ consumedDryMatterGrams: replaySummary.ingestion.consumedDryMatterGrams, animalTicks: replaySummary.ingestion.animalTicks, value: replaySummary.ingestion.value });
    expect(savedCounterSummary.feedingSuccess).toEqual(replaySummary.feedingSuccess);
  });

  it('não deixa contadores parcialmente gravados se um grupo existente estiver inválido', () => {
    const metrics = {
      'food.v1:fixture%3Aherbivore:adult:animalTicks': 0,
      'food.v1:fixture%3Apredator:adult:animalTicks': Number.NaN,
    };
    const before = structuredClone(metrics);
    const transition: FeedingTransition = {
      tick: 1,
      eligibleAtStart: [
        { individualId: 'animal:a', ...foodFilter },
        { individualId: 'animal:b', speciesId: 'fixture:predator', lifeStageId: 'adult' },
      ],
      ingestion: [],
      attempts: [],
    };

    expect(() => recordFoodMetricTransition(metrics, transition)).toThrow(/contador alimentar/i);
    expect(metrics).toEqual(before);
  });

  it('mantém a simulação igual quando telemetria excede o buffer de eventos', () => {
    const quiet: TickSystem[] = [{
      id: 'fixture:telemetry',
      order: 1,
      periodTicks: 1,
      phaseOffsetTicks: 0,
      run: (draft) => { draft.metrics['logicalCount'] = 1; },
    }];
    const noisy: TickSystem[] = [{
      ...quiet[0]!,
      run: (draft, tick) => {
        draft.metrics['logicalCount'] = 1;
        return Array.from({ length: MAX_EVENTS_PER_RESPONSE + 7 }, (_, index) => ({
          tick,
          systemId: 'fixture:telemetry',
          eventType: 'fixture:detail',
          actorIds: [],
          data: { index },
        }));
      },
    }];
    const quietResult = stepWorld(world(quiet), 1, quiet);
    const noisyResult = stepWorld(world(noisy), 1, noisy);
    expect(logicalStateString(noisyResult.state)).toBe(logicalStateString(quietResult.state));
    expect(noisyResult.events).toHaveLength(MAX_EVENTS_PER_RESPONSE);
    expect(noisyResult.eventsOmitted).toBe(7);
  });
});
