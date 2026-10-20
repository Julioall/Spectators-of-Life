import { describe, expect, it } from 'vitest';
import { buildLandformElevationField } from '../../src/core/natural/topography';

describe('campo regional de relevo', () => {
  it('amortece picos isolados sem remover a forma local nem criar variação numa planície', () => {
    const elevations = Array.from({ length: 49 }, () => 0);
    elevations[24] = 100;
    const landforms = buildLandformElevationField(7, 7, elevations);

    expect(landforms[24]).toBeCloseTo(35.546875, 8);
    expect(landforms[23]).toBeCloseTo(7.03125, 8);
    expect(landforms[22]).toBeCloseTo(1.7578125, 8);
    expect(buildLandformElevationField(4, 3, Array.from({ length: 12 }, () => 42))).toEqual(Array.from({ length: 12 }, () => 42));
  });

  it('mantém o campo determinístico e rejeita dimensões incompatíveis', () => {
    const elevations = [1, 4, 2, 7, 3, 6];
    expect(buildLandformElevationField(3, 2, elevations)).toEqual(buildLandformElevationField(3, 2, elevations));
    expect(() => buildLandformElevationField(2, 2, elevations)).toThrow('Dimensões incompatíveis');
  });
});
