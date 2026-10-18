# Especificação da simulação

## Estado e execução

Core em TypeScript, independente de Phaser e DOM. Worker executa ticks fixos; renderização recebe snapshots e deltas. Velocidade altera quantos ticks são processados, não as regras ou a duração lógica de um tick.

Estado básico: versões, seed, estado do RNG, tick, agenda dos sistemas, mapa, clima, reservatórios de água, solo, vegetação, detritos, organismos, linhagens, métricas e eventos. Cérebro existe apenas em entidades que possuem esse componente. Estado humano e institucional é opcional e ausente em cenários naturais.

## Ordem de atualização

1. Relógio, luz e forçantes climáticas.
2. Fluxos de água e temperatura.
3. Solo, detritos, decomposição e nutrientes.
4. Vegetação: crescimento, competição, sementes e mortalidade.
5. Necessidades e percepção dos animais.
6. Escolha de ações, reservas de alvo e resolução de movimento/interações.
7. Dano, doença, morte e transferência de biomassa para detritos.
8. Reprodução elegível, herança, mutação e novos indivíduos.
9. Recompensa da transição, aprendizado, eventos, métricas e snapshot.

Sistemas possuem cadências distintas em múltiplos inteiros do tick. Atualizações usam o intervalo lógico efetivamente decorrido; agendas são salvas. Ordem de resolução e desempates são estáveis. Mortes são resolvidas antes de nascimentos; regras para reprodução já iniciada são explícitas por espécie.

Humanos futuros usam as mesmas etapas biológicas; sistemas sociais entram por módulos com dependências e ordem declaradas.

## Invariantes

IDs únicos e estáveis; valores finitos; estoques não negativos; consumo simultâneo nunca excede o disponível; indivíduo morto não age nem aprende em ticks futuros. A transição terminal ainda pode receber uma última atualização.

Transferências de água, nutrientes e biomassa registram origem e destino. Para animais, registrar separadamente biomassa ingerida/residual e energia assimilada/alocada a manutenção, movimento, crescimento e reprodução; parâmetros de assimilação e dissipação devem ser explícitos. Fontes externas e perdas previstas são contabilizadas. Não somar ou impor conservação artificial entre quantidades de unidades diferentes.

Falha numérica pausa com diagnóstico; não corrigir silenciosamente estoque inválido.

## Reprodução de cenários

RNG controlado com fluxos por sistema e estado serializado. Nunca usar relógio real ou Math.random no core. Ordenação, agenda e orçamento de aprendizado dependem do tick, não de latência do dispositivo.

Garantia inicial: repetição na mesma versão e ambiente testado. Equivalência numérica entre plataformas exige verificação específica antes de ser prometida.

## Eventos e persistência

Eventos naturais: chuva, seca, inundação, germinação, dispersão, alimentação, predação, nascimento, doença, migração, morte, decomposição e extinção local. Eventos sociais são adicionados nas fases correspondentes.

Evento registra tick, atores, local, alterações e evidências de causa. A UI distingue causa registrada de hipótese estatística.

Save inclui agenda, RNG, versões de conteúdo, organismos, pesos, memória necessária ao aprendizado e checkpoints. Não inclui objetos Phaser/DOM. Observabilidade e save são entregas desde F0–F2; timeline completa vem depois.

O mundo continua sendo simulado fora da câmera. Agregação e cadências são propriedades do modelo e precisam de testes, nunca decisões dependentes da visibilidade.
