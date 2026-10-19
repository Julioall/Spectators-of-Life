# Testes, mods e referência ao roadmap

## Fonte de verdade

As fases e seus critérios estão exclusivamente em [09-roadmap.md](09-roadmap.md). Este arquivo mantém o caminho original para compatibilidade e concentra qualidade e extensibilidade. Escopo natural obrigatório: [10-ecologia-e-biologia.md](10-ecologia-e-biologia.md).

## Validação contínua

F0: RNG, ticks, protocolo Worker, pausa, avanço e save/load.
F1: água, fontes/perdas, escoamento e cadências.
F2: germinação, limitações ambientais, competição, biomassa e decomposição.
F3: metabolismo, ações simultâneas, reprodução, desenvolvimento, saúde, doença e morte.
F4: aprendizado online, máscara de ação, update terminal, serialização, memória limitada, herança e comparação entre seeds.

O ensaio anual do cenário natural pode ser executado separadamente com `npm run soak:natural`. Ele avança três seeds fixas por quatro estações, registra o pico de bytes do estado/save por estação e mede os resíduos dos balanços de água em m³ e dos estoques mineral e de nitrogênio em unidades totais no mapa, em [natural-soak-2026-10-19.json](evidence/natural-soak-2026-10-19.json). Os limites atuais são 2 m³ por dia e 20 m³ acumulados para água, 1e-7 de erro relativo para massa mineral e 1e-6 para nitrogênio. O estoque mineral aproxima o relevo por uma coluna de densidade configurada e inclui sedimento móvel; não é uma medição geológica calibrada. A suíte curta `npm run check` permanece adequada para regressões cotidianas; o ensaio longo não substitui os cenários de seca, saturação, competição e decomposição requeridos pelo gate F1–F2.

Verificar consumo de recurso disputado, prevenção de nascimento sem custo e causa de extinção. Extinção pode ser resultado legítimo; não maquiar cenários com reposição automática.

Repetir cenários com render desligado e câmera em regiões diferentes: o estado natural deve permanecer equivalente. Saves devem reproduzir a continuação do mundo e do controlador na mesma versão/ambiente testado.

Playtest com screenshots verifica mapa, leitura de fases biológicas, âncora, painel contextual, teclado, janela estreita e reduced-motion. Inspeção e eventos existem desde os primeiros marcos; não esperar sociedades para tornar o mundo compreensível.

60 FPS é meta de apresentação a aferir em equipamento registrado. Reportar separadamente tempo por tick, velocidade efetiva da simulação, população, memória e FPS. Tolerâncias de fluxos são definidas por sistema antes de executar ensaios.

## Mods por capacidade

IDs e schemas são preparados desde F0. Primeiro conteúdo externo: biomas, plantas, fauna e cenários naturais. Conteúdo humano exige os módulos futuros correspondentes.

Manifesto declara versão, dependências e capacidades exigidas; fase de produção sozinha não garante compatibilidade. Loader rejeita módulo ausente, referência inválida e parâmetro fora de limites. Saves registram versões/checksums. Mods data-first não executam código arbitrário.

## Relatórios

Registrar fase, cenário, seed, build, duração, população, resultado, limites do modelo e evidências. Revisões documentais verificam links e consistência; não podem alegar aprovação ecológica ou playtest sem runtime.
