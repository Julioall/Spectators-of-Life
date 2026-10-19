# SPEC-200 — Solo, vegetação e decomposição

**Fase:** F2  
**Estado:** rascunho de contrato; perfis e taxas dependem de cenários identificados.  
**Depende de:** [SPEC-100](100-mundo-fisico.md), [relógio e métricas](001-relogio-e-metricas.md), [escopo natural](../10-ecologia-e-biologia.md).

## 1. Objetivo e representação inicial

Acrescentar solo, nutrientes, sementes, crescimento vegetal, competição, mortalidade e retorno de matéria orgânica. A vida vegetal precisa responder à água, luz, temperatura e substrato de cada célula e produzir padrões persistentes entre estações.

**Proposta de F2:** representar plantas e decomposição como coortes agregadas por célula, espécie e estágio, em vez de simular cada folha/raiz/microrganismo. A renderização pode desenhar plantas individuais variadas, mas a quantidade e distribuição visual derivam das densidades simuladas. Essa representação deve poder ser substituída por indivíduos em espécies cujo comportamento exija resolução maior, sem mudar a fonte de verdade do mapa.

## 2. Estado e unidades

Cada célula acompanha:

- água do solo em mm, fertilidade/agregado de nitrogênio mineral em g N/m²;
- matéria orgânica do solo e detritos por tipo, em g de matéria seca/m²;
- atividade decompositora agregada em faixa 0–1;
- por espécie e estágio: biomassa viva em g de matéria seca/m², cobertura, sementes/m², idade/estágio agregado e reservas quando modeladas.

Cada perfil vegetal declara unidade e limites de seus parâmetros: janelas mínima/ótima/máxima de temperatura, água e luz; tolerância a substrato; demanda de N por biomassa; taxa máxima de crescimento por dia; estágio/maturação; investimento em sementes; janela de germinação; dispersão e palatabilidade/toxicidade quando representadas.

O calendário e unidades vêm da SPEC-100. Estoques não podem ser negativos. Valores de parâmetros são de cenário/perfil com versão e fonte; não são constantes universais para todo o reino vegetal.

## 3. Crescimento e competição

Uma atualização vegetal em período definido no cenário determina fatores limitantes independentes para luz, água, temperatura e nutriente, dentro de 0–1. Crescimento potencial é limitado pelo menor fator aplicável e pelos limites de biomassa, N, água e energia solar disponíveis. Registrar os fatores limitantes para inspeção.

Consumo de água e N é agregado por célula antes de aplicar deltas. Competidores não podem usar duas vezes o mesmo recurso. Cobertura/luz disponível considera a estrutura vegetal declarada; não permitir crescimento ilimitado por ordem de iteração.

A morte, queda de folhas e produção de sementes transferem matéria entre estoques. Biomassa vegetal produzida por fotossíntese tem fonte de carbono atmosférico e entrada de energia solar registradas como fluxos de fronteira do modelo; minerais absorvidos saem do reservatório de solo. Sementes usam parte da produção alocada, não surgem sem custo de biomassa.

## 4. Germinação, dispersão e sucessão

Germinação exige sementes disponíveis, janela ambiental permitida e espaço/recursos suficientes. Cada perfil declara dormência e condições de germinação; uma simplificação pode ignorar um fator, mas deve marcar o campo como inativo.

Dispersão é limitada por método e distância definidos no perfil. Seeds e escolha de direção são determinísticos. Não criar plantas para completar uma paisagem desejada. Uma célula sem condições pode permanecer sem aquela espécie.

Crescimento, competição, morte e sucessão devem ser observáveis em conjunto. Cenários medem tanto cobertura e biomassa como reprodução de sementes e limitação ambiental.

## 5. Detritos e decomposição

Folhas, sementes não germinadas, mortalidade vegetal e resíduos explicitamente modelados entram no estoque de detritos. A decomposição depende de temperatura, água, substrato e atividade agregada, com taxa limitada pelo material disponível. Matéria seca perdida e N mineralizado são fluxos diferentes; respiração/CO₂ pode ser registrada como perda de matéria seca na fronteira.

A atividade decompositora pode crescer/declinar por regras agregadas dependentes de habitat e detrito, sem agentes microbianos. Não usar um multiplicador sem unidade: taxa sempre informa unidade por dia/tick e estoque sobre o qual age.

## 6. Observação

A inspeção de célula/planta mostra biomassa e sementes, estágio/coorte, água/N disponíveis, fatores limitantes e entradas/saídas no intervalo. Eventos incluem germinação, expansão, competição, dispersão, senescência, morte e decomposição com causa registrada.

Camadas mínimas: biomassa, cobertura, sementes, nutriente mineral, detrito e fator limitante selecionado.

## 7. Cenários de aceite

- Espécie fora de sua faixa ambiental não ganha biomassa como se o habitat fosse adequado.
- Reduzir água/N limita crescimento e aparece no diagnóstico; remover limitação restaura o crescimento quando há sementes.
- Competição por nutriente/água respeita estoque compartilhado.
- Sementes não germinam sem disponibilidade e condições; germinação reduz o banco de sementes.
- Mortalidade e queda de folhas transferem matéria a detritos; decomposição reduz detritos e mineraliza N dentro do balanço definido.
- Save/load no meio da sucessão mantém coortes, reservas e agenda dos sistemas.
- Mesma configuração/seed reproduz os mesmos eventos e estoques; câmera/FPS não afetam sucessão.

## 8. Decisões para a primeira implementação F2

Escolher um conjunto pequeno de perfis contrastantes (por exemplo, gramínea, herbácea e arbusto/árvore) para fixtures, unidades e tolerâncias. Definir como o mapa fornece N e matéria orgânica inicial, os fatores de crescimento efetivamente ativos, a representação de árvores longevas e a regra de atividade decompositora. Cada escolha deve ser identificada como abstração do jogo e validada com testes direcionais antes de calibrar taxas.
