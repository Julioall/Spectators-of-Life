/**
 * Derived flow fields used by the natural-world generator.
 *
 * The persisted drainage graph remains single-direction (D8) so saves and
 * runtime routing stay deterministic and easy to inspect. These helpers are
 * deliberately derived fields: they approximate lateral catchment support
 * without changing the authoritative downstream edge.
 */

const NEIGHBORS = [
  [-1, -1, Math.SQRT2], [0, -1, 1], [1, -1, Math.SQRT2],
  [-1, 0, 1], [1, 0, 1],
  [-1, 1, Math.SQRT2], [0, 1, 1], [1, 1, Math.SQRT2],
] as const;

/**
 * Routes a precipitation-weighted contributing area through all lower
 * neighbours. A power greater than one preserves a preferred direction while
 * allowing a controlled lateral contribution on divergent slopes.
 */
export function buildMultipleFlowContributingCells(
  width: number,
  height: number,
  elevations: readonly number[],
  rainfallFactors: readonly number[],
  slopePower = 1.25,
): number[] {
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1
    || elevations.length !== width * height || rainfallFactors.length !== elevations.length) {
    throw new Error('Dimensões incompatíveis para o campo de contribuição múltipla.');
  }
  const contribution = rainfallFactors.map((rainfall) => clamp(0.7 + rainfall * 0.45, 0.7, 1.7));
  const order = elevations.map((_, index) => index)
    .sort((left, right) => (elevations[right] as number) - (elevations[left] as number) || left - right);

  for (const index of order) {
    const x = index % width;
    const y = Math.floor(index / width);
    const lower: Array<{ index: number; slope: number }> = [];
    for (const [dx, dy, distance] of NEIGHBORS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const neighborIndex = ny * width + nx;
      const slope = ((elevations[index] as number) - (elevations[neighborIndex] as number)) / distance;
      if (slope > 1e-9) lower.push({ index: neighborIndex, slope });
    }
    if (lower.length === 0) continue;
    const weightedSlope = lower.map((candidate) => Math.pow(candidate.slope, Math.max(0.5, slopePower)));
    const totalWeight = weightedSlope.reduce((total, weight) => total + weight, 0);
    if (!(totalWeight > 0)) continue;
    const amount = contribution[index] as number;
    for (let candidateIndex = 0; candidateIndex < lower.length; candidateIndex += 1) {
      const candidate = lower[candidateIndex]!;
      contribution[candidate.index] = (contribution[candidate.index] as number)
        + amount * (weightedSlope[candidateIndex] as number) / totalWeight;
    }
  }
  return contribution;
}

/**
 * Adapts a channel-start threshold to local wetness, slope and grid scale.
 * Wet or steep terrain can form a visible channel with less contributing
 * area; coarser cells need more support before becoming a persistent river.
 */
export function adaptiveChannelThreshold(
  baseThreshold: number,
  rainfallFactor: number,
  slope: number,
  cellSizeM: number,
): number {
  const wetness = clamp((rainfallFactor - 0.18) / 1.68, 0, 1);
  const steepness = clamp(slope / 0.24, 0, 1);
  const resolution = clamp(Math.sqrt(Math.max(1, cellSizeM) / 250), 0.78, 1.34);
  const environmentFactor = clamp(1.14 - wetness * 0.24 - steepness * 0.13, 0.68, 1.16);
  return Math.max(1, baseThreshold * environmentFactor * resolution);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
