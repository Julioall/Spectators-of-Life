# SPEC-001 — Relógio lógico e comparação de métricas

**Fases:** F0–F4  
**Estado:** proposta pronta para revisão de implementação  
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

O cliente transforma o controle de velocidade em pedidos inteiros de `STEP`; o core não recebe `deltaTime` real. Se o dispositivo não acompanhar a velocidade escolhida, o mundo avança mais devagar em tempo de parede e a interface pode informar atraso. O simulador preserva todos os ticks pendentes.

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

A unidade da quantidade (biomassa, itens, energia assimilada) deve aparecer no nome/relatório. Reportar também a distribuição entre indivíduos e seeds. Uma recompensa numérica do controlador não substitui nenhuma dessas métricas.

Para um jogo/benchmark legado que conte “comidas” discretas, definir explicitamente `comidas_consumidas / 100 ticks lógicos`, a janela e os critérios de inclusão. Resultados desse benchmark não se misturam com a métrica ecológica por biomassa sem conversão justificada.

## 5. Testes e critérios de aceite

- **Invariância de apresentação:** rodar a mesma seed/configuração por `N` ticks em 1× e 8× e comparar estado, eventos e métricas no tick `N`.
- **Invariância de renderização:** repetir com FPS e câmera diferentes ou render desligado; resultado idêntico no mesmo ambiente de execução.
- **Particionamento:** `STEP(N)` deve equivaler a vários passos cuja soma seja `N`.
- **Efeito de cadência declarado:** se o período ambiental ou a cadência individual mudar, registrar nova configuração/condição e não comparar como se fosse o mesmo cenário.
- **Métrica auditável:** teste com pequena trajetória conhecida confirma numerador, denominador, unidade e janela da métrica de ingestão.

F1 deve escolher e documentar `ticksPerDay`, duração das estações e parâmetros de clima por cenário antes do primeiro benchmark climático. F3/F4 acrescentam cadências de metabolismo, movimento, percepção, ação e aprendizado e aprovam intervalos sob cenários de referência. Os valores ficam em aberto até essas specs; não são inferidos da velocidade do jogo nem escolhidos para otimizar uma média isolada.
