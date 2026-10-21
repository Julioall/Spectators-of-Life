import type { MineralDepositState, MineralId, NaturalWorldCellState, NaturalWorldEntity } from '../../../../core/natural/types';
import {
  TILE, biomeProfiles, chooseRarity, drawOutcrop, footprintAt, hash, outcropSize,
  rarityProfiles, rng, sizeProfile, weightedChoice,
  type RockBiome, type RockDeposit, type RockFamily, type RockGeology, type RockMaterial, type RockSettings,
  type RockSizeProfile, type RockTerrain,
} from './legacy-engine.js';
import { createRockSettings } from './legacy-settings';
import { rockTerrainForSurface, terrainContext, terrainSurface, TERRAIN_SURFACE_COLORS, type TerrainContext as SurfaceTerrainContext } from '../../../../render/terrain-palette';

export { TILE as ROCK_NATIVE_CELL_SIZE } from './legacy-engine.js';
export type RockFootprint = { x: number; y: number; width: number; height: number };
export type ProceduralRock = {
  resourceId: MineralId;
  source: 'ore' | 'surface' | 'scatter';
  xCell: number;
  yCell: number;
  footprint: RockFootprint;
  deposit: RockDeposit;
  settings: RockSettings;
  /** Escala visual da formação original; a simulação continua usando a pegada nativa. */
  visualScale: number;
  raster: { width: number; height: number; anchorX: number; anchorY: number };
};

/** Cells occupied by the logical footprint of formations large enough to block trees. */
export function treeBlockingCellsForRocks(rocks: readonly ProceduralRock[], worldWidth: number, worldHeight: number): Set<number> {
  const blocked = new Set<number>();
  for (const rock of rocks) {
    if (rock.deposit.tier !== 'large' && rock.deposit.tier !== 'macro') continue;
    const startX = Math.max(0, rock.footprint.x);
    const endX = Math.min(worldWidth, rock.footprint.x + rock.footprint.width);
    const startY = Math.max(0, rock.footprint.y);
    const endY = Math.min(worldHeight, rock.footprint.y + rock.footprint.height);
    for (let y = startY; y < endY; y += 1) {
      for (let x = startX; x < endX; x += 1) blocked.add(y * worldWidth + x);
    }
  }
  return blocked;
}

/** Returns whether a rendered formation would occupy a water cell. */
export function rockTouchesWater(world: NaturalWorldEntity, rock: Pick<ProceduralRock, 'xCell' | 'yCell' | 'footprint' | 'deposit' | 'visualScale'>): boolean {
  const size = outcropSize(rock.deposit);
  const visualMargin = 0.25;
  if (footprintTouchesWater(world, rock.footprint)) return true;
  const left = rock.xCell - (size.w * 0.50 * rock.visualScale) / TILE - visualMargin;
  const right = rock.xCell + (size.w * 0.50 * rock.visualScale) / TILE + visualMargin;
  const top = rock.yCell - (size.h * 0.87 * rock.visualScale) / TILE - visualMargin;
  const bottom = rock.yCell + (size.h * 0.13 * rock.visualScale) / TILE + visualMargin;
  const startX = Math.max(0, Math.floor(left));
  const endX = Math.min(world.width - 1, Math.ceil(right) - 1);
  const startY = Math.max(0, Math.floor(top));
  const endY = Math.min(world.height - 1, Math.ceil(bottom) - 1);
  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const cell = cellAt(world, x, y);
      if (cell !== undefined && isWaterCell(cell)) return true;
    }
  }
  return false;
}

