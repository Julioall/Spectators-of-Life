# Pipeline de assets, tracker e UI

## Assets

Manifesto em data/assets/manifest.json é a fonte de verdade. Domínios: characters, environment, ui, fx, audio e data. Chaves são estáveis e legíveis; caminhos não se espalham pelo gameplay.

Cada asset registra ID, domínio, caminho, status, versão, autor, ferramenta, prompt/seed, licença, dimensões, âncora, dependências, teste visual e data. Status: planned, generated, normalized, reviewed, integrated, approved, blocked ou deprecated.

Pixel art usa paleta limitada, silhueta forte e âncora consistente. Construções grandes são módulos com footprint e pivôs. Tiras inteiras são normalizadas para tamanho, escala e âncora compartilhados. Desenho em código separa paleta, geometria e animação do sistema que desenha.

## Interface

A experiência usa uma única tela de jogo, com o mapa como superfície dominante. Não usar dashboards externos nem painéis laterais permanentes como estrutura principal da observação.

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

O manifesto distingue placeholders e referências de assets integrados. A cena desenha o solo com textura determinística por coordenadas, transições dither entre superfícies vizinhas e autotile da água usando a vizinhança de oito células; relevo e classe de solo continuam vindo da simulação. As cinco espécies do atlas `data/assets/tree/Spritesheets/arvores_atlas_128.png` usam quadros 01–08 por idade e o quadro seco em senescência. O atlas de rochas e minérios é usado na camada Minérios para afloramentos expostos; a disposição decorativa da pedra é determinística e não modifica a geologia. Espécies têm preferências de solo, habitat, água e temperatura; copas maduras sombreiam vizinhos e limitam o recrutamento de mudas. O atlas ambiental em `data/assets/environment/` permanece como referência visual, pois ainda não há um mapa que associe seus recortes às classes e máscaras do renderer. A autoria/licença dos pacotes ainda não foi confirmada.

| ID de planejamento | Fase | Estado | Aceite |
| --- | --- | --- | --- |
| natural.terrain-water | F1 | prototype | Relevo, solo, bacias, lagos e escoamento; camadas e inspeção no jogo |
| natural.plant-lifecycle | F2 | prototype | Gramínea, arbusto e cinco espécies de árvore agregadas; estágios visuais, habitat e competição por luz |
| natural.minerals | F1 | prototype | Veios no estado e atlas de pedra/minérios nos afloramentos expostos; overlay e inspeção de células |
| natural.detritus | F2 | planned | Decomposição visível sem ruído excessivo |
| natural.fauna-lifecycle | F3 | planned | Âncora e proporção estáveis entre estados |
| human.primitive | F5 | deferred | Só planejar em detalhe após gate natural |

Campos de autoria e licença permanecem `null` enquanto não verificados, inclusive nos recursos ambientais adicionados em `data/assets/environment/`. A cena importa os atlas integrados das cinco árvores e de rochas/minérios; os outros recursos ambientais continuam catalogados como referência. O loader futuro deve filtrar por estado e o schema F0 deve separar campos de planejamento de campos de integração.
