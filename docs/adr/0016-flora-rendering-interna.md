# Motores de apresentação integrados à Flora

## Decisão

Motores de folhas, árvores, vegetação e vento são módulos internos do jogo, organizados pelo domínio. Não serão pacotes externos nem dependências npm próprias. A Flora continua responsável pela biologia; seus renderizadores apenas projetam coortes e snapshots.

## Organização

- `src/modules/atmosphere/wind/`: campo visual compartilhado.
- `src/modules/biosphere/flora/rendering/leaves/`: geometria e aparência foliar.
- `src/modules/biosphere/flora/rendering/trees/`: quadros e formas de árvores.
- `src/modules/biosphere/flora/rendering/vegetation/`: presets de plantas, geometria G4 e suporte autônomo a cobertura/autotile.
- `src/modules/geosphere/rendering/rocks/`: geração e composição de rochas.

Os imports entre esses módulos são relativos. `package.json` não registra workspaces nem dependências para esses motores.

## Regras

1. O Worker é a fonte da verdade; renderização não avança tick nem grava biomassa.
2. Plantas desenhadas vêm das coortes do mundo; a projeção da partida usa touceiras procedurais para grama, e não a máscara autotile. Cobertura e autotile não criam população.
3. Renderizadores podem usar Phaser e Canvas, mas a simulação pode ser testada sem navegador.
4. O vento afeta apenas a apresentação enquanto não existir regra física de interação com a vegetação.
5. Sistemas animais futuros consultam os contratos naturais e não importam classes gráficas da Flora.

## Estado

Árvores, folhas, gramíneas e arbustos usam projeções procedurais ligadas a coortes; o vento compartilhado anima gramíneas, arbustos e copas. O autotile continua disponível para os ensaios do motor, mas não é usado na camada de jogo. As árvores usam `g244` com folhas G8 para corresponder ao laboratório; quadros são produzidos em fila e armazenados em atlas, embora cada render individual continue síncrono e possa exceder o orçamento por quadro. O detalhamento está em [14 — Motores naturais internos](../14-motores-naturais-e-flora.md).
