# ADR 0009 — Leitos persistentes e saídas abertas na hidrologia natural

- Status: aceito
- Data: 2026-10-19

## Contexto

O cenário natural usava uma borda fechada. A chuva entrava no mapa e a evaporação, a transpiração e a infiltração removiam água, mas nenhum rio ou lago descarregava quando alcançava a margem. Em ensaios longos isso permitia o acúmulo de água superficial e fazia a rede parecer um conjunto de terrenos azuis, sem distinção visual entre canal ativo e leito seco. A camada Relevo também era desenhada e apagada na mesma atualização em que a vegetação era redesenhada.

## Decisão

O cenário novo `natural:temperate-valley@1.7.0` usa borda aberta. Uma célula de rio ou lago na margem, sem vizinho de jusante, é uma saída de bacia. A cada passo hidrológico, a célula descarrega uma fração determinística da água superficial restante: 82% para rio e 36% para lago. A perda é registrada no fluxo da célula (`boundaryOutflowMm`), no total natural, na métrica `hydrology.boundaryOutflowMmM2` e no evento de hidrologia. Saves `1.6.0` e anteriores continuam com a borda fechada e são validados pelo contrato legado.

O renderer mantém a identidade do leito de rio mesmo quando a lâmina fica abaixo do limiar de água. O canal seco recebe uma faixa de leito com largura derivada de incisão e declive; a água corrente só é desenhada acima do limiar. Uma camada Phaser separada acrescenta reflexos curtos e lentos em rios ativos e pequenos brilhos nos lagos. Essa animação é visual, não altera o estado nem consome o RNG da simulação.

O relevo é uma projeção do campo físico e usa sua própria camada gráfica. A vegetação não limpa essa camada; alternar Relevo agora deixa visíveis as faixas hipsométricas e curvas de nível enquanto as outras camadas são atualizadas.

## Consequências

- O balanço hídrico anual pode perder água pela fronteira de forma observável e reproduzível.
- Rios podem secar visualmente sem desaparecer do mapa, preservando o leito para a recuperação em períodos úmidos.
- O mapa diferencia leito, água corrente e brilho superficial sem transformar animação em regra do mundo.
- A mudança de cenário exige migração/versionamento para novas criações; saves antigos continuam legíveis com suas regras de borda.
- Ainda não há solver de nível de lago, aquífero, transporte subdiário, cheias regionais ou migração física de um canal para outro; a incisão existente continua sendo a regra agregada para afinar e criar canais.