const MATERIALS: Record<MineralId, RockMaterial> = {
  stone: 'pedra', copper: 'cobre', iron: 'ferro', silver: 'prata', gold: 'ouro',
};
type ProtectedOreMaterial = 'cobre' | 'ferro' | 'prata' | 'ouro';
const ORE_PALETTES: Record<ProtectedOreMaterial, Array<[number, number, number]>> = {
  cobre: [[111, 74, 47], [181, 111, 58], [216, 150, 88], [123, 100, 77], [122, 154, 119]],
  ferro: [[78, 61, 54], [122, 91, 73], [161, 119, 94], [109, 92, 80], [139, 79, 56]],
  prata: [[95, 99, 104], [143, 152, 161], [195, 204, 212], [112, 119, 128], [215, 220, 225]],
  ouro: [[108, 88, 34], [185, 147, 31], [235, 201, 76], [138, 117, 56], [255, 240, 160]],
};
const GRAY_TERRAIN_TARGETS: Record<'mountain' | 'volcanic', [number, number, number]> = {
  mountain: [TERRAIN_SURFACE_COLORS.rock >> 16 & 0xff, TERRAIN_SURFACE_COLORS.rock >> 8 & 0xff, TERRAIN_SURFACE_COLORS.rock & 0xff],
  volcanic: [82, 79, 77],
};
const ORE_PROTECTED_DISTANCE = 24;
const NEIGHBORS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const;
const CARDINAL_NEIGHBORS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
const PLACEMENT_OFFSETS = [
  [0, 0], [0, -1], [1, 0], [-1, 0], [0, 1],
  [1, -1], [-1, -1], [1, 1], [-1, 1], [0, -2], [0, 2], [2, 0], [-2, 0],
] as const;
const CADENCE: Record<RockBiome, { oreCellsPerRock: number; surfaceCellsPerRock: number; maxSurfaceChance: number }> = {
  temperate: { oreCellsPerRock: 10, surfaceCellsPerRock: 6, maxSurfaceChance: 0.52 },
  desert: { oreCellsPerRock: 13, surfaceCellsPerRock: 7, maxSurfaceChance: 0.42 },
  alpine: { oreCellsPerRock: 8, surfaceCellsPerRock: 5, maxSurfaceChance: 0.68 },
  volcanic: { oreCellsPerRock: 7, surfaceCellsPerRock: 5, maxSurfaceChance: 0.76 },
  coastal: { oreCellsPerRock: 10, surfaceCellsPerRock: 6, maxSurfaceChance: 0.54 },
};

type PlacementRole = 'core' | 'companion' | 'scatter';

type RockCandidate = {
  cell: NaturalWorldCellState;
  physicalGrade?: number;
  neighbors: number;
  cardinalNeighbors: number;
  cohesion: number;
  transition: number;
};

type TerrainContext = SurfaceTerrainContext;

/** Adapts exposed world deposits to original rock-engine descriptors without touching world state. */
export function generateProceduralRocks(world: NaturalWorldEntity, visualSeed: number): ProceduralRock[] {
  const terrainContext = terrainContextFor(world);
  const ores = new Map<number, MineralDepositState>();
  for (const cell of world.cells) {
    const visible = cell.minerals.filter((deposit) => deposit.resourceId !== 'stone' && deposit.exposed && deposit.reserveKg > 0);
    const best = visible.reduce<MineralDepositState | undefined>((current, candidate) => current === undefined || mineralRank(candidate) > mineralRank(current) ? candidate : current, undefined);
    if (best !== undefined) ores.set(cell.index, best);
  }
  const occupied = new Uint8Array(world.width * world.height);
  const placements: ProceduralRock[] = [];
  for (const component of oreComponents(world, ores)) {
    const candidates = component.map(({ cell, deposit }) => candidateFor(world, cell, deposit.grade, 'ore', ores));
    placeComponent(placements, occupied, world, candidates, component.length, 'ore', visualSeed, terrainContext);
  }
  const surface = new Map<number, NaturalWorldCellState>();
  for (const cell of world.cells) {
    if (!cell.terrain.exposedRock || ores.has(cell.index)) continue;
    const biome = biomeFor(cell);
    const cadence = CADENCE[biome];
    const localRock = localNeighborCount(world, cell, (neighbor) => neighbor.terrain.exposedRock && !ores.has(neighbor.index));
    const localScore = (localRock.neighbors + localRock.cardinalNeighbors * 0.7) / (NEIGHBORS.length + CARDINAL_NEIGHBORS.length * 0.7);
    const regionAffinity = rockRegionAffinityForCell(world, cell, visualSeed);
    if (regionAffinity <= 0) continue;
    const chance = Math.min(cadence.maxSurfaceChance, (0.10 + cell.terrain.slope * 0.20 + (cell.terrain.mineralPotential ?? 0) * 0.13)
      * (0.42 + localScore * 0.68) * (0.56 + regionAffinity * 0.54));
    if (rng(hash(cell.x, cell.y, visualSeed + 47))() < chance) surface.set(cell.index, cell);
  }
  for (const component of cellComponents(world, surface)) {
    const candidates = component.map((cell) => candidateFor(world, cell, undefined, 'surface', surface));
    placeComponent(placements, occupied, world, candidates, component.length, 'surface', visualSeed, terrainContext);
  }
  const scatter = new Map<number, NaturalWorldCellState>();
  for (const cell of world.cells) {
    if (ores.has(cell.index) || isWaterCell(cell)) continue;
    const biome = biomeFor(cell);
    const localRock = localNeighborCount(world, cell, (neighbor) => neighbor.terrain.exposedRock);
    const rockySupport = cell.terrain.exposedRock ? 1 : localRock.neighbors / NEIGHBORS.length;
    const dryness = dryRockAffinity(cell);
    const gravelAffinity = gravelAffinityForCell(world, cell);
    const regionAffinity = rockRegionAffinityForCell(world, cell, visualSeed);
    if (regionAffinity <= 0) continue;
    const chance = Math.min(0.11, 0.002 + CADENCE[biome].maxSurfaceChance * 0.022 + rockySupport * 0.028
      + dryness * 0.026 + (cell.terrain.mineralPotential ?? 0) * 0.012 + regionAffinity * 0.072 + gravelAffinity * 0.10);
    if (rng(hash(cell.x, cell.y, visualSeed + 147))() < chance) scatter.set(cell.index, cell);
  }
  for (const component of cellComponents(world, scatter)) {
    const candidates = component.map((cell) => candidateFor(world, cell, undefined, 'scatter', scatter));
    placeComponent(placements, occupied, world, candidates, component.length, 'scatter', visualSeed, terrainContext);
  }
  return placements.sort((a, b) => a.yCell - b.yCell || a.xCell - b.xCell || a.deposit.seed - b.deposit.seed);
}

