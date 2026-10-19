# SPEC-001 — Relógio lógico e comparação de métricas

**Fases:** F0–F4  
**Estado:** contratos comuns implementados para F0; produtores biológicos e parâmetros de F1–F4 aguardam as respectivas specs
**Motivação:** separar velocidade visual, tempo ecológico e cadência de decisão para que benchmarks de alimentação/sobrevivência possam ser comparados.

## 1. Cinco tempos diferentes

Cada cenário e relatório deve distinguir estes campos:

| Campo | Significado | Muda o resultado do modelo? |
| --- | --- | --- |
| Tick lógico | Unidade inteira processada pelo core | Sim, cada tick pode alterar o mundo |
| Velocidade de apresentação | Ticks pedidos por segundo real; ex.: 1×/8× | Não, apenas quanto tempo de parede leva |
| Cadência do sistema | Intervalo em ticks entre atualizações de clima, água, planta etc. | Sim |
| Período ambiental | Duração em ticks de dia, estação, seca ou outro ciclo | Sim |
| Cadência do indivíduo | Intervalo de percepção, decisão e aprendizado em ticks | Sim |

As três últimas são parâmetros do modelo e ficam no cenário/versionamento da simulação. Alterá-las cria uma condição experimental diferente. A velocidade de apresentação não entra em recompensa, custo metabólico, reprodução, treino ou métrica ecológica.

F0 usa só tick lógico. F1 introduz unidades de calendário e cadências junto com os parâmetros do mundo. Não atribuir duração em segundos a um tick até que um cenário e uma escala espacial sejam aprovados.

## 2. Avanço e sistemas com cadências distintas

O cliente transforma o controle de velocidade em pedidos inteiros de `STEP`; o core não recebe `deltaTime` real. Se o dispositivo não acompanhar a velocidade escolhida, o mundo avança mais devagar em tempo de parede e a interface pode informar atraso. O simulador preserva ticks já admitidos no lote em voo. O driver usa fila limitada e não acumula dívida ilimitada de relógio real; pausa e retomada seguem a SPEC-000.

Todo sistema que não roda a cada tick declara `periodTicks`, fase inicial e a regra de intervalo usada ao atualizar. Para processos integrados entre atualizações, declarar o intervalo lógico efetivamente decorrido; não fingir que o processo ocorreu em um tick. A agenda/cursor é persistida para que save/load continue o mesmo ciclo.

A percepção, decisão e aprendizado animal usam cadências próprias. Não presumir que cada mudança ambiental produza uma nova decisão. A razão entre período ambiental e cadência do indivíduo é parte da configuração e do experimento.

## 3. Comparabilidade de cenários

Um registro de benchmark deve conter, no mínimo:

- `simulationVersion`, versão do cenário e versões/checksums de conteúdo;
- seed, configuração ambiental, períodos/cadências e população inicial;
- condição de aprendizado, herança de pesos e duração lógica;
- unidade observada, janela de cálculo e denominador de cada métrica;
- build/equipamento para métricas de desempenho, separados dos resultados ecológicos.

Comparações de aprendizado usam seeds pareadas e os mesmos cenários sempre que possível. Controlador heurístico, rede congelada, aprendizado online e transferência de pesos são condições diferentes. A frequência do ciclo ambiental deve ser mantida fixa numa comparação principal; depois pode ser varrida deliberadamente como fator experimental. Não concluir que uma rede melhorou quando também se mudou o tempo de chuva, a cadência de decisão ou a duração do episódio.

## 4. Definição mínima de “comida”

Nunca registrar apenas “média de comida” sem declarar o que foi contado. Separar pelo menos:

- **ingestão:** quantidade de recurso comestível realmente consumida, com unidade;
- **sucesso de alimentação:** episódios em que um indivíduo consumiu / tentativas elegíveis;
- **condição energética:** reserva/energia corporal ao longo do tempo, segundo a unidade do modelo;
- **desempenho populacional:** sobrevivência, reprodução e causa de mortalidade.

Para população variável, a métrica ecológica de ingestão recomendada é:

`ingestão por 1.000 ticks-indivíduo = (quantidade total consumida / soma de indivíduos vivos por tick) × 1.000`

A ingestão ecológica usa g de matéria seca; itens só pertencem a métricas discretas explicitamente rotuladas. Energia assimilada é outra métrica, em kJ, e não se soma à biomassa ingerida. Reportar também a distribuição entre indivíduos e seeds. Uma recompensa numérica do controlador não substitui nenhuma dessas métricas.

Para um jogo/benchmark legado que conte “comidas” discretas, definir explicitamente `100 × comidas_consumidas / ticks_lógicos_da_janela`, a janela e os critérios de inclusão. Resultados desse benchmark não se misturam com a métrica ecológica por biomassa sem conversão justificada.

## 5. Testes e critérios de aceite

- **Invariância de apresentação:** rodar a mesma seed/configuração por `N` ticks em 1× e 8× e comparar estado, eventos e métricas no tick `N`.
- **Invariância de renderização:** repetir com FPS e câmera diferentes ou render desligado; resultado idêntico no mesmo ambiente de execução.
- **Particionamento:** `STEP(N)` deve equivaler a vários passos cuja soma seja `N`.
- **Efeito de cadência declarado:** se o período ambiental ou a cadência individual mudar, registrar nova configuração/condição e não comparar como se fosse o mesmo cenário.
- **Métrica auditável:** teste com pequena trajetória conhecida confirma numerador, denominador, unidade e janela da métrica de ingestão.

