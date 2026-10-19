export type FoodMetricFilter = {
  speciesId: string;
  lifeStageId: string;
};

export type FoodMetricWindow = {
  fromTickExclusive: number;
  toTickInclusive: number;
};

export type EligibleFoodIndividual = FoodMetricFilter & {
  individualId: string;
};

export type FoodIngestion = {
  individualId: string;
  dryMatterGrams: number;
};

export type FeedingAttempt =
  | { individualId: string; status: 'pending' }
  | { individualId: string; status: 'completed'; consumed: boolean };

export type FeedingTransition = {
  tick: number;
  /** Living individuals eligible at the start of this logical transition. */
  eligibleAtStart: readonly EligibleFoodIndividual[];
  ingestion: readonly FoodIngestion[];
  attempts: readonly FeedingAttempt[];
};

export type DistributionSummary = {
  sampleCount: number;
  mean: number | null;
  minimum: number | null;
  q25: number | null;
  median: number | null;
  q75: number | null;
  q90: number | null;
  maximum: number | null;
};

export type FoodMetricIndividualSummary = FoodMetricFilter & {
  individualId: string;
  animalTicks: number;
  consumedDryMatterGrams: number;
  intakeGramsPer1000AnimalTicks: number;
  completedEligibleAttempts: number;
  successfulAttempts: number;
  feedingSuccessRate: number | null;
  feedingSuccessNullReason: 'no-eligible-completed-attempts' | null;
  pendingAttempts: number;
};

export type FoodWindowSummary = {
  window: FoodMetricWindow;
  filter: FoodMetricFilter;
  ingestion: {
    unit: 'g_dry_matter_per_1000_animal_ticks';
    consumedDryMatterGrams: number;
    animalTicks: number;
    value: number | null;
    nullReason: 'no-exposure' | null;
    individualDistribution: DistributionSummary;
  };
  feedingSuccess: {
    unit: 'fraction';
    successfulAttempts: number;
    completedEligibleAttempts: number;
    pendingAttempts: number;
    value: number | null;
    nullReason: 'no-eligible-completed-attempts' | null;
  };
  individuals: FoodMetricIndividualSummary[];
};

export type FoodSeedRun = {
  seed: string;
  summary: FoodWindowSummary;
};

export type FoodSeedDistribution = {
  window: FoodMetricWindow;
  filter: FoodMetricFilter;
  metric: 'g_dry_matter_per_1000_animal_ticks';
  runs: Array<{
    seed: string;
    value: number | null;
    nullReason: 'no-exposure' | null;
    individualDistribution: DistributionSummary;
  }>;
  acrossSeeds: DistributionSummary;
  acrossIndividuals: DistributionSummary;
};

export type FoodCounters = {
  animalTicks: number;
  consumedDryMatterGrams: number;
  completedEligibleAttempts: number;
  successfulAttempts: number;
  pendingAttempts: number;
};

export type LegacyDiscreteFoodSummary = {
  metricId: 'food.legacy-events-per-100-ticks';
  unit: 'discrete_food_events_per_100_logical_ticks';
  window: FoodMetricWindow;
  consumedEvents: number;
  logicalTicks: number;
  value: number;
};

const FOOD_COUNTER_PREFIX = 'food.v1:';
const FOOD_COUNTER_NAMES = [
  'animalTicks',
  'consumedDryMatterGrams',
  'completedEligibleAttempts',
  'successfulAttempts',
  'pendingAttempts',
] as const satisfies readonly (keyof FoodCounters)[];
const FOOD_THROUGH_TICK_KEY = 'food.v1:throughTick';

