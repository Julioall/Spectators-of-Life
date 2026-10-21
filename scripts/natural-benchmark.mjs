import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { createServer } from 'vite';

const scriptPath = fileURLToPath(import.meta.url);
const seed = '0123456789abcdef';
const warmupDays = 3;
const measuredDays = 30;
const ticksPerDay = 4;
const schema = JSON.parse(readFileSync(new URL('../data/schemas/benchmark.v1.schema.json', import.meta.url), 'utf8'));
const validateManifest = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
const childIndex = process.argv.indexOf('--child');

if (childIndex === -1) {
  const result = spawnSync(process.execPath, ['--expose-gc', scriptPath, '--child'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
  console.log(result.stdout.trim());
} else {
  const server = await createServer({
    configFile: false,
    logLevel: 'silent',
    appType: 'custom',
    server: { middlewareMode: true },
  });

  try {
    const [{ WorkerEngine }, { canonicalStringify, utf8ByteLength }, { NATURAL_SYSTEMS }, constants] = await Promise.all([
      server.ssrLoadModule('/src/worker/engine.ts'),
      server.ssrLoadModule('/src/core/canonical-json.ts'),
      server.ssrLoadModule('/src/core/natural/scenario.ts'),
      server.ssrLoadModule('/src/core/constants.ts'),
    ]);
    let collectSystemTimings = false;
    const systemSamples = new Map();
    const profiledSystems = NATURAL_SYSTEMS.map((system) => ({
      ...system,
      run: (...args) => {
        const startedAt = performance.now();
        try {
          return system.run(...args);
        } finally {
          if (collectSystemTimings) {
            const samples = systemSamples.get(system.id) ?? [];
            samples.push(performance.now() - startedAt);
            systemSamples.set(system.id, samples);
          }
        }
      },
    }));
    const engine = new WorkerEngine({ systems: profiledSystems, snapshotOwnership: 'post-message' });
    let requestId = 0;
    const send = (body) => engine.handle({ protocolVersion: 1, requestId: ++requestId, ...body });
    const ready = send({
      type: 'CREATE_WORLD',
      scenarioId: constants.NATURAL_SCENARIO_ID,
      scenarioVersion: constants.NATURAL_SCENARIO_VERSION,
      seed,
      config: {},
    });
    if (ready.type !== 'READY') throw new Error(`Falha ao criar cenário natural: ${JSON.stringify(ready)}.`);

    const simulationSamples = [];
    const stepRoundTripSamples = [];
    const snapshotHandlerSamples = [];
    const snapshotTransferSamples = [];
    const snapshotTotalSamples = [];
    let finalSnapshot;
    for (let day = 0; day < warmupDays + measuredDays; day += 1) {
      const stepStartedAt = performance.now();
      collectSystemTimings = day >= warmupDays;
      const advanced = send({ type: 'STEP', worldId: ready.worldId, ticks: ticksPerDay });
      collectSystemTimings = false;
      const stepRoundTripMs = performance.now() - stepStartedAt;
      if (advanced.type !== 'ADVANCED') throw new Error(`STEP natural falhou no dia ${day + 1}: ${JSON.stringify(advanced)}.`);
      if (day >= warmupDays) {
        simulationSamples.push(advanced.diagnostics.durationMs);
        stepRoundTripSamples.push(stepRoundTripMs);

        const snapshotStartedAt = performance.now();
        const snapshot = send({ type: 'GET_SNAPSHOT', worldId: ready.worldId });
        const handlerMs = performance.now() - snapshotStartedAt;
        if (snapshot.type !== 'SNAPSHOT') throw new Error(`GET_SNAPSHOT natural falhou no dia ${day + 1}: ${JSON.stringify(snapshot)}.`);

        const transferStartedAt = performance.now();
        finalSnapshot = structuredClone(snapshot);
        const transferMs = performance.now() - transferStartedAt;
        snapshotHandlerSamples.push(handlerMs);
        snapshotTransferSamples.push(transferMs);
        snapshotTotalSamples.push(handlerMs + transferMs);
      }
    }

    if (finalSnapshot === undefined) throw new Error('O benchmark não produziu snapshot final.');
    const natural = finalSnapshot.snapshot.entities[0];
    const totalTicks = (warmupDays + measuredDays) * ticksPerDay;
    const measuredFromTick = warmupDays * ticksPerDay;
    const measuredToTick = totalTicks;
    const measuredAt = new Date().toISOString();
    const gitRevision = gitText(['rev-parse', 'HEAD']);
    const workingTreeStatus = gitText(['status', '--porcelain', '--untracked-files=all']);
    const workingTreeDirty = workingTreeStatus.length > 0;
    const workingTreeFingerprint = workingTreeDirty ? fingerprintWorkingTree() : null;
    const buildRevision = workingTreeFingerprint === null ? gitRevision : `${gitRevision}+wt:${workingTreeFingerprint.slice(0, 32)}`;
    const scenario = {
      id: constants.NATURAL_SCENARIO_ID,
      version: constants.NATURAL_SCENARIO_VERSION,
      environmentConfig: {},
      content: [],
      cadences: NATURAL_SYSTEMS.map(({ id, periodTicks, phaseOffsetTicks }) => ({ systemId: id, periodTicks, phaseOffsetTicks })),
      initialPopulation: [],
    };
    const manifestMetrics = [
      ['performance.natural-simulation-p50', 'ms_per_STEP_4'],
      ['performance.natural-simulation-p95', 'ms_per_STEP_4'],
      ['performance.natural-snapshot-p50', 'ms_per_GET_SNAPSHOT_plus_structuredClone'],
      ['performance.natural-snapshot-p95', 'ms_per_GET_SNAPSHOT_plus_structuredClone'],
    ].map(([metricId, unit]) => ({
      metricId,
      scope: 'performance',
      unit,
      window: { fromTickExclusive: measuredFromTick, toTickInclusive: measuredToTick },
      denominator: `${measuredDays} dias naturais medidos após ${warmupDays} dias de aquecimento`,
      populationFilter: { speciesId: null, lifeStageId: null },
    }));
    const manifest = {
      format: 'spectators-of-life-benchmark',
      benchmarkSchemaVersion: 1,
      runId: `natural:simulation-snapshot-${measuredAt.replace(/[^0-9A-Z]/gi, '')}`,
      simulationVersion: finalSnapshot.snapshot.simulationVersion,
      seed,
      scenario,
      learningCondition: { controllerMode: 'heuristic', weightsInherited: false, conditionId: 'f0:natural-no-learning', parameters: {} },
      durationTicks: measuredToTick,
      metrics: manifestMetrics,
      buildRevision,
      performanceEquipment: {
        platform: `${os.type()} ${os.release()}`,
        architecture: process.arch,
        processor: os.cpus()[0]?.model ?? 'unknown',
        logicalProcessorCount: os.cpus().length,
        memoryBytes: os.totalmem(),
      },
    };
    if (!validateManifest(manifest)) throw new Error(`Manifesto natural inválido: ${JSON.stringify(validateManifest.errors)}.`);

    console.log(JSON.stringify({
      format: 'spectators-of-life-natural-performance',
      benchmarkSchemaVersion: 1,
      measuredAt,
      revision: gitRevision,
      workingTree: workingTreeDirty ? 'modified' : 'clean',
      workingTreeFingerprint,
      host: {
        platform: `${os.type()} ${os.release()}`,
        cpu: os.cpus()[0]?.model ?? 'unknown',
        logicalCpus: os.cpus().length,
        ramBytes: os.totalmem(),
        node: process.version,
        v8: process.versions.v8,
        arch: process.arch,
      },
      methodology: `Seed fixa ${seed}; ${warmupDays} dias de aquecimento e ${measuredDays} dias medidos, cada dia com STEP(${ticksPerDay}). Simulação vem de diagnostics.durationMs dentro do WorkerEngine; systemsMsPerDay mede cada sistema natural dentro do STEP sem alterar estado ou ordem. Snapshot inclui handler mais structuredClone para representar a cópia de postMessage. Render Phaser é medido no painel do navegador, com último tempo e P50/P95 em janela móvel de até 120 frames.`,
      scenario: {
        id: constants.NATURAL_SCENARIO_ID,
        version: constants.NATURAL_SCENARIO_VERSION,
        seed,
        width: natural.width,
        height: natural.height,
        cells: natural.cells.length,
        daysSimulated: natural.daysSimulated,
        finalTick: finalSnapshot.snapshot.tick,
        stateBytes: utf8ByteLength(canonicalStringify(finalSnapshot.snapshot)),
      },
      measurements: {
        simulationMsPerDay: summarize(simulationSamples),
        systemsMsPerDay: Object.fromEntries([...systemSamples]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([systemId, samples]) => [systemId, summarize(samples)])),
        stepRoundTripMsPerDay: summarize(stepRoundTripSamples),
        snapshotHandlerMs: summarize(snapshotHandlerSamples),
        snapshotTransferCloneMs: summarize(snapshotTransferSamples),
        snapshotTotalMs: summarize(snapshotTotalSamples),
        render: { source: 'painel de desempenho do navegador', p50P95Window: 'até 120 frames' },
      },
      benchmarkManifests: [manifest],
    }, null, 2));
  } finally {
    await server.close();
  }
}

function summarize(values) {
  const ordered = [...values].sort((left, right) => left - right);
  const percentile = (fraction) => ordered[Math.max(0, Math.ceil(ordered.length * fraction) - 1)];
  return {
    samples: ordered.length,
    p50Ms: Number(percentile(0.5).toFixed(3)),
    p95Ms: Number(percentile(0.95).toFixed(3)),
    maxMs: Number(ordered.at(-1).toFixed(3)),
  };
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