F1 deve escolher e documentar `ticksPerDay`, duração das estações e parâmetros de clima por cenário antes do primeiro benchmark climático. F3/F4 acrescentam cadências de metabolismo, movimento, percepção, ação e aprendizado e aprovam intervalos sob cenários de referência. Os valores ficam em aberto até essas specs; não são inferidos da velocidade do jogo nem escolhidos para otimizar uma média isolada.

## 6. Denominador e retenção

Usar janela de transições `(t0, t1]`: para cada tick contar animais elegíveis vivos no início dele; nascidos durante o tick entram no denominador a partir do próximo. Numerador usa ingestão ocorrida nessas transições para o mesmo conjunto elegível. Declarar espécie, estágio e filtros; não comparar herbívoros/predadores por uma média misturada sem composição populacional. Um animal que morre durante o tick contribui para a exposição desse tick. Nenhuma ingestão é atribuída a recém-nascido antes do próximo tick.

Denominador zero retorna `null` com motivo “sem exposição”, nunca NaN/Infinity ou zero que pareça desempenho. Sucesso alimentar usa tentativas concluídas e elegíveis na janela, incluindo falhas; ações ainda pendentes são informadas separadamente. Ausência de tentativas também retorna null.

Contadores acumulados necessários às métricas e continuidade são persistidos. Eventos detalhados de inspeção têm buffer limitado e política declarada; descarte de telemetria não altera estado, reward, RNG ou contadores. Relatórios registram perdas/agregações de telemetria. Histórico completo e replay não são prometidos pelo buffer de inspeção.

## 7. Implementação comum disponível em F0

Os contratos transversais que não dependem de calendário ou organismos já possuem implementação executável:

- Cada `TickSystem` declara `periodTicks` e `phaseOffsetTicks`. Fase zero executa primeiro em `periodTicks`; outra fase executa primeiro no tick indicado e, depois, a cada `periodTicks`. O callback recebe o `elapsedTicks` real desde sua atualização anterior, incluindo a primeira janela parcial. Sistemas integrados usam esse intervalo, sem simular que rodaram a cada tick.
- O estado persiste `periodTicks` e `nextTick`. O resto `nextTick % periodTicks` preserva a fase; `nextTick: 0` indica que não há próxima ocorrência representável dentro do limite de tick seguro. O Worker recusa carregar ou avançar um estado cuja agenda não corresponda aos sistemas/configuração ativos. `STEP(N)` mantém o mesmo cursor e os mesmos eventos que passos particionados.
- A velocidade de apresentação continua exclusivamente no `StepDriver`; o core não recebe velocidade ou `deltaTime`. O teste usa o mesmo mundo, seed e sistemas até quatro ticks lógicos em 1 tick/s e 8 ticks/s, comparando estado e eventos.
- `data/schemas/benchmark.v1.schema.json` define um manifesto por execução: versão/build, seed, cenário, conteúdo com checksums, cadências, população inicial, condição de aprendizado (modo, ID versionado e parâmetros), duração, unidade, janela, denominador e filtro. Equipamento é obrigatório para métricas de desempenho e fica separado dos resultados ecológicos. Validadores de comparação exigem condições iguais em replicações e seeds pareadas quando muda apenas o aprendizado. O ensaio sintético atual está em [spec-001-performance-baseline-2026-10-19.json](../evidence/spec-001-performance-baseline-2026-10-19.json).
- `src/core/food-metrics.ts` implementa a janela `(t0,t1]`, exposição por censo vivo no início do tick, ingestão em g de matéria seca, tentativas elegíveis concluídas, pendências e retorno `null` com motivo quando o denominador é zero. O resumo por trajetória conserva a distribuição individual; o agregador mantém distribuição individual por seed, distribuição agregada entre indivíduos e distribuição entre seeds. Quantis usam Type 7 com interpolação linear. Contadores agregados cumulativos são gravados no mapa lógico `metrics` e, portanto, seguem no save/load.
- O benchmark discreto legado tem unidade própria em eventos por 100 ticks e não se combina com biomassa ou energia. Energia, sobrevivência, reprodução e causas de mortalidade continuam métricas independentes, a serem produzidas pelas fases biológicas.
- `eventsOmitted` informa perdas por resposta quando o limite de telemetria é excedido. Um ensaio com eventos omitidos compara estado lógico e confirma que perda de telemetria não muda estado, contadores ou RNG. Não há buffer histórico completo nem replay prometido.

Os testes cobrem agendas de fase/período, intervalo decorrido, equivalência de partições, continuação após save/load, invalidação de cadência divergente, taxa de ingestão em uma trajetória conhecida, população variável, recém-nascido, denominador zero, tentativas pendentes, contadores persistidos, pareamento de seeds e invariância entre velocidade de apresentação. A suíte valida as funções e contratos; ainda não existe uma fauna que produza essas métricas.

F1 deve acrescentar `ticksPerDay`, estações e cadências ambientais ao cenário versionado. F3/F4 devem conectar as métricas ao estado de cada organismo e declarar as cadências biológicas e de aprendizado. Não atribuir segundos a ticks nem tratar o manifesto-fixture como calibração ecológica.