/** Explicitly normalize legacy discrete-food results without mixing them with biomass or energy. */
export function summarizeLegacyDiscreteFoodMetric(consumedEvents: number, tickRange: FoodMetricWindow): LegacyDiscreteFoodSummary {
  validateWindow(tickRange);
  if (!Number.isSafeInteger(consumedEvents) || consumedEvents < 0) throw new RangeError('A quantidade de eventos discretos deve ser um inteiro não negativo.');
  const logicalTicks = tickRange.toTickInclusive - tickRange.fromTickExclusive;
  const value = 100 * consumedEvents / logicalTicks;
  if (!Number.isFinite(value)) throw new RangeError('A métrica discreta de alimentação excedeu seu intervalo numérico.');
  return {
    metricId: 'food.legacy-events-per-100-ticks',
    unit: 'discrete_food_events_per_100_logical_ticks',
    window: { ...tickRange },
    consumedEvents,
    logicalTicks,
    value,
  };
}

/**
 * Add one complete logical transition to cumulative, save-persisted counters.
 * Call once for every tick after resolving feeding for the start-of-tick cohort;
 * an empty population still advances the persisted throughTick cursor.
 */
export function recordFoodMetricTransition(metrics: Record<string, number>, transition: FeedingTransition): void {
  const normalized = validateTransition(transition);
  const previousTick = metrics[FOOD_THROUGH_TICK_KEY] ?? 0;
  if (!Number.isSafeInteger(previousTick) || previousTick < 0 || transition.tick !== previousTick + 1) {
    throw new RangeError(`A transição alimentar deve ser contígua: esperado tick ${previousTick + 1}, recebido ${transition.tick}.`);
  }

  const groups = new Map<string, FoodCounters>();
  const eligibleById = new Map(normalized.eligibleAtStart.map((animal) => [animal.individualId, animal]));
  for (const animal of normalized.eligibleAtStart) {
    addCounter(groups, animal, 'animalTicks', 1);
  }
  for (const [individualId, dryMatterGrams] of normalized.ingestionByIndividual) {
    const animal = eligibleById.get(individualId);
    if (animal !== undefined) addCounter(groups, animal, 'consumedDryMatterGrams', dryMatterGrams);
  }
  for (const attempt of normalized.attempts) {
    const animal = eligibleById.get(attempt.individualId);
    if (animal === undefined) continue;
    if (attempt.status === 'pending') {
      addCounter(groups, animal, 'pendingAttempts', 1);
    } else {
      addCounter(groups, animal, 'completedEligibleAttempts', 1);
      if (attempt.consumed) addCounter(groups, animal, 'successfulAttempts', 1);
    }
  }

  const updates = new Map<string, number>();
  for (const [groupKey, values] of groups) {
    for (const counterName of FOOD_COUNTER_NAMES) {
      const key = `${FOOD_COUNTER_PREFIX}${groupKey}:${counterName}`;
      const before = metrics[key] ?? 0;
      const after = before + values[counterName];
      if (!Number.isFinite(before) || before < 0 || !Number.isFinite(after) || after < before) {
        throw new RangeError(`O contador alimentar ${counterName} excedeu seu intervalo numérico.`);
      }
      updates.set(key, after);
    }
  }
  for (const [key, value] of updates) metrics[key] = value;
  metrics[FOOD_THROUGH_TICK_KEY] = transition.tick;
}

/** Summarize counter deltas from the persisted world snapshots at t0 and t1. */
export function summarizeFoodCounterWindow(
  startMetrics: Readonly<Record<string, number>>,
  endMetrics: Readonly<Record<string, number>>,
  tickRange: FoodMetricWindow,
  filter: FoodMetricFilter,
): Omit<FoodWindowSummary, 'individuals' | 'ingestion'> & {
  ingestion: Omit<FoodWindowSummary['ingestion'], 'individualDistribution'>;
} {
  validateWindow(tickRange);
  validateFilter(filter);
  const fromThrough = startMetrics[FOOD_THROUGH_TICK_KEY] ?? 0;
  const toThrough = endMetrics[FOOD_THROUGH_TICK_KEY] ?? 0;
  if (fromThrough !== tickRange.fromTickExclusive || toThrough !== tickRange.toTickInclusive) {
    throw new RangeError('Os contadores alimentares não cobrem exatamente a janela solicitada.');
  }

  const start = readGroupCounters(startMetrics, filter);
  const end = readGroupCounters(endMetrics, filter);
  const delta = subtractCounters(end, start);
  return summarizeCounters(tickRange, filter, delta);
}

