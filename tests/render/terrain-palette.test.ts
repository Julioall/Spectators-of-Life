import { describe, expect, it } from 'vitest';
import {
  ALTITUDE_MAP_OVERLAY_ALPHA,
  altitudeMapColor,
  sampleTerrainPaletteColor,
  smoothTerrainPaletteField,
  TERRAIN_SURFACE_COLORS,
  type TerrainSurface,
} from '../../src/render/terrain-palette';

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

describe('transição visual da paleta do terreno', () => {
  it('mistura superfícies vizinhas com o pincel ponderado 5×5 sem alterar as classes', () => {
    const width = 9;
    const height = 3;
    const surfaces = Array.from({ length: width * height }, (_, index): TerrainSurface => {
      return index % width < 4 ? 'loam' : 'desert';
    });
    const original = [...surfaces];
    const palette = smoothTerrainPaletteField(width, height, surfaces);
    const loam = TERRAIN_SURFACE_COLORS.loam;
    const desert = TERRAIN_SURFACE_COLORS.desert;
    const boundary = sampleTerrainPaletteColor(palette, 3.5, 1);

    expect(boundary).not.toBe(loam);
    expect(boundary).not.toBe(desert);
    expect(palette.red[0]).toBe((loam >>> 16) & 0xff);
    expect(palette.red[width - 1]).toBe((desert >>> 16) & 0xff);
    expect(surfaces).toEqual(original);
  });

  it('preserva uma paleta uniforme em todo o campo', () => {
    const palette = smoothTerrainPaletteField(4, 3, new Array<TerrainSurface>(12).fill('woodland'));
    const color = TERRAIN_SURFACE_COLORS.woodland;
    for (let y = 0; y < palette.height; y += 1) {
      for (let x = 0; x < palette.width; x += 1) {
        expect(sampleTerrainPaletteColor(palette, x, y)).toBe(color);
      }
    }
  });
});
