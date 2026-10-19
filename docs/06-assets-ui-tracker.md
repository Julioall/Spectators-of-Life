# Pipeline de assets, tracker e UI

## Assets

Manifesto em data/assets/manifest.json é a fonte de verdade. Domínios: characters, environment, ui, fx, audio e data. Chaves são estáveis e legíveis; caminhos não se espalham pelo gameplay.

Cada asset registra ID, domínio, caminho, status, versão, autor, ferramenta, prompt/seed, licença, dimensões, âncora, dependências, teste visual e data. Status: planned, generated, normalized, reviewed, integrated, approved, blocked ou deprecated.

Pixel art usa paleta limitada, silhueta forte e âncora consistente. Construções grandes são módulos com footprint e pivôs. Tiras inteiras são normalizadas para tamanho, escala e âncora compartilhados. Desenho em código separa paleta, geometria e animação do sistema que desenha.

## Interface

O mapa fica no canvas; texto denso fica no DOM/CSS. HUD mínimo mostra tempo, velocidade, estação e clima. Ferramentas são discretas. Seleção abre painel contextual; genealogia, cérebro, relações, economia e replay ficam em painéis profundos.

Desktop prioriza mapa e painel lateral. Janelas estreitas usam gavetas. O centro do mapa permanece livre. Modal suspende input de câmera. Respeitar teclado, foco, contraste, texto escalável, reduced-motion e não depender só de cor.

## Inspeção

Indivíduo mostra necessidades, ação, percepção, recompensa decomposta, memória, relações, linhagem, genoma, cérebro e causa de morte. Evento aponta atores, local, tick, causa e consequências.

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
