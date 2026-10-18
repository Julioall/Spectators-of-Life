# Roadmap de implementação

Status: planejamento. F0 é o marco atual; nenhuma fase está validada como implementada. Este documento é a fonte de verdade para ordem, escopo e critérios de avanço.

## Regras de progressão

F0–F4 entregam um mundo natural autônomo. O planejamento detalhado de humanos começa após sua validação. Entregas pequenas dentro de cada fase são permitidas. Interfaces, save, diagnóstico e testes acompanham cada fase.

As fases habilitam possibilidades no software. Não são eras automáticas dentro do mundo: regiões podem seguir trajetórias distintas, regredir, coexistir ou desaparecer.

| Fase | Entrega | Critério de saída |
| --- | --- | --- |
| F0 — Fundação | Phaser/TypeScript/Vite, core headless, Worker, seed, tick, save mínimo, contratos e CI | Mundo vazio reproduzível; pausa, avanço, save/load e erro observável |
| F1 — Mundo físico | Relevo, regiões, luz, temperatura, estações, chuva, água superficial e do solo, escoamento e retenção | Fluxos auditáveis; seca e chuva mudam reservas; repetição por seed |
| F2 — Ecologia vegetal | Solo/nutrientes, germinação, crescimento, competição, dispersão, morte, detritos e decomposição agregada | Plantas respondem a habitat; matéria circula; primeiro recorte natural observável sem fauna |
| F3 — Biologia animal | Perfis alimentares, metabolismo, sentidos, movimento, descanso, predação, reprodução, desenvolvimento, envelhecimento, doença simplificada e morte | Ciclo de vida completo; orçamentos explícitos de matéria, energia e água; custos de manutenção, movimento, crescimento e reprodução; recursos finitos; cenários de competição e recuperação |
| F4 — Aprendizado e evolução | Redes individuais online, memória, traços herdáveis, mutação, linhagens, comparação de herança | Experimentos reproduzíveis; ausência de NaN; avaliação entre seeds e gerações; gate natural aprovado |
| F5 — Humanos individuais | Planejamento detalhado humano; necessidades, coleta, abrigo simples, aprendizado, reprodução e cuidado | Humanos sobrevivem sob a mesma ecologia, sem recursos gratuitos nem instituições prontas |
| F6 — Pequenas tribos | Vínculos, comunicação, compartilhamento, acampamento, cuidado coletivo, migração, conflito local e práticas aprendidas | Grupos se formam, persistem ou se separam por interações; conhecimento é transmitido e pode se perder |
| F7 — Aldeias e especialização | Cultivo, armazenamento, ferramentas, construção persistente, trocas e divisão de trabalho | Produção tem trabalho, sazonalidade e perdas; especialização depende de suporte material |
| F8 — Cidades e Estados | Profissões estáveis, instituições, leis, governança, diplomacia, defesa e logística | Instituições têm regras, custos, acesso, efeitos e eventos observáveis |
| F9 — Impérios e política complexa | Expansão, administração regional, tributos, sucessão, legitimidade, rebelião e fragmentação | Dominação exige logística e manutenção; conflitos e colapsos são explicáveis sem ascensão obrigatória |

## Gate natural antes de F5

- Todos os sistemas obrigatórios de [10-ecologia-e-biologia.md](10-ecologia-e-biologia.md) possuem cenário e evidência.
- Pelo menos dois habitats, duas formas vegetais e três perfis de fauna exercitam produção, consumo e decomposição.
- Reprodução, desenvolvimento, doença simplificada, mortalidade e reciclagem funcionam sem humanos.
- Aprendizado online, traços genéticos e transferência experimental de pesos têm métricas separadas e limites numéricos.
- Comparar rede sem atualização, aprendizagem online sem transferência de pesos e transferência direta; testar recursos estáveis e ciclos sazonais em ritmos diferentes da adaptação da rede, conforme [08-pesquisa-e-validacao.md](08-pesquisa-e-validacao.md).
- Seca, excesso de chuva, escassez, pressão de predação e recuperação têm resultados auditáveis.
- Rodar ao menos cinco seeds por dez ciclos sazonais e cinco gerações da espécie de teste de ciclo curto; esse é um piso de verificação funcional, não base suficiente para alegações gerais. Ampliar replicações conforme a variabilidade e reportar distribuições para comparações de F4.
- Extinções são registradas e explicadas, nunca ocultadas por respawn automático.
- Save/load reproduz continuação e mantém aprendizado; inspeção mostra causas e fluxos.
- Registrar equipamento, build, população, tempo por tick, memória e FPS. 60 FPS é meta visual no desktop de referência a ser escolhido, não medição já obtida.

Aprovação registra seeds, resultados, simplificações, falhas e decisão de avanço. Sistemas científicos adicionais não incluídos no escopo podem continuar como expansão posterior.

## Trilhas contínuas

Arte procedural e diversidade visual, UI contextual, acessibilidade, compatibilidade de saves, testes e performance acompanham F0–F9. Schemas e IDs preparados para mods desde F0; primeiro pacote de conteúdo natural validado pode aparecer em F4. Ferramentas públicas e SDK comunitário evoluem depois da estabilização dos contratos.
