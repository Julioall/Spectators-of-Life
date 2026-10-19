# SPEC-300 — Biologia animal e populações

**Fase:** F3  
**Estado:** rascunho de contrato; perfis de espécie e calibração pendentes.  
**Depende de:** [SPEC-100](100-mundo-fisico.md), [SPEC-200](200-vegetacao-e-decomposicao.md), [relógio e métricas](001-relogio-e-metricas.md), [IA individual](../03-individual-ai-spec.md).

## 1. Objetivo e limites

Adicionar animais com ciclo de vida completo e controladores de referência determinísticos, sem rede aprendendo ainda. O ambiente deve produzir busca por recurso, alimentação, descanso, fuga, predação, reprodução, doença simplificada, migração local e mortalidade sem respawn automático.

F3 não declara evolução genética nem transferência neural. A variação individual é limitada ao que o perfil inicial declarar; mutação, herança e redes online pertencem à F4.

## 2. Estado do organismo

Cada organismo tem ID estável, espécie, posição, orientação, idade em ticks, estágio de desenvolvimento e estado vital. Componentes biológicos incluem, conforme o perfil:

- massa estrutural em g de matéria seca;
- reserva de energia em kJ e condição corporal;
- água corporal em mL;
- saúde/lesão, fadiga e condição térmica quando modeladas;
- maturidade, condição reprodutiva e dependência/cuidado parental se aplicável;
- ação e alvo atuais, percepção recente e estado de transição para inspeção.

Rede neural, genoma evolutivo e cultura não existem no runtime F3. O controlador heurístico possui estado persistente próprio (memória de alvos, agenda e transição), necessário para reproduzir seu comportamento. Entidades mortas deixam de agir e aprender; restos são transferidos a detritos conforme as regras do perfil.

## 3. Perfil de espécie e recursos

Perfil declara dieta e classes consumíveis, habitat, alcance sensorial, tolerâncias ambientais, massa de referência, maturação, longevidade, taxa de manutenção, custo locomotor, velocidade, necessidade de água, digestibilidade e estratégias reprodutivas. Campos não modelados são omitidos, não preenchidos com zeros enganosos.

Unidades alimentares compatíveis com F2: g de matéria seca ingerida; energia do alimento em kJ/g matéria seca; frações de digestibilidade e de energia assimilada no intervalo 0–1. A alimentação remove biomassa comestível disponível. Energia assimilada é calculada da ingestão e eficiência; a energia não assimilada acompanha os resíduos ou outras perdas declaradas; apenas as parcelas metabólicas correspondentes são dissipadas como calor. Não contabilizar toda energia não assimilada como calor. Matéria não assimilada e resíduos retornam ao estoque de detritos.

A energia corporal é alocada em ordem declarada pelo perfil: manutenção, termorregulação se ativa, atividade/movimento, reparo, crescimento e reprodução. Manutenção não pode deixar a reserva negativa. Crescimento exige matéria assimilável e energia; reprodução exige reserva/custo e fonte de biomassa do descendente. Toda fonte, transferência e perda aparece na auditoria.

## 4. Percepção, decisão e movimento

O controlador de referência F3 usa regras observáveis e versionadas. Recebe apenas sinais dentro do alcance/capacidades do indivíduo. Observação inclui necessidades corporais, perigos, alimento/água acessíveis, abrigo, direção/obstáculo e indivíduos visíveis ou detectáveis; sem acesso global ao mapa.

Ações são capacidades permitidas pelo perfil: deslocar/explorar, forragear, beber, descansar, abrigar, fugir, perseguir, socializar ou reproduzir quando elegível. Executor valida precondições e resolve custos; o controlador não altera estoques diretamente. Movimento declara velocidade e custo por distância/tempo, respeitando a escala e calendário da SPEC-100.

A cadência de percepção, decisão e ação é parte da configuração do cenário. Alvos disputados são reservados/resolvidos deterministicamente, com desempate explícito e sem consumo acima do estoque.

## 5. Ciclo de vida, saúde e população

Nascimento, dependência juvenil, maturação, reprodução, envelhecimento e morte são eventos com causa e custo registrados. Perfis declaram o que modelam sobre sexo, época reprodutiva, número de descendentes e cuidado parental; não generalizar uma estratégia para todas as espécies.

