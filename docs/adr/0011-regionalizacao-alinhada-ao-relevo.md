# ADR 0011 — Classificar terreno por relevo regional

- Status: aceito
- Data: 2026-10-20

## Contexto

No cenário natural, a altitude física já formava cristas, vales e bacias, mas as classes de solo, habitat e superfície visual eram avaliadas célula a célula. Mudanças locais de altitude podiam fragmentar as faixas de terreno mesmo quando faziam parte de uma mesma forma de relevo.

## Decisão

O cenário novo `natural:temperate-valley@1.9.0` deriva um campo de forma regional com um filtro gaussiano 5×5 de borda estendida, combinado com 25% da altitude local. A forma regional orienta a seleção de solo, habitat, umidade potencial, prospectividade mineral e classes visuais do mapa. A altitude armazenada, o declive, a drenagem, a erosão e os afloramentos continuam usando seus valores físicos locais. O campo é determinístico e não é persistido, pois pode ser reconstituído a partir das altitudes.

## Consequências

- Faixas visuais e categorias iniciais de terreno acompanham regiões maiores de vale, encosta e altitude.
- A classificação espacial perde parte do ruído local, mas preserva variações físicas relevantes para água, erosão e rocha exposta.
- A mudança fica isolada na versão 1.9.0; saves anteriores mantêm o estado que já carregam e continuam aceitos.
- O filtro é uma simplificação de regionalização para o mapa de jogo, não uma afirmação de processo geomorfológico validado.
