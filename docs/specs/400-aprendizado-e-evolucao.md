# SPEC-400 — Aprendizado online e evolução

**Fase:** F4  
**Estado:** rascunho experimental; hiperparâmetros dependem do perfil e dos testes de custo.  
**Depende de:** [SPEC-300](300-biologia-animal.md), [SPEC-001](001-relogio-e-metricas.md), [IA individual](../03-individual-ai-spec.md), [pesquisa e validação](../08-pesquisa-e-validacao.md).

## 1. Objetivo

Cada animal elegível passa a ter um controlador próprio que aprende durante a vida por experiência no próprio jogo. O sistema deve permitir avaliar se o comportamento aprendido muda alimentação, sobrevivência e reprodução, sem assumir que redes neurais sempre convergem ou que aprendizado necessariamente melhora aptidão.

Não usar modelos treinados fora do jogo, pesos pré-treinados, inferência remota ou bibliotecas de treinamento externo no runtime inicial. Controladores congelados podem ser usados como condição experimental, mas não recebem atualização.

## 2. Dados separados

- **Genoma:** traços físicos herdáveis e alelos/valores versionados; expressão, limites e mutação definidos por perfil.
- **Fenótipo/corpo:** massa, necessidades, saúde e demais estados biológicos da SPEC-300.
- **Controlador:** topologia/versão, pesos, taxa de exploração/aprendizado, memória necessária e estado de transição pendente.
- **Experiência:** transições/estatísticas necessárias ao método; tem limite, política de descarte e serialização.
- **Linhagem:** pais, geração, mutações, herança e nascimento.
- **Cultura futura:** práticas transmitidas socialmente apenas em fases humanas, nunca confundidas com genes ou pesos.

## 3. Contrato de observação e ação

Cada perfil declara versão do schema de observação e de ações. A observação é limitada aos sensores e memória do indivíduo e normalizada com limites explícitos. Ações são um conjunto discreto e versionado por capacidades; uma máscara de ações legais impede escolher ações indisponíveis, incompatíveis ou cujo pré-requisito não existe.

A topologia é compatível dentro da espécie/versão ou a migração do controlador falha explicitamente. Alterar número, ordem ou significado dos campos de observação/ações incrementa a versão do schema e requer migração/teste; não reinterpretar pesos antigos silenciosamente.

A ação produzida é apenas intenção. Executor da SPEC-300 valida e aplica custos, resolve alvos e retorna a transição real.

## 4. Método candidato e atualização

**Candidato de referência:** MLP pequena com uma saída Q por ação, ação epsilon-greedy entre ações legais e atualização TD online. A equação-alvo usa recompensa observada e valor futuro descontado pelo intervalo lógico: alvo = retorno descontado da ação + `gammaTick^deltaTicks × maxQLegal(nextObservation)`. `gammaTick` é o desconto por tick lógico, em (0,1]; se configurado por uma duração de referência, converter explicitamente para tick. O retorno da ação soma recompensas por tick ponderadas por `gammaTick^k`, com k iniciando em zero no primeiro tick da ação. Em transição terminal, o termo futuro é zero.

Esse método é hipótese de implementação, não garantia de convergência em um ambiente multiagente não estacionário. Antes de adotá-lo, fixar topologia, ativação, inicialização, faixa de pesos, taxa de aprendizado, clipping, exploração, desconto, limite e política de memória, precisão numérica e orçamento computacional. Registrar todos no cenário e no relatório de treino.

Updates e exploração têm agenda determinística medida em operações/ticks, nunca em milissegundos. Se houver limite global de atualizações, escalonamento justo usa cursor estável persistido para não favorecer sempre os menores IDs. Na avaliação congelada, pesos e estado de treinamento não mudam; o corpo e a memória comportamental continuam evoluindo conforme regras declaradas.

## 5. Recompensa e avaliação biológica

Recompensa de treino é registrada em componentes: mudança de necessidade/condição, risco, energia gasta, alimento realmente ingerido, dano e ações com custo. Não recompensar continuamente mera proximidade de alimento nem o início de uma ação. Recompensa total não é aptidão biológica.

Medir separadamente ingestão por unidade e janela da SPEC-001, energia corporal, sobrevivência, reprodução viável, diversidade genética, diversidade de comportamento, causas de morte e extinção. Reportar distribuição individual e entre seeds, não apenas a média.

## 6. Herança e mutação

Padrão: descendentes recebem traços genéticos segundo regra versionada do perfil; rede, memória episódica e recompensa aprendidas não são copiadas. O controlador do descendente é inicializado pela regra declarada no experimento.