/** Calculate an auditable food window and per-individual distribution from a complete tick trace. */
export function summarizeFoodTransitions(
  transitions: readonly FeedingTransition[],
  tickRange: FoodMetricWindow,
  filter: FoodMetricFilter,
): FoodWindowSummary {
  validateWindow(tickRange);
  validateFilter(filter);
  const expectedLength = tickRange.toTickInclusive - tickRange.fromTickExclusive;
  if (transitions.length !== expectedLength) throw new RangeError('A trajetória deve conter uma transição para cada tick da janela.');

  const byIndividual = new Map<string, MutableIndividualSummary>();
  let previousTick = tickRange.fromTickExclusive;
  for (const transition of transitions) {
    if (transition.tick !== previousTick + 1) throw new RangeError('A trajetória alimentar contém ticks duplicados, ausentes ou fora de ordem.');
    previousTick = transition.tick;
    const normalized = validateTransition(transition);
    const eligibleById = new Map(normalized.eligibleAtStart.map((animal) => [animal.individualId, animal]));

    for (const animal of normalized.eligibleAtStart) {
      if (!matchesFilter(animal, filter)) continue;
      const row = getIndividual(byIndividual, animal);
      row.animalTicks += 1;
    }
    for (const [individualId, dryMatterGrams] of normalized.ingestionByIndividual) {
      const animal = eligibleById.get(individualId);
      if (animal === undefined || !matchesFilter(animal, filter)) continue;
      getIndividual(byIndividual, animal).consumedDryMatterGrams = addFinite(
        getIndividual(byIndividual, animal).consumedDryMatterGrams,
        dryMatterGrams,
      );
    }
    for (const attempt of normalized.attempts) {
      const animal = eligibleById.get(attempt.individualId);
      if (animal === undefined || !matchesFilter(animal, filter)) continue;
      const row = getIndividual(byIndividual, animal);
      if (attempt.status === 'pending') row.pendingAttempts += 1;
      else {
        row.completedEligibleAttempts += 1;
        if (attempt.consumed) row.successfulAttempts += 1;
      }
    }
  }

  const individuals = [...byIndividual.values()]
    .sort((left, right) => compareAscii(left.individualId, right.individualId))
    .map((row): FoodMetricIndividualSummary => ({
      individualId: row.individualId,
      speciesId: row.speciesId,
      lifeStageId: row.lifeStageId,
      animalTicks: row.animalTicks,
      consumedDryMatterGrams: row.consumedDryMatterGrams,
      intakeGramsPer1000AnimalTicks: row.animalTicks === 0 ? 0 : row.consumedDryMatterGrams / row.animalTicks * 1000,
      completedEligibleAttempts: row.completedEligibleAttempts,
      successfulAttempts: row.successfulAttempts,
      feedingSuccessRate: ratioOrNull(row.successfulAttempts, row.completedEligibleAttempts),
      feedingSuccessNullReason: row.completedEligibleAttempts === 0 ? 'no-eligible-completed-attempts' : null,
      pendingAttempts: row.pendingAttempts,
    }));
  const counters = totalsFromIndividuals(individuals);
  const aggregate = summarizeCounters(tickRange, filter, counters);
  return {
    ...aggregate,
    ingestion: {
      ...aggregate.ingestion,
      individualDistribution: summarizeDistribution(individuals.map((row) => row.intakeGramsPer1000AnimalTicks)),
    },
    individuals,
  };
}

