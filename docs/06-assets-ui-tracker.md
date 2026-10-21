# Pipeline de assets, tracker e UI

## Assets

Manifesto em data/assets/manifest.json é a fonte de verdade. Domínios: characters, environment, ui, fx, audio e data. Chaves são estáveis e legíveis; caminhos não se espalham pelo gameplay.

Cada asset registra ID, domínio, caminho, status, versão, autor, ferramenta, prompt/seed, licença, dimensões, âncora, dependências, teste visual e data. Status: planned, generated, normalized, reviewed, integrated, approved, blocked ou deprecated.

Pixel art usa paleta limitada, silhueta forte e âncora consistente. Construções grandes são módulos com footprint e pivôs. Tiras inteiras são normalizadas para tamanho, escala e âncora compartilhados. Desenho em código separa paleta, geometria e animação do sistema que desenha.

## Interface

A experiência usa uma única tela de jogo, com o mapa como superfície dominante. Não usar dashboards externos nem painéis laterais permanentes como estrutura principal da observação.

O botão **Desempenho** abre uma sobreposição opcional e desligada por padrão. Ela separa o FPS do `requestAnimationFrame` do FPS real do Phaser, mede tempo de frame, renderização Phaser, atualização das camadas dinâmicas, movimento da água, tempo de ida e volta dos lotes enviados ao Worker e ticks por lote. FPS e frame usam médias móveis; os demais tempos mostram a última operação medida. Também mostra células projetadas e heap JS usado/total/limite quando o navegador oferece essa API. Esses valores são telemetria da apresentação: não entram no estado da simulação, nos saves, no RNG nem nos eventos. O painel pode ser fechado a qualquer momento e reinicia a janela de amostras quando é reaberto.

O mapa é desenhado no canvas; HUD, menus e textos densos usam DOM/CSS acessível. O HUD persistente é compacto e mostra tempo, velocidade e, quando disponíveis na fase ativa, estação e clima. Controles globais ficam em uma barra discreta ou em menus flutuantes dentro da tela do jogo.

Selecionar uma célula ou entidade abre uma ficha contextual sobre o jogo, próxima à seleção ou em uma área de canto. A ficha pode ser expandida para detalhes e fechada sem sair da tela principal. Ela apresenta apenas dados que a entidade e os módulos ativos realmente fornecem. Nas fases naturais atuais, a inspeção cobre terreno, água, solo, habitat, plantas e, quando habilitada, fauna. Informações de aldeias, cidades, reinos, profissões ou política só aparecem quando esses sistemas forem implementados e o objeto correspondente for selecionado.

As sobreposições devem preservar a leitura do mapa e evitar cobrir o alvo ou o centro da área visível. Em telas estreitas, a ficha contextual pode virar uma gaveta inferior, mantendo o mapa visível. Pausar, fechar com Escape, foco, contraste, ampliação de texto e redução de movimento devem funcionar corretamente. A entrada de seleção, câmera e controles é coordenada para que clicar em um controle não mova o mapa nem selecione uma entidade por engano.
## Inspeção

A ficha contextual do indivíduo pode expandir ou abrir seções para necessidades, ação, percepção, recompensa decomposta, memória, relações, linhagem, genoma, cérebro e causa de morte, conforme a fase e os dados existentes. Evento aponta atores, local, tick, causa e consequências.

## Tracker

Status, responsável, dependências, licença e critério de aceite devem aparecer na tabela de produção. O tracker humano não substitui o manifesto nem a validação automática.

## Prioridade visual e de interface

F1–F2: relevo, margens, água, solo, rochas, plantas em diferentes estágios e detritos.
F3–F4: animais juvenis/adultos, deslocamento, alimentação, repouso, reprodução e morte; inspeção de saúde, necessidades e linhagem.
F5–F6: humanos, recursos coletados, abrigos e acampamentos simples.
F7–F9: cultivo, edifícios, ferramentas profissionais, cidades e instituições.

Pixel art desenhado em código é a base escolhida. Grade de 64 pixels é referência de detalhe, não limite de tamanho nem unidade biológica. Objetos maiores usam múltiplas células/partes; registrar footprint, pivô, ocupação e área visual separadamente. Seeds de variação visual não alteram ecologia.

Painéis de profissões, economia ou política só aparecem quando seus módulos existem. Antes disso, priorizar água, solo, habitat, vegetação, ciclos de vida, fluxos e teias alimentares.

O manifesto distingue placeholders e referências de assets integrados. A cena desenha a paleta do solo com o pincel ponderado 5×5 e interpolação por pixel, mantendo textura determinística por coordenadas; a água usa autotile pela vizinhança de oito células. Relevo e classe de solo continuam vindo da simulação, e o filtro RGB só altera a projeção visual. Altitude e Relevo começam ativos e podem ser desligados no HUD. As cinco espécies de árvores usam o motor interno para gerar quadros de espécie, crescimento e variação em runtime. Gramíneas e arbustos projetam coortes existentes usando os motores internos de cobertura e plantas; rochas também são projeções procedurais. Espécies mantêm preferências de solo, habitat, água e temperatura; copas maduras sombreiam vizinhos e limitam o recrutamento de mudas. Bitmaps recebidos ficam arquivados para referência e não são carregados pelo jogo.

