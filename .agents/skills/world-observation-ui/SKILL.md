---
name: world-observation-ui
description: Design or implement the Phaser map, camera, overlays, inspection panels, timeline controls, and responsive observation UI.
---

# World observation UI

Use for map rendering, camera/input behavior, HUD, contextual inspection, overlays, and browser presentation.

## Read the relevant contracts

- docs/04-arquitetura-e-integracao.md for simulation/render boundaries and worker protocol.
- docs/06-assets-ui-tracker.md for visual hierarchy, observation surfaces, and responsive rules.
- docs/01-ai-gdd.md for player role and current feature scope.
- docs/09-roadmap.md for which world modules currently exist.

## Workflow

1. Keep Phaser scenes thin: project simulation snapshots into visuals and send typed commands through one boundary.
2. Keep durable state in the simulation. Sprites, tweens, camera, and DOM are disposable view state.
3. Use canvas for the world and DOM/CSS for text-heavy, accessible panels and controls. Use stable manifest keys.
4. Build one primary game screen with the map as its dominant surface and a compact persistent HUD. Open an expandable, dismissible contextual inspector only after selecting a cell or entity; do not use a permanent side dashboard as the main layout. Keep detailed lineage, brain, resource, and event data inside that contextual layer. Show only data supported by the active phase; natural phases must not display empty human or political interfaces. On narrow screens, adapt the inspector to a bottom sheet while keeping the map visible.
5. Derive animation from simulation state; do not create a second UI-only truth about entity behavior.
6. Map input centrally. Selection, pause, speed, camera pan/zoom, and modal focus must not compete.
7. Validate desktop and narrow viewports, keyboard, focus, pause, reduced motion, map readability, and screenshots when a runnable app exists.

## Phase boundaries

F1–F2 emphasize terrain, climate, water, soil, plants, and ecological flows. F3–F4 add fauna, health, and lineages. Do not display empty human politics, professions, or settlement panels before their modules exist.