/** Keep seed-to-seed variation separate from individual variation within each run. */
export function summarizeFoodSeedRuns(runs: readonly FoodSeedRun[]): FoodSeedDistribution {
  if (runs.length === 0) throw new RangeError('É necessário pelo menos um resultado de seed.');
  const first = runs[0] as FoodSeedRun;
  const seenSeeds = new Set<string>();
  const values: number[] = [];
  const individualValues: number[] = [];
  const normalizedRuns = runs.map(({ seed, summary }) => {
    if (!/^[0-9a-f]{16}$/.test(seed) || seenSeeds.has(seed)) throw new RangeError('Seeds devem ser hexadecimais e únicas no experimento.');
    seenSeeds.add(seed);
    if (!sameWindow(summary.window, first.summary.window) || !sameFilter(summary.filter, first.summary.filter)) {
      throw new RangeError('Os resultados das seeds precisam usar a mesma janela e os mesmos filtros.');
    }
    if (summary.ingestion.value !== null) values.push(summary.ingestion.value);
    individualValues.push(...summary.individuals.map((individual) => individual.intakeGramsPer1000AnimalTicks));
    return {
      seed,
      value: summary.ingestion.value,
      nullReason: summary.ingestion.nullReason,
      individualDistribution: summary.ingestion.individualDistribution,
    };
  });
  return {
    window: { ...first.summary.window },
    filter: { ...first.summary.filter },
    metric: 'g_dry_matter_per_1000_animal_ticks',
    runs: normalizedRuns,
    acrossSeeds: summarizeDistribution(values),
    acrossIndividuals: summarizeDistribution(individualValues),
  };
}

function summarizeCounters(tickRange: FoodMetricWindow, filter: FoodMetricFilter, counters: FoodCounters): {
  window: FoodMetricWindow;
  filter: FoodMetricFilter;
  ingestion: FoodWindowSummary['ingestion'];
  feedingSuccess: FoodWindowSummary['feedingSuccess'];
} {
  const hasExposure = counters.animalTicks > 0;
  const hasAttempts = counters.completedEligibleAttempts > 0;
  const value = hasExposure ? counters.consumedDryMatterGrams / counters.animalTicks * 1000 : null;
  if (value !== null && !Number.isFinite(value)) throw new RangeError('A métrica de ingestão excedeu seu intervalo numérico.');
  return {
    window: { ...tickRange },
    filter: { ...filter },
    ingestion: {
      unit: 'g_dry_matter_per_1000_animal_ticks',
      consumedDryMatterGrams: counters.consumedDryMatterGrams,
      animalTicks: counters.animalTicks,
      value,
      nullReason: hasExposure ? null : 'no-exposure',
      individualDistribution: summarizeDistribution([]),
    },
    feedingSuccess: {
      unit: 'fraction',
      successfulAttempts: counters.successfulAttempts,
      completedEligibleAttempts: counters.completedEligibleAttempts,
      pendingAttempts: counters.pendingAttempts,
      value: ratioOrNull(counters.successfulAttempts, counters.completedEligibleAttempts),
      nullReason: hasAttempts ? null : 'no-eligible-completed-attempts',
    },
  };
}

