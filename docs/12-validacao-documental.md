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

O baseline headless histórico foi medido no equipamento local: Windows 11 Pro build 26200, Intel Core i3-10105 3,70 GHz, 8 processadores lógicos, 15,9 GiB de RAM, Node 24.19.0 e V8 13.6.233.17. Para `stepWorld(1)`, o mundo vazio mediu p50/p95 de 0,035/0,059 ms; a fixture sintética de 10.000 entidades mediu 26,138/31,624 ms; a de 50.000, 144,098/161,896 ms. A segunda cópia viva do estado de 50.000 entidades aumentou o heap em 5.930.976 bytes. O JSON original está em [f0-performance-baseline-2026-10-19.json](evidence/f0-performance-baseline-2026-10-19.json); a medição com manifesto SPEC-001 está em [spec-001-performance-baseline-2026-10-19.json](evidence/spec-001-performance-baseline-2026-10-19.json). Esses resultados históricos não são repetidos pelo benchmark atual, que usa o cenário natural e separa simulação e snapshot. Use `npm run benchmark:natural`; a renderização Phaser deve ser lida separadamente no painel do navegador.

O benchmark natural, seed `0123456789abcdef`, 80×56 células e 30 dias medidos após aquecimento, registrou P50/P95 de 446,629/524,728 ms por `STEP(4)`, estado de 6.914.410 bytes e P50/P95 de 73,085/89,775 ms para snapshot mais cópia estruturada. Após remover a cópia canônica do estado a cada atualização diária, o P50 headless caiu de 586,689 para 446,629 ms nesta máquina (uma execução por versão). No navegador embutido, quatro avanços manuais produziram um snapshot no tick 4 e nenhum nos três ticks anteriores. A amostra de render foi curta (43 frames) e instável: Phaser 3,3 FPS, render P50/P95 de 60,4/93,3 ms e atualização das camadas de 23,3 ms; não é um baseline representativo nem demonstra 60 FPS. O [relatório reproduzível](evidence/natural-performance-2026-10-20.json) registra separadamente simulação, preparação/cópia do snapshot e render, com essa limitação explícita para a observação do browser.

F0 fecha para a fundação vazia neste ambiente. O stress test de 50.000 entidades não é uma meta de gameplay nem garante ritmo em tempo real; o resultado exige rever limite de entidades/bytes e estratégia de clone antes de F1. No fechamento original, o commit ainda não havia sido publicado e o GitHub Actions remoto não estava confirmado. O commit `d722ec6` foi enviado depois a `main`; o resultado remoto não foi verificado neste relatório. Não declarar compatibilidade numérica entre plataformas nem desempenho de conteúdo ecológico ainda inexistente.

## SPEC-001 — implementação comum disponível em F0

Revisão sobre `d722ec6e31e268a94955bbfb7ffa27be422206a1` mais alterações de trabalho em 19/10/2026. `npm run check` passou: typecheck, 39 testes em seis arquivos, verificação headless em oito arquivos do core e build de produção. A suíte inclui velocidade 1×/8×, agendas com fase e intervalo decorrido, partições `STEP`, save/load de cursor, métricas alimentares de janela conhecida, seeds pareadas e descarte de telemetria sem alteração lógica.

`TickSystem` agora declara `periodTicks` e `phaseOffsetTicks`; cada atualização recebe o intervalo lógico decorrido. O cursor persistido mantém a fase, e o Worker recusa `LOAD` quando a agenda salva diverge do sistema ativo sem substituir o mundo atual. Nenhuma duração real foi atribuída a um tick.

O contrato alimentar usa censo vivo no início de cada transição em `(t0,t1]`, g de matéria seca, tentativas concluídas e pendentes separadas, filtros de espécie/estágio, taxa por 1.000 ticks-indivíduo e `null` com motivo para denominador zero. Contadores agregados são salvos no estado lógico. Funções de análise retornam distribuição por indivíduo e por seed; ainda não há população animal para produzi-los no runtime.

O schema do manifesto de benchmark declara seed, cenário, conteúdo/checksums, cadências, população inicial, aprendizado, duração, unidades, janelas, denominadores e build. Equipamento acompanha apenas medições de desempenho. A comparação valida condições idênticas entre replicações e seeds pareadas quando a condição de aprendizado é o fator experimental.

