# ADR 0007 — Tela única e inspeção contextual

- Status: aceito
- Data: 2026-10-19

## Contexto

Spectators-of-Life é um jogo observacional cujo mapa é a principal forma de acompanhar o mundo. Uma estrutura baseada em painéis laterais permanentes ou dashboards separados reduz a área do mapa e distancia a interação dos organismos, habitats e regiões observados. A interface também precisa crescer com o roadmap sem apresentar antecipadamente sistemas ainda inexistentes.

## Decisão

A experiência principal será organizada em uma única tela de jogo, com o mapa como superfície dominante, HUD persistente compacto e menus integrados ou flutuantes dentro da própria tela.

Selecionar uma célula, organismo ou região abrirá uma ficha contextual expansível e fechável. A ficha exibirá apenas informações fornecidas pelo objeto e pelos módulos ativos. Dados detalhados, como necessidades, ação, memória, linhagem e cérebro, ficarão nessa camada contextual, e não em painéis sempre visíveis.

Nas fases naturais, a interface apresentará terreno, clima, água, solo, habitat, plantas e fauna somente quando seus sistemas estiverem habilitados. Dados de aldeias, cidades, reinos, profissões e política serão exibidos apenas depois da implementação das fases correspondentes e mediante seleção do objeto. Em telas estreitas, a ficha poderá adaptar-se como gaveta inferior sem ocultar todo o mapa.

## Consequências

- O mapa mantém a maior área útil e permanece acessível durante a observação.
- A seleção liga a inspeção diretamente ao elemento observado.
- Menus e detalhes respeitam a fase ativa e não anunciam funcionalidades futuras como existentes.
- Canvas continua responsável pelo mundo; DOM/CSS continua responsável por texto, menus e acessibilidade.
- Câmera, seleção, foco de teclado e controles precisam de coordenação para evitar cliques ambíguos.
- Esta decisão altera a apresentação, não acrescenta comandos de jogo nem muda a ordem do roadmap natural-primeiro.
