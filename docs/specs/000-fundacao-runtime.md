# SPEC-000 — Fundação do runtime

**Fase:** F0  
**Estado:** proposta revisada; pendências de fechamento listadas na seção 8
**Escopo:** core TypeScript headless, Web Worker, protocolo de mensagens, execução por ticks e save/load mínimo.  
**Fontes:** [arquitetura](../04-arquitetura-e-integracao.md), [simulação](../02-simulacao-spec.md), [roadmap](../09-roadmap.md), [validação determinística](../07-testes-mods-roadmap.md).

## 1. Objetivo

Criar uma execução vazia, observável e reproduzível sobre a qual F1 possa acrescentar terreno e clima. A simulação é a fonte de verdade. Phaser e DOM exibem projeções descartáveis e não guardam estado do mundo.

A spec não inclui ecologia, fauna, controladores neurais, humanos, regras sociais ou calibração de parâmetros biológicos. Esses sistemas entram nas fases definidas pelo roadmap.

## 2. Componentes e autoridade

- **Core:** funções TypeScript sem dependência de Phaser, DOM, navegador ou Vite. Recebe estado e comando; atualiza estado e devolve eventos/métricas.
- **Worker:** único proprietário mutável do estado de um mundo. Valida mensagens, executa o core e serializa saves.
- **Cliente:** cria o Worker, agenda pedidos de avanço, apresenta snapshots completos e encaminha comandos de controle.
- **Phaser/UI:** renderizam e inspecionam dados recebidos. Nunca calculam regras, sorteios, reprodução, movimento ou tempo ecológico.
- **Driver de tempo real:** fica no cliente. Decide quantos ticks pedir por segundo de parede; latência ou FPS não alteram a duração lógica do tick.

Um Worker mantém um mundo ativo por vez. Benchmarks com vários mundos usam Workers isolados ou criam, salvam e descartam mundos em sequência.

## 3. Tempo e avanço

O estado contém `tick`, inteiro seguro de JavaScript, iniciado em zero. Um tick é uma unidade lógica do modelo; nesta fase não equivale a segundo, hora ou dia.

O core só avança quando recebe `STEP`. `STEP(n)` bem-sucedido processa exatamente `n` ticks e retorna o intervalo inicial/final. Pausar significa deixar de enviar `STEP`; acelerar significa pedir ticks lógicos com maior frequência. Nenhuma velocidade pode pular ticks, alterar custos por tick ou chamar o core com `deltaTime` variável.

O limite proposto é **256 ticks** por pedido; ele limita o lote, mas não garante latência de resposta. O tempo de cada tick ainda precisa ser medido. Avanços maiores são divididos em pedidos sucessivos pelo cliente. A divisão não pode descartar trabalho; para a mesma sequência total, `STEP(100)` deve produzir o mesmo estado que `STEP(40)` seguido de `STEP(60)`.

Snapshots, inspeção e salvamento não incrementam o tick. Eventos são ordenados pelo tick e por uma ordem estável de resolução.

## 4. Protocolo tipado do Worker

Todos os pedidos têm `protocolVersion: 1` e `requestId` inteiro seguro positivo, estritamente crescente na sessão do Worker; respostas ecoam esses campos do pedido. O Worker guarda o maior ID admitido; IDs iguais ou menores retornam DUPLICATE_REQUEST sem reexecução. Reiniciar a sessão reinicia esse contador, mas não o estado lógico carregado. Mensagens ligadas a um mundo também têm `worldId`. O protocolo usa união discriminada; campos desconhecidos ou tipos incompatíveis são rejeitados com erro estruturado.

### Cliente → Worker

- `CREATE_WORLD`: `scenarioId`, `scenarioVersion`, seed e configuração validada.
- `STEP`: `worldId` e quantidade inteira de ticks entre 1 e 256.
- `GET_SNAPSHOT`: `worldId`; solicita uma projeção completa sem alterar o estado.
- `SAVE`: `worldId`; solicita save consistente no fim de uma operação.
- `LOAD`: documento de save; valida tudo antes de substituir o mundo ativo.
- `DISPOSE`: `worldId`; libera o mundo e seus recursos.

### Worker → cliente

