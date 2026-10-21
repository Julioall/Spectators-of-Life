# SPEC-200 — Solo, vegetação e decomposição

**Fase:** F2  
**Estado:** implementação inicial no cenário de referência; perfis e taxas são parâmetros de jogo ainda sem calibração de longo prazo.
**Depende de:** [SPEC-100](100-mundo-fisico.md), [relógio e métricas](001-relogio-e-metricas.md), [escopo natural](../10-ecologia-e-biologia.md).

## 1. Objetivo e representação inicial

Acrescentar solo, nutrientes, sementes, crescimento vegetal, competição, mortalidade e retorno de matéria orgânica. A vida vegetal precisa responder à água, luz, temperatura e substrato de cada célula e produzir padrões persistentes entre estações.

**Proposta de F2:** representar plantas como coortes por célula, espécie e estágio, e decompositores como atividade agregada por célula, em vez de simular cada folha/raiz/microrganismo. A renderização pode desenhar plantas individuais variadas, mas a quantidade e distribuição visual derivam das densidades simuladas. Essa representação deve poder ser substituída por indivíduos em espécies cujo comportamento exija resolução maior, sem mudar a fonte de verdade do mapa.

## 2. Estado e unidades

Cada célula acompanha:

- água do solo em mm, nutriente mineral agregado (proposta: nitrogênio em g N/m², a confirmar no cenário);
- matéria orgânica do solo e detritos por tipo, em g de matéria seca/m²;
- atividade decompositora agregada em faixa 0–1;
- por espécie e estágio: biomassa viva em g de matéria seca/m², cobertura, sementes/m², idade/estágio agregado e reservas quando modeladas.

Cada perfil vegetal declara unidade e limites de seus parâmetros: janelas mínima/ótima/máxima de temperatura, água e luz; tolerância a substrato; demanda de N por biomassa e fração de N em tecido/semente; taxa máxima de crescimento por dia; estágio/maturação; investimento em sementes; janela de germinação; dispersão e palatabilidade/toxicidade quando representadas.

O calendário e unidades vêm da SPEC-100. Estoques não podem ser negativos. Valores de parâmetros são de cenário/perfil com versão e fonte; não são constantes universais para todo o reino vegetal.

## 3. Crescimento e competição

Uma atualização vegetal em período definido no cenário determina fatores limitantes independentes para luz, água, temperatura e nutriente, dentro de 0–1. Como simplificação candidata do jogo, crescimento potencial é limitado pelo menor fator aplicável e pelos limites de biomassa, N, água e energia solar disponíveis. Registrar os fatores limitantes para inspeção.

Consumo de água e N é agregado por célula antes de aplicar deltas. Competidores não podem usar duas vezes o mesmo recurso. Cobertura/luz disponível considera a estrutura vegetal declarada; não permitir crescimento ilimitado por ordem de iteração.

A morte, queda de folhas e produção de sementes transferem matéria entre estoques. Biomassa vegetal produzida por fotossíntese tem fonte de carbono atmosférico e entrada de energia solar registradas como fluxos de fronteira do modelo; minerais absorvidos saem do reservatório de solo. A fração de N da biomassa/coorte determina o N transferido a sementes, detritos e solo mineralizado. Sementes usam parte da produção alocada, não surgem sem custo de biomassa.

## 4. Germinação, dispersão e sucessão

Germinação exige sementes disponíveis, janela ambiental permitida e espaço/recursos suficientes. Cada perfil declara dormência e condições de germinação; uma simplificação pode ignorar um fator, mas deve marcar o campo como inativo.

Dispersão é limitada por método e distância definidos no perfil. Seeds e escolha de direção são determinísticos. Não criar plantas para completar uma paisagem desejada. Uma célula sem condições pode permanecer sem aquela espécie.

Crescimento, competição, morte e sucessão devem ser observáveis em conjunto. Cenários medem tanto cobertura e biomassa como reprodução de sementes e limitação ambiental.

## 5. Detritos e decomposição

Folhas, sementes mortas/inviáveis, mortalidade vegetal e resíduos explicitamente modelados entram no estoque de detritos. A decomposição depende de temperatura, água, substrato e atividade agregada, com taxa limitada pelo material disponível. Matéria seca perdida e N mineralizado são fluxos diferentes; respiração/CO₂ pode ser registrada como perda de matéria seca na fronteira.

A atividade decompositora pode crescer/declinar por regras agregadas dependentes de habitat e detrito, sem agentes microbianos. Não usar um multiplicador sem unidade: taxa sempre informa unidade por dia/tick e estoque sobre o qual age.

## 6. Observação

A inspeção de célula/planta mostra biomassa e sementes, estágio/coorte, água/N disponíveis, fatores limitantes e entradas/saídas no intervalo. Eventos incluem germinação, expansão, competição, dispersão, senescência, morte e decomposição com causa registrada.

Camadas mínimas: biomassa, cobertura, sementes, nutriente mineral, detrito e fator limitante selecionado.

## 7. Cenários de aceite

- Espécie fora de sua faixa ambiental não ganha biomassa como se o habitat fosse adequado.
- Reduzir água/N limita crescimento e aparece no diagnóstico; remover limitação restaura o crescimento em plantas viáveis; recolonização após extinção local depende de sementes viáveis ou dispersão registrada.
- Competição por nutriente/água respeita estoque compartilhado.
- Sementes não germinam sem disponibilidade e condições; germinação reduz o banco de sementes.
- Mortalidade e queda de folhas transferem matéria a detritos; decomposição reduz detritos e mineraliza N dentro do balanço definido.
- Save/load no meio da sucessão mantém coortes, reservas e agenda dos sistemas.
- Mesma configuração/seed reproduz os mesmos eventos e estoques; câmera/FPS não afetam sucessão.