function placeComponent(
  placements: ProceduralRock[], occupied: Uint8Array, world: NaturalWorldEntity,
  candidates: RockCandidate[], componentSize: number, source: ProceduralRock['source'], visualSeed: number,
  terrainContext: TerrainContext,
): void {
  if (candidates.length === 0) return;
  const biome = biomeFor(candidates[0]!.cell);
  const cadence = CADENCE[biome];
  const cellsPerRock = source === 'ore' ? cadence.oreCellsPerRock : cadence.surfaceCellsPerRock;
  const target = source === 'scatter'
    ? Math.min(12, Math.max(1, Math.ceil(componentSize / 2)))
    : Math.min(18, Math.max(1, Math.ceil(componentSize / cellsPerRock)));
  const remaining = [...candidates];
  const selected: RockCandidate[] = [];
  for (let slot = 0; slot < target && remaining.length > 0; slot += 1) {
    remaining.sort((a, b) => candidateScore(b, selected, visualSeed) - candidateScore(a, selected, visualSeed));
    let placed = false;
    while (remaining.length > 0) {
      const candidate = remaining.shift()!;
      const resourceId = source === 'ore' ? mineralAt(candidate.cell) : 'stone';
      if (resourceId === undefined) continue;
      const before = placements.length;
      if (addPlacement(
        placements, occupied, world, candidate.cell, resourceId, source, candidate.physicalGrade,
        visualSeed, source === 'ore' ? 101 : source === 'scatter' ? 147 : 83,
        candidate.cohesion, candidate.transition, terrainContext, source === 'scatter' ? 'scatter' : 'core',
      )) {
        selected.push(candidate);
        const placedRock = placements[before];
        if (placedRock !== undefined && (placedRock.deposit.tier === 'large' || placedRock.deposit.tier === 'macro')) {
          placeCompanions(
            placements, occupied, world, candidate.cell, source === 'ore' ? 'ore' : 'surface', resourceId,
            visualSeed, terrainContext, placedRock.deposit.tier === 'macro' ? 5 : 3,
          );
        }
        placed = true;
        break;
      }
    }
    if (!placed) break;
  }
}