O [baseline de desempenho com manifestos SPEC-001](evidence/spec-001-performance-baseline-2026-10-19.json) foi repetido com o runtime atualizado. No equipamento registrado, `stepWorld(1)` mediu p50/p95 de 0,029/0,075 ms vazio; 25,467/31,358 ms com 10.000 entidades sintéticas; 148,291/162,554 ms com 50.000. A segunda cópia viva do estado de 50.000 entidades aumentou o heap em 5.804.960 bytes. Continua sendo um ensaio headless sintético, não uma previsão de ecologia ou garantia de 60 FPS.

Na revisão SPEC-001, F1 ainda escolhia calendário e cadências ambientais; F3/F4 conectariam métricas às entidades biológicas e definiriam cadências individuais. O avanço posterior de F1–F2 está registrado abaixo e não substitui os gates naturais.

## Protótipo F1–F2 — 19/10/2026

O cenário versionado `natural:temperate-valley@1.2.0` cria um mapa procedural de 80×56 células de 250 m (20×14 km nominais) com chuva regional persistente, transições de pântano, floresta, pradaria, terra seca e deserto, além de bacias/lago, água superficial/solo, rochas e veios minerais. O Worker cria, avança, salva e retoma esse mapa; a interface Phaser mostra cinco espécies arbóreas, biomas, pedra comum e afloramentos de cobre, ferro, prata e ouro, com inspeção por célula. Saves naturais `1.0.0` e `1.1.0` continuam compatíveis; o cenário vazio continua disponível para o ensaio F0.

Nesta revisão, `npm run typecheck` e `npm run build` passaram. O playtest no navegador criou o mapa 1.2.0, mostrou as regiões de bioma, selecionou uma célula para conferir habitat e fator regional de chuva, e avançou um tick sem erro. Uma geração determinística adicional confirmou os cinco recursos expostos e um save inicial de 6,27 MiB. A suíte automatizada não foi reexecutada. A conferência manual comprova integração e operação básica, não calibração realista, sucessão de longo prazo, todos os cenários quantitativos de SPEC-100/200 nem performance multiplataforma; SPEC-100 e SPEC-200 continuam em revisão, e animais e sociedades não foram adicionados. O build mantém um aviso do Vite para o bundle JavaScript principal acima de 500 KiB.

A revisão seguinte (`natural:temperate-valley@1.3.0`) acrescenta potencial geológico por célula e províncias regionais com veios minerais variáveis. A implementação foi feita, mas ainda não passou pela suíte automatizada nem por validação visual no navegador; portanto, seus resultados não contam como aceite da SPEC-100.

A revisão `natural:temperate-valley@1.4.0` substitui a faixa de elevação diagonal por cristas e vales curvos determinísticos em várias escalas, adiciona sombreado, curvas de nível e inspeção de declive/carga hidráulica, e roteia o escoamento pela menor carga hidráulica local. Typecheck e build passaram nesta revisão; a suíte automatizada e a inspeção visual no navegador ainda não foram realizadas, portanto a mudança não representa aceite da SPEC-100. Saves de `1.0.0` a `1.3.0` continuam aceitos e preservam as regras de escoamento anteriores.

A revisão `natural:temperate-valley@1.5.0` classifica rios e lagos pelo potencial de escoamento acumulado, ponderado por chuva regional, declive e resistência do solo à infiltração. Após a imagem de revisão mostrar canais largos e angulosos e lagos pequenos, os limiares dos rios foram elevados, os canais foram estreitados e suavizados, e as bacias de lago passaram a formar manchas conectadas com contorno curvo, margem rasa e gradação de profundidade mais contida. Células de rio e lago continuam sem coortes arbóreas. Uma amostra diagnóstica de cinco seeds gerou 43–80 células classificadas como rio e lagos de 27–48 células cada.

`npm run typecheck` e `npm run build` passaram; o playtest automatizado não foi executado. A inspeção visual no navegador com seed `0000000000000004` confirmou cursos estreitos e lagos distintos, com margens suavizadas, no zoom inicial. O build mantém o aviso do Vite de bundle acima de 500 KiB. Isso não fecha a SPEC-100: a forma dos corpos d'água é fixa durante a simulação e o escoamento continua sendo uma aproximação D8 local, sem solver do nível dos lagos.

