import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import protocolSchema from '../../data/schemas/worker-protocol.v1.schema.json';
import saveSchema from '../../data/schemas/save.v1.schema.json';
import benchmarkSchema from '../../data/schemas/benchmark.v1.schema.json';
import { assertBenchmarkManifestSemantics, assertComparableBenchmarkRuns, assertControlledLearningComparison, type BenchmarkManifest } from '../../src/core/benchmark';

const ajv = new Ajv2020({ allErrors: true, strict: false });
ajv.addSchema(protocolSchema);
const validateProtocol = ajv.compile(protocolSchema);
const validateSave = ajv.compile(saveSchema);
const validateBenchmark = ajv.compile(benchmarkSchema);

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../../data/fixtures/spec-000/${name}`, import.meta.url), 'utf8')) as unknown;
}

const spec001PerformanceEvidence = JSON.parse(readFileSync(new URL('../../docs/evidence/spec-001-performance-baseline-2026-10-19.json', import.meta.url), 'utf8')) as {
  benchmarkManifests: unknown[];
  runs: Array<{ benchmarkRunId: string }>;
};

describe('schemas versionados de SPEC-000', () => {
  it('aceita os fixtures válidos de criação e save', () => {
    expect(validateProtocol(fixture('valid-create-world.json'))).toBe(true);
    expect(validateSave(fixture('valid-save.json'))).toBe(true);
  });

  it('recusa propriedades desconhecidas, saves truncados e respostas que não pertencem ao protocolo', () => {
    expect(validateProtocol(fixture('invalid-create-unknown-field.json'))).toBe(false);
    expect(validateSave(fixture('invalid-save-truncated.json'))).toBe(false);
    expect(validateProtocol({ protocolVersion: 1, requestId: 1, type: 'UNKNOWN' })).toBe(false);
  });

  it('especifica STEP inteiro inclusive fora do limite operacional para produzir erro tipado no Worker', () => {
    expect(validateProtocol(fixture('invalid-step-zero.json'))).toBe(true);
    expect(validateProtocol({ protocolVersion: 1, requestId: 2, type: 'STEP', worldId: 'world-1', ticks: 1.5 })).toBe(false);
  });

  it('valida respostas com correlação, identidade do mundo e diagnóstico versionado', () => {
    expect(validateProtocol({
      protocolVersion: 1,
      requestId: 7,
      type: 'ADVANCED',
      worldId: 'world-1',
      tickFrom: 4,
      tickTo: 5,
      completedTicks: 1,
      events: [],
      eventsOmitted: 0,
      diagnostics: { durationMs: 0.25, simulationVersion: '0.2.0', seed: '0000000000000000' },
    })).toBe(true);
    expect(validateProtocol({
      protocolVersion: 1,
      requestId: 8,
      type: 'ERROR',
      code: 'INVARIANT_VIOLATION',
      message: 'Falha controlada.',
      recoverable: false,
      tick: 4,
      simulationVersion: '0.2.0',
      seed: '0000000000000000',
      systemId: 'core:foundation',
      entityId: 'animal:1',
      completedTicks: 4,
      lastValidTick: 4,
      worldId: 'world-1',
    })).toBe(true);
    expect(validateProtocol({ protocolVersion: 1, requestId: 0, type: 'ERROR', code: 'INVALID_MESSAGE', message: 'Sem envelope.', recoverable: true, tick: null })).toBe(true);
  });
});

describe('manifesto de benchmark versionado da SPEC-001', () => {
  it('exige cenário, seed, condição, janela, unidade, denominador e build', () => {
    expect(validateBenchmark(fixture('../spec-001/valid-benchmark-manifest.json'))).toBe(true);
    expect(validateBenchmark(fixture('../spec-001/invalid-benchmark-missing-denominator.json'))).toBe(false);
  });

  it('exige equipamento quando o manifesto mede desempenho', () => {
    const benchmark = fixture('../spec-001/valid-benchmark-manifest.json') as Record<string, unknown>;
    const metric = (benchmark['metrics'] as Array<Record<string, unknown>>)[0]!;
    expect(validateBenchmark({
      ...benchmark,
      metrics: [{ ...metric, metricId: 'performance.step-p95', scope: 'performance', unit: 'ms', denominator: 'one logical tick' }],
    })).toBe(false);
    expect(validateBenchmark({
      ...benchmark,
      metrics: [{ ...metric, metricId: 'performance.step-p95', scope: 'performance', unit: 'ms', denominator: 'one logical tick' }],
      performanceEquipment: {
        platform: 'Test OS', architecture: 'x64', processor: 'Fixture CPU', logicalProcessorCount: 4, memoryBytes: 17179869184,
      },
    })).toBe(true);
  });

  it('mantém manifestos válidos vinculados às medições de desempenho publicadas', () => {
    expect(spec001PerformanceEvidence.benchmarkManifests).toHaveLength(spec001PerformanceEvidence.runs.length);
    for (const manifest of spec001PerformanceEvidence.benchmarkManifests) expect(validateBenchmark(manifest)).toBe(true);
    const runIds = new Set(spec001PerformanceEvidence.benchmarkManifests.map((manifest) => (manifest as { runId: string }).runId));
    expect(spec001PerformanceEvidence.runs.every((run) => runIds.has(run.benchmarkRunId))).toBe(true);
  });

  it('pareia seeds e recusa comparação quando cenário ou cadência também mudam', () => {
    const first = fixture('../spec-001/valid-benchmark-manifest.json') as BenchmarkManifest;
    expect(() => assertBenchmarkManifestSemantics(first)).not.toThrow();
    const second: BenchmarkManifest = { ...first, runId: 'fixture:run-2', seed: '1123456789abcdef' };
    expect(() => assertComparableBenchmarkRuns([first, second])).not.toThrow();
    expect(() => assertComparableBenchmarkRuns([first, {
      ...second,
      scenario: { ...second.scenario, cadences: [{ systemId: 'climate:rain', periodTicks: 5, phaseOffsetTicks: 2 }] },
    }])).toThrow(/cadências/i);
    expect(() => assertBenchmarkManifestSemantics({
      ...first,
      metrics: [{ ...first.metrics[0]!, window: { fromTickExclusive: 0, toTickInclusive: 4 } }],
    })).toThrow(/fora da duração/i);
    expect(() => assertBenchmarkManifestSemantics({
      ...first,
      scenario: { ...first.scenario, cadences: [{ systemId: 'climate:rain', periodTicks: 5, phaseOffsetTicks: 5 }] },
    })).toThrow(/cadência inválida/i);

    const treatment = [first, second].map((manifest) => ({
      ...manifest,
      runId: `${manifest.runId}:online`,
      learningCondition: { controllerMode: 'online-learning' as const, weightsInherited: true, conditionId: 'fixture:online-v1', parameters: { updateEveryTicks: 1 } },
    }));
    expect(() => assertControlledLearningComparison([first, second], treatment)).not.toThrow();
    expect(() => assertControlledLearningComparison([first, second], [
      treatment[0]!, { ...treatment[1]!, seed: '2123456789abcdef' },
    ])).toThrow(/não existe|mesma quantidade/i);
  });
});