function addPlacement(
  placements: ProceduralRock[], occupied: Uint8Array, world: NaturalWorldEntity,
  cell: NaturalWorldCellState, resourceId: MineralId, source: ProceduralRock['source'],
  physicalGrade: number | undefined, visualSeed: number, salt: number, cohesion: number, transition: number,
  terrainContext: TerrainContext, role: PlacementRole,
): boolean {
  const material = MATERIALS[resourceId];
  const biome = biomeFor(cell);
  const settings = createRockSettings(
    biome,
    material,
    geologyFor(cell),
    visualSeed,
    terrainPaletteFor(cell, terrainContext),
    mossMultiplierForHabitat(cell.terrain.habitat),
  );
  const random = rng(hash(cell.x, cell.y, visualSeed + salt));
  const rarity = chooseRarity(random, settings.rarity);
  const gradeRange = rarityProfiles[rarity].grade;
  const grade = physicalGrade ?? Number((gradeRange[0] + random() * (gradeRange[1] - gradeRange[0])).toFixed(3));
  const family = chooseRockFamily(random, settings.biome, cell);
  const variant = hash(cell.x * TILE, cell.y * TILE, visualSeed + 191) % 5;
  const requestedProfile = sizeProfile(family, grade, variant, random,
    Math.min(0.95, settings.macroRate * (0.32 + cohesion * 0.68) * (rarity === 'epic' ? 1.55 : rarity === 'rare' ? 1.20 : 1)));
  const visual = progressionProfile(family, variant, requestedProfile, cohesion, transition, source, role, cell, visualSeed);
  const profile = visual.profile;
  const rect = footprintAt(0, 0, { family, grade, rarity, tier: profile.tier, tilesW: profile.tilesW, tilesH: profile.tilesH });
  if (rect.w > world.width || rect.h > world.height) return false;
  const initialX = Math.max(0, Math.min(world.width - rect.w, Math.round(cell.x + 0.5 - rect.w * 0.5)));
  const initialY = Math.max(0, Math.min(world.height - rect.h, cell.y + 1 - rect.h));
  let selected: {
    x: number; y: number; footprint: RockFootprint; nativeX: number; nativeY: number;
    deposit: RockDeposit; raster: ProceduralRock['raster'];
  } | undefined;
  for (const [offsetX, offsetY] of PLACEMENT_OFFSETS) {
    const x = Math.max(0, Math.min(world.width - rect.w, initialX + offsetX));
    const y = Math.max(0, Math.min(world.height - rect.h, initialY + offsetY));
    const footprint = { x, y, width: rect.w, height: rect.h };
    if (!canOccupy(occupied, world.width, footprint) || footprintTouchesWater(world, footprint)) continue;
    // Same native-cell anchor and seed formula as depositData in the original engine.
    const nativeX = Math.round((x + rect.w * 0.5) * TILE);
    const nativeY = Math.round((y + rect.h) * TILE - 1);
    const deposit: RockDeposit = {
      id: placements.length + 1, x: nativeX, y: nativeY,
      seed: hash(nativeX, nativeY, visualSeed + 87), grade, rarity,
      material, geology: geologyFor(cell), biome: settings.biome,
      family, forma: family, variant, tier: profile.tier,
      tilesW: rect.w, tilesH: rect.h, satellites: profile.satellites,
      macro: profile.macro, large: profile.large,
    };
    const raster = rockRasterBounds(deposit);
    if (rockTouchesWater(world, {
      xCell: nativeX / TILE, yCell: nativeY / TILE, footprint, deposit, visualScale: visual.scale,
    })) continue;
    selected = { x, y, footprint, nativeX, nativeY, deposit, raster };
    break;
  }
  if (selected === undefined) return false;
  const { x, y, footprint, nativeX, nativeY, deposit, raster } = selected;
  for (let row = y; row < y + rect.h; row += 1) {
    for (let column = x; column < x + rect.w; column += 1) occupied[row * world.width + column] = 1;
  }
  placements.push({
    resourceId, source, xCell: nativeX / TILE, yCell: nativeY / TILE,
    footprint, deposit, settings, visualScale: visual.scale, raster,
  });
  return true;
}

function placeCompanions(
  placements: ProceduralRock[], occupied: Uint8Array, world: NaturalWorldEntity,
  anchor: NaturalWorldCellState, source: 'ore' | 'surface', resourceId: MineralId,
  visualSeed: number, terrainContext: TerrainContext, count: number,
): void {
  const surfaceCells = new Map<number, NaturalWorldCellState>();
  const oreCells = new Map<number, MineralDepositState>();
  const nearby: Array<{ cell: NaturalWorldCellState; distance: number }> = [];
  for (let dy = -4; dy <= 4; dy += 1) {
    for (let dx = -4; dx <= 4; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const cell = cellAt(world, anchor.x + dx, anchor.y + dy);
      if (cell === undefined || isWaterCell(cell)) continue;
      if (source === 'ore') {
        const deposit = cell.minerals.find((candidate) => candidate.resourceId === resourceId && candidate.exposed && candidate.reserveKg > 0);
        if (deposit === undefined) continue;
        oreCells.set(cell.index, deposit);
      } else {
        if (!cell.terrain.exposedRock || mineralAt(cell) !== undefined) continue;
        surfaceCells.set(cell.index, cell);
      }
      nearby.push({ cell, distance: Math.max(Math.abs(dx), Math.abs(dy)) });
    }
  }
  const sourceCells = source === 'ore' ? oreCells : surfaceCells;
  nearby.sort((left, right) => left.distance - right.distance
    || hash(left.cell.x, left.cell.y, visualSeed + 277) - hash(right.cell.x, right.cell.y, visualSeed + 277));
  let added = 0;
  for (const { cell } of nearby) {
    if (added >= count) break;
    const physicalGrade = source === 'ore' ? oreCells.get(cell.index)?.grade : undefined;
    const candidate = candidateFor(world, cell, physicalGrade, source, sourceCells);
    const before = placements.length;
    if (addPlacement(
      placements, occupied, world, cell, resourceId, source, candidate.physicalGrade,
      visualSeed, 271 + added, candidate.cohesion, candidate.transition, terrainContext, 'companion',
    )) {
      if (placements.length > before) {
        added += 1;
      }
    }
  }
}

