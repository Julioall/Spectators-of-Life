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

O manifesto atual contém exemplos planejados com caminhos ainda inexistentes; não deve ser tratado como catálogo carregável. Estado planned não autoriza anunciar asset integrado. O tracker inicial abaixo registra a prioridade, sem atribuir autoria/licença a assets ainda não produzidos.

| ID de planejamento | Fase | Estado | Aceite |
| --- | --- | --- | --- |
| natural.terrain-water | F1 | planned | Solo, relevo e água legíveis em zoom de jogo |
| natural.plant-lifecycle | F2 | planned | Estágios, variações e morte distinguíveis |
| natural.detritus | F2 | planned | Decomposição visível sem ruído excessivo |
| natural.fauna-lifecycle | F3 | planned | Âncora e proporção estáveis entre estados |
| human.primitive | F5 | deferred | Só planejar em detalhe após gate natural |

Campos de autoria e licença permanecem `null` enquanto não verificados. Caminhos `planned` são intenções, não arquivos carregáveis; o loader futuro filtra por estado. O schema F0 deve separar campos mínimos de planejamento dos campos obrigatórios de integração, e fixtures devem cobrir ambos.
