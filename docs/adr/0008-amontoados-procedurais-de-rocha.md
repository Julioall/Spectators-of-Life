# ADR 0008 — Amontoados procedurais de rocha

- Status: aceito
- Data: 2026-10-19

## Contexto

A primeira integração reimplementou de forma simplificada o desenho das rochas e foi rejeitada visualmente. O autor solicitou usar exatamente o código do gerador original v2.3. O runtime do jogo precisa continuar determinístico e separado do estado de simulação.

## Decisão

- Arquivar o HTML fornecido integralmente e extrair suas seções de motor literalmente, por script reproduzível. Conferir os hashes SHA-256 e a igualdade das seções nos testes.
- Usar `drawOutcrop`, `rockSprite`, `pixelFinish`, paletas, malhas, perfis de tamanho e pegadas originais, sem redesenhar suas funções. A extração exclui a inicialização da interface de demonstração e o comparador de PNGs legados.
- Extrair os controles padrão do HTML respeitando a normalização que o navegador aplica aos sliders. Preservar paleta `reference`, acabamento `realistic` e pixel `normal`.
- Manter a relação nativa de 16 pixels por célula. O Phaser amplia a textura pelo fator `CELL_SIZE / 16` e usa a âncora calculada no raster original. Não redimensionar a arte para caber em uma única célula.
- Usar um adaptador TypeScript para relacionar os afloramentos expostos do mundo aos materiais, biomas e geologias do motor. Reservar as pegadas do motor entre formações. O mapa fixo de demonstração não substitui a geração física do cenário.
- Compartilhar a classificação e as cores-base de superfície entre o renderer do terreno e o adaptador em `src/render/terrain-palette.ts`. A família de paleta (`grass`, `dry`, `mountain`, `volcanic`, `coast`) é escolhida a partir da superfície já visível no mapa, sem editar as paletas do gerador original.
- Formar manchas conectadas a partir das células expostas, selecionar âncoras com suporte de vizinhança e espaçamento determinístico, e limitar tiers grandes/macros quando a formação não tem continuidade local. Isso aproxima um autotile de rochas sem criar regras físicas novas.
- Usar uma progressão visual por posição na mancha: o núcleo recebe perfis normais/grandes quando há suporte, e as bordas recebem o tier pequeno ou a mesma arte original em escala reduzida. A escala afeta apenas o sprite projetado; a pegada lógica continua sendo calculada por `footprintAt`.
- Restringir famílias pontiagudas (`shard` e `column`) a biomas e habitats secos. Criar uma segunda passagem de pedregulhos em células sem água, com perfil `small` e escala visual de 0,42–0,60, para que pedras do tamanho de um coelho apareçam entre as formações maiores.
- Quando uma formação central é grande ou macro, selecionar até três acompanhantes pequenos/médios (até cinco no macro) em células rochosas próximas. A reserva de ocupação continua impedindo sobreposição.
- Reduzir o afastamento usado na escolha dos âncoras e ponderar a afinidade de cascalho por vizinhança de rios, escoamento, sedimento, incisão e erosão mineral/orgânica. Assim os grupos ficam compactos e trilhas de drenagem e áreas erodidas recebem mais pedras pequenas sem criar cascalho dentro da água.
- Aplicar à seleção de afloramentos e pedregulhos um campo regional determinístico suavizado em blocos de oito células, com variação local menor. Células expostas isoladas e terreno sem suporte rochoso ficam fora da região salvo quando a drenagem ou a erosão justificam cascalho. Isso concentra a projeção em manchas contínuas, como serras e afloramentos, em vez de espalhar pedras pelo mapa inteiro.
- Ordenar árvores e rochas pelo ponto de contato com o solo em uma escala de profundidade comum. A base mais baixa no mapa aparece à frente; em empate, a rocha fica na frente. As pegadas lógicas de formações `large` e `macro` bloqueiam a projeção de árvores e cobertura dentro delas. Além disso, células de rocha exposta não estabelecem árvores na simulação; solo rochoso sem afloramento continua usando tolerâncias por espécie.
- Rejeitar formações cuja pegada ou corpo visual encoste em lago ou rio e tentar âncoras vizinhas determinísticas antes de descartar a formação. As pedras permanecem nas margens e não cobrem o leito; o traçado de água já existente fica visível ao redor delas.
- Aplicar, no adaptador e depois de `drawOutcrop`, uma ambientação seletiva para as famílias `mountain` e `volcanic`: a base geológica conserva a luminância e se aproxima do cinza do terreno, enquanto as cores dos veios de cobre, ferro, prata e ouro e os pixels verdes de musgo ficam intactos. O código original continua byte a byte sem alterações.
- Multiplicar o parâmetro original de musgo por habitat no adaptador: floresta recebe 2,25×, áreas úmidas 1,65× e pradaria 1,20×, com limite em 1, para formar uma progressão mais contínua de rocha exposta para floresta. O multiplicador não altera o estado natural.
- Preservar os perfis visuais normal/raro/épico do motor. Eles não mudam reservas, teor, RNG ou estado persistente da simulação.
- Comparar a renderização com funções executadas diretamente no HTML original em uma matriz de famílias, variações, tamanhos, materiais e raridades.

## Consequências

- Rochas e veios usam o desenho original do autor e seus amontoados multi-célula. A pegada é visual, sem colisão na simulação; pedras de apoio podem ultrapassar o retângulo original.
- A camada permanece uma projeção descartável e pode ser reconstruída com a mesma seed visual.
- O motor rasteriza sprites detalhados uma vez por formação. As texturas são descartadas ao trocar de mundo; esse trabalho aumenta o custo inicial de apresentação.
- O autor autorizou a integração nesta tarefa. O HTML arquivado inclui os bitmaps de comparação originais; esses bitmaps não são extraídos nem carregados pelo jogo.
- Mudanças no algoritmo visual não exigem versão nova de save, porque os footprints e texturas não são dados persistidos.
- A ambientação depende da superfície já classificada pelo terreno e é recalculada a cada projeção; ela não cria uma paleta nova no motor nem persiste cores ou musgo.

## Evidência

A [comparação de 19/10/2026](../evidence/asterra-v23-render-parity-2026-10-19.json) verificou 40 casos contra as funções executadas diretamente no HTML original: zero pixels RGBA diferentes, zero pixels opacos nas bordas do envelope e parâmetros padrão iguais. A matriz cobre as oito famílias com suas cinco variações, incluindo os quatro tamanhos e três raridades. A distribuição no mundo permanece responsabilidade do adaptador aos afloramentos existentes.