function candidateFor(
  world: NaturalWorldEntity, cell: NaturalWorldCellState, physicalGrade: number | undefined,
  source: 'ore' | 'surface' | 'scatter', sourceCells: Map<number, MineralDepositState> | Map<number, NaturalWorldCellState>,
): RockCandidate {
  const neighbors = localNeighborCount(world, cell, (neighbor) => {
    if (source === 'ore') return (sourceCells as Map<number, MineralDepositState>).get(neighbor.index)?.resourceId === mineralAt(cell);
    return (sourceCells as Map<number, NaturalWorldCellState>).has(neighbor.index);
  });
  const cohesion = Math.min(1, (neighbors.neighbors + neighbors.cardinalNeighbors * 0.7) / (NEIGHBORS.length + CARDINAL_NEIGHBORS.length * 0.7));
  const rockLike = localNeighborCount(world, cell, (neighbor) => neighbor.terrain.exposedRock || sourceCells.has(neighbor.index));
  const transition = Math.min(1, ((NEIGHBORS.length - rockLike.neighbors) / NEIGHBORS.length) * 0.72 + (1 - cohesion) * 0.28);
  return {
    cell,
    ...(physicalGrade === undefined ? {} : { physicalGrade }),
    neighbors: neighbors.neighbors,
    cardinalNeighbors: neighbors.cardinalNeighbors,
    cohesion,
    transition,
  };
}

function candidateScore(candidate: RockCandidate, selected: RockCandidate[], visualSeed: number): number {
  const spread = selected.length === 0 ? 0.5 : Math.min(...selected.map((other) => Math.max(Math.abs(candidate.cell.x - other.cell.x), Math.abs(candidate.cell.y - other.cell.y)))) / 12;
  const tie = rng(hash(candidate.cell.x, candidate.cell.y, visualSeed + 701))();
  return candidate.cohesion * 2.2 + candidate.cardinalNeighbors * 0.16 + spread * 0.16 + tie * 0.02;
}

function cadenceProfile(family: RockFamily, variant: number, requested: RockSizeProfile, cohesion: number): RockSizeProfile {
  if (requested.tier === 'macro' && cohesion < 0.48) return sizeProfile(family, 0.64, variant, () => 0, 0);
  if ((requested.tier === 'large' || requested.tier === 'macro') && cohesion < 0.22) return sizeProfile(family, 0.46, variant, () => 0.99, 0);
  return requested;
}

function progressionProfile(
  family: RockFamily, variant: number, requested: RockSizeProfile, cohesion: number, transition: number,
  source: ProceduralRock['source'], role: PlacementRole, cell: NaturalWorldCellState, visualSeed: number,
): { profile: RockSizeProfile; scale: number } {
  if (role === 'scatter') {
    const roll = rng(hash(cell.x, cell.y, visualSeed + 363))();
    return roll < 0.38
      ? { profile: forcedProfile(family, variant, 'small'), scale: 0.42 }
      : { profile: forcedProfile(family, variant, 'small'), scale: 0.60 };
  }
  if (role === 'companion') {
    const roll = rng(hash(cell.x, cell.y, visualSeed + 343))();
    if (roll < 0.46) return { profile: forcedProfile(family, variant, 'small'), scale: 0.56 };
    if (roll < 0.82) return { profile: forcedProfile(family, variant, 'small'), scale: 0.78 };
    return { profile: forcedProfile(family, variant, 'normal'), scale: 0.90 };
  }
  const profile = cadenceProfile(family, variant, requested, cohesion);
  const pressure = Math.min(1, transition * 0.74 + (1 - cohesion) * 0.26);
  const roll = rng(hash(cell.x, cell.y, visualSeed + 303))();
  const tinyChance = (source === 'surface' ? 0.22 : 0.13) * pressure;
  const smallChance = tinyChance + (source === 'surface' ? 0.44 : 0.30) * pressure;
  const mediumChance = smallChance + (source === 'surface' ? 0.18 : 0.12) * pressure;
  if (roll < tinyChance) return { profile: forcedProfile(family, variant, 'small'), scale: 0.56 };
  if (roll < smallChance) return { profile: forcedProfile(family, variant, 'small'), scale: 0.78 };
  if (roll < mediumChance && (profile.tier === 'large' || profile.tier === 'macro')) {
    return { profile: forcedProfile(family, variant, 'normal'), scale: 0.94 };
  }
  return { profile, scale: profile.tier === 'small' ? 0.82 : 1 };
}