- `READY`: mundo criado; informa `worldId`, versão da simulação e tick inicial.
- `ADVANCED`: `tickFrom`, `tickTo`, eventos do intervalo e métricas diagnósticas.
- `SNAPSHOT`: estado de leitura completo e `tick` correspondente.
- `SAVED`: save serializado, versão do schema e tick salvo.
- `LOADED`: mundo restaurado, versão e tick.
- `DISPOSED`: mundo liberado.
- `ERROR`: `requestId`, código estável, mensagem legível, `recoverable`, tick conhecido e `systemId` quando disponível.

O Worker processa pedidos de estado em ordem FIFO. Não intercala mutações de outro pedido no meio de um `STEP`. Um erro de validação não altera o mundo. Erro de invariante numérica pausa o processamento e preserva diagnóstico; não corrige estoque silenciosamente. Não manter cache ilimitado de respostas. Após timeout, o cliente não reenvia cegamente a mutação com outro ID; deve aguardar a resposta ou restaurar um checkpoint confirmado em nova sessão.

Códigos mínimos: `UNSUPPORTED_PROTOCOL`, `INVALID_MESSAGE`, `INVALID_SCENARIO`, `UNKNOWN_WORLD`, `DUPLICATE_REQUEST`, `STEP_LIMIT_EXCEEDED`, `INVALID_SAVE`, `UNSUPPORTED_SAVE_VERSION`, `INVARIANT_VIOLATION`, `WORLD_FAULTED` e `INTERNAL_ERROR`.

## 5. Determinismo

