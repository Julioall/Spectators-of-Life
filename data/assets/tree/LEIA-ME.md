# Asterra — Pacote de árvores (PNG transparente)

Conjunto de **60 sprites** de árvores e restos de madeira, extraídos e normalizados de arte original gerada para este pedido.

- 5 espécies: carvalho, pinheiro, bétula, árvore outonal e salgueiro.
- Em cada espécie: 8 estágios de crescimento, árvore seca, toco (cortada), tronco e árvore caída.
- 60 PNGs individuais em `PNG_192px` (192×192, RGBA transparente).
- Os mesmos 60 PNGs em `PNG_128px` (128×128, RGBA transparente).
- Spritesheets organizados por espécie em `Spritesheets/arvores_atlas_192.png` e `arvores_atlas_128.png`, **com transparência**. Colunas: 1–8 = crescimento; 9 = seca; 10 = toco; 11 = tronco; 12 = caída.
- Visualização de todo o pacote: `Previews/visao_geral.jpg` (somente esta prévia utiliza fundo bege para visualização).
- Posições das âncoras e metadados em `Documentacao/manifest.json`.

## Usando no jogo

1. Para crescimento, renderize `crescimento_01` até `crescimento_08`, avançando de fase quando a árvore amadurecer.
2. Para seca/morte, substitua por `seca`; para corte, `toco`. `tronco` e `caida` podem aparecer durante coleta de madeira.
3. Use pivot inferior central em `(96,184)` nos PNGs de 192×192 e `(64,123)` nos de 128×128.
4. Para um tilemap, configure o retângulo da célula em 192×192 ou 128×128 e preserve alpha. As árvores podem ficar numa camada de objetos acima do solo, com o tronco na posição do tile.

### Notas de qualidade

Estes PNGs derivam de uma composição gerada em pixel art. Foram removidos pixels semitransparentes residuais e o canal alpha foi normalizado. A transição de crescimento é feita por troca discreta de sprite, não por uma animação desenhada quadro a quadro. Há pequenas variações de geometria entre as fases, próprias de uma coleção de arte gerada, e algumas sobreposições de copas da composição original foram separadas manualmente.