function chooseRockFamily(random: () => number, biome: RockBiome, cell: NaturalWorldCellState): RockFamily {
  const families = biomeProfiles[biome].families;
  const dryLocale = biome === 'desert' || biome === 'volcanic'
    || cell.terrain.habitat === 'desert' || cell.terrain.habitat === 'dryland';
  if (dryLocale) return weightedChoice(random, families);
  const rounded = families.filter(([family]) => !isPointedFamily(family));
  return weightedChoice(random, rounded.length > 0 ? rounded : families);
}

function isPointedFamily(family: RockFamily): boolean {
  return family === 'shard' || family === 'column';
}

function dryRockAffinity(cell: NaturalWorldCellState): number {
  if (cell.terrain.habitat === 'desert') return 1;
  if (cell.terrain.habitat === 'dryland') return 0.88;
  if (cell.terrain.soilType === 'sand' && cell.terrain.habitat !== 'wetland') return 0.68;
  if (cell.terrain.bedrock === 'basalt' && cell.terrain.habitat !== 'wetland') return 0.58;
  if (cell.terrain.habitat === 'upland') return 0.22;
  return 0.08;
}

function isWaterCell(cell: NaturalWorldCellState): boolean {
  return cell.terrain.waterBody === 'lake' || cell.terrain.waterBody === 'river' || cell.water.surfaceMm > 18;
}

function footprintTouchesWater(world: NaturalWorldEntity, footprint: RockFootprint): boolean {
  const endX = Math.min(world.width, footprint.x + footprint.width);
  const endY = Math.min(world.height, footprint.y + footprint.height);
  for (let y = Math.max(0, footprint.y); y < endY; y += 1) {
    for (let x = Math.max(0, footprint.x); x < endX; x += 1) {
      const cell = cellAt(world, x, y);
      if (cell !== undefined && isWaterCell(cell)) return true;
    }
  }
  return false;
}

/** Scores cells where runoff, channels or deposited sediment naturally collect gravel. */
export function gravelAffinityForCell(world: NaturalWorldEntity, cell: NaturalWorldCellState): number {
  const runoff = (cell.water.lastFlows.runoffOutMm ?? 0) + (cell.water.lastFlows.runoffInMm ?? 0);
  const mineralErosion = cell.soil.lastMineralErosionKgPerM2 ?? 0;
  const organicErosion = cell.soil.lastErosionGPerM2;
  const incision = cell.terrain.channelIncisionM ?? 0;
  const sediment = cell.soil.sedimentLoadKgPerM2 ?? 0;
  const flow = Math.min(1, runoff / 3.2);
  const erosion = Math.min(1, mineralErosion / 0.24 + organicErosion / 18);
  const channel = Math.min(1, incision / 0.08);
  const load = Math.min(1, sediment / 0.45);
  const riverNeighbors = localNeighborCount(world, cell, (neighbor) => neighbor.terrain.waterBody === 'river' || neighbor.water.surfaceMm > 18).neighbors;
  const path = Math.min(1, riverNeighbors / 3.5);
  return Math.min(1, Math.max(path * 0.86, flow * 0.72, erosion * 0.78, channel * 0.92, load * 0.62));
}

/** Creates coherent rocky regions from exposed-rock support and a coarse deterministic field. */
export function rockRegionAffinityForCell(world: NaturalWorldEntity, cell: NaturalWorldCellState, visualSeed: number): number {
  const localRock = localNeighborCount(world, cell, (neighbor) => neighbor.terrain.exposedRock);
  const neighborSupport = localRock.neighbors / NEIGHBORS.length;
  const structural = cell.terrain.exposedRock ? 0.42 + neighborSupport * 0.58 : neighborSupport;
  const gravel = gravelAffinityForCell(world, cell);
  if (structural < 0.125 && gravel < 0.52) return 0;
  const blockX = Math.floor(cell.x / 8);
  const blockY = Math.floor(cell.y / 8);
  let regionalNoise = 0;
  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      regionalNoise += rng(hash(blockX + offsetX, blockY + offsetY, visualSeed + 601))();
    }
  }
  regionalNoise /= 9;
  const microNoise = rng(hash(Math.floor(cell.x / 3), Math.floor(cell.y / 3), visualSeed + 631))();
  const patch = regionalNoise * 0.72 + microNoise * 0.28;
  if (structural < 0.70 && gravel < 0.52 && patch < 0.46) return 0;
  return Math.min(1, structural * 0.72 + patch * 0.28 + gravel * 0.22);
}

function forcedProfile(family: RockFamily, variant: number, tier: 'small' | 'normal' | 'large'): RockSizeProfile {
  if (tier === 'small') return sizeProfile(family, 0.35, variant, () => 0.99, 0);
  if (tier === 'large') return sizeProfile(family, 0.64, variant, () => 0, 0);
  return sizeProfile(family, 0.50, variant, () => 0, 0);
}