function validateTransition(transition: FeedingTransition): {
  eligibleAtStart: EligibleFoodIndividual[];
  ingestionByIndividual: Map<string, number>;
  attempts: FeedingAttempt[];
} {
  if (!Number.isSafeInteger(transition.tick) || transition.tick < 1) throw new RangeError('tick da transição deve ser um inteiro positivo.');
  const eligibleIds = new Set<string>();
  const eligibleAtStart = transition.eligibleAtStart.map((animal) => {
    validateFilter(animal);
    validateStableId(animal.individualId, 'individualId');
    if (eligibleIds.has(animal.individualId)) throw new RangeError(`Indivíduo duplicado na população elegível: ${animal.individualId}.`);
    eligibleIds.add(animal.individualId);
    return { ...animal };
  });
  const ingestionByIndividual = new Map<string, number>();
  for (const item of transition.ingestion) {
    validateStableId(item.individualId, 'individualId');
    if (!Number.isFinite(item.dryMatterGrams) || item.dryMatterGrams < 0) throw new RangeError('A ingestão em g de matéria seca deve ser finita e não negativa.');
    if (!eligibleIds.has(item.individualId)) throw new RangeError(`Ingestão atribuída a indivíduo fora do censo inicial do tick: ${item.individualId}.`);
    ingestionByIndividual.set(item.individualId, addFinite(ingestionByIndividual.get(item.individualId) ?? 0, item.dryMatterGrams));
  }
  const attempts = transition.attempts.map((attempt) => {
    validateStableId(attempt.individualId, 'individualId');
    if (!eligibleIds.has(attempt.individualId)) throw new RangeError(`Tentativa atribuída a indivíduo fora do censo inicial do tick: ${attempt.individualId}.`);
    if (attempt.status === 'pending') {
      if (Object.keys(attempt).some((key) => key !== 'individualId' && key !== 'status')) throw new RangeError('Tentativa pendente contém resultado prematuro.');
      return { individualId: attempt.individualId, status: 'pending' } as const;
    }
    if (attempt.status !== 'completed' || typeof attempt.consumed !== 'boolean' || Object.keys(attempt).some((key) => !['individualId', 'status', 'consumed'].includes(key))) {
      throw new RangeError('Tentativa alimentar inválida.');
    }
    return { individualId: attempt.individualId, status: 'completed', consumed: attempt.consumed } as const;
  });
  return { eligibleAtStart, ingestionByIndividual, attempts };
}

function validateWindow(tickRange: FoodMetricWindow): void {
  if (!Number.isSafeInteger(tickRange.fromTickExclusive) || !Number.isSafeInteger(tickRange.toTickInclusive)
    || tickRange.fromTickExclusive < 0 || tickRange.toTickInclusive <= tickRange.fromTickExclusive) {
    throw new RangeError('A janela lógica deve ser um intervalo válido (t0, t1].');
  }
}

function validateFilter(filter: FoodMetricFilter): void {
  validateStableId(filter.speciesId, 'speciesId');
  validateStableId(filter.lifeStageId, 'lifeStageId');
}

function validateStableId(value: string, name: string): void {
  if (typeof value !== 'string' || value.length > 128 || !/^[a-z][a-z0-9]*(?:[.:/_-][a-z0-9]+)*$/.test(value)) {
    throw new RangeError(`${name} precisa ser um ID estável e namespaced.`);
  }
}

function addCounter(groups: Map<string, FoodCounters>, animal: EligibleFoodIndividual, counter: keyof FoodCounters, amount: number): void {
  const key = foodGroupKey(animal);
  const counters = groups.get(key) ?? emptyCounters();
  const next = counters[counter] + amount;
  if (!Number.isFinite(next) || next < counters[counter]) throw new RangeError(`O contador alimentar ${counter} excedeu seu intervalo numérico.`);
  counters[counter] = next;
  groups.set(key, counters);
}

function foodGroupKey(filter: FoodMetricFilter): string {
  return `${encodeURIComponent(filter.speciesId)}:${encodeURIComponent(filter.lifeStageId)}`;
}

function readGroupCounters(metrics: Readonly<Record<string, number>>, filter: FoodMetricFilter): FoodCounters {
  const key = foodGroupKey(filter);
  const output = emptyCounters();
  for (const counterName of FOOD_COUNTER_NAMES) {
    const value = metrics[`${FOOD_COUNTER_PREFIX}${key}:${counterName}`] ?? 0;
    if (!Number.isFinite(value) || value < 0) throw new RangeError(`Contador alimentar inválido: ${counterName}.`);
    output[counterName] = value;
  }
  return output;
}

function subtractCounters(end: FoodCounters, start: FoodCounters): FoodCounters {
  const output = emptyCounters();
  for (const key of FOOD_COUNTER_NAMES) {
    const difference = end[key] - start[key];
    if (!Number.isFinite(difference) || difference < 0) throw new RangeError(`Contador alimentar ${key} não é monotônico.`);
    output[key] = difference;
  }
  return output;
}

