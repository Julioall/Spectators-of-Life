# Validação documental — 19/10/2026

## Escopo e conclusão

Revisão do repositório `Julioall/Spectators-of-Life`, partindo do commit `5ddb39651464aa9ac7ba7bd6b8d7e3d2db82ac6e`. Foram lidos os 36 arquivos existentes: 35 documentos Markdown e um manifesto JSON. A cobertura inclui raiz, documentos 00–11, índices, cinco ADRs, seis specs de implementação, seis skills e contratos de dados planejados. Protótipos e arquivos externos ao repositório não fazem parte desta revisão.

A proposta está coerente com natureza primeiro, observação, Phaser/TypeScript, simulação independente de renderização e redes que aprendem no jogo. Foram corrigidas contradições e completadas restrições de integração. **As specs continuam propostas; ainda não estão todas prontas para implementação integral.** F0 permanece o marco atual. Nenhum gate ecológico, teste de runtime ou benchmark foi aprovado documentalmente.

## Achados e correções

| ID | Gravidade | Problema encontrado | Correção e localização |
| --- | --- | --- | --- |
| DOC-01 | Alta | Skill colocava F3–F4 após o gate que essas fases devem construir | Skill animal corrigida: F3–F4 após F1–F2, gate ao final de F4 |
| DOC-02 | Alta | Arquitetura listava comandos de UI como protocolo Worker e prometia deltas em F0 | Arquitetura, simulação e ADR 0003 alinhados à SPEC-000; snapshots completos em F0 |
| DOC-03 | Alta | Pausa não especificava lote em voo; ticks pendentes permitiam backlog ilimitado | SPEC-000/001: um pedido em voo, barreira de pausa, ausência de dívida ilimitada de tempo real |
| DOC-04 | Alta | Duplicidade, falha no meio de lote e comparação de snapshots eram ambíguas | SPEC-000: IDs monotônicos, último tick válido, erro com progresso parcial e igualdade lógica sem telemetria |
| DOC-05 | Alta | Fluxos hídricos podiam competir pelo mesmo estoque; mistura de m/mm e overflow como perda | SPEC-100: conversões, alocação prévia e transferência interna preservada |
| DOC-06 | Alta | Spec vegetal omitira erosão obrigatória e tratava sementes não germinadas como detrito | SPEC-200: erosão/deposição, dormência, coortes etárias, reservas e massa por semente |
| DOC-07 | Alta | Nutriente agregado virou N físico sem fechar o modelo | SPEC-200 marca a escolha como proposta; exige balanços de N orgânico/mineral antes de adotar unidades reais |
| DOC-08 | Alta | Energia não assimilada era toda dissipada; reservas materiais e déficit metabólico indefinidos | SPEC-300: resíduos separados de calor, massa de reservas, déficit, catabolismo, cadáver e água auditáveis |
| DOC-09 | Alta | Percepção/ação só apareciam nos schemas F4, apesar de serem necessárias em F3 | Índice de schemas inclui contratos e estado heurístico em F3 |
| DOC-10 | Alta | Avaliação congelada, desconto temporal e truncamento insuficientemente definidos | SPEC-400: desconto por tick, retorno da ação, avaliação isolada, término vs truncamento e RNG separado |
| DOC-11 | Média | Métrica de comida misturava energia e biomassa; população variável sem convenção de censo | SPEC-001: unidades separadas, janela, exposição, filtros e denominador zero |
| DOC-12 | Média | Licença original atribuída a assets inexistentes e skill proibia entradas planned | Manifesto usa null para autoria/licença desconhecidas; skill/guia distinguem planejamento de integração |
| DOC-13 | Média | ADR neural soava como algoritmo definitivo; status das specs sugeria prontidão maior | ADR 0002 e índice ajustados; candidato e pendências explícitos |
| DOC-14 | Média | Histórico/eventos detalhados sem limite de retenção | SPEC-001/300/400: buffers, contadores persistentes e limites separados do estado de aprendizado |