function mineralAt(cell: NaturalWorldCellState): MineralId | undefined {
  const deposit = cell.minerals.find((candidate) => candidate.resourceId !== 'stone' && candidate.exposed && candidate.reserveKg > 0);
  return deposit?.resourceId;
}

function localNeighborCount(
  world: NaturalWorldEntity, cell: NaturalWorldCellState, predicate: (neighbor: NaturalWorldCellState) => boolean,
): { neighbors: number; cardinalNeighbors: number } {
  let neighbors = 0;
  let cardinalNeighbors = 0;
  for (const [dx, dy] of NEIGHBORS) {
    const neighbor = cellAt(world, cell.x + dx, cell.y + dy);
    if (neighbor !== undefined && predicate(neighbor)) neighbors += 1;
  }
  for (const [dx, dy] of CARDINAL_NEIGHBORS) {
    const neighbor = cellAt(world, cell.x + dx, cell.y + dy);
    if (neighbor !== undefined && predicate(neighbor)) cardinalNeighbors += 1;
  }
  return { neighbors, cardinalNeighbors };
}

function cellComponents(world: NaturalWorldEntity, cells: Map<number, NaturalWorldCellState>): NaturalWorldCellState[][] {
  const unvisited = new Set(cells.keys());
  const components: NaturalWorldCellState[][] = [];
  while (unvisited.size > 0) {
    const index = Math.min(...unvisited);
    const first = cells.get(index);
    unvisited.delete(index);
    if (first === undefined) continue;
    const component = [first];
    const queue = [first];
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor]!;
      for (const [dx, dy] of NEIGHBORS) {
        const neighbor = cellAt(world, current.x + dx, current.y + dy);
        if (neighbor === undefined || !unvisited.has(neighbor.index)) continue;
        unvisited.delete(neighbor.index);
        queue.push(neighbor);
        component.push(neighbor);
      }
    }
    components.push(component);
  }
  return components;
}

function cellAt(world: NaturalWorldEntity, x: number, y: number): NaturalWorldCellState | undefined {
  if (x < 0 || x >= world.width || y < 0 || y >= world.height) return undefined;
  return world.cells[y * world.width + x];
}

function terrainContextFor(world: NaturalWorldEntity): TerrainContext {
  return terrainContext(world);
}

function terrainPaletteFor(cell: NaturalWorldCellState, context: TerrainContext): RockTerrain {
  const surface = terrainSurface(cell, context.minimumElevation, context.maximumElevation, context.landformElevations[cell.index]);
  return rockTerrainForSurface(surface, cell.terrain.bedrock);
}

/** Envelope adds transparent room for the original drawOutcrop satellites and burial. */
export function rockRasterBounds(deposit: RockDeposit): ProceduralRock['raster'] {
  const size = outcropSize(deposit);
  const anchorX = Math.ceil(size.w * 0.68 + 8);
  const anchorY = Math.ceil(size.h * 0.87 + 8);
  return { width: anchorX * 2, height: Math.ceil(size.h * 1.10 + 20), anchorX, anchorY };
}

/** Delegates all pixels to the untouched engine, preserving native coordinates and scale. */
export function drawProceduralRock(context: CanvasRenderingContext2D, rock: ProceduralRock): void {
  context.clearRect(0, 0, rock.raster.width, rock.raster.height);
  context.save();
  context.imageSmoothingEnabled = false;
  context.translate(rock.raster.anchorX - rock.deposit.x, rock.raster.anchorY - rock.deposit.y);
  drawOutcrop(context, rock.deposit, rock.settings);
  context.restore();
  applyAmbientRockPalette(context, rock);
}

/** Returns the habitat moss boost used by the adapter while leaving the engine untouched. */
export function mossMultiplierForHabitat(habitat: NaturalWorldCellState['terrain']['habitat']): number {
  if (habitat === 'woodland') return 2.25;
  if (habitat === 'wetland') return 1.65;
  if (habitat === 'meadow') return 1.20;
  return 1;
}

/**
 * Ambientizes only the geological base of a gray terrain. Ore colors and green moss
 * remain intact so a gold, copper, iron or silver vein keeps its original palette identity.
 */
