import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import provenance from '../../src/render/asterra/provenance.json';
import { createAsterraSettings } from '../../src/render/asterra/settings';
import { depositData } from '../../src/render/asterra/engine.js';

describe('motor original ASTERRA v2.3', () => {
  it('preserva o HTML integral e as seções executáveis sem reescrever funções', () => {
    const source = readFileSync(new URL(`../../${provenance.source}`, import.meta.url));
    expect(createHash('sha256').update(source).digest('hex')).toBe(provenance.sourceSha256);
    const html = source.toString('utf8');
    const section = (start: string, end: string): string => html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start)));
    const engine = readFileSync(new URL('../../src/render/asterra/engine.js', import.meta.url), 'utf8');
    const body = section('const TILE=16,', 'SPRITES_LEGACY.pedra=') + section('const clamp=(v,a,b)', 'let last={};');
    expect(engine.slice(engine.indexOf('const TILE=16,'), engine.lastIndexOf('\nexport {'))).toBe(body);
    expect(createHash('sha256').update(engine).digest('hex')).toBe(provenance.engineSha256);
  });

  it('executa o gerador original com repetição determinística e footprints multi-célula', () => {
    const settings = createAsterraSettings();
    const first = depositData(settings);
    expect(first.deposits.length).toBeGreaterThan(0);
    expect(first).toEqual(depositData(settings));
    expect(first.deposits.every((deposit) => deposit.tilesW > 1 || deposit.tilesH > 1)).toBe(true);
    expect(settings.paletteMode).toBe('reference');
    expect(settings.pixelStyle).toBe('realistic');
  });
});
