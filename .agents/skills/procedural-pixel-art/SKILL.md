---
name: procedural-pixel-art
description: Create or integrate code-drawn pixel-art terrain, plants, animals, structures, and animation for the game's asset pipeline.
---

# Procedural pixel art

Use when drawing assets directly in code or integrating pixel-art sprites and animation into the world.

## Read the relevant contracts

- docs/06-assets-ui-tracker.md for visual direction, anchors, tracker, and manifest.
- data/assets/manifest.json for current planned asset keys and status.
- docs/09-roadmap.md to prioritize assets for the active phase.

## Workflow

1. Inspect the existing renderer, palette, geometry helpers, and asset manifest before introducing a new drawing path.
2. Keep shape/palette/frame data separate from simulation rules. Drawing must be reproducible from a visual seed that cannot change world RNG.
3. Preserve strong top-down silhouettes, limited palette families, stable baselines/anchors, and readable states at the camera's actual zoom.
4. Treat a 64-pixel grid as a common detail reference, not a maximum size or mandatory footprint. Compose large resources and buildings from parts or cells with explicit pivots, occupied footprint, and selection bounds.
5. Derive animation from organism state. Maintain the same silhouette, scale, and anchor across frames; make the action readable at game scale.
6. Add or update a manifest entry only when its implementation exists. Record dimensions, anchor, status, source, and license honestly.
7. Preview representative states in the game and check pixel alignment, palette, scale, occlusion, and selection footprint.

## Boundaries

- The production base is pixel art drawn procedurally in code; generated images may inform reference only when requested.
- Never let cosmetic variety alter ecological traits or simulation randomness.
- Do not describe a planned manifest entry as integrated.