---
name: natural-world-systems
description: Implement or review terrain, climate, water, soil, vegetation, or decomposition systems for Spectators-of-Life phases F1–F2.
---

# Natural world systems

Use for ecological and physical simulation work in F1–F2. The current milestone is F0; check the roadmap before treating a phase as active.

## Read the relevant contracts

- docs/09-roadmap.md for phase and gate.
- docs/10-ecologia-e-biologia.md for modeled scope, abstractions, flows, and acceptance scenarios.
- docs/02-simulacao-spec.md for tick order, determinism, events, and persistence.

## Workflow

1. Identify the phase, system, units, update cadence, sources, transfers, sinks, and observable outcomes.
2. Inspect the existing code and data contracts before choosing an implementation. Do not invent unapproved precision or claim scientific calibration.
3. Keep the system independent of Phaser and DOM. Make update order and random draws deterministic and independent of camera visibility or frame rate.
4. Account for stocks and flows. When the model intentionally creates or removes a quantity at boundaries, expose that source or sink in diagnostics.
5. Add a small fixed-seed scenario for the relevant behavior and boundary cases, including limiting conditions such as drought, saturation, unsuitable habitat, or competition as applicable.
6. Expose state and flow in event/inspection data so a player can understand what changed.

## Boundaries

- F1–F2 contain no people, settlements, agriculture, politics, or animal neural controllers.
- Decomposers may be aggregated by cell; do not add microbial individuals unless a task and contract require them.
- Do not respawn organisms or fabricate resources to preserve a preferred population curve.
- Keep procedural visual randomness on a separate seed from ecological randomness.
- Update the domain spec when behavior or assumptions change; label simplifications and unresolved parameters.