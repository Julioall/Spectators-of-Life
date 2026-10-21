import { describe, expect, it } from 'vitest';
import { createNaturalWorld } from '../../src/core/natural/scenario';
import { getNaturalWorld } from '../../src/core/natural/types';
import { generateProceduralRocks, treeBlockingCellsForRocks } from '../../src/modules/geosphere/rendering/rocks/procedural-rocks';
import { worldObjectDepth } from '../../src/render/z-order';

describe('ordem visual do mundo', () => {
  it('coloca bases mais baixas na frente e mantém rocha à frente em empate', () => {
    expect(worldObjectDepth(12, 32)).toBeGreaterThan(worldObjectDepth(4, 32));
    expect(worldObjectDepth(12, 32, 0.002)).toBeGreaterThan(worldObjectDepth(12, 32));
  });

  it('bloqueia árvores somente nas pegadas de formações grandes e macro', () => {
    const world = getNaturalWorld(createNaturalWorld('0123456789abcdef'));
    const rocks = generateProceduralRocks(world, 1947);
    const blocked = treeBlockingCellsForRocks(rocks, world.width, world.height);
    const large = rocks.filter((rock) => rock.deposit.tier === 'large' || rock.deposit.tier === 'macro');
    const small = rocks.filter((rock) => rock.deposit.tier !== 'large' && rock.deposit.tier !== 'macro');

    expect(large.length).toBeGreaterThan(0);
    expect(blocked.size).toBeGreaterThan(0);
    for (const rock of large) {
      const center = rock.footprint.y * world.width + rock.footprint.x;
      expect(blocked.has(center)).toBe(true);
    }
    for (const rock of small) {
      const center = rock.footprint.y * world.width + rock.footprint.x;
      expect(blocked.has(center)).toBe(false);
    }
  });
});
