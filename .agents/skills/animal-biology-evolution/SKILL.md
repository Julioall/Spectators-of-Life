---
name: animal-biology-evolution
description: Implement or review animal life cycles, food webs, health, online learning, heredity, mutation, or lineage in phases F3–F4.
---

# Animal biology and evolution

Use for animal organisms and their adaptation. Confirm the roadmap phase; F3–F4 follow the natural-world gate and do not include humans.

## Read the relevant contracts

- docs/09-roadmap.md for phase gates.
- docs/10-ecologia-e-biologia.md for species, flows, life cycle, health, and simplifications.
- docs/03-individual-ai-spec.md for genome, body, controller, reward, learning, and inheritance.
- docs/02-simulacao-spec.md for tick order, simultaneous actions, determinism, and saves.

## Workflow

1. Separate species profile, heritable traits, current body state, learned controller, and lineage. Do not conflate genetic inheritance with learned weights.
2. Specify needs, perception limits, legal actions, costs, resource transfers, and failure outcomes before implementing behavior. Keep biomass, usable energy, and water budgets separate; include the costs of maintenance, movement, growth, and reproduction.
3. Resolve contested food and water through a deterministic rule; available stock cannot be consumed twice.
4. Model birth, juvenile development, reproduction cost, aging, disease, injury, death, and detritus transfer as explicit state transitions.
5. For F4 learning, use the current documented candidate only as an experiment: a small MLP with Q-values over legal discrete actions and TD updates. Keep the heuristic baseline and frozen evaluation mode. Do not silently switch between Q-values and policy logits.
6. Bound updates and numerical values; serialize every state needed to continue learning. Test terminal updates, invalid observations, depleted memory, reproduction, and death.
7. Compare frozen, online-learning, and direct weight-transfer conditions across fixed seeds and generations. Test stable and cyclical resources at different rates relative to learning adaptation; report distributions and failures, and do not claim adaptation from one high score.

## Boundaries

- No externally pretrained model, remote inference, ONNX, or deep-learning framework in the initial runtime.
- No reward for merely initiating an action or remaining near food. Separate reward, survival, reproduction, and population metrics.
- No automatic ranking cull or respawn that masks extinction.
- Direct transfer of learned weights is an explicit controller-transfer experiment, not genetic inheritance and not, by itself, evidence for the Baldwin effect.
- Human culture, tribes, jobs, institutions, and politics belong to later phases.