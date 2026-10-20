import referenceUrl from '../../data/assets/rocks/asterra/ASTERRA_Gerador_Rochas_v2.3.html?url';
import { drawProceduralRock, rockRasterBounds, type ProceduralRock } from '../../src/render/procedural-rocks';
import { createAsterraSettings } from '../../src/render/asterra/settings';
import { hash, type AsterraDeposit, type AsterraFamily, type AsterraGeology, type AsterraMaterial, type AsterraSettings, type AsterraTier, type AsterraRarity } from '../../src/render/asterra/engine.js';

type Reference = Window & {
  settings: () => AsterraSettings;
  drawOutcrop: (context: CanvasRenderingContext2D, deposit: AsterraDeposit, settings: AsterraSettings) => void;
};
const status = document.querySelector<HTMLPreElement>('#results')!;
const gallery = document.querySelector<HTMLElement>('#gallery')!;

async function verify(): Promise<void> {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.src = referenceUrl;
  const loaded = new Promise<void>((resolve, reject) => {
    iframe.onload = () => resolve();
    iframe.onerror = () => reject(new Error('Não foi possível carregar o HTML original.'));
  });
  document.body.append(iframe);
  await loaded;
  const reference = iframe.contentWindow as Reference;
  const defaults = createAsterraSettings();
  const originalDefaults = reference.settings();
  const defaultsMatch = Object.entries(originalDefaults).every(([key, value]) => defaults[key as keyof AsterraSettings] === value)
    && Object.keys(originalDefaults).length === Object.keys(defaults).length;
  const families: AsterraFamily[] = ['round', 'block', 'wedge', 'plate', 'column', 'shard', 'cluster', 'vein'];
  const tiers: AsterraTier[] = ['normal', 'large', 'macro', 'small', 'macro'];
  const rarities: AsterraRarity[] = ['normal', 'rare', 'epic', 'normal', 'rare'];
  const materials: AsterraMaterial[] = ['pedra', 'cobre', 'ferro', 'prata', 'ouro'];
  const geologies: AsterraGeology[] = ['granite', 'sandstone', 'basalt', 'slate', 'limestone', 'tuff'];
  let count = 0;
  let differentPixels = 0;
  let boundaryPixels = 0;
  const start = performance.now();
  for (const [familyIndex, family] of families.entries()) {
    for (let variant = 0; variant < 5; variant += 1) {
      const tier = tiers[variant]!;
      const rarity = rarities[variant]!;
      const geology = geologies[(familyIndex + variant) % geologies.length]!;
      const material = materials[(familyIndex + variant) % materials.length]!;
      const settings = createAsterraSettings('temperate', material, geology);
      const deposit: AsterraDeposit = {
        id: count + 1, x: 193 + familyIndex * 3, y: 157 + variant * 7,
        family, forma: family, variant, grade: 0.72 + variant * 0.04,
        geology, material, biome: 'temperate', rarity, tier,
        tilesW: 3, tilesH: 3, satellites: 4,
        macro: tier === 'macro', large: tier === 'large', seed: hash(familyIndex, variant, 1947),
      };
      const raster = rockRasterBounds(deposit);
      const rock: ProceduralRock = {
        resourceId: 'stone', source: 'surface', xCell: deposit.x / 16, yCell: deposit.y / 16,
        footprint: { x: 0, y: 0, width: 3, height: 3 }, deposit, settings, visualScale: 1, raster,
      };
      const expected = document.createElement('canvas');
      const actual = document.createElement('canvas');
      expected.width = actual.width = raster.width;
      expected.height = actual.height = raster.height;
      const originalContext = expected.getContext('2d')!;
      originalContext.translate(raster.anchorX - deposit.x, raster.anchorY - deposit.y);
      reference.drawOutcrop(originalContext, deposit, settings);
      const actualContext = actual.getContext('2d')!;
      drawProceduralRock(actualContext, rock);
      const a = originalContext.getImageData(0, 0, raster.width, raster.height).data;
      const b = actualContext.getImageData(0, 0, raster.width, raster.height).data;
      for (let pixel = 0; pixel < a.length; pixel += 4) {
        if (a[pixel] !== b[pixel] || a[pixel + 1] !== b[pixel + 1] || a[pixel + 2] !== b[pixel + 2] || a[pixel + 3] !== b[pixel + 3]) differentPixels += 1;
        const index = pixel / 4;
        const x = index % raster.width;
        const y = Math.floor(index / raster.width);
        if ((x === 0 || y === 0 || x === raster.width - 1 || y === raster.height - 1) && b[pixel + 3] !== 0) boundaryPixels += 1;
      }
      const card = document.createElement('article');
      const label = document.createElement('p');
      label.textContent = `${family} V${variant + 1} · ${tier} · ${material} · ${rarity}`;
      card.append(label, expected, actual);
      gallery.append(card);
      count += 1;
      status.textContent = `Casos: ${count}/40\nPixels diferentes: ${differentPixels}\nPixels na borda: ${boundaryPixels}\nParâmetros padrão iguais: ${defaultsMatch}`;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  }
  status.textContent += `\nResultado: ${defaultsMatch && differentPixels === 0 && boundaryPixels === 0 ? 'APROVADO' : 'FALHOU'}\nDuração: ${Math.round(performance.now() - start)} ms`;
}

verify().catch((error: unknown) => {
  status.textContent = `FALHOU: ${String(error)}`;
});
