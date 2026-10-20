# ADR 0013 — Iluminação topográfica procedural no renderer

**Status:** Aceita para a projeção visual do cenário natural.

**Data:** 20/10/2026

## Contexto

A visualização do relevo usava um sombreado fixo para noroeste aplicado tanto à textura-base quanto à camada Relevo. Isso não permitia testar outras direções de luz e misturava a iluminação com a sobreposição hipsométrica. A iluminação precisa permanecer independente do estado ecológico, da câmera e do Worker.

## Decisão

- Implementar `src/render/terrain-lighting.ts` como módulo puro do renderer. Ele recebe altitudes já presentes no snapshot e calcula gradientes centrais, hillshade direcional e oclusão aproximada em até quatro posições na direção da luz.
- Usar ângulo solar configurável (0° norte, 90° leste, 180° sul, 270° oeste), força de relevo entre 0 e 8 e o fator `clamp(1.02 + intensity - occlusion, 0.62, 1.38)`. Aplicar o fator em cada canal RGB da textura do solo e preservar alfa.
- Suavizar o campo com um pincel ponderado 5×5 e interpolar entre células na escala de pixel para evitar blocos de iluminação abruptos.
- Iniciar com iluminação ativada, 315° e força 3. O painel visual controla ativação, ângulo (15° por passo) e força (0,5 por passo).
- Manter configurações na apresentação do cliente: não persistir em save, não enviar ao Worker e não alterar valores do mundo.
- Recalcular ao criar ou carregar mundo, mudar controles ou detectar variação de altitude de pelo menos 0,25 m. Não recalcular por frame. A camada Relevo mantém suas faixas e curvas de nível, sem duplicar hillshade fixo.
- Oferecer a vista diagnóstica Altitude: uma rampa hipsométrica contínua lê a altitude bruta e preserva as curvas de nível. A rampa usa 48% de opacidade para manter visíveis por baixo a textura iluminada, água, vegetação e minérios; ela não substitui as camadas naturais.
- Renderizar Altitude e Relevo com o mesmo pincel ponderado 5×5 e interpolação por pixel usada pela iluminação. Rios e lagos recebem campo de profundidade suavizado somente entre células molhadas, cor e luz bilinearmente amostradas numa textura auxiliar e um feather discreto nas margens; as geometrias lógicas não mudam.
- Aplicar esse pincel ponderado também aos canais RGB da paleta base do terreno e ampliá-la por interpolação por pixel. Remover a faixa dither entre classes, preservando textura local determinística e classes físicas; o filtro não altera relevo, solo ou bioma.
- Iniciar a apresentação com Altitude e Relevo ativos, com a legenda hipsométrica visível; ambos continuam sendo alternáveis no HUD.
- Em mudanças locais de altitude, repintar a área afetada mais sete células ao redor para cobrir vizinhos do gradiente, raio de oclusão, suavização e interpolação. Se a região suja exceder 60% do mapa, fazer atualização completa.
- Preservar câmera vertical top-down; não adicionar paredes, perspectiva, geometria, novos sprites ou dependências.

## Consequências e limites

A luz torna encostas orientadas e faces opostas mais legíveis sem modificar a altitude. A mistura RGB ponderada suaviza a passagem entre paletas de superfície, enquanto grãos determinísticos mantêm a textura do solo. A aproximação de oclusão é determinística e barata, mas não substitui um horizonte físico nem sombras de longa distância. O pincel de água não cria cobertura fora da máscara de células molhadas; a textura auxiliar e a filtragem linear são descartáveis e não afetam a hidrologia. Os parâmetros são de apresentação e não têm calibração física; o detalhe topográfico continua limitado pela resolução do campo de altitude. Testes determinísticos cobrem gradientes, direções, oclusão, limites, suavização de paleta e elevação, interpolação de campos, máscara de água, multiplicação RGB e desativação; a rampa hipsométrica cobre interpolação, limites e opacidade translúcida.
