---
name: deterministic-simulation-validation
description: Design, debug, or validate fixed-seed simulation scenarios, invariants, saves, worker messages, and ecology acceptance tests.
---

# Deterministic simulation validation

Use when creating or reviewing tests, scenarios, reproducibility, simulation bugs, or phase-gate evidence.

## Read the relevant contracts

- docs/02-simulacao-spec.md for tick order, state, RNG, invariants, events, and save.
- docs/07-testes-mods-roadmap.md for validation approach.
- docs/09-roadmap.md for the current phase and exact exit criteria.
- docs/10-ecologia-e-biologia.md for ecological scenario expectations.

## Workflow

1. Inspect repository scripts and test framework; use commands that actually exist. Do not assume a runtime or test suite has been implemented.
2. Reduce the issue to a small scenario with a fixed seed, initial state, commands, expected invariant, and tolerance.
3. Verify that camera position, render rate, worker scheduling latency, and entity iteration order do not affect core results.
4. For resource systems, assert bounds and account for sources, transfers, and sinks. Use declared tolerances rather than exact floating-point equality where appropriate.
5. For saves, compare continuation after load and confirm schema/version handling without overwriting the source save.
6. For visual changes, use browser playtest and screenshots when the app exists; test canvas and DOM layers separately.
7. Report evidence with phase, seed, build/revision, population, duration, measured result, and remaining limits.

## Boundaries

- A test should verify a contract or meaningful failure mode, not mirror implementation details.
- Distinguish deterministic guarantees within a tested environment from cross-platform numeric equivalence.
- Extinction or ecological imbalance can be valid outcomes; validate causes and distributions, not one forced trajectory.
- Do not state that a phase gate passed without the corresponding measurements and evidence.