- O core não usa `Math.random`, relógio de parede, latência, FPS, câmera ou ordem incidental de objetos para decidir resultados.
- Sistemas têm IDs estáveis e executam numa ordem declarada. Essa ordem respeita as dependências e etapas do contrato de simulação; ordenação de IDs resolve apenas empates dentro da etapa. Entidades e disputas são resolvidas por IDs ordenados e regras de desempate documentadas.
- A fonte de aleatoriedade é injetada por interface e separada por sistema. ID de sistema é estável, único e namespaced.
- **Proposta para F0:** seed de 64 bits serializada como 16 dígitos hexadecimais minúsculos; expansão de seed com SplitMix64 e gerador de estado xoshiro128** v1. Registrar o identificador do algoritmo e estado de cada fluxo no save. A inicialização dos fluxos percorre IDs de sistema em ordem lexicográfica ASCII.
- Incluir vetores de teste fixos do algoritmo e testes de continuação. Esta escolha é para aleatoriedade de simulação, não criptografia. A referência dos autores recomenda SplitMix64 para inicializar esses geradores e apresenta xoshiro128** como opção geral de 32 bits: [PRNG shootout](https://prng.di.unimi.it/).

A semente inicial pode ser criada pelo cliente usando `crypto.getRandomValues`, mas deve ser exibida/armazenada para repetição. O core recebe uma seed já normalizada; nunca deriva seed de `Date.now`.

Garantia F0: mesma versão da simulação, mesmos dados/configuração, mesmos comandos e mesma seed produzem o mesmo estado no mesmo ambiente testado. Não prometer equivalência bit a bit entre navegadores/plataformas sem uma validação própria.

## 6. Save mínimo

O formato inicial contém:

- `saveSchemaVersion`, `simulationVersion` e `scenarioId`/versão;
- seed normalizada, tick e configuração completa do cenário;
- IDs/versões/checksums dos módulos e conteúdos ativos;
- estado e cursor dos fluxos de RNG;
- agendas e contadores dos sistemas, quando introduzidos;
- entidades e métricas persistentes, ordenadas por ID.

Não serializar Worker, objetos Phaser, DOM, timers, referências de função ou velocidade de apresentação. A velocidade do cliente não pertence ao modelo salvo.

`LOAD` valida versão, limites, referências, finitude numérica e invariantes antes de alterar o mundo atual. Save incompatível é recusado com diagnóstico; migração futura cria um resultado novo e nunca sobrescreve silenciosamente o original. F0 testa save/load na mesma versão; compatibilidade entre versões exige migrações e fixtures próprias.

## 7. Critérios de aceite F0

1. Criar o cenário vazio, avançar `N` ticks e confirmar `tick === N`.
2. Avançar a mesma quantidade de ticks em partições diferentes e comparar estados/eventos.
3. Repetir comandos com a mesma seed e comparar snapshots serializados canonicamente.
4. Executar os mesmos ticks com render desligado, FPS diferente e câmera em locais diferentes; o estado deve ser igual.
5. Na execução A, salvar no tick `t` e avançar `N`. Na execução B, carregar o save de `t` e avançar `N`; comparar estado final e estado de RNG entre A e B.
6. Enviar mensagem malformada, versão desconhecida, tick fracionário, `STEP(0)` e `STEP(257)`; cada um deve retornar erro e preservar o estado.
7. Tentar carregar save truncado ou incompatível; mundo ativo permanece intacto.
8. Executar testes do core sem navegador e verificar que core/IA não importam Phaser nem DOM.
9. Publicar diagnóstico com versão, seed, tick, sistema e entidade quando disponível.

F0 só sai do marco após todos os critérios passarem e a validação constar no relatório da fase. A documentação atual não constitui essa evidência.

## 8. Fechamento de contratos antes da implementação

- Formalizar schemas de mensagens/save, limites de tamanho, versão do conteúdo, serialização canônica e fixtures válidas/inválidas.
- Fechar o PRNG em ADR com código de referência, mapeamento dos 64 bits para o estado de 128 bits, tratamento de estado nulo e vetores de teste. A ordem ASCII proposta não garante que adicionar um sistema preserve os fluxos existentes: decidir derivação por ID ou versionar o catálogo inteiro e registrar a mudança. A proposta da seção 5 não é especificação completa do algoritmo.
- Fixar versões das dependências, gerenciador/lockfile, scripts de typecheck/test/build, CI e cenário vazio de referência. Não há runtime para executar esses comandos nesta revisão.
- Escolher limites de snapshots, eventos e saves antes de aceitar conteúdo externo. O manifesto de módulos F0 cobre conteúdo interno; o loader comunitário completo pertence à trilha de mods.

## 9. Fila, pausa, falha e comparação de estado

O cliente envia no máximo um pedido de estado por vez e aguarda sua resposta antes do próximo. Pausa interrompe novos pedidos e fica em estado “pausando” até o lote em voo terminar; a UI então confirma o tick parado. SAVE, LOAD e DISPOSE esperam essa barreira. O avanço manual durante pausa envia STEP e volta a aguardar. Suspensão de aba não acumula dívida ilimitada de tempo real nem dispara simulação offline ao retornar. Ticks já admitidos são processados; tempo de parede não admitido não é trabalho prometido.

Um tick publica estado apenas depois de validar suas invariantes. Em falha, preservar o último tick completo válido, descartar a transação do tick defeituoso e retornar ERROR com `completedTicks`, `lastValidTick` e diagnóstico. Os ticks restantes do lote não foram executados. O mundo entra em estado faulted: STEP é recusado até LOAD válido, DISPOSE ou recriação explícita; SAVE/GET_SNAPSHOT acessam apenas o último estado válido, marcado com diagnóstico. CREATE_WORLD com mundo ativo é recusado; LOAD é a substituição explícita e atômica. Implementação e teste devem escolher uma estratégia de transação sem custo de cópia ilimitado.

`worldId` identifica a instância de transporte; é renovado em CREATE_WORLD/LOAD bem-sucedidos e informado na resposta. `requestId`, identidade do Worker, horários reais e tempo de CPU não entram na igualdade ecológica nem no save lógico. Comparar estado lógico canônico (tick, configuração, RNG, agendas, entidades, contadores e métricas do modelo). Comparar eventos ordenados concatenados, sem envelopes ou fronteiras de lotes. Respostas sempre ecoam requestId e a identidade aplicável.

Testes adicionais: pausa durante lote; duas solicitações consecutivas sem sobreposição; ID repetido/antigo; tentativa de criar sobre mundo ativo; falha no meio de STEP sem publicar tick parcial; SAVE após falha; LOAD inválido preservando estado; suspensão/retomada sem backlog ilimitado. Testar overflow do contador de ticks antes de executar o lote e recusar sem mutação.
