# ADR 0017 — Arte natural procedural no runtime

Status: aceita — 20/10/2026

## Contexto

O renderer de árvores carregava `arvores_atlas_128.png`, apesar da arquitetura já separar Flora/Rendering da biologia e do projeto priorizar pixel art procedural. A cena também desenha gramíneas, arbustos, terreno, água e rochas por código. O objetivo é que o mapa não dependa de bitmaps externos no runtime.

## Decisão

- Nenhuma imagem raster arquivada em `data/assets/` é carregada para compor o mundo durante o jogo.
- O renderer de árvores gera uma única textura-atlas em memória, pixel a pixel, com paletas e silhuetas próprias para carvalho, pinheiro, bétula, árvore outonal e salgueiro.
- Os quadros são derivados da espécie e do estágio de crescimento/senescência. Variações por célula derivam de um hash visual do mundo, sem consumir o RNG da simulação.
- Os bitmaps recebidos podem permanecer no repositório como referência, mas ficam marcados como não integrados/deprecated e fora do bundle do jogo.
- A UI DOM/CSS não é considerada arte do mapa; continua usando controles, texto e estilos próprios.

## Consequências

- A licença de um bitmap de árvore não é requisito para desenhar o mapa em runtime.
- A forma, paleta e ocupação dos quadros devem ser verificadas em testes determinísticos e na escala real da câmera.
- O atlas procedural reduz chamadas por árvore, mas ocupa memória como uma textura compartilhada; não se cria uma textura exclusiva para cada planta.
- Alterações visuais continuam descartáveis e não mudam estado ecológico, saves ou aleatoriedade da simulação.
