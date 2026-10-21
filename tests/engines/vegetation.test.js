import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRESETS, makePlant, createVegetationEngine, VegetationWorld,
  WindField, LeafGenetics, LeafLifecycle, ByteLRU, LeafEngine,
  createCanvas, setCanvasFactory
} from '../../src/modules/biosphere/flora/rendering/vegetation/index.js';

const presets = PRESETS.map(p => p.id);

test('all fifteen vegetation presets produce structured plants', () => {
  assert.equal(PRESETS.length, 15);
  for (const preset of presets) {
    const plant = makePlant({ preset, seed: 476 });
    assert.ok(plant.leaves.length > 0, preset);
    assert.ok(plant.stems.length > 0 || plant.profile.mode === 'rosette', preset);
    assert.ok(plant.leaves.every(l => Number.isFinite(l.x) && Number.isFinite(l.y)), preset);
    assert.equal(plant.metadata.leafCount, plant.leaves.length);
  }
});

test('geometry is deterministic with seed, same species and environment', () => {
  for (const preset of presets) {
    const options = { preset, seed: 123456, density: .85, age: .7, season: 'outono', drought: .2 };
    assert.deepEqual(makePlant(options), makePlant(options));
  }
});

test('different seeds alter procedural geometry', () => {
  assert.notDeepEqual(
    makePlant({ preset: 'samambaia', seed: 12 }).leaves,
    makePlant({ preset: 'samambaia', seed: 13 }).leaves
  );
});

test('profiles validate unsupported presets', () => {
  assert.throws(() => makePlant({ preset: '__missing__' }), /Preset desconhecido/);
});

test('age and density affect leaf counts and plant growth', () => {
  const young = makePlant({ preset: 'arbusto_denso', age: .1, density: .5 });
  const mature = makePlant({ preset: 'arbusto_denso', age: 1, density: 1.5 });
  assert.ok(mature.leaves.length > young.leaves.length);
});

test('wind field is deterministic and spatially coherent', () => {
  const wind = new WindField({ seed: 222, strength: .72 });
  assert.deepEqual(wind.sample(100, 200, .3), wind.sample(100, 200, .3));
  const a = wind.sample(100, 200, .3);
  const b = wind.sample(101, 201, .3);
  const c = wind.sample(1100, 2200, .3);
  assert.ok(Number.isFinite(a.strength));
  assert.ok(Math.abs(a.vx - b.vx) < Math.abs(a.vx - c.vx) + 1.1);
});

test('genetics and leaf life are available as pure logic', () => {
  const a = LeafGenetics.createGenome('quercus', 1);
  const b = LeafGenetics.createGenome('quercus', 2);
  assert.deepEqual(a, LeafGenetics.createGenome('quercus', 1));
  const child = LeafGenetics.breed(a, b, 3);
  assert.equal(child.species, 'quercus');
  assert.equal(child.generation, 1);
  assert.ok(LeafGenetics.phenotype(child).length > 0);
  assert.equal(typeof LeafLifecycle.evaluate, 'function');
  assert.equal(typeof LeafEngine.renderLeaf, 'function');
});

test('cache respects budget and LRU replacement', () => {
  const cache = new ByteLRU(1024);
  assert.equal(cache.put('a', { width: 12, height: 12 }), true);
  assert.equal(cache.put('b', { width: 12, height: 12 }), true);
  assert.ok(cache.bytes <= cache.budget);
  assert.equal(cache.get('a'), null);
  assert.ok(cache.get('b'));
});

test('world grid queries and mutations work without browser APIs', () => {
  const engine = createVegetationEngine();
  const world = engine.createWorld({ cellSize: 100 });
  world.insert({ id: 'a', preset: 'trevo_rasteiro', x: 5, y: 10 });
  world.insert({ id: 'b', preset: 'cerca_viva', x: 10000, y: 10000 });
  const near = world.query({ x: 0, y: 0, width: 400, height: 300, zoom: 1 });
  assert.deepEqual(near.map(p => p.id), ['a']);
  assert.equal(world.remove('a'), true);
  assert.equal(world.remove('a'), false);
  assert.equal(world.query({ x: 0, y: 0, width: 400, height: 300, zoom: 1 }).length, 0);
  engine.dispose();
  assert.throws(() => engine.createPlant({ preset: 'roseta' }), /disposed/);
});

test('canvas adapter supports custom game engine canvas factory', () => {
  setCanvasFactory((w, h) => ({ width: w, height: h, getContext: () => ({}) }));
  const canvas = createCanvas(64, 32);
  assert.equal(canvas.width, 64);
  assert.equal(canvas.height, 32);
  assert.throws(() => createCanvas(0, 4), /positive integers/);
  setCanvasFactory(null);
});

test('incremental sprite queue processes work and shares a cached result', () => {
  const engine = createVegetationEngine();
  const { runtime } = engine;
  // Override the rendering dependency with a tiny fake sprite to test the queue
  runtime.engine = { renderLeaf: (opts) => ({ width: opts.size, height: opts.size, getContext: () => ({}) }) };
  const config = { shape: 'oval', seed: 15, size: 32 };
  const pending = runtime.requestSprite(config);
  assert.equal(pending.status, 'pending');
  const batch = runtime.tick({ maxJobs: 1, timeBudgetMs: 100 });
  assert.equal(batch.generated, 1);
  const ready = runtime.requestSprite(config);
  assert.equal(ready.status, 'ready');
  assert.ok(runtime.stats().hits >= 1);
  runtime.clear();
  engine.dispose();
});

test('renderer uses cached sprites without owning the game canvas', () => {
  const engine = createVegetationEngine();
  engine.runtime.engine = { renderLeaf: () => ({ width: 96, height: 96, getContext: () => ({}) }) };
  const plant = engine.createPlant({ preset: 'trevo_rasteiro', seed: 56 });
  engine.prepare(plant);
  engine.flush();
  const calls = [];
  const ctx = new Proxy({}, {
    get(target, prop) {
      if (prop === 'drawImage') return (...args) => calls.push(args);
      if (prop === 'imageSmoothingEnabled') return false;
      return () => {};
    },
    set() { return true; }
  });
  const result = engine.draw(ctx, plant, { x: 10, y: 20, time: .5, wind: .25 });
  assert.equal(result.ready, result.total);
  assert.equal(result.pending, 0);
  assert.equal(calls.length, plant.leaves.length);
  engine.dispose();
});