## Pendências bloqueantes por fase

Estas decisões devem ser fechadas no início da respectiva fase, antes de aceitar a implementação do sistema afetado. Não é necessário calibrar F4 para começar a preparação de F0.

| Fase | Decisão/entrega pendente | Evidência para fechar |
| --- | --- | --- |
| F0 | Versões e lockfile, scripts/CI, schemas de mensagens/save, serialização, limites e estratégia transacional | Fixture mínima válida/inválida; testes de pausa, falha, save/load e execução headless |
| F0 | PRNG proposto ainda sem mapeamento de seed completo, derivação de fluxos e vetores | ADR e fixtures de referência; continuação exata no ambiente testado |
| F1 | Escala espacial/temporal, solver hídrico, bordas e alocação de fluxos | Cenário versionado com balanço numérico esperado e tolerâncias prévias |
| F2 | Representação final de plantas, reservas, competição, N ou nutriente abstrato, erosão | Perfis versionados; fixtures de dormência, crescimento, competição, decomposição e transporte |
| F3 | Conversão material/energia, catabolismo, termorregulação, estratégias reprodutivas, doença e disputas | Três perfis contrastantes com orçamentos e ciclos de vida testáveis |
| F4 | Topologia, vetores, recompensas, hiperparâmetros, memória, retenção e orçamento global | Protocolo de experimento reproduzível com baseline e avaliação isolada |
| Transversal | Equipamento de referência, limites de população/memória, navegadores e empacotamento | Medições e matriz de compatibilidade; portabilidade da stack não garante suporte já testado |
| Mods | Schemas e resolver de dependências, colisões de IDs, ordem, versão e limites de conteúdo | Pacote válido/inválido e continuação de save; código arbitrário fora do primeiro escopo |

A escolha de licença do projeto e política de distribuição de conteúdo comunitário também permanece aberta antes de publicação de um SDK de mods. Não atribuir licença a arquivos ou contribuições por inferência.

## Rastreabilidade do escopo natural

| Requisito de domínio | Spec responsável | Verificação planejada |
| --- | --- | --- |
| Tick, RNG, agenda, save e autoridade | 000 e 001 | Partições, pausa, erros e continuação |
| Relevo, clima, luz, água e substrato | 100 | Chuva, seca, encosta, saturação e conversões |
| Nutrientes, reservas vegetais e erosão | 200 | Produção, transporte, deposição e balanços |
| Sementes, crescimento, competição e decomposição | 200 | Dormência, sucessão, morte e mineralização |
| Metabolismo, hidratação, temperatura, descanso e alimentação | 300 | Custos, déficit, consumo e cadáver sem duplicação |
| Reprodução, desenvolvimento, doença, mortalidade e populações | 300 | Ciclo de vida, transmissão, competição e extinção |
| Aprendizado, genoma, mutação e linhagens | 400 | Atualizações, herança, isolamento de avaliação e comparação entre seeds |
| Câmera, inspeção e arte | Documento 06 e specs de cada fase | Projeções sem alterar o mundo; playtest quando existir cliente |

## Evidência e limites desta revisão

