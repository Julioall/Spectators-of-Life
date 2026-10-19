import type { JsonValue } from './types';
import { canonicalStringify } from './canonical-json';

export type BenchmarkCadence = {
  systemId: string;
  periodTicks: number;
  phaseOffsetTicks: number;
};

export type BenchmarkContentVersion = {
  id: string;
  version: string;
  checksum: string;
};

export type BenchmarkPopulationEntry = {
  speciesId: string;
  lifeStageId: string;
  count: number;
};

export type BenchmarkScenarioFixture = {
  id: string;
  entityKind: string;
  entityCount: number;
};

export type BenchmarkMetricDefinition = {
  metricId: string;
  scope: 'ecological' | 'performance';
  unit: string;
  window: {
    fromTickExclusive: number;
    toTickInclusive: number;
  };
  denominator: string;
  populationFilter: {
    speciesId: string | null;
    lifeStageId: string | null;
  };
};

export type BenchmarkManifest = {
  format: 'spectators-of-life-benchmark';
  benchmarkSchemaVersion: 1;
  runId: string;
  simulationVersion: string;
  seed: string;
  scenario: {
    id: string;
    version: string;
    environmentConfig: { [key: string]: JsonValue };
    content: BenchmarkContentVersion[];
    cadences: BenchmarkCadence[];
    initialPopulation: BenchmarkPopulationEntry[];
    fixture?: BenchmarkScenarioFixture;
  };
  learningCondition: {
    controllerMode: 'heuristic' | 'frozen-network' | 'online-learning' | 'weight-transfer';
    weightsInherited: boolean;
    conditionId: string;
    parameters: { [key: string]: JsonValue };
  };
  durationTicks: number;
  metrics: BenchmarkMetricDefinition[];
  buildRevision: string;
  /** Null unless at least one performance metric is included. */
  performanceEquipment: {
    platform: string;
    architecture: string;
    processor: string;
    logicalProcessorCount: number;
    memoryBytes: number;
  } | null;
};

/** Check constraints that JSON Schema cannot express across related fields. */
export function assertBenchmarkManifestSemantics(manifest: BenchmarkManifest): void {
  if (!Number.isSafeInteger(manifest.durationTicks) || manifest.durationTicks < 1 || manifest.metrics.length === 0) {
    throw new RangeError('O manifesto precisa declarar duração positiva e ao menos uma métrica.');
  }
  const cadenceIds = new Set<string>();
  for (const cadence of manifest.scenario.cadences) {
    if (cadenceIds.has(cadence.systemId)
      || !Number.isSafeInteger(cadence.periodTicks) || cadence.periodTicks < 1
      || !Number.isSafeInteger(cadence.phaseOffsetTicks) || cadence.phaseOffsetTicks < 0
      || cadence.phaseOffsetTicks >= cadence.periodTicks) {
      throw new RangeError(`Cadência inválida ou duplicada: ${cadence.systemId}.`);
    }
    cadenceIds.add(cadence.systemId);
  }
  const initialPopulationGroups = new Set<string>();
  let initialPopulationCount = 0;
  for (const entry of manifest.scenario.initialPopulation) {
    const group = `${entry.speciesId}\u0000${entry.lifeStageId}`;
    if (initialPopulationGroups.has(group)) throw new RangeError(`Grupo inicial duplicado: ${entry.speciesId}/${entry.lifeStageId}.`);
    initialPopulationGroups.add(group);
    initialPopulationCount += entry.count;
    if (!Number.isSafeInteger(initialPopulationCount) || initialPopulationCount > 100_000) {
      throw new RangeError('A população inicial excede o limite de entidades do runtime.');
    }
  }
  const metricIds = new Set<string>();
  let hasPerformanceMetric = false;
  for (const metric of manifest.metrics) {
    if (metricIds.has(metric.metricId)) throw new RangeError(`Métrica duplicada: ${metric.metricId}.`);
    metricIds.add(metric.metricId);
    const { fromTickExclusive, toTickInclusive } = metric.window;
    if (!Number.isSafeInteger(fromTickExclusive) || !Number.isSafeInteger(toTickInclusive)
      || fromTickExclusive < 0 || toTickInclusive <= fromTickExclusive || toTickInclusive > manifest.durationTicks) {
      throw new RangeError(`Janela inválida ou fora da duração para ${metric.metricId}.`);
    }
    if (metric.scope === 'performance') hasPerformanceMetric = true;
    if (metric.metricId === 'food.intake-per-1000-animal-ticks'
      && (metric.populationFilter.speciesId === null || metric.populationFilter.lifeStageId === null)) {
      throw new RangeError('A métrica ecológica de ingestão exige filtro explícito de espécie e estágio.');
    }
  }
  if (hasPerformanceMetric !== (manifest.performanceEquipment !== null)) {
    throw new RangeError('Métricas de desempenho exigem build/equipamento; manifestos ecológicos não carregam equipamento como resultado.');
  }
}

/** Require seed replicates to use identical, explicitly versioned conditions. */
export function assertComparableBenchmarkRuns(manifests: readonly BenchmarkManifest[]): void {
  if (manifests.length < 2) throw new RangeError('Uma comparação entre seeds exige pelo menos duas execuções.');
  const seenSeeds = new Set<string>();
  const reference = comparableManifestKey(manifests[0] as BenchmarkManifest, false);
  for (const manifest of manifests) {
    assertBenchmarkManifestSemantics(manifest);
    if (seenSeeds.has(manifest.seed)) throw new RangeError(`Seed repetida no mesmo conjunto de replicações: ${manifest.seed}.`);
    seenSeeds.add(manifest.seed);
    if (comparableManifestKey(manifest, false) !== reference) {
      throw new RangeError('Replicações pareadas devem manter cenário, cadências, conteúdo, condição, duração, métricas e build idênticos.');
    }
  }
}

/** Pair control/treatment runs by seed while allowing only the learning condition to differ. */
export function assertControlledLearningComparison(
  control: readonly BenchmarkManifest[],
  treatment: readonly BenchmarkManifest[],
): void {
  assertComparableBenchmarkRuns(control);
  assertComparableBenchmarkRuns(treatment);
  if (control.length !== treatment.length) throw new RangeError('Controle e tratamento precisam ter a mesma quantidade de seeds pareadas.');
  const controlBySeed = new Map(control.map((manifest) => [manifest.seed, manifest]));
  for (const candidate of treatment) {
    const baseline = controlBySeed.get(candidate.seed);
    if (baseline === undefined) throw new RangeError(`A seed ${candidate.seed} não existe no grupo de controle.`);
    if (canonicalStringify(baseline.learningCondition) === canonicalStringify(candidate.learningCondition)) {
      throw new RangeError(`A seed ${candidate.seed} não altera a condição de aprendizado.`);
    }
    if (comparableManifestKey(baseline, true) !== comparableManifestKey(candidate, true)) {
      throw new RangeError(`A seed ${candidate.seed} altera fatores além da condição de aprendizado.`);
    }
  }
}

function comparableManifestKey(manifest: BenchmarkManifest, omitLearningCondition: boolean): string {
  const { runId: _runId, seed: _seed, learningCondition: _learningCondition, ...base } = manifest;
  if (!omitLearningCondition) return canonicalStringify({ ...base, learningCondition: manifest.learningCondition });
  return canonicalStringify(base);
}
