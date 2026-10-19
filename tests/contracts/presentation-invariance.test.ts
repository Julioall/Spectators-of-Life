import { describe, expect, it } from 'vitest';
import { logicalStateString } from '../../src/core/canonical-json';
import { drawFromSystem } from '../../src/core/rng';
import { WorkerEngine } from '../../src/worker/engine';
import type { SimulationEvent, WorkerResponse, WorldState } from '../../src/core/types';

type PresentationProfile = {
  render: boolean;
  fps: number;
  camera: { x: number; y: number; zoom: number };
};

function runWithPresentation(profile: PresentationProfile): {
  state: WorldState;
  events: SimulationEvent[];
  renderedFrames: number;
  projectionChecksum: number;
} {
  const engine = new WorkerEngine({
    createWorldId: () => 'world-presentation',
    systems: [{
      id: 'core:presentation-fixture',
      order: 1,
      periodTicks: 1,
      phaseOffsetTicks: 0,
      run: (world, tick) => {
        const draw = drawFromSystem(world.rng, world.seed, 'core:presentation-fixture');
        world.metrics['drawSum'] = (world.metrics['drawSum'] ?? 0) + draw;
        return [{ tick, systemId: 'core:presentation-fixture', eventType: 'test:tick', actorIds: [], data: { draw } }];
      },
    }],
  });
  let requestId = 0;
  let worldId = '';
  const events: SimulationEvent[] = [];
  let renderedFrames = 0;
  let projectionChecksum = 0;

  const handle = (body: Record<string, unknown>): WorkerResponse => engine.handle({
    protocolVersion: 1,
    requestId: ++requestId,
    ...body,
  });
  const created = handle({
    type: 'CREATE_WORLD',
    scenarioId: 'foundation:empty-world',
    scenarioVersion: '1.0.0',
    seed: '0123456789abcdef',
    config: {},
  });
  if (created.type !== 'READY') throw new Error(`READY esperado; recebido ${created.type}.`);
  worldId = created.worldId;

  const simulationTicksPerSecond = 30;
  const totalTicks = 120;
  for (let tick = 1; tick <= totalTicks; tick += 1) {
    const advanced = handle({ type: 'STEP', worldId, ticks: 1 });
    if (advanced.type !== 'ADVANCED') throw new Error(`ADVANCED esperado; recebido ${advanced.type}.`);
    events.push(...advanced.events);

    if (!profile.render) continue;
    const framesThisTick = Math.floor(tick * profile.fps / simulationTicksPerSecond)
      - Math.floor((tick - 1) * profile.fps / simulationTicksPerSecond);
    for (let frame = 0; frame < framesThisTick; frame += 1) {
      const response = handle({ type: 'GET_SNAPSHOT', worldId });
      if (response.type !== 'SNAPSHOT') throw new Error(`SNAPSHOT esperado; recebido ${response.type}.`);
      const { x, y, zoom } = profile.camera;
      // Presentation-only projection work: camera and frame cadence never enter Worker requests.
      projectionChecksum += (response.snapshot.tick - x) * zoom + (response.snapshot.tick - y) * zoom;
      renderedFrames += 1;
    }
  }

  const finalSnapshot = handle({ type: 'GET_SNAPSHOT', worldId });
  if (finalSnapshot.type !== 'SNAPSHOT') throw new Error(`SNAPSHOT final esperado; recebido ${finalSnapshot.type}.`);
  return { state: finalSnapshot.snapshot, events, renderedFrames, projectionChecksum };
}

describe('SPEC-000 · isolamento da apresentação', () => {
  it('mantém estado, RNG e eventos com render desligado, cadências diferentes e câmeras distintas', () => {
    const profiles: PresentationProfile[] = [
      { render: false, fps: 30, camera: { x: 0, y: 0, zoom: 1 } },
      { render: true, fps: 30, camera: { x: 0, y: 0, zoom: 1 } },
      { render: true, fps: 60, camera: { x: 320, y: -180, zoom: 1.5 } },
      { render: true, fps: 144, camera: { x: -2048, y: 1024, zoom: 0.75 } },
    ];
    const results = profiles.map(runWithPresentation);

    expect(results.map((result) => result.renderedFrames)).toEqual([0, 120, 240, 576]);
    for (const result of results.slice(1)) {
      expect(logicalStateString(result.state)).toBe(logicalStateString(results[0]!.state));
      expect(result.events).toEqual(results[0]!.events);
    }
    expect(new Set(results.map((result) => result.projectionChecksum)).size).toBeGreaterThan(1);
  });
});
