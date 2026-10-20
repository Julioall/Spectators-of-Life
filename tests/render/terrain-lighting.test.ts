import { describe, expect, it } from 'vitest';
import {
  applyTerrainLightingToImageData,
  calculateDirectionalLight,
  calculateHillshade,
  calculateLightFactor,
  calculateTerrainGradient,
  calculateTerrainLightingFactors,
  calculateTerrainOcclusion,
  compositeInterpolatedColorFieldToImageData,
  createTerrainLightingDirtyMask,
  DEFAULT_TERRAIN_LIGHTING_SETTINGS,
  sampleCellFieldBilinear,
  sanitizeTerrainLightingSettings,
  smoothCellField,
  smoothTerrainLightingFactors,
} from '../../src/render/terrain-lighting';

describe('iluminação topográfica', () => {
  it('mapeia os ângulos cardeais para as direções do mapa top-down', () => {
    expect(calculateDirectionalLight(0).y).toBeCloseTo(-1);
    expect(calculateDirectionalLight(90).x).toBeCloseTo(1);
    expect(calculateDirectionalLight(180).y).toBeCloseTo(1);
    expect(calculateDirectionalLight(270).x).toBeCloseTo(-1);
  });

  it('calcula diferenças centrais e gradiente unilateral nas bordas', () => {
    const center = calculateTerrainGradient(0, 100, 0, 50, 250);
    const edge = calculateTerrainGradient(0, 100, 0, 50, 250, 1, 1);
    expect(center).toEqual({ dx: 0.2, dy: 0.1, slope: Math.hypot(0.2, 0.1) });
    expect(edge).toEqual({ dx: 0.4, dy: 0.2, slope: Math.hypot(0.4, 0.2) });
    expect(calculateTerrainGradient(0, 10, 10, 0, 0).slope).toBe(0);
  });

  it('ilumina a encosta voltada à direção solar e limita o resultado', () => {
    const northwest = calculateDirectionalLight(315);
    expect(calculateHillshade(0.2, 0.2, northwest, 3)).toBeGreaterThan(0);
    expect(calculateHillshade(-0.2, -0.2, northwest, 3)).toBeLessThan(0);
    expect(calculateHillshade(10, 10, northwest, 8)).toBe(0.48);
    expect(calculateHillshade(-10, -10, northwest, 8)).toBe(-0.52);
    expect(calculateLightFactor(0, 0)).toBeCloseTo(1.02);
  });

  it('sombreia por oclusão quando há uma elevação na direção da luz', () => {
    const elevations = new Float32Array([
      0, 100, 0,
      0, 0, 0,
      0, 0, 0,
    ]);
    const shadowed = calculateTerrainOcclusion(1, 1, 3, 3, elevations, 250, calculateDirectionalLight(0), 3);
    const open = calculateTerrainOcclusion(1, 1, 3, 3, elevations, 250, calculateDirectionalLight(180), 3);
    expect(shadowed).toBeCloseTo(0.17);
    expect(open).toBe(0);
  });

  it('é determinística, mantém o plano neutro e desliga sem alterar cores', () => {
    const elevations = new Float32Array(25).fill(140);
    const originalElevations = [...elevations];
    const first = calculateTerrainLightingFactors(5, 5, 250, elevations, DEFAULT_TERRAIN_LIGHTING_SETTINGS);
    const second = calculateTerrainLightingFactors(5, 5, 250, elevations, DEFAULT_TERRAIN_LIGHTING_SETTINGS);
    const disabled = calculateTerrainLightingFactors(5, 5, 250, elevations, { ...DEFAULT_TERRAIN_LIGHTING_SETTINGS, enabled: false });
    expect(first).toEqual(second);
    expect([...elevations]).toEqual(originalElevations);
    expect(first.every((factor) => Math.abs(factor - 1.02) < 0.000001)).toBe(true);
    expect(disabled.every((factor) => factor === 1)).toBe(true);
  });

  it('normaliza controles aos intervalos e incrementos declarados', () => {
    expect(sanitizeTerrainLightingSettings({ enabled: true, sunAngle: 352, reliefStrength: 8.2 })).toEqual({
      enabled: true,
      sunAngle: 345,
      reliefStrength: 8,
    });
    expect(sanitizeTerrainLightingSettings({ enabled: false, sunAngle: 22, reliefStrength: 1.26 }).sunAngle).toBe(15);
    expect(sanitizeTerrainLightingSettings({ enabled: false, sunAngle: 22, reliefStrength: 1.26 }).reliefStrength).toBe(1.5);
  });

  it('suaviza mudanças entre células e conserva um campo uniforme', () => {
    const uniform = smoothTerrainLightingFactors(4, 3, new Float32Array(12).fill(1.02));
    const ridge = smoothTerrainLightingFactors(5, 1, new Float32Array([1, 1, 1.38, 1, 1]));
    expect(uniform.every((factor) => Math.abs(factor - 1.02) < 0.000001)).toBe(true);
    expect(ridge[1]!).toBeGreaterThan(1);
    expect(ridge[1]!).toBeLessThan(1.38);
    expect(ridge[3]!).toBeCloseTo(ridge[1]!);
  });

  it('suaviza profundidade da água dentro da máscara sem espalhar valores para o terreno seco', () => {
    const field = smoothCellField(5, 1, [0, 20, 100, 20, 0], [0, 1, 1, 1, 0]);
    expect(field[0]).toBe(0);
    expect(field[4]).toBe(0);
    expect(field[1]).toBeGreaterThan(20);
    expect(field[1]).toBeLessThan(field[2]!);
    expect(field[2]).toBeLessThan(100);
  });

  it('interpola o campo entre células e mistura a rampa por pixel sem mudar o alpha', () => {
    expect(sampleCellFieldBilinear(2, 2, [0, 1, 2, 3], 0.5, 0.5)).toBe(1.5);
    const imageData = {
      width: 4,
      height: 2,
      data: new Uint8ClampedArray(4 * 2 * 4).fill(0),
    } as ImageData;
    for (let index = 3; index < imageData.data.length; index += 4) imageData.data[index] = 255;
    compositeInterpolatedColorFieldToImageData(imageData, 2, 1, 2, [0, 1], (value) => {
      const channel = Math.round(value * 255);
      return (channel << 16) | (channel << 8) | channel;
    }, 0.5);
    expect([...imageData.data.slice(0, 16)]).toEqual([
      0, 0, 0, 255,
      32, 32, 32, 255,
      96, 96, 96, 255,
      128, 128, 128, 255,
    ]);
  });

  it('expande alterações de altitude a uma região de iluminação e usa rebuild amplo quando ela é grande', () => {
    const mask = createTerrainLightingDirtyMask(30, 30, [15 * 30 + 15]);
    expect(mask?.[15 * 30 + 15]).toBe(1);
    expect(mask?.[8 * 30 + 8]).toBe(1);
    expect(mask?.[7 * 30 + 15]).toBe(0);
    expect(createTerrainLightingDirtyMask(10, 10, Array.from({ length: 100 }, (_, index) => index))).toBeUndefined();
  });

  it('multiplica RGB por célula, preserva transparência e limita canais', () => {
    const imageData = {
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([100, 80, 50, 255, 200, 150, 100, 0]),
    } as ImageData;
    applyTerrainLightingToImageData(imageData, 2, 1, 1, new Float32Array([1.2, 0.5]));
    expect([...imageData.data]).toEqual([120, 96, 60, 255, 200, 150, 100, 0]);

    const clipped = { width: 1, height: 1, data: new Uint8ClampedArray([250, 10, 0, 255]) } as ImageData;
    applyTerrainLightingToImageData(clipped, 1, 1, 1, [1.38]);
    expect([...clipped.data]).toEqual([255, 14, 0, 255]);
  });
});
