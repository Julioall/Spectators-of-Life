# Documentação de Spectators-of-Life

Estado: F0 validado localmente; protótipo F1–F2 em revisão. Implementação parcial não significa gate de fase aprovado nem calibração ecológica.

## Ordem de leitura

[Visão](00-visao-e-principios.md) → [GDD](01-ai-gdd.md) → [Roadmap](09-roadmap.md) → [Ecologia e biologia](10-ecologia-e-biologia.md) → contratos de simulação, indivíduo e arquitetura.

| Documento | Responsabilidade |
| --- | --- |
| [00 — Visão](00-visao-e-principios.md) | Pilares e progressão da proposta |
| [01 — AI-GDD](01-ai-gdd.md) | Experiência e recortes jogáveis |
| [02 — Simulação](02-simulacao-spec.md) | Ticks, estado, fluxos, eventos e save |
| [03 — Indivíduo e IA](03-individual-ai-spec.md) | Corpo, percepção, aprendizado e herança |
| [04 — Arquitetura](04-arquitetura-e-integracao.md) | Fronteiras e dependências entre módulos |
| [05 — Prompt Bible](05-prompt-bible.md) | Tarefas de IA com escopo por fase |
| [06 — Assets e UI](06-assets-ui-tracker.md) | Arte procedural, inspeção e prioridades |
| [07 — Testes e mods](07-testes-mods-roadmap.md) | Evidências e compatibilidade |
| [08 — Pesquisa](08-pesquisa-e-validacao.md) | Hipóteses; ainda sem resultados validados |
| [09 — Roadmap](09-roadmap.md) | Única fonte de fases F0–F9 e gates |
| [10 — Ecologia e biologia](10-ecologia-e-biologia.md) | Escopo natural obrigatório e abstrações |
| [11 — Skills de agentes](11-agent-skills.md) | Roteamento de skills focadas para tarefas de desenvolvimento por IA |
| [Specs de implementação](specs/README.md) | Contratos verificáveis para F0–F4, tempo lógico, métricas e critérios de aceite |

## Specs de implementação

O índice em [specs/README.md](specs/README.md) acompanha o avanço do roadmap. SPEC-000 está validada localmente, SPEC-001 implementa contratos comuns e SPEC-100/200 têm implementação inicial ligada ao cenário de referência.

[AGENTS.md](../AGENTS.md) orienta agentes e [CONTRIBUTING.md](../CONTRIBUTING.md) contribuições. [ADRs](adr/) registram decisões; [ADR 0005](adr/0005-mundo-natural-primeiro.md) formaliza natureza antes de humanos, [ADR 0006](adr/0006-prng-f0.md) fecha os geradores determinísticos de F0 e [ADR 0007](adr/0007-ui-contextual-tela-unica.md) define a tela única com inspeção contextual.

F0–F4 entregam mundo natural autônomo. F5–F6 introduzem humanos e tribos. F7–F9 ampliam para especialização, Estados e impérios. Progressão de produção não impõe uma trajetória social a toda população.

[Contratos de dados](../data/schemas/README.md) F0 são versionados e têm fixtures. O cenário natural já tem validação runtime; schemas JSON específicos para cada sistema F1/F2 e seus critérios completos de aceite ainda estão pendentes. O renderer usa os atlases de cinco espécies de árvores e de rochas/minérios; as referências de autotiling em `data/assets/environment/` continuam fora do runtime.

## Revisão documental

[12 — Validação documental e pendências](12-validacao-documental.md) registra cobertura, correções, prontidão por fase e evidências exigidas antes da implementação.
