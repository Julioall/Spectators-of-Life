import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

describe('interface de observação do mundo', () => {
  it('mantém os elementos DOM requeridos pelo controlador e pelo Worker', () => {
    const runtimeIds = [
      'runtime-status',
      'seed-input',
      'setup-panel',
      'world-details',
      'create-button',
      'new-seed-button',
      'resume-button',
      'pause-button',
      'step-button',
      'speed-select',
      'save-button',
      'load-button',
      'load-input',
      'performance-toggle',
      'performance-panel',
      'performance-fps',
      'performance-phaser-fps',
      'performance-frame',
      'performance-render',
      'performance-layers',
      'performance-water-motion',
      'performance-worker',
      'performance-ticks',
      'performance-cells',
      'performance-memory',
      'performance-memory-total',
      'performance-memory-limit',
      'tick-value',
      'seed-value',
      'version-value',
      'world-date',
      'climate-reading',
      'water-reading',
      'vegetation-reading',
      'minerals-reading',
      'cell-info',
      'error-output',
      'world-canvas',
    ];

    for (const id of runtimeIds) {
      expect(html.match(new RegExp(`\\bid="${id}"`, 'g'))).toHaveLength(1);
    }
  });

  it('apresenta o canvas como superfície principal e os controles como HUD/painéis', () => {
    expect(html.indexOf('<header class="game-hud"')).toBeLessThan(html.indexOf('<main class="world-stage"'));
    expect(html).toContain('<nav class="game-controls"');
    expect(html).toContain('<details id="setup-panel" class="map-panel setup-panel" open>');
    expect(html).toContain('<details id="world-details" class="map-panel world-details">');
    expect(html).toContain('<nav class="map-layer-controls" aria-label="Camadas do mapa">');
    expect(html).toContain('<span>Gerar vale natural</span>');
    expect(html).not.toContain('<aside class="control-panel"');
    expect(html).not.toContain('<footer>');
  });
});