A doença inicial é uma abstração com exposição, transmissão por contato/densidade, efeito na saúde, recuperação e mortalidade. Parâmetros são do cenário e não representam microbiologia completa. Doença não substitui condição corporal ou lesão.

Populações emergem de nascimentos, mortes e deslocamentos. Capacidade de suporte depende dos recursos. Extinção local é resultado válido e não é compensada por reposição gratuita.

## 6. Eventos e inspeção

Eventos mínimos: detecção, decisão, movimento, alimentação, ingestão, bebida, repouso, dano, exposição, contágio, recuperação, reprodução, nascimento, maturação, migração e morte. Cada evento identifica tick, atores, local, ação/causa, estoques antes/depois e energia/matéria transferidas.

Painel individual mostra necessidade, reserva, dieta, percepção, ação e histórico recente. Painel populacional mostra distribuição etária e corporal, nascimentos, mortes, migração, causa de mortalidade e consumo por espécie.

## 7. Cenários de aceite

- Animal sem acesso a alimento/água perde condição segundo custos declarados; animal bem alimentado paga manutenção e pode recuperar reserva.
- Caça consome tempo, movimento e energia; fuga/predação têm risco e resultados auditáveis.
- Duas entidades disputando estoque nunca consomem mais que disponível; ordem é determinística e desempate declarado.
- Crescimento e nascimento não criam biomassa ou energia sem transferência/custo.
- Jovem dependente não é tratado como adulto reprodutor; mortalidade e maturação decorrem de estado e perfil.
- Doença pode propagar, recuperar ou causar morte segundo exposição e saúde; diagnóstico indica via causal.
- Câmera, velocidade de apresentação e FPS não alteram população após os mesmos ticks.
- Save/load continua corpo, percepção, alvos, agenda e métricas necessárias à reprodução do cenário.

## 8. Decisões para a primeira implementação F3

Selecionar no mínimo três perfis com nichos contrastantes para testar herbivoria, predação e competição; definir quais campos de corpo, água, doença e cuidado parental entram no primeiro recorte. Fechar cadências, limiares e tolerâncias em cenários com versão, sem declarar que os perfis representam universalmente a espécie na natureza.

## 9. Contratos de integração corporal

Além da energia em kJ, reservas mobilizáveis precisam de massa em g de matéria seca ou conversão explícita e versionada entre reserva material e conteúdo energético. Estrutura, reserva, alimento em processamento, resíduos e descendentes não podem contar duas vezes a mesma matéria. Fixar assimilação, alocação, catabolismo e perdas de fronteira antes da implementação. Isso é um balanço simplificado; não converter matéria seca diretamente em massa de CO₂ sem estequiometria e entradas correspondentes.

Déficit de manutenção gera consumo de reserva, catabolismo estrutural se previsto, deterioração e morte conforme regra do perfil. Não zerar a reserva para conceder manutenção gratuita. Na morte, contabilizar a biomassa restante disponível e a parcela consumida pelo predador, sem duplicar cadáver e alimento. Água corporal e nutrientes também recebem destino explícito. Usar conversões por área da SPEC-100/SPEC-200.

Termorregulação simplificada e descanso são obrigatórios em F3: declarar indicador térmico, exposição, abrigo, efeito na atividade/manutenção e limiares de dano. O modelo não precisa resolver calor corporal completo. Hidratação, saúde, doença e reprodução permanecem obrigatórias; estratégias de cuidado parental variam por perfil.

A navegação pode consultar colisões autoritativas para executar uma intenção, mas não revelar ao controlador recursos/alvos fora de seus sensores ou memória. Decisões concorrentes usam um estado perceptivo definido antes da resolução; executores revalidam disponibilidade. A regra de desempate deve ser testada quanto a favorecimento persistente de IDs.

Animais nascidos na etapa de reprodução só percebem, agem e consomem a partir do próximo tick. Eventos de detecção/movimento podem ser amostrados no buffer de inspeção; fatos que mudam estado, recompensas e contadores são computados integralmente. Limites de telemetria seguem a SPEC-001 e não afetam o modelo.

Testes adicionais: reserva esgotada sem manutenção gratuita; morte durante disputa de alimento; cadáver consumido uma única vez; conversão de densidade vegetal para gramas; água corporal para mm da célula; sensor sem vazamento global; estado heurístico preservado no save.