## 8. Decisões para a primeira implementação F2

Escolher um conjunto pequeno de perfis contrastantes (por exemplo, gramínea, herbácea e arbusto/árvore) para fixtures, unidades e tolerâncias. Definir como o mapa fornece N e matéria orgânica inicial, os fatores de crescimento efetivamente ativos, a representação de árvores longevas e a regra de atividade decompositora. Cada escolha deve ser identificada como abstração do jogo e validada com testes direcionais antes de calibrar taxas.

## 9. Coortes, nutrientes, reservas e erosão

Sementes dormentes viáveis permanecem no banco até germinar, morrer ou ser consumidas; não viram detrito apenas por não germinar. Cada semente tem massa e teor de nutriente declarados. Germinação transfere matéria da semente ao juvenil, descontando perdas declaradas. Reservas vegetais, biomassa estrutural e sementes são estoques distintos com transferências e custos; o perfil não pode omitir todas as reservas se elas forem usadas para manutenção ou reprodução.

Coortes preservam idade de germinação ou classes etárias explicitamente discretizadas. Não fundir idades numa média que provoque maturação instantânea; a regra de fusão/divisão e seus efeitos são versionados e testados. A inspeção mostra coorte/estimativa quando o sprite não representa um indivíduo simulado.

A escolha de N é proposta de fechamento do estoque agregado canônico. Até sua aceitação, não chamar um índice abstrato de fertilidade de g N. Se N for adotado, rastrear N mineral e orgânico por estoque; mineralização é limitada pelo N orgânico removido, mantendo frações/conversões consistentes. Matéria seca e N são balanços distintos; g N não são somados a g de biomassa como recursos independentes quando já fazem parte do tecido.

Erosão simplificada integra F2: escoamento exporta uma quantidade limitada de solo/material e seus nutrientes associados para célula receptora ou saída de borda. Depositar no receptor, conservar transferências internas e declarar perdas externas. Cobertura vegetal e classe de substrato modulam a taxa. Alterações de retenção do solo precisam redistribuir água excedente explicitamente. Topografia pode permanecer fixa nesse recorte, simplificação que deve constar no cenário.

Fechar regra de competição vegetal, estoques de reserva, massa por semente, transporte erosivo e mineralização antes de aceitar a implementação. Acrescentar fixtures de dormência, germinação com balanço, coortes etárias, nutriente esgotado e erosão com deposição/saída. Ao transferir biomassa para animais, converter `g = g/m² × área_m²`; não descontar gramas diretamente de uma densidade.

## 10. Implementação inicial — cenário de referência

O cenário atual `natural:temperate-valley@1.10.0` declara sete perfis (gramínea, arbusto, carvalho, pinheiro, bétula, árvore outonal e salgueiro), seus limites ambientais, taxas de crescimento/mortalidade, sementes e preferências de solo/habitat. A distribuição vegetal também diferencia a ocupação de árvores em afloramentos e solos rochosos: árvores tolerantes a rocha mantêm alguma vantagem relativa, mas a cobertura arbórea diminui. Margens suaves tornam-se habitat úmido, recebem infiltração e sedimento/nutrientes, e podem sustentar gramíneas, arbustos e salgueiros já presentes no banco de sementes local. Células submersas não crescem; leitos fluviais rasos ou expostos podem germinar cobertura herbácea, e canais novos removem árvores para o estoque local de detritos. Ainda não há plantas aquáticas nem dispersão de sementes entre células. Cada célula guarda registros agregados apenas para espécies com biomassa viva ou banco de sementes, incluindo N do tecido, N das sementes, idade e fatores limitantes. Solo armazena N mineral/orgânico, matéria orgânica, detritos e atividade decompositora. A distribuição vegetal inicial segue manchas contínuas de habitat; cada célula começa com no máximo uma espécie arbórea, as árvores começam em idades variadas, germinam novamente a partir do banco local de sementes e têm seu crescimento limitado pela sombra das copas próximas. As versões `1.0.0` a `1.9.0` permanecem aceitas para saves existentes.

`src/modules/biosphere/flora/simulation/flora-system.ts` atualiza transpiração, germinação local, mortalidade, respiração, crescimento limitado por água/luz/temperatura/N e produção de sementes. `environment-systems.ts` cobre decomposição, humificação, mineralização de N e transporte de sedimentos entre células. As cinco espécies arbóreas geram quadros pixel a pixel em runtime, com oito estágios de crescimento, senescência e variações visuais derivadas do seed do mundo e das coordenadas da célula. Gramíneas e arbustos também são desenhados por código. Copas maduras propagam sombra por várias células, reduzindo o crescimento das árvores menores e favorecendo sua presença nas bordas das manchas florestais. Esse footprint visual não altera a área física da célula nem o balanço ecológico; os PNGs de árvores permanecem somente como referência e não são carregados pelo jogo.

Este recorte não inclui dispersão de sementes entre células, herbivoria, consumidores, reservas vegetais separadas, várias classes etárias por espécie nem validação de sucessão em escala sazonal longa. As taxas e conversões são abstrações para o protótipo. A cobertura visual representa estado agregado por célula e não a contagem de indivíduos. Os testes direcionais e de persistência existentes ainda precisam ser reexecutados após esta revisão; os critérios da seção 7 e o balanço completo de matéria seca/N também permanecem abertos, portanto SPEC-200 continua em revisão.
