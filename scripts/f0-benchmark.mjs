import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { createServer } from 'vite';

const scriptPath = fileURLToPath(import.meta.url);
const populations = [0, 10_000, 50_000];
const benchmarkSchema = JSON.parse(readFileSync(new URL('../data/schemas/benchmark.v1.schema.json', import.meta.url), 'utf8'));
const validateBenchmark = new Ajv2020({ allErrors: true, strict: false }).compile(benchmarkSchema);
const childIndex = process.argv.indexOf('--child');

if (childIndex === -1) {
  const runs = [];
  for (const population of populations) {
    const result = spawnSync(process.execPath, ['--expose-gc', scriptPath, '--child', String(population)], {
      cwd: process.cwd(),
      encoding: 'utf8',
      maxBuffer: 2 * 1024 * 1024,
    });
    if (result.status !== 0) {
      process.stderr.write(result.stderr);
      process.exit(result.status ?? 1);
    }
    runs.push(JSON.parse(result.stdout.trim()));
  }
  const gitRevision = gitText(['rev-parse', 'HEAD']);
  const workingTreeStatus = gitText(['status', '--porcelain', '--untracked-files=all']);
  const workingTreeDirty = workingTreeStatus.trim().length > 0;
  const workingTreeFingerprint = workingTreeDirty ? fingerprintWorkingTree() : null;
  const buildRevision = workingTreeFingerprint === null ? gitRevision : `${gitRevision}+wt:${workingTreeFingerprint.slice(0, 32)}`;
  const measuredAt = new Date().toISOString();
  const benchmarkManifests = runs.map((run) => ({
    format: 'spectators-of-life-benchmark',
    benchmarkSchemaVersion: 1,
    runId: `f0:stepworld-${run.population}-${measuredAt.replace(/[^0-9A-Z]/gi, '')}`,
    simulationVersion: '0.1.0',
    seed: '0123456789abcdef',
    scenario: {
      id: 'foundation:empty-world',
      version: '1.0.0',
      environmentConfig: {},
      content: [],
      cadences: [],
      initialPopulation: [],
      fixture: { id: 'fixture:static-entities', entityKind: 'fixture:benchmark', entityCount: run.population },
    },
    learningCondition: { controllerMode: 'heuristic', weightsInherited: false, conditionId: 'f0:empty-controller', parameters: {} },
    durationTicks: run.resultingTick,
    metrics: ['p50Ms', 'p95Ms', 'maxMs'].map((sample) => ({
      metricId: `performance.core-step-${sample.replace('Ms', '').toLowerCase()}`,
      scope: 'performance',
      unit: 'ms_per_STEP_1',
      window: { fromTickExclusive: 3, toTickInclusive: 3 + run.samples },
      denominator: `${run.samples} operações STEP(1), cada uma avançando um tick lógico`,
      populationFilter: { speciesId: null, lifeStageId: null },
    })),
    buildRevision,
    performanceEquipment: {
      platform: `${os.type()} ${os.release()}`,
      architecture: process.arch,
      processor: os.cpus()[0]?.model ?? 'unknown',
      logicalProcessorCount: os.cpus().length,
      memoryBytes: os.totalmem(),
    },
  }));
  for (const manifest of benchmarkManifests) {
    if (!validateBenchmark(manifest)) throw new Error(`Manifesto de benchmark inválido: ${JSON.stringify(validateBenchmark.errors)}.`);
    for (const metric of manifest.metrics) {
      if (metric.window.toTickInclusive > manifest.durationTicks) throw new Error(`Janela ${metric.metricId} excede a duração declarada.`);
    }
  }
  const reportedRuns = runs.map((run, index) => ({
    ...run,
    benchmarkRunId: benchmarkManifests[index]?.runId,
  }));
  console.log(JSON.stringify({
    measuredAt,
    revision: gitRevision,
    workingTree: workingTreeDirty ? 'modified' : 'clean',
    workingTreeFingerprint,
    host: {
      platform: `${os.type()} ${os.release()}`,
      cpu: os.cpus()[0]?.model ?? 'unknown',
      logicalCpus: os.cpus().length,
      ramBytes: os.totalmem(),
      freeRamAtStartBytes: os.freemem(),
      node: process.version,
      v8: process.versions.v8,
      arch: process.arch,
    },
    methodology: 'One isolated Node process per population; stepWorld(1), 3 warm-up ticks, 50/25/10 timed ticks, nearest-rank p50/p95 and maximum latency; retained heap delta after GC with both previous and next snapshots live.',
    benchmarkManifests,
    runs: reportedRuns,
  }, null, 2));
} else {
  const population = Number(process.argv[childIndex + 1]);
  if (!populations.includes(population)) throw new RangeError(`População inválida: ${population}.`);

  const server = await createServer({
    configFile: false,
    logLevel: 'silent',
    appType: 'custom',
    server: { middlewareMode: true },
  });
  try {
    const { createEmptyWorld, stepWorld } = await server.ssrLoadModule('/src/core/world.ts');
    const { canonicalStringify, utf8ByteLength } = await server.ssrLoadModule('/src/core/canonical-json.ts');
    let state = createEmptyWorld({
      scenarioId: 'foundation:empty-world',
      scenarioVersion: '1.0.0',
      seed: '0123456789abcdef',
      config: {},
    });
    state.entities = Array.from({ length: population }, (_, index) => ({
      id: `bench:${String(index).padStart(5, '0')}`,
      kind: 'fixture:benchmark',
    }));
    const stateBytes = utf8ByteLength(canonicalStringify(state));
    if (stateBytes > 3 * 1024 * 1024 - 1024) {
      throw new RangeError(`O estado de ${population} entidades excede o limite F0: ${stateBytes} bytes.`);
    }

    for (let index = 0; index < 3; index += 1) state = stepWorld(state, 1).state;
    const sampleCount = population === 0 ? 50 : population === 10_000 ? 25 : 10;
    const samplesMs = [];
    for (let index = 0; index < sampleCount; index += 1) {
      const startedAt = performance.now();
      state = stepWorld(state, 1).state;
      samplesMs.push(performance.now() - startedAt);
    }

    globalThis.gc?.();
    const beforeClone = process.memoryUsage();
    const nextSnapshot = stepWorld(state, 1).state;
    globalThis.gc?.();
    const afterClone = process.memoryUsage();
    const sorted = [...samplesMs].sort((left, right) => left - right);
    const percentile = (fraction) => sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
    console.log(JSON.stringify({
      population,
      stateBytes,
      samples: sampleCount,
      p50Ms: Number(percentile(0.50).toFixed(3)),
      p95Ms: Number(percentile(0.95).toFixed(3)),
      maxMs: Number(sorted.at(-1).toFixed(3)),
      retainedSecondSnapshotHeapBytes: Math.max(0, afterClone.heapUsed - beforeClone.heapUsed),
      rssBeforeCloneBytes: beforeClone.rss,
      rssWithTwoSnapshotsBytes: afterClone.rss,
      resultingTick: nextSnapshot.tick,
    }));
  } finally {
    await server.close();
  }
}

function gitText(args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} falhou: ${result.stderr}`);
  return result.stdout.trim();
}

function fingerprintWorkingTree() {
  const trackedDiff = spawnSync('git', ['diff', '--binary', 'HEAD', '--', '.', ':(exclude)docs/**']);
  if (trackedDiff.status !== 0) throw new Error(`git diff falhou: ${trackedDiff.stderr.toString('utf8')}`);
  const untracked = spawnSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' });
  if (untracked.status !== 0) throw new Error(`git ls-files falhou: ${untracked.stderr}`);
  const hash = createHash('sha256');
  hash.update(trackedDiff.stdout);
  for (const relativePath of untracked.stdout.split('\0').filter((path) => path.length > 0 && !path.startsWith('docs/')).sort()) {
    hash.update(relativePath);
    hash.update('\0');
    hash.update(readFileSync(relativePath));
    hash.update('\0');
  }
  return hash.digest('hex');
}
