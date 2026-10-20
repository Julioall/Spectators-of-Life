import { describe, expect, it } from 'vitest';
import { adaptiveChannelThreshold, buildMultipleFlowContributingCells } from '../../src/core/natural/flow-routing';

describe('campos derivados de roteamento hídrico', () => {
  it('mantém contribuição total e distribui suporte lateral em uma encosta divergente', () => {
    const elevations = [
      4, 4, 4,
      3, 2, 3,
      2, 1, 2,
    ];
    const factors = new Array(9).fill(1);
    const contribution = buildMultipleFlowContributingCells(3, 3, elevations, factors);
    expect(contribution[4]).toBeGreaterThan(1);
    expect(contribution[7]).toBeGreaterThan(contribution[6]!);
    expect(contribution[7]).toBeGreaterThan(contribution[8]!);
    expect(contribution.every((value) => Number.isFinite(value) && value >= 0)).toBe(true);
  });

  it('reduz o limiar em ambiente úmido e íngreme, aumentando-o em células grossas', () => {
    const dryFlat = adaptiveChannelThreshold(21, 0.2, 0.01, 250);
    const wetSteep = adaptiveChannelThreshold(21, 1.8, 0.35, 250);
    const coarse = adaptiveChannelThreshold(21, 1, 0.1, 500);
    expect(wetSteep).toBeLessThan(dryFlat);
    expect(coarse).toBeGreaterThan(adaptiveChannelThreshold(21, 1, 0.1, 250));
  });
});
