import { describe, expect, it } from 'vitest';
import { buildRainStreaks, meanPrecipitationMm, rainOpacity } from '../../src/render/rain-effect';

describe('efeito visual procedural de chuva', () => {
  it('calcula chuva média sem permitir valores negativos ou não finitos', () => {
    expect(meanPrecipitationMm([
      { climate: { precipitationMm: 2 } },
      { climate: { precipitationMm: 4 } },
      { climate: { precipitationMm: -1 } },
      { climate: { precipitationMm: Number.NaN } },
    ])).toBe(1.5);
    expect(meanPrecipitationMm([])).toBe(0);
  });

  it('não desenha gotas fora de um evento de precipitação', () => {
    expect(buildRainStreaks(800, 600, 40, 7, 0, 0)).toEqual([]);
    expect(buildRainStreaks(800, 600, 40, 7, 0, 0.01)).toEqual([]);
  });

  it('gera gotas determinísticas que descem entre quadros', () => {
    const firstFrame = buildRainStreaks(800, 600, 40, 7, 0, 2.5);
    const repeatedFrame = buildRainStreaks(800, 600, 40, 7, 0, 2.5);
    const nextFrame = buildRainStreaks(800, 600, 40, 7, 100, 2.5);

    expect(firstFrame).toEqual(repeatedFrame);
    expect(firstFrame.length).toBeGreaterThan(0);
    expect(nextFrame).toHaveLength(firstFrame.length);
    expect(nextFrame[0]!.x).toBe(firstFrame[0]!.x);
    expect(nextFrame[0]!.y).not.toBe(firstFrame[0]!.y);
    expect(firstFrame.every((streak) => streak.endY > streak.y)).toBe(true);
  });

  it('aumenta a opacidade e a densidade com a intensidade da chuva', () => {
    const drizzle = buildRainStreaks(800, 600, 40, 7, 0, 0.5);
    const downpour = buildRainStreaks(800, 600, 40, 7, 0, 5);
    expect(downpour.length).toBeGreaterThan(drizzle.length);
    expect(rainOpacity(5, 2)).toBeGreaterThan(rainOpacity(0.5, 2));
  });
});
