---
name: human-societies-progression
description: Plan or implement human survival, tribes, settlements, professions, states, or imperial politics in roadmap phases F5–F9.
---

# Human societies progression

Use only for explicitly requested planning/design of human systems or implementation in F5–F9. First inspect whether the natural-world gate has been approved in docs/09-roadmap.md.

## Read the relevant contracts

- docs/09-roadmap.md for phase, gate evidence, and progression.
- docs/01-ai-gdd.md for spectator experience and social scope.
- docs/02-simulacao-spec.md for deterministic state, event, and module rules.
- docs/03-individual-ai-spec.md for biological, learned, and cultural state.
- docs/04-arquitetura-e-integracao.md for module dependencies.

## Workflow

1. If the natural gate is not explicitly evidenced, restrict work to requested high-level design, questions, or backlog preparation. Do not implement people or social systems.
2. Add one stage at a time: F5 individual survival; F6 small tribes; F7 cultivation/storage/early specialization; F8 cities and states; F9 imperial administration and political complexity.
3. Make every capability require its material, ecological, informational, and social prerequisites. Human needs and mortality continue to depend on the same world.
4. Separate biological inheritance, individual learning, social transmission, and institutional rules in state and metrics.
5. Keep alternatives viable: groups may remain small, migrate, split, regress, coexist, or disappear. Do not force a civilization timer or make empire the winning path.
6. Emit inspectable events and costs for cooperation, production, authority, conflict, expansion, taxation, revolt, and fragmentation.
7. Update schemas, saves, mods, tests, and UI contracts for each added module; never imply a later-stage system exists before it is implemented.

## Boundaries

- The user's ecological-first order overrides convenience or generic strategy-game templates.
- No social system should be a hard dependency of natural simulation.
- Professions are acquired and sustained socially, not encoded as inherited castes.
- Do not use the phrase “natural selection” to imply moral superiority or an inevitable imperial endpoint.