A revisão `natural:temperate-valley@1.7.0` abre saídas de rios e lagos na margem quando não há jusante, registra a descarga no fluxo, nos totais, nas métricas e nos eventos, e conserva o leito fluvial visível quando a lâmina seca. A camada de água ganhou reflexos animados discretos; Relevo deixou de ser apagado pela atualização da vegetação e passou a permanecer visível ao alternar a camada. O ensaio `npm run soak:natural` completou 120 dias em três seeds, com descarga de fronteira positiva e resíduos máximos de balanço hídrico abaixo de 8 m³ acumulados; a suíte completa passou com 63 testes, a fronteira headless foi aprovada em 15 arquivos e o build passou com o aviso conhecido do bundle acima de 500 KiB. Isso melhora a conservação do reservatório e a leitura visual, mas SPEC-100 continua em revisão porque ainda não há solver próprio de nível de lago, cheias regionais ou evento dedicado de seca.

## Regionalização alinhada ao relevo — 20/10/2026

O cenário `natural:temperate-valley@1.9.0` usa um campo derivado do relevo regional para classificar solo, habitat, umidade potencial, potencial mineral e a superfície renderizada. O filtro gaussiano determinístico 5×5 preserva 25% da altitude local e não modifica altitude, declive, escoamento ou erosão. A decisão e seus limites estão em [ADR 0011](adr/0011-regionalizacao-alinhada-ao-relevo.md); a SPEC-100 continua em revisão e não foi aceita.

Validação local: `npm run typecheck`, 80 testes (`npm test -- --run`), `npm run verify:boundary` (17 arquivos headless) e `npm run build` passaram. Um teste também confirma que os contratos de estado das versões 1.7 e 1.8 continuam válidos depois da nova revisão. O build mantém o aviso existente para o bundle JavaScript acima de 500 KiB. A revisão manual no navegador gerou o cenário 1.9.0 com a seed `1ec4ae9c6e383f8a` e mostrou regiões de terreno em faixas maiores, alinhadas com baixadas, vales fluviais e zonas altas; relevo e potencial mineral permaneceram camadas de observação. A conferência foi feita na resolução e zoom iniciais, sem comparação quantitativa entre seeds nem calibração geológica/ecológica. Essa evidência confirma integração visual básica, não valida a SPEC-100 nem garante que todas as seeds tenham o mesmo resultado.

## Integração e alargamento fluvial — 20/10/2026

O cenário `natural:temperate-valley@1.10.0` alarga o leito onde células vizinhas já drenam para canais de maior área contribuinte e nas confluências. A incisão das margens junto a rios aumenta, mas a formação dinâmica de novas células continua condicionada por escoamento, substrato, incisão acumulada e área contribuinte. O renderer liga o rio ao lago por células vizinhas, escala a largura com a bacia contribuinte e desenha uma pequena piscina visual nas confluências; essa piscina não cria um lago lógico. A decisão e os limites estão em [ADR 0012](adr/0012-alargamento-e-confluencia-fluvial.md). A SPEC-100 continua em revisão.

Os testes determinísticos cobrem ligação rio-lago, alargamento relativo a jusante, confluências com mais células fluviais e erosão de margens maior na versão 1.10 que em saves 1.9. A inspeção visual usou a seed fixa `1ec4ae9c6e383f8a` no zoom inicial; ela confirma que o canal se alarga e a saída do lago aparece conectada, mas ainda não calibra a forma hidrológica entre seeds, zooms ou estações.

## Iluminação topográfica procedural — 20/10/2026

O renderer aplica iluminação direcional derivada da elevação às cores do terreno, com direção e intensidade configuráveis. A comparação com o laboratório ASTERRA confirmou que o vetor solar e a fórmula de hillshade são os mesmos; a oclusão continua uma aproximação por amostras de células. Foi adicionada a vista Altitude, que mostra a elevação bruta em rampa hipsométrica contínua e desativa overlays, tornando possível conferir a forma sem hillshade. Com seed fixa `1ec4ae9c6e383f8a`, a inspeção alternou entre essa vista e o terreno natural com iluminação ligada/desligada; a vista mostrou as faixas de altitude e a iluminação alterou a projeção sem avançar o tick (0). A conferência foi visual no zoom inicial, sem calibração de realismo ou comparação quantitativa com o laboratório. O teste determinístico cobre direções cardeais, gradientes e bordas, limites do sombreado, oclusão aproximada, suavização, invalidação de cache e preservação do alpha e da altitude; testes adicionais cobrem extremos e interpolação da rampa hipsométrica. A implementação não altera estado lógico, relevo, câmera top-down, saves ou mensagens do Worker. A técnica representa iluminação visual aproximada, não sombras físicas nem um modelo de iluminação calibrado.

