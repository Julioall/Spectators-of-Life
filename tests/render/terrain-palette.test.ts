import { describe, expect, it } from 'vitest';
import { ALTITUDE_MAP_OVERLAY_ALPHA, altitudeMapColor } from '../../src/render/terrain-palette';

describe('paleta hipsométrica de altitude', () => {
  it('usa transparência para preservar a leitura do mapa natural', () => {
    expect(ALTITUDE_MAP_OVERLAY_ALPHA).toBe(0.48);
    expect(ALTITUDE_MAP_OVERLAY_ALPHA).toBeGreaterThan(0);
    expect(ALTITUDE_MAP_OVERLAY_ALPHA).toBeLessThan(1);
  });

  it('mapeia os extremos de elevação para os extremos da legenda', () => {
    expect(altitudeMapColor(0)).toBe(0x254d45);
    expect(altitudeMapColor(1)).toBe(0xe0dec9);
  });

  it('interpola cores intermediárias e limita alturas fora da faixa', () => {
    expect(altitudeMapColor(0.5)).not.toBe(altitudeMapColor(0));
    expect(altitudeMapColor(0.5)).not.toBe(altitudeMapColor(1));
    expect(altitudeMapColor(-1)).toBe(altitudeMapColor(0));
    expect(altitudeMapColor(2)).toBe(altitudeMapColor(1));
    expect(altitudeMapColor(Number.NaN)).toBe(altitudeMapColor(0));
  });
});