Transferência direta de pesos parentais é uma condição separada, opt-in e marcada como experimento de transferência de controlador. Deve registrar pesos copiados, mutações, compatibilidade e parentesco. Não chamar transferência de pesos de herança genética ou prova do efeito Baldwin.

Mutação ocorre em traços herdáveis com distribuição, limites e custos definidos; valores inviáveis são rejeitados ou limitados segundo regra explícita. Seleção emerge de sobrevivência e reprodução custosas; o simulador não elimina indivíduos por ranking de score.

## 7. Protocolo mínimo de comparação

Executar nos mesmos perfis, populações e seeds pareadas:

1. baseline heurístico F3;
2. rede congelada sem atualização;
3. rede com aprendizado durante a vida, sem transferência de pesos;
4. rede com transferência de pesos, após validar os contratos e a estabilidade numérica da condição anterior.

Cada condição fixa duração lógica, cadências ambiental e neural, parâmetros de recompensa e população inicial. Congelar pesos na janela de avaliação. Comparar períodos ambientais mais lentos e mais rápidos que a janela de adaptação como fator controlado, sem misturar esses resultados na comparação principal.

Relatar método, topologia, seed, versão, gerações, população inicial/final, custo de CPU, memória, distribuição de resultados, extinções e limitações. Cinco seeds por dez ciclos sazonais e cinco gerações de espécie de ciclo curto são apenas o piso funcional do gate; resultados gerais exigem replicação maior conforme variabilidade observada.

## 8. Cenários de aceite F4

- Mesmo estado, observação, pesos, RNG e sequência de transições produzem as mesmas atualizações no ambiente testado.
- Máscara de ação impede executar ação ilegal, inclusive quando todas as ações normais são inválidas; fallback seguro fica registrado.
- Transição terminal não inclui valor futuro; transição com duração variável usa intervalo lógico.
- Save/load preserva pesos, memória, exploração, agenda e resultado futuro.
- Avaliação congelada não altera qualquer peso.
- Mutação respeita limites e registra ancestralidade; por padrão, pesos aprendidos não passam aos descendentes.
- Transferência direta é isolada, configurável e comparada contra descendentes sem cópia.
- Nenhum indivíduo nasce ou morre por ranking artificial de recompensa.

O gate F4 só passa com resultados reproduzíveis e relatório; nenhuma dessas condições é considerada implementada ou validada por estar especificada.

## 9. Avaliação, término e limites experimentais

Morte encerra a transição do indivíduo: admitir uma última atualização terminal e depois liberar seu estado ativo. Pausa, save e fim da janela de benchmark não são morte. Truncamento mantém a continuidade ou aplica regra de bootstrap documentada; não atribuir valor futuro zero automaticamente. Impedir updates duplicados ao retomar uma ação pendente.

Na avaliação congelada, não atualizar pesos, otimizador, buffer de treinamento ou agenda de exploração treinável. Declarar epsilon de avaliação (incluindo zero quando essa for a condição) e desempates. Memória usada como observação pode atualizar, sem contaminar o treino: avaliar cópia de checkpoint com RNG próprio e nunca mesclar experiências de avaliação no mundo original. Rede congelada de controle inicial e avaliação de uma rede já treinada são condições distintas, identificadas no relatório.

Separar fluxos de ambiente, inicialização, exploração e mutação para que draws neurais não desloquem a sequência climática. Seeds pareadas garantem condições iniciais comparáveis; interações posteriores podem divergir legitimamente. Registrar versão dos fluxos e agendas.

Fallback de indivíduo vivo é uma ação de espera legal e custosa conforme o metabolismo; o executor revalida precondições após disputas. Estado terminal não precisa de maxQ nem ação legal. Topologia, vetor e limites são fechados antes dos ensaios; entrada inválida ou peso não finito segue o diagnóstico da SPEC-000, sem substituição silenciosa por zero.

Traços corporais herdáveis têm custos/compensações explicitados no perfil e testes que verifiquem sua expressão. A transferência de pesos mantém memória e experiências separadas; não inicializar genoma a partir de recompensa. Limites de memória por animal, retenção de linhagens mortas e orçamento total precisam de política antes de testes longos.

Adicionar testes de recompensa em ação de múltiplos ticks, truncamento, morte, espera legal, isolamento de avaliação e continuação de treino após save. Se a condição sem transferência apresentar instabilidade numérica ou falhar nos contratos, registrar falha e não aprovar o gate natural; o requisito comparativo do roadmap não é dispensado.

Oscilações populacionais, extinção e ausência de ganho com aprendizado podem ser resultados experimentais válidos; não equivalem, por si só, a instabilidade numérica ou falha do contrato.
