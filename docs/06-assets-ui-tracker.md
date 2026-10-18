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