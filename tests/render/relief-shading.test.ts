import { describe, expect, it } from 'vitest';
import { reliefShadeForNeighbors } from '../../src/render/relief-shading';

describe('sombreado do relevo', () => {
  it('mantém terreno plano neutro', () => {
    expect(reliefShadeForNeighbors(120, 120, 120, 120, 250)).toBe(0);
  });

  it('ilumina faces voltadas ao noroeste e sombreia a face oposta', () => {
    const northwestFacing = reliefShadeForNeighbors(0, 100, 0, 0, 250);
    const southeastFacing = reliefShadeForNeighbors(100, 0, 0, 0, 250);

    expect(northwestFacing).toBeGreaterThan(0);
    expect(southeastFacing).toBeLessThan(0);
    expect(Math.abs(northwestFacing)).toBeLessThanOrEqual(0.72);
    expect(Math.abs(southeastFacing)).toBeLessThanOrEqual(0.72);
  });

  it('ignora medidas inválidas sem propagar NaN para o desenho', () => {
    expect(reliefShadeForNeighbors(0, Number.NaN, 0, 0, 250)).toBe(0);
    expect(reliefShadeForNeighbors(0, 10, 0, 0, 0)).toBe(0);
  });
});
