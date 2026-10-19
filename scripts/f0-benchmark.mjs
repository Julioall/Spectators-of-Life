import { spawnSync } from 'node:child_process';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const scriptPath = fileURLToPath(import.meta.url);
const populations = [0, 10_000, 50_000];
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
  const gitRevision = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
  console.log(JSON.stringify({
    measuredAt: new Date().toISOString(),
    revision: gitRevision,
    workingTree: 'modified',
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
    methodology: 'One isolated Node process per population; stepWorld(1), 3 warm-up ticks, 50/25/10 timed ticks, p50/p95/max latency; retained heap delta after GC with both previous and next snapshots live.',
    runs,
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
