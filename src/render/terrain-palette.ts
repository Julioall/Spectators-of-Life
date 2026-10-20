import type { NaturalWorldCellState, NaturalWorldEntity } from '../core/natural/types';
import { buildLandformElevationField } from '../core/natural/topography';
import { sampleCellFieldBilinear, smoothCellField } from './terrain-lighting';
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

export type TerrainPaletteField = {
  width: number;
  height: number;
  red: Float32Array;
  green: Float32Array;
  blue: Float32Array;
};

/** Smooths only render colors; terrain classes and simulation values remain unchanged. */
export function smoothTerrainPaletteField(width: number, height: number, surfaces: readonly TerrainSurface[]): TerrainPaletteField {
  const validDimensions = Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0;
  const cellCount = validDimensions ? width * height : 0;
  const red = new Float32Array(cellCount);
  const green = new Float32Array(cellCount);
  const blue = new Float32Array(cellCount);
  if (!validDimensions || surfaces.length !== cellCount) {
    return { width: 0, height: 0, red, green, blue };
  }
  for (let index = 0; index < cellCount; index += 1) {
    const color = TERRAIN_SURFACE_COLORS[surfaces[index] ?? 'loam'];
    red[index] = (color >>> 16) & 0xff;
    green[index] = (color >>> 8) & 0xff;
    blue[index] = color & 0xff;
  }
  return {
    width,
    height,
    red: smoothCellField(width, height, red),
    green: smoothCellField(width, height, green),
    blue: smoothCellField(width, height, blue),
  };
}

/** Samples a palette field at cell coordinates for pixel-scaled terrain rendering. */
export function sampleTerrainPaletteColor(field: TerrainPaletteField, x: number, y: number): number {
  const red = Math.round(sampleCellFieldBilinear(field.width, field.height, field.red, x, y));
  const green = Math.round(sampleCellFieldBilinear(field.width, field.height, field.green, x, y));
  const blue = Math.round(sampleCellFieldBilinear(field.width, field.height, field.blue, x, y));
  return (red << 16) | (green << 8) | blue;
}

const ALTITUDE_MAP_STOPS = [0x254d45, 0x467852, 0x719754, 0xa9a565, 0x9b7c68, 0xe0dec9] as const;
export const ALTITUDE_MAP_OVERLAY_ALPHA = 0.48;

/** Continuous hypsometric ramp for inspecting raw elevation over the natural map. */
export function altitudeMapColor(relativeElevation: number): number {
  const relative = Number.isFinite(relativeElevation) ? clamp(relativeElevation, 0, 1) : 0;
  const scaled = relative * (ALTITUDE_MAP_STOPS.length - 1);
  const startIndex = Math.min(ALTITUDE_MAP_STOPS.length - 2, Math.floor(scaled));
  const fraction = scaled - startIndex;
  const start = ALTITUDE_MAP_STOPS[startIndex]!;
  const end = ALTITUDE_MAP_STOPS[startIndex + 1]!;
  const red = mixChannel((start >>> 16) & 0xff, (end >>> 16) & 0xff, fraction);
  const green = mixChannel((start >>> 8) & 0xff, (end >>> 8) & 0xff, fraction);
  const blue = mixChannel(start & 0xff, end & 0xff, fraction);
  return (red << 16) | (green << 8) | blue;
}

export function terrainSurface(cell: NaturalWorldCellState, minimum: number, maximum: number, landformElevationM = cell.terrain.elevationM): TerrainSurface {
  const relative = (landformElevationM - minimum) / Math.max(1, maximum - minimum);
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

export type TerrainContext = { minimumElevation: number; maximumElevation: number; landformElevations: number[] };

export function terrainContext(world: NaturalWorldEntity): TerrainContext {
  const elevations = world.cells.map((cell) => cell.terrain.elevationM);
  return {
    minimumElevation: Math.min(...elevations),
    maximumElevation: Math.max(...elevations),
    landformElevations: buildLandformElevationField(world.width, world.height, elevations),
  };
}

export function terrainSurfaceField(world: NaturalWorldEntity, minimum: number, maximum: number): TerrainSurface[] {
  const landforms = buildLandformElevationField(world.width, world.height, world.cells.map((cell) => cell.terrain.elevationM));
  return world.cells.map((cell) => terrainSurface(cell, minimum, maximum, landforms[cell.index] as number));
}

/** Maps the project's displayed surface to the closest original ASTERRA palette family. */
export function asterraTerrainForSurface(surface: TerrainSurface, bedrock: NaturalWorldCellState['terrain']['bedrock']): AsterraTerrain {
  if (bedrock === 'basalt') return 'volcanic';
  if (surface === 'rock' || surface === 'highland' || surface === 'upland') return 'mountain';
  if (surface === 'wetland') return 'coast';
  if (surface === 'desert' || surface === 'dryland' || surface === 'sand') return 'dry';
  return 'grass';
}

function mixChannel(start: number, end: number, fraction: number): number {
  return Math.round(start + (end - start) * fraction);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