`npm run check` passou: typecheck, 91 testes em 18 arquivos, verificação da fronteira headless em 17 módulos e build de produção. `git diff --check` passou. O build mantém o aviso existente do Vite para o bundle JavaScript principal acima de 500 KiB. A validação visual foi feita no zoom inicial; outras resoluções e dispositivos não foram verificados. A SPEC-100 continua em revisão.

### Revisão da vista Altitude — 20/10/2026

A rampa hipsométrica passou a usar 48% de opacidade e mantém água, vegetação, minérios e iluminação visíveis sob a sobreposição. No navegador, a seed `17360b1723241014` mostrou esses elementos junto às curvas de nível; o mundo permaneceu pausado no tick 0. A camada segue sendo apenas visual e não altera o estado lógico.

### Composição suave de relevo e água — 20/10/2026

Altitude e Relevo agora usam o pincel 5×5 de hillshade e interpolação por pixel sobre a textura do solo; as curvas ainda vêm da elevação original. Uma textura auxiliar de água mistura profundidade e iluminação por amostragem bilinear na máscara molhada e usa feather nas margens. A inspeção visual com Altitude, Relevo e Água ativas confirmou relevo contínuo e rios/lagos coloridos pelo gradiente de luz; a seed foi `2f85efac3c9d280f`, tick 0, mundo pausado. A lógica hídrica e a geometria lógica do mapa não mudaram.

`npm run check` passou nesta revisão: typecheck, 93 testes em 18 arquivos, fronteira headless em 17 módulos e build. O build mantém o aviso conhecido do Vite para o bundle acima de 500 KiB. Foram verificados 114 destinos locais de links Markdown.

## Drenagem de rios e escoamento em cascata — 20/10/2026

O cenário natural `1.11.0` substitui o traçado fluvial planejado por cursos selecionados da acumulação de chuva e ligados pelas direções descendentes do relevo. A chuva agora pode percorrer vários trechos em um mesmo passo; em depressões fechadas, o nível sobe até formar um lago e a água acima da soleira segue para a saída. A camada Água desenha lâminas temporárias como manchas conectadas e suavizadas e mostra caminhos de escoamento com correnteza animada. Saves `1.0.0` a `1.10.0` seguem reconhecidos; os novos enums `1.11.0` estão presentes nos schemas de save e Worker. Ver decisão e limites em [ADR 0014](adr/0014-drenagem-fluvial-guiada-pelo-relevo.md).

Testes determinísticos verificam que cursos permanentes acompanham vizinhos mais baixos até outro corpo d'água ou sumidouro, que uma bacia artificial recebe chuva por múltiplas células em um passo, forma lago e mantém a conservação no passo seguinte. A SPEC-100 continua em revisão; a calibração para várias seeds, zooms e estações permanece pendente.

`npm run check` passou: typecheck, 94 testes em 18 arquivos, fronteira headless aprovada em 17 arquivos e build de produção. `git diff --check` passou; 36 arquivos Markdown tiveram seus destinos locais verificados. O build ainda emite o aviso conhecido do Vite para o chunk principal acima de 500 KiB. A inspeção visual no navegador usou o seed `f508bcde7db23742`, camadas Altitude, Relevo e Água, e confirmou cursos conectados ao longo do terreno após vários dias simulados; não foi uma calibração visual entre múltiplas seeds.

### Suavização da paleta do terreno — 20/10/2026

A paleta base do solo agora recebe o mesmo filtro ponderado 5×5 das camadas topográficas e é interpolada na escala de pixel. O dither entre classes foi removido para evitar faixas abruptas; grãos determinísticos preservam a textura. Altitude e Relevo iniciam ativos, com a legenda visível. A mudança permanece na projeção visual e não modifica classe de terreno, relevo, água nem saves.

`npm run check` passou: typecheck, 97 testes em 18 arquivos, fronteira headless em 17 arquivos e build. O build mantém o aviso existente do Vite para o bundle JavaScript acima de 500 KiB. A inspeção no navegador com o seed `1ec4ae9c6e383f8a` confirmou a paleta suavizada e os controles Altitude e Relevo ativos; o mundo permaneceu no início do ano 1.