export function ambientRockColor(
  color: readonly [number, number, number],
  terrain: RockTerrain,
  material: RockMaterial | 'mixed',
): [number, number, number] {
  if (terrain !== 'mountain' && terrain !== 'volcanic') return [...color] as [number, number, number];
  if (material !== 'pedra' && isProtectedOreColor(color, material)) return [...color] as [number, number, number];
  if (isMossColor(color)) return [...color] as [number, number, number];
  const target = GRAY_TERRAIN_TARGETS[terrain];
  const luminance = 0.299 * color[0] + 0.587 * color[1] + 0.114 * color[2];
  const targetLuminance = Math.max(1, 0.299 * target[0] + 0.587 * target[1] + 0.114 * target[2]);
  const scale = luminance / targetLuminance;
  const strength = terrain === 'mountain' ? 0.44 : 0.32;
  const [red, green, blue] = color;
  const [targetRed, targetGreen, targetBlue] = target;
  return [
    Math.round(red * (1 - strength) + Math.min(255, targetRed * scale) * strength),
    Math.round(green * (1 - strength) + Math.min(255, targetGreen * scale) * strength),
    Math.round(blue * (1 - strength) + Math.min(255, targetBlue * scale) * strength),
  ];
}

function applyAmbientRockPalette(context: CanvasRenderingContext2D, rock: ProceduralRock): void {
  if (rock.settings.terrain !== 'mountain' && rock.settings.terrain !== 'volcanic') return;
  const image = context.getImageData(0, 0, rock.raster.width, rock.raster.height);
  const pixels = image.data;
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3]! < 115) continue;
    const next = ambientRockColor(
      [pixels[index]!, pixels[index + 1]!, pixels[index + 2]!],
      rock.settings.terrain,
      rock.settings.material,
    );
    pixels[index] = next[0];
    pixels[index + 1] = next[1];
    pixels[index + 2] = next[2];
  }
  context.putImageData(image, 0, 0);
}

function isProtectedOreColor(color: readonly [number, number, number], material: RockMaterial | 'mixed'): boolean {
  const palette = material === 'cobre' || material === 'ferro' || material === 'prata' || material === 'ouro'
    ? ORE_PALETTES[material]
    : undefined;
  if (palette === undefined) return false;
  return palette.some((ore) => {
    const dr = color[0] - ore[0], dg = color[1] - ore[1], db = color[2] - ore[2];
    return Math.sqrt(dr * dr + dg * dg + db * db) <= ORE_PROTECTED_DISTANCE;
  });
}

function isMossColor(color: readonly [number, number, number]): boolean {
  return color[1] > color[0] + 7 && color[1] > color[2] + 2;
}

function biomeFor(cell: NaturalWorldCellState): RockBiome {
  if (cell.terrain.habitat === 'desert' || cell.terrain.habitat === 'dryland') return 'desert';
  if (cell.terrain.habitat === 'upland') return 'alpine';
  if (cell.terrain.bedrock === 'basalt') return 'volcanic';
  if (cell.terrain.habitat === 'wetland') return 'coastal';
  return 'temperate';
}

function geologyFor(cell: NaturalWorldCellState): RockGeology {
  return cell.terrain.bedrock === 'sedimentary' ? 'sandstone' : cell.terrain.bedrock;
}

function canOccupy(occupied: Uint8Array, width: number, footprint: RockFootprint): boolean {
  for (let y = footprint.y; y < footprint.y + footprint.height; y += 1) {
    for (let x = footprint.x; x < footprint.x + footprint.width; x += 1) if (occupied[y * width + x] !== 0) return false;
  }
  return true;
}

function mineralRank(deposit: MineralDepositState): number {
  return (deposit.sizeClass === undefined ? 0 : ({ trace: 0, small: 1, medium: 2, large: 3 } as const)[deposit.sizeClass] * 0.32)
    + deposit.grade + Math.log1p(deposit.reserveKg) * 0.01;
}

function oreComponents(world: NaturalWorldEntity, ores: Map<number, MineralDepositState>): Array<Array<{ cell: NaturalWorldCellState; deposit: MineralDepositState }>> {
  const unvisited = new Set(ores.keys());
  const components: Array<Array<{ cell: NaturalWorldCellState; deposit: MineralDepositState }>> = [];
  while (unvisited.size > 0) {
    const index = Math.min(...unvisited);
    const first = world.cells[index];
    const deposit = ores.get(index);
    unvisited.delete(index);
    if (first === undefined || deposit === undefined) continue;
    const component = [{ cell: first, deposit }];
    const queue = [first];
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor]!;
      for (const [dx, dy] of NEIGHBORS) {
        const x = current.x + dx;
        const y = current.y + dy;
        if (x < 0 || x >= world.width || y < 0 || y >= world.height) continue;
        const neighborIndex = y * world.width + x;
        const neighborDeposit = ores.get(neighborIndex);
        const neighbor = world.cells[neighborIndex];
        if (neighbor === undefined || neighborDeposit?.resourceId !== deposit.resourceId || !unvisited.has(neighborIndex)) continue;
        unvisited.delete(neighborIndex);
        queue.push(neighbor);
        component.push({ cell: neighbor, deposit: neighborDeposit });
      }
    }
    components.push(component);
  }
  return components;
}