As camadas Altitude e Relevo compartilham uma rampa de elevação suavizada com pincel ponderado 5×5 e interpolação por pixel; as curvas de nível preservam a elevação original. Rios e lagos sobrepõem uma textura linear de profundidade e iluminação calculada só dentro da máscara molhada, com feather discreto nas margens. Essa suavização é visual e não move margens nem modifica estoques de água.

Rochas e minérios usam o código original do gerador v2.3 em `src/modules/geosphere/rendering/rocks/legacy-engine.js`, extraído literalmente do HTML fornecido pelo autor. O [adaptador](../src/modules/geosphere/rendering/rocks/procedural-rocks.ts) liga afloramentos expostos aos materiais e biomas do motor e delega todos os pixels a `drawOutcrop`, `rockSprite` e `pixelFinish`, preservando paletas, malhas, musgo, fraturas, cristais, enterramento e pedras de apoio. A escolha da família de paleta usa a mesma superfície do terreno em `src/render/terrain-palette.ts`; basalto mantém a família vulcânica. Em terreno cinza, a etapa visual do adaptador aproxima apenas a base da pedra do cinza ambiente e mantém intactas as cores dos veios; em floresta, o parâmetro original de musgo recebe um multiplicador maior. Famílias pontiagudas são usadas em biomas e habitats secos. A geração também cria pedregulhos pequenos em células sem água e acompanhantes pequenos/médios ao redor de formações grandes. Os grupos são compactados e a afinidade de cascalho usa vizinhança de rios, escoamento, sedimento, incisão e erosão. Um campo regional suavizado em blocos de oito células filtra pedras fora das manchas e preserva a exceção de drenagem/erosão. A distribuição passa por manchas conectadas de células expostas, com distância entre âncoras e limite de tamanho para impedir uma formação macro isolada. Se a pegada ou o corpo visual tocar rio ou lago, a âncora tenta posições vizinhas secas para manter o leito livre. A progressão visual agora combina tier normal, pequeno e escala reduzida nas bordas das manchas, enquanto o núcleo pode usar formações maiores. Árvores e rochas usam uma profundidade comum baseada na base no eixo Y, e as pegadas `large`/`macro` bloqueiam árvores na projeção; a simulação também não estabelece árvores em células de rocha exposta. Os controles padrão vêm do próprio HTML. As pegadas e dimensões originais atravessam várias células; o Phaser mantém a proporção de 16 pixels nativos por célula e não comprime a rocha em uma tile. Perfis normal/raro/épico continuam exclusivamente visuais. O atlas antigo não é carregado. A cópia integral, hashes, extração reproduzível e comparação RGBA estão descritos no [README do motor](../src/modules/geosphere/rendering/rocks/README.md) e na [ADR 0008](adr/0008-amontoados-procedurais-de-rocha.md).

O atlas ambiental em `data/assets/environment/` permanece como referência visual, pois ainda não há um mapa que associe seus recortes às classes e máscaras do renderer. A autoria/licença dos pacotes de árvores ainda não foi confirmada. A integração do código motor de rochas foi solicitada e autorizada pelo autor nesta tarefa; os bitmaps de comparação ficam somente no HTML arquivado, fora do runtime do jogo.

| ID de planejamento | Fase | Estado | Aceite |
| --- | --- | --- | --- |
| natural.terrain-water | F1 | prototype | Relevo, solo, bacias, lagos e escoamento; camadas e inspeção no jogo |
| natural.plant-lifecycle | F2 | prototype | Gramínea, arbusto e cinco espécies de árvore agregadas; estágios visuais, habitat e competição por luz |
| natural.minerals | F1 | prototype | Veios no estado; rochas e afloramentos procedurais no overlay, sem alterar o estado físico; inspeção de células |
| natural.detritus | F2 | planned | Decomposição visível sem ruído excessivo |
| natural.fauna-lifecycle | F3 | planned | Âncora e proporção estáveis entre estados |
| human.primitive | F5 | deferred | Só planejar em detalhe após gate natural |

Campos de autoria e licença permanecem `null` enquanto não verificados, inclusive nos recursos ambientais adicionados em `data/assets/environment/`. A entrada do motor motor de rochas registra a autoria declarada e a autorização de integração. O runtime não carrega bitmaps para desenhar o mundo: árvores, gramíneas, arbustos, terreno, água e rochas são gerados por código. Os atlas de árvores e minerais e os demais recursos ambientais continuam catalogados somente como referência/deprecated. O loader futuro deve filtrar por estado e o schema F0 deve separar campos de planejamento de campos de integração.
