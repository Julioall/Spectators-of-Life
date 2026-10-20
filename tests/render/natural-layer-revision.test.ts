import { describe, expect, it } from 'vitest';
import { hasNaturalLayerRevisionChanged } from '../../src/render/natural-layer-revision';

describe('revisão das camadas naturais', () => {
  it('não redesenha camadas quando só avança o relógio entre atualizações diárias', () => {
    expect(hasNaturalLayerRevisionChanged(
      { worldKey: 'natural:temperate-valley@1.7.0:0123456789abcdef', daysSimulated: 12 },
      { worldKey: 'natural:temperate-valley@1.7.0:0123456789abcdef', daysSimulated: 12 },
    )).toBe(false);
  });

  it('redesenha no novo dia ou quando um mundo de mesma seed é recarregado', () => {
    const previous = { worldKey: 'natural:temperate-valley@1.7.0:0123456789abcdef', daysSimulated: 12 };
    expect(hasNaturalLayerRevisionChanged(previous, { ...previous, daysSimulated: 13 })).toBe(true);
    expect(hasNaturalLayerRevisionChanged(previous, { ...previous, worldKey: `${previous.worldKey}:other` })).toBe(true);
    expect(hasNaturalLayerRevisionChanged(null, previous)).toBe(true);
  });
});
