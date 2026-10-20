import type { NaturalWorldCellState, NaturalWorldEntity } from '../core/natural/types';
import type { AsterraTerrain } from './asterra/engine.js';

export type TerrainSurface = 'loam' | 'sand' | 'clay' | 'rock' | 'upland' | 'highland' | 'wetland' | 'woodland' | 'meadow' | 'dryland' | 'desert';

/** Base colors shared by the terrain renderer and the rock palette adapter. */
export const TERRAIN_SURFACE_COLORS: Record<TerrainSurface, number> = {
  loam: 0x87965d,
  sand: 0xb4a06c,
  clay: 0x8f8861,
  rock: 0x85836f,
  upland: 0x9ca274,
  highland: 0xb3aa88,
  wetland: 0x607653,
  woodland: 0x73865a,
  meadow: 0x91a46a,
  dryland: 0xa99a62,
  desert: 0xc89a54,
};

export function terrainSurface(cell: NaturalWorldCellState, minimum: number, maximum: number): TerrainSurface {
  const relative = (cell.terrain.elevationM - minimum) / Math.max(1, maximum - minimum);
  if (cell.terrain.soilType === 'rock' || cell.terrain.exposedRock) return 'rock';
  if (relative > 0.88) return 'highland';
  if (relative > 0.74) return 'upland';
  if (cell.terrain.habitat === 'wetland') return 'wetland';
  if (cell.terrain.habitat === 'desert') return 'desert';
  if (cell.terrain.habitat === 'dryland') return 'dryland';
  if (cell.terrain.habitat === 'woodland') return 'woodland';
  if (cell.terrain.habitat === 'meadow') return 'meadow';
  if (cell.terrain.soilType === 'sand') return 'sand';
  if (cell.terrain.soilType === 'clay') return 'clay';
  return 'loam';
}

export function terrainContext(world: NaturalWorldEntity): { minimumElevation: number; maximumElevation: number } {
  const elevations = world.cells.map((cell) => cell.terrain.elevationM);
  return { minimumElevation: Math.min(...elevations), maximumElevation: Math.max(...elevations) };
}

/** Maps the project's displayed surface to the closest original ASTERRA palette family. */
export function asterraTerrainForSurface(surface: TerrainSurface, bedrock: NaturalWorldCellState['terrain']['bedrock']): AsterraTerrain {
  if (bedrock === 'basalt') return 'volcanic';
  if (surface === 'rock' || surface === 'highland' || surface === 'upland') return 'mountain';
  if (surface === 'wetland') return 'coast';
  if (surface === 'desert' || surface === 'dryland' || surface === 'sand') return 'dry';
  return 'grass';
}