function emptyCounters(): FoodCounters {
  return { animalTicks: 0, consumedDryMatterGrams: 0, completedEligibleAttempts: 0, successfulAttempts: 0, pendingAttempts: 0 };
}

function getIndividual(rows: Map<string, MutableIndividualSummary>, animal: EligibleFoodIndividual): MutableIndividualSummary {
  let row = rows.get(animal.individualId);
  if (row === undefined) {
    row = {
      individualId: animal.individualId,
      speciesId: animal.speciesId,
      lifeStageId: animal.lifeStageId,
      animalTicks: 0,
      consumedDryMatterGrams: 0,
      completedEligibleAttempts: 0,
      successfulAttempts: 0,
      pendingAttempts: 0,
    };
    rows.set(animal.individualId, row);
  } else if (row.speciesId !== animal.speciesId || row.lifeStageId !== animal.lifeStageId) {
    throw new RangeError(`O indivíduo ${animal.individualId} mudou de espécie/estágio dentro de um resumo filtrado.`);
  }
  return row;
}

function totalsFromIndividuals(individuals: readonly FoodMetricIndividualSummary[]): FoodCounters {
  const counters = emptyCounters();
  for (const row of individuals) {
    counters.animalTicks += row.animalTicks;
    counters.consumedDryMatterGrams = addFinite(counters.consumedDryMatterGrams, row.consumedDryMatterGrams);
    counters.completedEligibleAttempts += row.completedEligibleAttempts;
    counters.successfulAttempts += row.successfulAttempts;
    counters.pendingAttempts += row.pendingAttempts;
  }
  return counters;
}

/** Quantiles use Type 7: position p * (n - 1), with linear interpolation. */
function summarizeDistribution(values: readonly number[]): DistributionSummary {
  if (values.length === 0) return { sampleCount: 0, mean: null, minimum: null, q25: null, median: null, q75: null, q90: null, maximum: null };
  const sorted = [...values].sort((left, right) => left - right);
  if (sorted.some((value) => !Number.isFinite(value))) throw new RangeError('A distribuição contém valor não finito.');
  const sum = sorted.reduce((total, value) => addFinite(total, value), 0);
  return {
    sampleCount: sorted.length,
    mean: sum / sorted.length,
    minimum: sorted[0] as number,
    q25: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    q75: quantile(sorted, 0.75),
    q90: quantile(sorted, 0.9),
    maximum: sorted.at(-1) as number,
  };
}

function quantile(sorted: readonly number[], probability: number): number {
  const position = (sorted.length - 1) * probability;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const lower = sorted[lowerIndex] as number;
  const upper = sorted[upperIndex] as number;
  return lower + (upper - lower) * (position - lowerIndex);
}

function ratioOrNull(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  const value = numerator / denominator;
  if (!Number.isFinite(value)) throw new RangeError('A taxa alimentar excedeu seu intervalo numérico.');
  return value;
}

function addFinite(left: number, right: number): number {
  const value = left + right;
  if (!Number.isFinite(value)) throw new RangeError('A soma da métrica excedeu seu intervalo numérico.');
  return value;
}

function matchesFilter(animal: FoodMetricFilter, filter: FoodMetricFilter): boolean {
  return animal.speciesId === filter.speciesId && animal.lifeStageId === filter.lifeStageId;
}

function sameFilter(left: FoodMetricFilter, right: FoodMetricFilter): boolean {
  return left.speciesId === right.speciesId && left.lifeStageId === right.lifeStageId;
}

function sameWindow(left: FoodMetricWindow, right: FoodMetricWindow): boolean {
  return left.fromTickExclusive === right.fromTickExclusive && left.toTickInclusive === right.toTickInclusive;
}

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

type MutableIndividualSummary = FoodMetricFilter & {
  individualId: string;
  animalTicks: number;
  consumedDryMatterGrams: number;
  completedEligibleAttempts: number;
  successfulAttempts: number;
  pendingAttempts: number;
};
