# Motores procedurais de rochas

## Escopo

O renderer de rochas tem duas camadas com responsabilidades diferentes:

1. **motor de rochas v2.3** rasteriza uma formação individual com a arte, as malhas, os cristais, as fraturas, o musgo, o enterramento e as pedras de apoio do motor original.
2. **Adaptador procedural do mundo** escolhe onde as formações aparecem, agrupa células próximas, associa material, bioma, geologia e superfície e entrega ao motor de rochas um descritor compatível.

Essa separação mantém a autoria e a aparência do motor fornecido, enquanto a distribuição se adapta ao cenário natural do jogo. As rochas são uma projeção visual descartável; não criam colisão nem alteram reservas minerais, água, solo, RNG ou saves.

## Componentes

| Componente | Responsabilidade |
| --- | --- |
| [`src/modules/geosphere/rendering/rocks/legacy-engine.js`](../src/modules/geosphere/rendering/rocks/legacy-engine.js) | Código original extraído literalmente: famílias, paletas, perfis de tamanho, raridade, `footprintAt`, `drawOutcrop`, `rockSprite` e `pixelFinish`. |
| [`src/modules/geosphere/rendering/rocks/legacy-settings.ts`](../src/modules/geosphere/rendering/rocks/legacy-settings.ts) | Conversão de material, bioma, geologia, seed e controles visuais para `RockSettings`. |
| [`src/modules/geosphere/rendering/rocks/procedural-rocks.ts`](../src/modules/geosphere/rendering/rocks/procedural-rocks.ts) | Seleção de afloramentos, componentes conectados, cadência por bioma, grupos, acompanhantes, cascalho, ocupação, margem da água e ambientação. |
| [`src/render/terrain-palette.ts`](../src/render/terrain-palette.ts) | Classificação da superfície visível e escolha da família de paleta correspondente. |
| [`src/render/z-order.ts`](../src/render/z-order.ts) | Profundidade comum baseada na base do objeto no eixo Y. |
| [`src/render/foundation-scene.ts`](../src/render/foundation-scene.ts) | Criação de texturas Canvas, escala nativa de 16 px por célula, sprites, profundidade e descarte ao trocar de mundo. |
| [`scripts/extract-rock-engine.mjs`](../scripts/extract-rock-engine.mjs) | Extração reproduzível do HTML entregue pelo autor. |
| [HTML-fonte original](../data/assets/rocks/asterra/ASTERRA_Gerador_Rochas_v2.3.html) | Fonte arquivada para procedência e comparação visual. |

## Fluxo de geração

`generateProceduralRocks(world, visualSeed)` executa o seguinte fluxo determinístico:

1. Lê apenas depósitos minerais expostos e células de rocha exposta já presentes no estado do mundo.
2. Forma componentes conectados de minério e de superfície para evitar uma pedra isolada representar uma região inteira.
3. Calcula a afinidade regional em blocos de oito células. A variação local é suavizada para formar manchas compactas, semelhantes a serras, afloramentos e regiões rochosas.
4. Calcula vizinhança cardinal, vizinhança diagonal, coesão e posição de transição de cada candidato.
5. Escolhe âncoras com cadência própria do bioma. A quantidade de células por formação varia entre temperado, deserto, alpino, vulcânico e costeiro.
6. Consulta `sizeProfile` e `footprintAt` do motor de rochas. A formação pode ocupar várias células; o Phaser amplia a textura pela relação `40 / 16` sem comprimir a arte para uma tile.
7. Tenta a âncora e posições vizinhas em uma ordem fixa. A formação é rejeitada se sobrepuser outra, tocar água ou exceder o mapa.
8. Adiciona acompanhantes pequenos e médios ao redor de formações `large` e `macro`. A quantidade é limitada para manter um grupo legível.
9. Faz uma passagem de pedras pequenas em células secas e uma passagem de cascalho. Rios, escoamento, sedimento, incisão e erosão aumentam a afinidade de cascalho.
10. Ordena o resultado por posição para que a mesma seed visual produza a mesma lista e a mesma ordem de sprites.

Os perfis de raridade, tamanho e família continuam sendo os do motor de rochas. A escala reduzida usada nas bordas de uma mancha altera somente o sprite projetado; a pegada original continua sendo usada para ocupação, bloqueio e testes de água.

## Biomas, paleta e materiais

`terrain-palette.ts` classifica a superfície que o jogador vê e encaminha a formação para a família correspondente:

- `grass`: pradaria e superfícies verdes;
- `dry`: terra seca e deserto;
- `mountain`: rocha e relevo elevado;
- `volcanic`: basalto e superfícies vulcânicas;
- `coast`: areia, costa e transições próximas da água.

Quando o terreno é cinza, somente a base geológica da pedra se aproxima do cinza ambiente. Veios e cristais de cobre, ferro, prata e ouro mantêm suas cores características. Os pixels de musgo também são protegidos da ambientação da base.

O musgo usa o parâmetro original do motor de rochas com multiplicadores por habitat:

| Habitat | Multiplicador |
| --- | ---: |
| Floresta | 2,25× |
| Pântano/área úmida | 1,65× |
| Pradaria | 1,20× |
| Outros | 1,00× |

Famílias pontiagudas (`shard` e `column`) ficam restritas a biomas e habitats secos. Isso reserva silhuetas agressivas para desertos, terras secas e regiões vulcânicas.

## Grupos, progressão e cascalho

Uma formação grande não é usada como único elemento da região. O adaptador combina:

- núcleo com formações normais, grandes ou macro;
- bordas com formações pequenas ou a mesma arte em escala reduzida;
- acompanhantes pequenos e médios próximos ao núcleo;
- pedregulhos do tamanho de um animal pequeno em células secas;
- cascalho mais frequente em caminhos de drenagem e áreas erodidas.

As reservas de ocupação impedem que acompanhantes se sobreponham. A distância entre âncoras é menor dentro da mesma mancha e maior entre manchas distintas. A função `treeBlockingCellsForRocks` marca as pegadas `large` e `macro` para que árvores não sejam desenhadas por cima delas.

## Água e ordem de desenho

Uma formação cuja pegada ou corpo visual toca rio ou lago tenta posições vizinhas determinísticas antes de ser descartada. Assim a rocha fica na margem e o leito continua visível; o renderer da água não precisa abrir espaço depois.

Rochas e árvores usam a mesma função de profundidade. A base mais baixa no eixo Y aparece na frente; em empate, a rocha recebe uma pequena prioridade. O bloqueio visual é reforçado pelo estado natural: células com rocha exposta não estabelecem árvores, embora solo rochoso sem afloramento continue sujeito às preferências de cada espécie.

## Determinismo e procedência

O adaptador usa `hash` e `rng` com coordenadas, seed visual e sais estáveis. Seeds de variação visual não entram na simulação e não modificam o estado persistente. Trocar de mundo destrói as texturas e os sprites procedurais, permitindo reconstruir a projeção sem carregar dados de rocha no save.

O HTML original é preservado em [`data/assets/rocks/asterra/`](../data/assets/rocks/asterra/). [`provenance.json`](../src/modules/geosphere/rendering/rocks/provenance.json) registra os hashes SHA-256 da fonte e do módulo extraído. O script de extração não inclui os controles da demonstração nem os bitmaps legados usados apenas na comparação.

## Validação

- [`tests/render/rock-engine-source.test.ts`](../tests/render/rock-engine-source.test.ts) confere procedência, hash e presença das funções originais.
- [`tests/render/procedural-rocks.test.ts`](../tests/render/procedural-rocks.test.ts) confere determinismo, materiais, grupos, escalas, pegadas, pedras pequenas e exclusão da água.
- [`tests/render/z-order.test.ts`](../tests/render/z-order.test.ts) confere a ordem comum entre rochas e árvores.
- [`tests/render/rocks-engine-visual.html`](../tests/render/rocks-engine-visual.html) e [`rocks-engine-visual.ts`](../tests/render/rocks-engine-visual.ts) comparam a saída RGBA do adaptador com o HTML original.
- [`docs/adr/0008-amontoados-procedurais-de-rocha.md`](adr/0008-amontoados-procedurais-de-rocha.md) registra a decisão e a evidência de paridade.

Para reproduzir a extração e a validação automatizada:

```powershell
node scripts/extract-rock-engine.mjs
npm test -- --run tests/render/rock-engine-source.test.ts tests/render/procedural-rocks.test.ts tests/render/z-order.test.ts
```

O motor rasteriza uma textura por formação, portanto a construção inicial pode ser mais cara que a renderização contínua. O painel opcional **Desempenho** registra esse custo em `Camadas (último)` e separa o tempo do render Phaser do tempo do Worker.
