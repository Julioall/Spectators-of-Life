# ASTERRA — Pacote de Rochas e Minérios

**65 sprites distintos em três resoluções (195 PNGs RGBA), mais 5 versões largas (384×192).**

Categorias: **pedra comum**, **cobre**, **ferro**, **prata** e **ouro**.
Cada tipo possui 13 formatos: cascalho, seixo_pequeno, seixo_medio, fragmentos, blocos_duplos, rocha_angular, rochedo_grande, monte_pedras, lajes_agrupadas, picos_medios, picos_altos, monolito, escarpa_grande.
A segunda linha de pedra comum (pedra fissurada) foi removida do material de origem.

## Pastas
- `PNG_192px/`, `PNG_128px/`, `PNG_64px/`: arquivos individuais, fundo transparente, âncora na base central.
- `Spritesheets/atlas_192.png`, `atlas_128.png`, `atlas_64.png`: cinco linhas (material), treze colunas (formato).
- `Extras_384x192/`: lajes agrupadas em tamanho de 2 tiles, evitando reduzir grupos largos.
- `Spritesheets/atlas_lajes_384x192.png`: spritesheet das cinco lajes largas.
- `Documentacao/manifest.json`: catálogo, recortes, arquivos e pivots.
- `Documentacao/atlas_*_phaser.json`: Texture Atlas JSON compatível com carregamento Phaser.
- `Documentacao/validacao.json`: verificação técnica.
- `Documentacao/config_recortes.json`: coordenadas para reproduzir o pacote com PixelPackager.
- `Fonte/rochas_minerios_sem_linha_extra.png`: arte RGBA original sem a duplicação.
- `Previews/visao_geral.jpg`: prévia com fundo opaco; não inserir no jogo como textura.

## Phaser 3
```js
this.load.atlas('minérios', 'Spritesheets/atlas_128.png', 'Documentacao/atlas_128_phaser.json');
// Na cena:
const mineral = this.add.image(x, y, 'minérios', 'cobre_rochedo_grande');
mineral.setOrigin(0.5, 0.953125);
mineral.setDepth(y);
```
Utilize `scene.textures.get('minérios').getFrameNames()` para listar formatos.

## Godot / PixiJS / Canvas
Os PNGs podem ser carregados individualmente ou extraídos do atlas usando `frame.x/y/w/h` no JSON.
Use filtragem nearest (sem suavização), blending com alpha e pivô na base central.
O tamanho visual no mapa é configurado pelo seu jogo: as dimensões do PNG representam **canvas**, não escala obrigatória do mundo.

## Notas
- Os 13 formatos são variações de nós de recursos, não uma animação de mineração.
- Para causar dano/minerar, altere o estado da entidade do jogo e suas colisões; o atlas não inventa fases de dano.
- As raridades no manifest são **sugestões de gameplay**.
- Separações onde pedras se encostam foram mantidas em conjunto para preservar integridade visual.
- A origem contém alguns contornos suavizados; o alpha parcial foi preservado acima do limiar de limpeza 70.