- Leitura de todos os arquivos do commit-base e revisão das alterações; verificação dos destinos locais dos links Markdown e fragmentos presentes, além das referências de arquivos canônicos nas skills.
- Resultado da checagem local: 75 links Markdown locais e 24 referências canônicas das skills com destino existente; nenhum fragmento de âncora nos links atuais; zero falhas. `git diff --check` sem erros após corrigir espaços finais nas linhas alteradas.
- Parse do manifesto JSON e validação de frontmatter das seis skills. Isso valida formato, não um schema executável de assets ainda inexistente.
- Conferência das três referências científicas do documento 08 por páginas dos editores/instituição e da referência dos autores do PRNG. A conferência cobre identificação e enquadramento das hipóteses, não revisão sistemática nem reprodução dos artigos. Redirecionamentos DOI indisponíveis na primeira tentativa foram contornados pelas páginas editoriais.
- Referências: [Martin et al.](https://besjournals.onlinelibrary.wiley.com/doi/10.1111/j.2041-210X.2011.00168.x), [Malishev et al.](https://besjournals.onlinelibrary.wiley.com/doi/10.1111/2041-210X.12909), [Aguilar et al.](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0219502), [PRNG dos autores](https://prng.di.unimi.it/).
- O repositório não contém runtime, package.json, schemas executáveis ou suíte de testes. Não foram executados typecheck/build, playtest, ensaios biológicos ou medições de desempenho. As situações descritas nas specs são testes a implementar.

À data daquela revisão, o próximo passo era fechar os contratos de F0 e implementar o mundo vazio reproduzível. A atualização abaixo registra o avanço posterior. Fases humanas continuam condicionadas à evidência do [gate natural](09-roadmap.md).

## Fechamento de F0 — 19/10/2026

SPEC-000 foi implementada: cliente Vite/Phaser, core headless, Worker v1, mundo vazio, PRNG SplitMix64/xoshiro128** 1.1, save/load, schemas, fixtures, lockfile e workflow de CI. O relatório desta seção fecha a aceitação local de F0; não aprova F1 nem o gate natural pré-F5.

`npm ci` instalou 47 pacotes auditados, com zero vulnerabilidades. `npm run check` passou: typecheck, 23 testes em cinco arquivos, verificação da fronteira headless e build de produção. `git diff --check` não reportou problemas. O playtest confirmou criação, avanço manual, 8 ticks/s, pausa aguardando o lote e layout sem overflow horizontal em viewport estreita.

O ensaio Phaser de 120 ticks com seed `0123456789abcdef` carregou o mesmo save inicial para cada perfil. Com o render desligado, avançou 120 ticks e contou zero eventos `postrender`. No ensaio local sem throttling, 30 FPS medidos deram 31 FPS; 60 FPS medidos deram 59,9 e 60 FPS em duas posições/zooms de câmera. Todos os snapshots lógicos canônicos e eventos permaneceram iguais. O harness dev repete o ensaio e marca a execução como reprovada se o browser não sustentar a taxa configurada ou se render/câmera alterarem a simulação. Execuções posteriores no browser embutido foram limitadas a 0–4 FPS e não foram usadas como medição válida; a ocorrência e o resultado válido estão documentados em [f0-presentation-run-2026-10-19.json](evidence/f0-presentation-run-2026-10-19.json).

O baseline headless foi medido no equipamento local: Windows 11 Pro build 26200, Intel Core i3-10105 3,70 GHz, 8 processadores lógicos, 15,9 GiB de RAM, Node 24.19.0 e V8 13.6.233.17. Para `stepWorld(1)`, o mundo vazio mediu p50/p95 de 0,035/0,059 ms; a fixture sintética de 10.000 entidades mediu 26,138/31,624 ms; a de 50.000, 144,098/161,896 ms. A segunda cópia viva do estado de 50.000 entidades aumentou o heap em 5.930.976 bytes. O JSON e a metodologia reproduzível estão em [f0-performance-baseline-2026-10-19.json](evidence/f0-performance-baseline-2026-10-19.json), repetidos por `npm run benchmark:f0`.

F0 fecha para a fundação vazia neste ambiente. O stress test de 50.000 entidades não é uma meta de gameplay nem garante ritmo em tempo real; o resultado exige rever limite de entidades/bytes e estratégia de clone antes de F1. O workflow de CI está configurado e o mesmo comando passou localmente; GitHub Actions remoto não foi disparado porque o trabalho ainda não foi publicado. Não declarar compatibilidade numérica entre plataformas nem desempenho de conteúdo ecológico ainda inexistente.
