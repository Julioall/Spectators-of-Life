# ADR 0012 — Alargamento e confluência fluvial

- Status: aceito para a implementação inicial
- Data: 2026-10-20

## Contexto

Os rios gerados eram canais de uma célula e o renderer estimava sua largura pela lâmina superficial local, que quase não varia ao longo do curso. A seleção do ponto de saída de um lago também dependia de `flowTo` no relevo do fundo, que pode apontar para o interior do lago mesmo quando existe um canal de saída adjacente.

## Decisão

Na versão `natural:temperate-valley@1.10.0`, a geração amplia o leito para células vizinhas que já drenam para o canal quando a área contribuinte e o encontro de cursos justificam o alargamento. A simulação aplica um limite de incisão maior às margens adjacentes a rios; elas só se tornam células fluviais após também passarem os limiares existentes de incisão acumulada e área contribuinte.

O renderer calcula a área contribuinte pela drenagem persistida, aumenta a largura progressivamente a jusante e conecta o traçado a lagos por adjacência física. Uma piscina elíptica pequena nas confluências é uma projeção visual para suavizar o encontro de cursos; ela não cria um lago nem altera o estado hidráulico.

## Consequências

- Os novos mapas exibem canais mais largos onde recebem mais drenagem; células ampliadas deixam de receber árvores conforme o contrato de `waterBody`.
- As margens podem erodir mais depressa junto a um canal, mas o tempo de formação continua dependente de precipitação, escoamento, substrato e área contribuinte.
- Saves de cenários `1.0.0` a `1.9.0` continuam válidos e não são reclassificados. O comportamento de projeção é calculado a partir do estado, sem novos campos persistidos.
- O modelo continua em revisão: largura por células de 250 m é grosseira, a piscina de confluência é apenas visual e os limiares ainda não foram calibrados hidrologicamente.
