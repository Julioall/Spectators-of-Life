import { drawFromSystem } from '../rng';
import type { RandomState } from '../types';
import { NATURAL_SCENARIO, validateNaturalScenarioParameters, type MineralVeinProfile, type SoilProfile } from './parameters';
import { buildLandformElevationField } from './topography';
import type { BedrockId, NaturalWorldCellState, NaturalWorldEntity, PlantCohortState, PlantSpeciesId, SoilTypeId, TreeSpeciesId, WaterBodyId } from './types';

const NEIGHBORS = [
  [-1, -1, Math.SQRT2], [0, -1, 1], [1, -1, Math.SQRT2],
  [-1, 0, 1], [1, 0, 1],
  [-1, 1, Math.SQRT2], [0, 1, 1], [1, 1, Math.SQRT2],
] as const;
const UINT32_RANGE = 0x1_0000_0000;

export function generateNaturalWorld(seed: string, rng: RandomState): NaturalWorldEntity {
  validateNaturalScenarioParameters();
  const { world, terrain, climate, soil, minerals } = NATURAL_SCENARIO;
  const totalCells = world.width * world.height;
  const terrainStreamId = 'terrain:generation';
  const vegetationStreamId = 'vegetation:initialization';
  const noise = buildElevationField(world.width, world.height, rng, seed, terrainStreamId);
  const geologyField = buildSpatialField(world.width, world.height, rng, seed, 'geology:regional', [
    { columns: 3, rows: 3, weight: 0.62 },
    { columns: 8, rows: 6, weight: 0.30 },
    { columns: 16, rows: 12, weight: 0.08 },
  ]);
  const mineralPotentialField = buildSpatialField(world.width, world.height, rng, seed, 'geology:mineral-potential', [
    { columns: 3, rows: 2, weight: 0.64 },
    { columns: 7, rows: 5, weight: 0.28 },
    { columns: 15, rows: 11, weight: 0.08 },
  ]);
  const normalizedMineralPotential = normalizeField(mineralPotentialField);
  const soilField = buildSpatialField(world.width, world.height, rng, seed, 'geology:soil', [
    { columns: 4, rows: 3, weight: 0.58 },
    { columns: 10, rows: 8, weight: 0.32 },
    { columns: 20, rows: 16, weight: 0.10 },
  ]);
  const moistureField = buildSpatialField(world.width, world.height, rng, seed, 'climate:moisture-regions', [
    { columns: 3, rows: 2, weight: 0.68 },
    { columns: 7, rows: 5, weight: 0.25 },
    { columns: 14, rows: 10, weight: 0.07 },
  ]);
  const rainfallField = buildSpatialField(world.width, world.height, rng, seed, 'climate:rainfall-regions', [
    { columns: 3, rows: 2, weight: 0.68 },
    { columns: 7, rows: 5, weight: 0.25 },
    { columns: 14, rows: 10, weight: 0.07 },
  ]);
  const rainfallFactors = normalizeRainfallField(rainfallField);
  const woodlandField = buildSpatialField(world.width, world.height, rng, seed, 'ecology:woodland-regions', [
    { columns: 4, rows: 3, weight: 0.64 },
    { columns: 8, rows: 6, weight: 0.28 },
    { columns: 16, rows: 12, weight: 0.08 },
  ]);
  const minimum = Math.min(...noise);
  const maximum = Math.max(...noise);
  const elevations = noise.map((value) => {
    const normalized = (value - minimum) / Math.max(1e-9, maximum - minimum);
    return round1(terrain.minimumElevationM + normalized * (terrain.maximumElevationM - terrain.minimumElevationM));
  });

  const landformElevations = buildLandformElevationField(world.width, world.height, elevations);
  let flowTo = buildFlowDirections(world.width, world.height, elevations, world.cellSizeM);
  let basinIds = findBasins(flowTo);
  let basinSizes = countBasins(basinIds);
  let { bedrock, soilTypes, slopes } = buildSurfaceFields(
    world.width, world.cellSizeM, elevations, landformElevations, flowTo, basinIds, basinSizes,
    rainfallFactors, geologyField, soilField, moistureField, terrain.minimumElevationM, terrain.maximumElevationM, totalCells,
  );
  let runoff = buildRunoffAccumulation(flowTo, elevations, rainfallFactors, soilTypes, slopes);
  const riverNetwork: RiverNetworkPlan = {
    cells: findPersistentRiverCells(flowTo, runoff.contributingCells, runoff.runoffPotential, new Set(), terrain.riverRunoffThreshold),
    downstream: new Map(),
  };
  const lakeCandidates = [...basinSizes.entries()]
    .filter(([basinId, size]) => size >= 20
      && (elevations[basinId] as number) <= terrain.maximumElevationM * 0.74
      && (runoff.runoffPotential[basinId] as number) >= terrain.lakeRunoffThreshold)
    .sort((left, right) => (runoff.runoffPotential[right[0]] as number) - (runoff.runoffPotential[left[0]] as number)
      || (elevations[left[0]] as number) - (elevations[right[0]] as number)
      || left[0] - right[0]);
  if (lakeCandidates.length === 0) {
    const fallback = [...basinSizes.entries()]
      .filter(([basinId, size]) => size >= 12 && (elevations[basinId] as number) <= terrain.maximumElevationM * 0.74)
      .sort((left, right) => (runoff.runoffPotential[right[0]] as number) - (runoff.runoffPotential[left[0]] as number)
        || (elevations[left[0]] as number) - (elevations[right[0]] as number))[0];
    if (fallback !== undefined) lakeCandidates.push(fallback);
  }
  const selectedLakes = lakeCandidates.slice(0, 3);
  const lakeSurfaceElevation = [...elevations];
  const lakeCells = new Set<number>();
  const lakeRecords: LakeRoutingRecord[] = [];
  for (const [basinId, basinSize] of selectedLakes) {
    const basinCells = basinIds.map((candidateBasin, index) => candidateBasin === basinId ? index : -1)
      .filter((index) => index >= 0)
      .sort((left, right) => (elevations[left] as number) - (elevations[right] as number) || left - right);
    const meanCatchmentRunoff = (runoff.runoffPotential[basinId] as number) / Math.max(1, basinSize);
    const spillRiseM = 2.5 + clamp(meanCatchmentRunoff * 5, 1, 9);
    const targetLakeCells = Math.min(basinSize, Math.max(18, Math.min(48, Math.ceil(Math.sqrt(basinSize) * 2.8))));
    const basinLakeCells = growLakeFootprint(basinId, basinCells, targetLakeCells, elevations, world.width);
    const highestLakeBedM = Math.max(...basinLakeCells.map((index) => elevations[index] as number));
    const spillElevation = Math.max((elevations[basinId] as number) + spillRiseM, highestLakeBedM + 0.15);
    lakeRecords.push({ basinId, size: basinSize, cells: basinLakeCells, spillElevation });
    for (const index of basinLakeCells) {
      lakeCells.add(index);
      lakeSurfaceElevation[index] = spillElevation;
    }
  }
  if (connectLakesToDrainage(lakeRecords, lakeCells, lakeSurfaceElevation, elevations, riverNetwork, world.width, world.height, terrain.maximumElevationM)) {
    flowTo = buildFlowDirections(world.width, world.height, elevations, world.cellSizeM);
    for (const [from, to] of riverNetwork.downstream) {
      if ((elevations[from] as number) > (elevations[to] as number)) flowTo[from] = to;
    }
    basinIds = findBasins(flowTo);
    basinSizes = countBasins(basinIds);
    ({ bedrock, soilTypes, slopes } = buildSurfaceFields(
      world.width, world.cellSizeM, elevations, landformElevations, flowTo, basinIds, basinSizes,
      rainfallFactors, geologyField, soilField, moistureField, terrain.minimumElevationM, terrain.maximumElevationM, totalCells,
    ));
    runoff = buildRunoffAccumulation(flowTo, elevations, rainfallFactors, soilTypes, slopes);
  }
  const waterBodies = new Array<WaterBodyId>(totalCells).fill('none');
  for (const index of lakeCells) waterBodies[index] = 'lake';
  const persistentRiverCells = findPersistentRiverCells(
    flowTo,
    runoff.contributingCells,
    runoff.runoffPotential,
    lakeCells,
    terrain.riverRunoffThreshold,
  );
  const widenedRiverCells = widenRiverChannels(world.width, world.height, flowTo, runoff.contributingCells, persistentRiverCells, lakeCells);
  for (let index = 0; index < totalCells; index += 1) {
    if (waterBodies[index] !== 'lake' && widenedRiverCells.has(index)) waterBodies[index] = 'river';
  }
  const riparianCells = findRiparianCells(world.width, world.height, waterBodies, slopes);

  const cells: NaturalWorldCellState[] = [];
  const elevationRange = Math.max(1, terrain.maximumElevationM - terrain.minimumElevationM);
  for (let index = 0; index < totalCells; index += 1) {
    const x = index % world.width;
    const y = Math.floor(index / world.width);
    const heightM = elevations[index] as number;
    const downstream = flowTo[index] as number;
    const gradient = slopes[index] as number;
    const soilProfile = terrain.soilTypes.find((profile) => profile.id === soilTypes[index]) as SoilProfile;
    const exposedRock = soilProfile.id === 'rock' || gradient > 0.45;
    const hostBedrock = bedrock[index] as BedrockId;
    const landformElevationM = landformElevations[index] as number;
    const relativeRelief = clamp((landformElevationM - terrain.minimumElevationM) / elevationRange, 0, 1);
    const upliftProspectivity = smooth(clamp((relativeRelief - 0.22) / 0.55, 0, 1));
    const slopeProspectivity = clamp(gradient / 0.3, 0, 1);
    const hostRockProspectivity = hostBedrock === 'sedimentary' ? 0.34 : 1;
    const exposureProspectivity = exposedRock ? 1 : 0.35;
    const basinId = basinIds[index] as number;
    const waterBody = waterBodies[index] as WaterBodyId;
    const isLake = waterBody === 'lake';
    const spillElevation = lakeSurfaceElevation[index] as number;
    const lakeDepth = Math.max(terrain.lakeSurfaceWaterMm, (spillElevation - heightM) * 1000);
    const riverDepth = terrain.riverSurfaceWaterMm + Math.min(1_450, Math.log1p(Math.max(0, runoff.runoffPotential[index] as number)) * 165);
    const surfaceWaterMm = isLake ? round1(Math.min(25_000, lakeDepth)) : waterBody === 'river' ? round1(riverDepth) : 0;
    const rainfallFactor = rainfallFactors[index] as number;
    const moisturePotential = clamp(0.43 + (rainfallFactor - 1) * 0.29 + (1 - relativeRelief) * 0.2 + ((moistureField[index] as number) - 0.5) * 0.2 + (basinSizes.get(basinId) ?? 1) / totalCells * 0.66, 0, 1);
    const moistureFactor = clamp(0.4 + moisturePotential * 0.35 + rainfallFactor * 0.25 - gradient * 0.3, 0.35, 1.15);
    const soilWaterMm = round3(soilProfile.waterCapacityMm * terrain.initialWaterTableFraction * moistureFactor);
    const season = climate.seasonalForcing[0]!;
    const temperatureC = round2(season.temperatureC - heightM * 0.0065);
    const solarMjPerM2Day = round2(season.solarMjPerM2Day * clamp(1 - gradient * 1.8, 0.58, 1));
    const relativeHumidity = round3(clamp(season.relativeHumidity + (rainfallFactor - 1) * 0.18 + (moisturePotential - 0.5) * 0.18, 0.16, 0.97));
    const soilId = soilProfile.id;
    const mineralNitrogen = rangeDraw(rng, seed, 'soil:initialization', soil.initialMineralNitrogenGPerM2);
    const organicMatter = rangeDraw(rng, seed, 'soil:initialization', soil.initialOrganicMatterGPerM2);
    const organicNitrogen = rangeDraw(rng, seed, 'soil:initialization', soil.initialOrganicNitrogenGPerM2);
    const detritus = rangeDraw(rng, seed, 'soil:initialization', soil.initialDetritusGPerM2);
    const detritusNitrogen = rangeDraw(rng, seed, 'soil:initialization', soil.initialDetritusNitrogenGPerM2);
    const vegetationDraw = nextFloat(rng, seed, vegetationStreamId);
    const cell: NaturalWorldCellState = {
      index,
      x,
      y,
      terrain: {
        elevationM: heightM,
        slope: round4(gradient),
        flowTo: downstream,
        basinId,
        bedrock: hostBedrock,
        soilType: soilId,
        habitat: initialHabitat({
          isLake: waterBody !== 'none',
          isRiparian: riparianCells.has(index),
          relativeElevation: relativeRelief,
          slope: gradient,
          moisturePotential,
          rainfallFactor,
          basinWetness: (basinSizes.get(basinId) ?? 1) / totalCells,
          woodlandPotential: (woodlandField[index] as number) * 0.76 + moisturePotential * 0.24,
        }),
        exposedRock,
        waterBody,
        mineralPotential: round3(clamp(
          (normalizedMineralPotential[index] as number) * 0.46
            + hostRockProspectivity * 0.2
            + upliftProspectivity * 0.18
            + slopeProspectivity * 0.1
            + exposureProspectivity * 0.06,
          0,
          1,
        )),
      },
      climate: { temperatureC, relativeHumidity, solarMjPerM2Day, precipitationMm: 0, rainfallFactor: round3(rainfallFactor) },
      water: {
        surfaceMm: surfaceWaterMm,
        soilMm: round3(soilWaterMm),
        capacityMm: soilProfile.waterCapacityMm,
        infiltrationMmPerDay: soilProfile.infiltrationMmPerDay,
        lastFlowTo: downstream,
        lastFlows: emptyWaterFlows(),
      },
      soil: {
        mineralNitrogenGPerM2: round4(mineralNitrogen),
        organicNitrogenGPerM2: round4(organicNitrogen),
        organicMatterGPerM2: round3(organicMatter),
        detritusGPerM2: round3(detritus),
        detritusNitrogenGPerM2: round4(detritusNitrogen),
        decomposerActivity: round3(clamp(0.35 + relativeHumidity * 0.42, 0, 1)),
        lastErosionGPerM2: 0,
        lastDepositionGPerM2: 0,
      },
      minerals: [],
      plants: [],
    };
    cell.minerals.push({
      resourceId: 'stone',
      reserveKg: minerals.stoneReserveKgPerCell,
      grade: exposedRock ? 0.95 : 0.72,
      depthM: exposedRock ? 0 : round2(0.8 + (soilField[index] as number) * 3.2),
      exposed: exposedRock,
      sizeClass: !exposedRock ? 'trace' : gradient > 0.42 ? 'large' : (cell.terrain.mineralPotential ?? 0) > 0.72 ? 'medium' : 'small',
    });
    cell.plants = generateInitialPlantCohorts(cell, vegetationDraw, rng, seed, woodlandField[index] as number);
    cells.push(cell);
  }

  addOreVeins(cells, rng, seed);
  return {
    id: 'world:natural',
    kind: 'natural-world',
    scenarioVersion: NATURAL_SCENARIO.scenarioVersion,
    width: world.width,
    height: world.height,
    cellSizeM: world.cellSizeM,
    boundary: world.boundary,
    ticksPerDay: world.ticksPerDay,
    daysPerSeason: world.daysPerSeason,
    yearLengthDays: world.daysPerSeason * 4,
    dayOfYear: 0,
    seasonId: 'spring',
    seasonDay: 0,
    daysSimulated: 0,
    cells,
    totals: {
      precipitationMmM2: 0,
      surfaceEvaporationMmM2: 0,
      soilEvaporationMmM2: 0,
      transpirationMmM2: 0,
      runoffBoundaryMmM2: 0,
      erosionG: 0,
      depositionG: 0,
      mineralErosionKg: 0,
      mineralDepositionKg: 0,
      photosynthesisG: 0,
      plantRespirationG: 0,
      decompositionRespirationG: 0,
      nitrogenMineralizedG: 0,
    },
  };
}

function buildElevationField(width: number, height: number, rng: RandomState, seed: string, streamId: string): number[] {
  const octaves = [
    { columns: 3, rows: 2, weight: 0.48 },
    { columns: 7, rows: 5, weight: 0.28 },
    { columns: 15, rows: 11, weight: 0.18 },
    { columns: width, rows: height, weight: 0.06 },
  ];
  const layers = createSpatialLayers(width, height, rng, seed, streamId, octaves);
  const ridges = createRidgeLines(width, height, rng, seed, streamId, 2);
  const valleys = createRidgeLines(width, height, rng, seed, streamId, 1, true);
  const values: number[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let background = 0;
      for (let octave = 0; octave < layers.length; octave += 1) {
        const layer = layers[octave]!;
        background += sampleGrid(layer.values, layer.columns, layer.rows, x / Math.max(1, width - 1), y / Math.max(1, height - 1)) * octaves[octave]!.weight;
      }
      const uplift = ridgeStrengthAt(ridges, x, y);
      const valleyCut = ridgeStrengthAt(valleys, x, y);
      values.push(background * 0.62 + uplift * 0.34 - valleyCut * 0.12);
    }
  }
  return values;
}

type TerrainPoint = { x: number; y: number };
type TerrainRidge = { points: TerrainPoint[]; width: number; strength: number };

function createRidgeLines(
  width: number,
  height: number,
  rng: RandomState,
  seed: string,
  streamId: string,
  count: number,
  valley = false,
): TerrainRidge[] {
  return Array.from({ length: count }, () => {
    const horizontal = nextFloat(rng, seed, streamId) > 0.36;
    const span = horizontal ? width : height;
    const crossSpan = horizontal ? height : width;
    const margin = span * 0.12;
    const startCross = crossSpan * (0.18 + nextFloat(rng, seed, streamId) * 0.64);
    const endCross = clamp(startCross + (nextFloat(rng, seed, streamId) - 0.5) * crossSpan * 0.5, crossSpan * 0.1, crossSpan * 0.9);
    const crossControls = [startCross];
    for (let pointIndex = 1; pointIndex < 5; pointIndex += 1) {
      const progress = pointIndex / 5;
      crossControls.push(lerp(startCross, endCross, progress) + (nextFloat(rng, seed, streamId) - 0.5) * crossSpan * 0.32);
    }
    crossControls.push(endCross);
    const points: TerrainPoint[] = [];
    for (let pointIndex = 0; pointIndex <= 16; pointIndex += 1) {
      const progress = pointIndex / 16;
      const cross = sampleGrid(crossControls, crossControls.length, 1, progress, 0);
      const along = -margin + progress * (span + margin * 2);
      points.push(horizontal ? { x: along, y: clamp(cross, -margin, crossSpan + margin) } : { x: clamp(cross, -margin, crossSpan + margin), y: along });
    }
    return {
      points,
      width: Math.max(3, Math.min(width, height) * (valley ? 0.105 : 0.085 + nextFloat(rng, seed, streamId) * 0.07)),
      strength: valley ? 0.78 + nextFloat(rng, seed, streamId) * 0.22 : 0.72 + nextFloat(rng, seed, streamId) * 0.28,
    };
  });
}

function ridgeStrengthAt(ridges: TerrainRidge[], x: number, y: number): number {
  let total = 0;
  for (const ridge of ridges) {
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < ridge.points.length - 1; index += 1) {
      const start = ridge.points[index]!;
      const end = ridge.points[index + 1]!;
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const lengthSquared = dx * dx + dy * dy;
      const projection = lengthSquared === 0 ? 0 : clamp(((x - start.x) * dx + (y - start.y) * dy) / lengthSquared, 0, 1);
      nearestDistance = Math.min(nearestDistance, Math.hypot(x - (start.x + dx * projection), y - (start.y + dy * projection)));
    }
    total = Math.max(total, Math.exp(-((nearestDistance / ridge.width) ** 2) * 1.7) * ridge.strength);
  }
  return total;
}

type SpatialOctave = { columns: number; rows: number; weight: number };
type SpatialLayer = SpatialOctave & { values: number[] };

function buildSpatialField(width: number, height: number, rng: RandomState, seed: string, streamId: string, octaves: SpatialOctave[]): number[] {
  const layers = createSpatialLayers(width, height, rng, seed, streamId, octaves);
  const values: number[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let value = 0;
      for (const layer of layers) {
        value += sampleGrid(layer.values, layer.columns, layer.rows, x / Math.max(1, width - 1), y / Math.max(1, height - 1)) * layer.weight;
      }
      values.push(value);
    }
  }
  return values;
}

function createSpatialLayers(width: number, height: number, rng: RandomState, seed: string, streamId: string, octaves: SpatialOctave[]): SpatialLayer[] {
  return octaves.map(({ columns, rows, weight }) => ({
    columns: Math.min(columns, width),
    rows: Math.min(rows, height),
    weight,
    values: Array.from({ length: Math.min(columns, width) * Math.min(rows, height) }, () => nextFloat(rng, seed, streamId)),
  }));
}

function sampleGrid(values: number[], columns: number, rows: number, x: number, y: number): number {
  const gx = clamp(x, 0, 1) * Math.max(0, columns - 1);
  const gy = clamp(y, 0, 1) * Math.max(0, rows - 1);
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const x1 = Math.min(columns - 1, x0 + 1);
  const y1 = Math.min(rows - 1, y0 + 1);
  const tx = smooth(gx - x0);
  const ty = smooth(gy - y0);
  const top = lerp(values[y0 * columns + x0] as number, values[y0 * columns + x1] as number, tx);
  const bottom = lerp(values[y1 * columns + x0] as number, values[y1 * columns + x1] as number, tx);
  return lerp(top, bottom, ty);
}

type LakeRoutingRecord = { basinId: number; size: number; cells: number[]; spillElevation: number };

function countBasins(basinIds: number[]): Map<number, number> {
  const sizes = new Map<number, number>();
  for (const basinId of basinIds) sizes.set(basinId, (sizes.get(basinId) ?? 0) + 1);
  return sizes;
}

function findRiparianCells(width: number, height: number, waterBodies: WaterBodyId[], slopes: number[]): Set<number> {
  const riparian = new Set<number>();
  for (let index = 0; index < waterBodies.length; index += 1) {
    if (waterBodies[index] === 'none') continue;
    const x = index % width;
    const y = Math.floor(index / width);
    for (const [dx, dy] of NEIGHBORS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const neighbor = ny * width + nx;
      if (waterBodies[neighbor] === 'none' && (slopes[neighbor] as number) <= NATURAL_SCENARIO.soil.riparianSlopeThreshold) riparian.add(neighbor);
    }
  }
  return riparian;
}

function findPersistentRiverCells(
  flowTo: number[],
  contributingCells: number[],
  runoffPotential: number[],
  lakeCells: Set<number>,
  runoffThreshold: number,
): Set<number> {
  const persistent = new Set<number>();
  for (let source = 0; source < flowTo.length; source += 1) {
    if (lakeCells.has(source) || (contributingCells[source] as number) < 32 || (runoffPotential[source] as number) < runoffThreshold) continue;
    let cursor = source;
    const visited = new Set<number>();
    while (cursor >= 0 && cursor < flowTo.length && !lakeCells.has(cursor) && !visited.has(cursor)) {
      persistent.add(cursor);
      visited.add(cursor);
      cursor = flowTo[cursor] as number;
    }
  }
  return persistent;
}

/** Widen high-catchment channels where neighboring runoff already drains into the river. */
function widenRiverChannels(
  width: number,
  height: number,
  flowTo: number[],
  contributingCells: number[],
  centerline: Set<number>,
  lakeCells: Set<number>,
): Set<number> {
  const riverCells = new Set(centerline);
  const upstreamCount = new Uint8Array(flowTo.length);
  for (const source of centerline) {
    const downstream = flowTo[source] as number;
    if (centerline.has(downstream)) upstreamCount[downstream] = (upstreamCount[downstream] ?? 0) + 1;
  }
  const ordered = [...centerline].sort((left, right) => (contributingCells[right] as number) - (contributingCells[left] as number) || left - right);
  for (const channel of ordered) {
    const catchment = contributingCells[channel] as number;
    const junction = (upstreamCount[channel] ?? 0) >= 2;
    const radius = Math.min(2.15, 0.55 + Math.log2(Math.max(1, catchment / 32)) * 0.33 + (junction ? 0.28 : 0));
    if (radius < 1) continue;
    const x = channel % width;
    const y = Math.floor(channel / width);
    const minimumBankCatchment = Math.max(2, Math.floor(catchment * 0.01));
    const candidates: Array<{ cell: number; distance: number }> = [];
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const distance = Math.hypot(dx, dy);
        if (distance > radius) continue;
        const cell = ny * width + nx;
        if (lakeCells.has(cell) || riverCells.has(cell) || (contributingCells[cell] as number) < minimumBankCatchment) continue;
        candidates.push({ cell, distance });
      }
    }
    candidates.sort((left, right) => left.distance - right.distance || left.cell - right.cell);
    for (const candidate of candidates) {
      const downstream = flowTo[candidate.cell] as number;
      if (riverCells.has(downstream)) riverCells.add(candidate.cell);
    }
  }
  return riverCells;
}

function buildSurfaceFields(
  width: number,
  cellSizeM: number,
  elevations: number[],
  landformElevations: number[],
  flowTo: number[],
  basinIds: number[],
  basinSizes: Map<number, number>,
  rainfallFactors: number[],
  geologyField: number[],
  soilField: number[],
  moistureField: number[],
  minimumElevationM: number,
  maximumElevationM: number,
  totalCells: number,
): { bedrock: BedrockId[]; soilTypes: SoilTypeId[]; slopes: number[] } {
  const bedrock: BedrockId[] = [];
  const soilTypes: SoilTypeId[] = [];
  const slopes: number[] = [];
  const elevationRange = Math.max(1, maximumElevationM - minimumElevationM);
  for (let index = 0; index < totalCells; index += 1) {
    const relativeElevation = clamp(((landformElevations[index] as number) - minimumElevationM) / elevationRange, 0, 1);
    const geology = geologyField[index] as number;
    const substrate = soilField[index] as number;
    const moisture = moistureField[index] as number;
    const downstream = flowTo[index] as number;
    const x = index % width;
    const y = Math.floor(index / width);
    const slope = downstream < 0 ? 0 : ((elevations[index] as number) - (elevations[downstream] as number))
      / (cellSizeM * (Math.abs((downstream % width) - x) === 1 && Math.abs(Math.floor(downstream / width) - y) === 1 ? Math.SQRT2 : 1));
    slopes.push(slope);
    bedrock.push(relativeElevation > 0.76
      ? (geology < 0.48 ? 'granite' : 'basalt')
      : geology < 0.28 ? 'sedimentary' : geology < 0.68 ? 'granite' : 'basalt');
    const basinWetness = (basinSizes.get(basinIds[index] as number) ?? 1) / totalCells;
    const rainfallFactor = rainfallFactors[index] as number;
    const moisturePotential = clamp(0.43 + (rainfallFactor - 1) * 0.29 + (1 - relativeElevation) * 0.2 + (moisture - 0.5) * 0.2 + basinWetness * 0.66, 0, 1);
    const lowland = relativeElevation < 0.3;
    const soilProfile = relativeElevation > 0.86 || slope > 0.32
      ? 'rock'
      : lowland && rainfallFactor > 1.2 && moisturePotential > 0.64 && substrate > 0.4
        ? 'clay'
        : (rainfallFactor < 0.58 || (substrate < (lowland ? 0.31 : 0.18) && moisturePotential < 0.72))
          ? 'sand'
          : substrate > 0.78 && rainfallFactor > 0.86 && moisturePotential > 0.6 ? 'clay' : 'loam';
    soilTypes.push(soilProfile);
  }
  return { bedrock, soilTypes, slopes };
}

function connectLakesToDrainage(
  lakes: LakeRoutingRecord[],
  lakeCells: Set<number>,
  lakeSurfaceElevation: number[],
  elevations: number[],
  riverNetwork: RiverNetworkPlan,
  width: number,
  height: number,
  maximumElevationM: number,
): boolean {
  let connected = false;
  const ordered = [...lakes].sort((left, right) => right.cells.length - left.cells.length || left.basinId - right.basinId);
  for (let index = 0; index < ordered.length; index += 1) {
    const source = ordered[index] as LakeRoutingRecord;
    const lowerLargerLakes = ordered.slice(0, index)
      .filter((candidate) => candidate.cells.length > source.cells.length && candidate.spillElevation < source.spillElevation)
      .sort((left, right) => left.spillElevation - right.spillElevation || right.cells.length - left.cells.length);
    let route: number[] = [];
    let receiver: LakeRoutingRecord | undefined;
    for (const candidate of lowerLargerLakes) {
      route = findTerrainPath(width, height, elevations, source.cells, new Set(candidate.cells), maximumElevationM, `lake-${source.basinId}-to-${candidate.basinId}`);
      if (route.length >= 5) {
        receiver = candidate;
        break;
      }
    }
    if (route.length < 5) {
      const riverTargets = new Set([...riverNetwork.cells].filter((cell) => !lakeCells.has(cell)
        && (elevations[cell] as number) < source.spillElevation - 0.5));
      if (riverTargets.size === 0) continue;
      route = findTerrainPath(width, height, elevations, source.cells, riverTargets, maximumElevationM, `lake-${source.basinId}-to-river`);
      receiver = undefined;
    }
    if (route.length < 5) continue;
    const sourceCells = new Set(source.cells);
    const firstChannelIndex = route.findIndex((cell) => !sourceCells.has(cell));
    if (firstChannelIndex < 0 || firstChannelIndex >= route.length - 2) continue;
    const target = route[route.length - 1] as number;
    const channel = route.slice(firstChannelIndex);
    if (channel.slice(0, -1).some((cell) => lakeCells.has(cell))) continue;
    const saddle = Math.max(...channel.slice(0, -1).map((cell) => elevations[cell] as number));
    const lakeFloor = Math.min(...source.cells.map((cell) => elevations[cell] as number));
    const spill = Math.max(source.spillElevation, saddle + 0.2);
    if (spill - lakeFloor > 25) continue;
    const receiverLevel = receiver === undefined
      ? (elevations[target] as number) - 0.2
      : receiver.spillElevation - 0.2;
    if (receiverLevel >= spill - 0.2) continue;
    source.spillElevation = spill;
    for (const cell of source.cells) lakeSurfaceElevation[cell] = spill;
    carveLakeOutletProfile(channel, elevations, spill - 0.12, receiverLevel, width);
    addRiverPath(channel, elevations, riverNetwork.cells, riverNetwork.downstream);
    connected = true;
  }
  return connected;
}

function carveLakeOutletProfile(path: number[], elevations: number[], startLevel: number, endLevel: number, width: number): void {
  if (path.length < 2) return;
  const distances = new Array<number>(path.length).fill(0);
  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1] as number;
    const current = path[index] as number;
    const dx = Math.abs((current % width) - (previous % width));
    const dy = Math.abs(Math.floor(current / width) - Math.floor(previous / width));
    distances[index] = (distances[index - 1] as number) + (dx === 1 && dy === 1 ? Math.SQRT2 : 1);
  }
  let previousHeight = startLevel + 0.1;
  for (let index = 0; index < path.length - 1; index += 1) {
    const progress = (distances[index] as number) / Math.max(1, distances[distances.length - 1] as number);
    const profile = lerp(startLevel, endLevel, progress) - Math.sin(Math.PI * progress) * 1.8;
    const terminalConstraint = (elevations[path[path.length - 1] as number] as number) - (path.length - 1 - index) * 0.08;
    const carved = Math.max(0, Math.min(elevations[path[index] as number] as number, profile, previousHeight - 0.08, terminalConstraint));
    elevations[path[index] as number] = round1(carved);
    previousHeight = elevations[path[index] as number] as number;
  }
}

type RiverNetworkPlan = { cells: Set<number>; downstream: Map<number, number> };

function findTerrainPath(
  width: number,
  height: number,
  elevations: number[],
  starts: number[],
  goals: Set<number>,
  maximumElevationM: number,
  salt: string,
): number[] {
  const distances = new Float64Array(elevations.length);
  distances.fill(Number.POSITIVE_INFINITY);
  const previous = new Int32Array(elevations.length);
  previous.fill(-1);
  const heap: Array<{ index: number; cost: number }> = [];
  const noiseSeed = deterministicTextHash(`${salt}:${width}x${height}`);
  for (const start of starts) {
    distances[start] = 0;
    heapPush(heap, { index: start, cost: 0 });
  }
  let destination = -1;
  const elevationScale = Math.max(1, maximumElevationM);
  while (heap.length > 0) {
    const current = heapPop(heap);
    if (current === undefined || current.cost !== distances[current.index]) continue;
    if (goals.has(current.index)) {
      destination = current.index;
      break;
    }
    const x = current.index % width;
    const y = Math.floor(current.index / width);
    for (const [dx, dy, distanceFactor] of NEIGHBORS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const next = ny * width + nx;
      const rise = Math.max(0, (elevations[next] as number) - (elevations[current.index] as number));
      const heightCost = Math.max(0, (elevations[next] as number) / elevationScale) * 0.34;
      const uphillCost = (rise / elevationScale) * 26;
      const boundaryDistance = Math.min(nx, ny, width - 1 - nx, height - 1 - ny);
      const boundaryPenalty = goals.has(next) ? 0 : Math.max(0, 3 - boundaryDistance) * 0.3;
      const meander = deterministicCellNoise(next, noiseSeed) * 0.32;
      const candidate = current.cost + distanceFactor * (0.85 + heightCost + meander + boundaryPenalty) + uphillCost;
      if (candidate >= distances[next]!) continue;
      distances[next] = candidate;
      previous[next] = current.index;
      heapPush(heap, { index: next, cost: candidate });
    }
  }
  if (destination < 0) return [];
  const route = [destination];
  let cursor = destination;
  while ((previous[cursor] as number) >= 0) {
    cursor = previous[cursor] as number;
    route.push(cursor);
  }
  route.reverse();
  return route;
}

function addRiverPath(path: number[], elevations: number[], cells: Set<number>, downstream: Map<number, number>): void {
  for (let index = 0; index < path.length; index += 1) {
    const cell = path[index] as number;
    cells.add(cell);
    const next = path[index + 1];
    if (next !== undefined && (elevations[cell] as number) > (elevations[next] as number)) downstream.set(cell, next);
  }
}

function deterministicTextHash(key: string): number {
  let hash = 2_166_136_261;
  for (let character = 0; character < key.length; character += 1) hash = Math.imul(hash ^ key.charCodeAt(character), 16_777_619);
  return hash >>> 0;
}

function deterministicCellNoise(index: number, seed: number): number {
  let hash = Math.imul(index ^ seed, 0x45d9f3b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  return (hash >>> 0) / UINT32_RANGE;
}

function heapPush(heap: Array<{ index: number; cost: number }>, value: { index: number; cost: number }): void {
  let index = heap.length;
  heap.push(value);
  while (index > 0) {
    const parent = Math.floor((index - 1) / 2);
    if ((heap[parent] as { cost: number }).cost <= value.cost) break;
    heap[index] = heap[parent] as { index: number; cost: number };
    index = parent;
  }
  heap[index] = value;
}

function heapPop(heap: Array<{ index: number; cost: number }>): { index: number; cost: number } | undefined {
  if (heap.length === 0) return undefined;
  const first = heap[0] as { index: number; cost: number };
  const last = heap.pop() as { index: number; cost: number };
  if (heap.length === 0) return first;
  let index = 0;
  while (true) {
    const left = index * 2 + 1;
    const right = left + 1;
    if (left >= heap.length) break;
    const child = right < heap.length && (heap[right] as { cost: number }).cost < (heap[left] as { cost: number }).cost ? right : left;
    if ((heap[child] as { cost: number }).cost >= last.cost) break;
    heap[index] = heap[child] as { index: number; cost: number };
    index = child;
  }
  heap[index] = last;
  return first;
}

function buildFlowDirections(width: number, height: number, elevations: number[], cellSizeM: number): number[] {
  const result = new Array<number>(width * height).fill(-1);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      let steepestIndex = -1;
      let steepestSlope = 0;
      for (const [dx, dy, distanceFactor] of NEIGHBORS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const neighborIndex = ny * width + nx;
        const slope = ((elevations[index] as number) - (elevations[neighborIndex] as number)) / (cellSizeM * distanceFactor);
        if (slope > steepestSlope + 1e-12) {
          steepestSlope = slope;
          steepestIndex = neighborIndex;
        }
      }
      result[index] = steepestIndex;
    }
  }
  return result;
}

function buildRunoffAccumulation(
  flowTo: number[],
  elevations: number[],
  rainfallFactors: number[],
  soilTypes: SoilTypeId[],
  slopes: number[],
): { runoffPotential: number[]; contributingCells: number[] } {
  const soilRunoff = new Map(NATURAL_SCENARIO.terrain.soilTypes.map((profile) => [profile.id, profile.runoffFraction]));
  const runoffPotential = elevations.map((_, index) => (rainfallFactors[index] as number)
    * (0.2 + (soilRunoff.get(soilTypes[index] as SoilTypeId) ?? 0) * 1.7 + (slopes[index] as number) * 0.25));
  const contributingCells = elevations.map(() => 1);
  const downhillOrder = elevations.map((_, index) => index)
    .sort((left, right) => (elevations[right] as number) - (elevations[left] as number) || left - right);
  for (const index of downhillOrder) {
    const downstream = flowTo[index] as number;
    if (downstream < 0) continue;
    runoffPotential[downstream] = (runoffPotential[downstream] as number) + (runoffPotential[index] as number);
    contributingCells[downstream] = (contributingCells[downstream] as number) + (contributingCells[index] as number);
  }
  return { runoffPotential, contributingCells };
}

function findBasins(flowTo: number[]): number[] {
  const result = new Array<number>(flowTo.length).fill(-1);
  for (let index = 0; index < flowTo.length; index += 1) {
    let cursor = index;
    while ((flowTo[cursor] as number) >= 0 && (result[cursor] ?? -1) < 0) cursor = flowTo[cursor] as number;
    const basin = (result[cursor] ?? -1) >= 0 ? result[cursor] as number : cursor;
    cursor = index;
    while ((result[cursor] ?? -1) < 0) {
      const next = flowTo[cursor] as number;
      result[cursor] = basin;
      if (next < 0) break;
      cursor = next;
    }
  }
  return result;
}

function growLakeFootprint(sinkIndex: number, basinCells: number[], targetCount: number, elevations: number[], width: number): number[] {
  const basin = new Set(basinCells);
  const selected = new Set<number>([sinkIndex]);
  const frontier = new Set<number>();
  const sinkX = sinkIndex % width;
  const sinkY = Math.floor(sinkIndex / width);
  while (selected.size < targetCount) {
    for (const index of selected) {
      const x = index % width;
      const y = Math.floor(index / width);
      for (const [dx, dy] of NEIGHBORS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width) continue;
        const neighbor = ny * width + nx;
        if (basin.has(neighbor) && !selected.has(neighbor)) frontier.add(neighbor);
      }
    }
    if (frontier.size === 0) break;
    const next = [...frontier].sort((left, right) => {
      const leftDistance = Math.hypot((left % width) - sinkX, Math.floor(left / width) - sinkY);
      const rightDistance = Math.hypot((right % width) - sinkX, Math.floor(right / width) - sinkY);
      const leftJitter = ((Math.imul(left + 1, 0x45d9f3b) >>> 16) & 0xff) / 255;
      const rightJitter = ((Math.imul(right + 1, 0x45d9f3b) >>> 16) & 0xff) / 255;
      const leftScore = leftDistance + Math.max(0, (elevations[left] as number) - (elevations[sinkIndex] as number)) / 90 + leftJitter * 0.45;
      const rightScore = rightDistance + Math.max(0, (elevations[right] as number) - (elevations[sinkIndex] as number)) / 90 + rightJitter * 0.45;
      return leftScore - rightScore || left - right;
    })[0] as number;
    frontier.delete(next);
    selected.add(next);
  }
  return [...selected].sort((left, right) => (elevations[left] as number) - (elevations[right] as number) || left - right);
}

function normalizeRainfallField(field: number[]): number[] {
  const minimum = Math.min(...field);
  const maximum = Math.max(...field);
  return field.map((value) => 0.18 + Math.pow((value - minimum) / Math.max(1e-9, maximum - minimum), 0.72) * 1.68);
}

function normalizeField(field: number[]): number[] {
  const minimum = Math.min(...field);
  const maximum = Math.max(...field);
  return field.map((value) => clamp((value - minimum) / Math.max(1e-9, maximum - minimum), 0, 1));
}

function initialHabitat(input: { isLake: boolean; isRiparian: boolean; relativeElevation: number; slope: number; moisturePotential: number; rainfallFactor: number; basinWetness: number; woodlandPotential: number }): NaturalWorldCellState['terrain']['habitat'] {
  if (input.isLake || input.isRiparian || (input.rainfallFactor > 1.25 && input.relativeElevation < 0.36 && input.basinWetness > 0.002 && input.moisturePotential > 0.64)) return 'wetland';
  if (input.rainfallFactor < 0.52 && input.moisturePotential < 0.46) return 'desert';
  if (input.relativeElevation > 0.77 || input.slope > 0.28) return 'upland';
  if (input.rainfallFactor < 0.82) return 'dryland';
  if (input.rainfallFactor > 0.9 && input.woodlandPotential > 0.43) return 'woodland';
  return 'meadow';
}

function generateInitialPlantCohorts(cell: NaturalWorldCellState, establishmentDraw: number, rng: RandomState, seed: string, woodlandDraw: number): PlantCohortState[] {
  const profiles = [...NATURAL_SCENARIO.plants].sort((left, right) => compareAscii(left.id, right.id));
  const cohorts: PlantCohortState[] = [];
  const inWoodland = cell.terrain.habitat === 'woodland';
  const woodlandProximity = clamp((woodlandDraw - 0.3) * 2, 0, 1);
  const pineAffinity = clamp((cell.terrain.elevationM / NATURAL_SCENARIO.terrain.maximumElevationM - 0.36) * 1.2
    + (cell.terrain.soilType === 'sand' ? 0.26 : 0)
    + (cell.climate.temperatureC < 10 ? 0.18 : 0), 0, 1);
  const treeSpecies = chooseTreeSpecies(profiles, cell, establishmentDraw, woodlandProximity, pineAffinity);
  for (const profile of profiles) {
    const draw = nextFloat(rng, seed, 'vegetation:initialization');
    const flooded = cell.water.surfaceMm >= NATURAL_SCENARIO.terrain.lakeSurfaceWaterMm * 0.8;
    const substrateMatches = profile.soilPreference.includes(cell.terrain.soilType);
    const preferredHabitat = profile.habitatPreference.includes(cell.terrain.habitat);
    const habitatBase = profile.id === 'grass'
      ? cell.terrain.habitat === 'meadow' ? 0.96 : inWoodland ? 0.78 : cell.terrain.habitat === 'dryland' ? 0.8 : cell.terrain.habitat === 'desert' ? 0.52 : 0.4
      : profile.id === 'shrub'
        ? cell.terrain.habitat === 'meadow' ? 0.26 : inWoodland ? 0.13 : cell.terrain.habitat === 'dryland' ? 0.24 : cell.terrain.habitat === 'desert' ? 0.17 : 0.08
        : treeHabitatAffinity(profile.id, cell, woodlandProximity, pineAffinity);
    const soilFactor = substrateMatches ? 1 : 0.42;
    const habitatFactor = preferredHabitat ? 1 : 0.12;
    const temperatureFactor = initialTemperatureSuitability(cell.climate.temperatureC, profile.temperatureMinC, profile.temperatureOptimumC, profile.temperatureMaxC);
    const waterFactor = clamp(cell.water.soilMm / Math.max(1, profile.soilWaterOptimumMm), 0.3, 1.1);
    const rockFactor = isTreeSpecies(profile.id) ? treeRockAffinity(profile.id, cell) : 1;
    const probability = flooded ? 0.08 : clamp(habitatBase * soilFactor * habitatFactor * temperatureFactor * waterFactor * rockFactor, 0, 0.94);
    const established = draw < probability && !flooded && (!isTreeSpecies(profile.id) || profile.id === treeSpecies);
    const variation = 0.72 + establishmentDraw * 0.3 + draw * 0.28;
    const biomass = established ? profile.initialBiomassGPerM2 * variation : 0;
    const ageDays = established ? profile.maturityDays * (0.05 + draw * 1.45) : 0;
    const seedHabitatFactor = isTreeSpecies(profile.id)
      ? profile.id === treeSpecies && preferredHabitat && (inWoodland || woodlandProximity > 0.42) ? 0.8 * rockFactor : 0
      : preferredHabitat ? 1 : 0.18;
    const seedMatter = flooded
      ? profile.initialSeedBankGPerM2 * (isTreeSpecies(profile.id) ? 0 : 0.16)
      : profile.initialSeedBankGPerM2 * seedHabitatFactor * (0.65 + variation * 0.45);
    if (!established && seedMatter < 0.001) continue;
    cohorts.push({
      speciesId: profile.id,
      stage: initialPlantStage(ageDays, profile.maturityDays, profile.maximumLifespanDays),
      densityPerM2: established ? profile.initialDensityPerM2 * variation : 0,
      biomassGPerM2: round3(biomass),
      nitrogenGPerM2: round4(biomass * profile.nitrogenDemandGPerGBiomass),
      seedBankMatterGPerM2: round4(seedMatter),
      seedBankNitrogenGPerM2: round5(seedMatter * profile.seedNitrogenFraction),
      ageDays: round2(ageDays),
      stress: 1,
    });
  }
  return cohorts;
}

function initialPlantStage(ageDays: number, maturityDays: number, maximumLifespanDays: number): PlantCohortState['stage'] {
  if (ageDays < maturityDays * 0.15) return 'seedling';
  if (ageDays < maturityDays * 0.42) return 'sapling';
  if (ageDays < maturityDays) return 'juvenile';
  if (ageDays >= maximumLifespanDays * 0.78) return 'senescent';
  return 'mature';
}

function isTreeSpecies(speciesId: PlantSpeciesId): speciesId is TreeSpeciesId {
  return speciesId !== 'grass' && speciesId !== 'shrub';
}

function chooseTreeSpecies(
  profiles: typeof NATURAL_SCENARIO.plants,
  cell: NaturalWorldCellState,
  selectionDraw: number,
  woodlandProximity: number,
  pineAffinity: number,
): TreeSpeciesId | null {
  const candidates: Array<{ id: TreeSpeciesId; weight: number }> = [];
  for (const profile of profiles) {
    if (!isTreeSpecies(profile.id)) continue;
    const habitatAffinity = treeHabitatAffinity(profile.id, cell, woodlandProximity, pineAffinity);
    const soilAffinity = profile.soilPreference.includes(cell.terrain.soilType) ? 1 : 0.42;
    const habitatPreference = profile.habitatPreference.includes(cell.terrain.habitat) ? 1 : 0.12;
    const thermalAffinity = initialTemperatureSuitability(cell.climate.temperatureC, profile.temperatureMinC, profile.temperatureOptimumC, profile.temperatureMaxC);
    const waterAffinity = clamp(cell.water.soilMm / Math.max(1, profile.soilWaterOptimumMm), 0.3, 1.1);
    const weight = habitatAffinity * soilAffinity * habitatPreference * thermalAffinity * waterAffinity;
    const adjustedWeight = weight * treeRockAffinity(profile.id, cell);
    if (adjustedWeight > 0) candidates.push({ id: profile.id, weight: adjustedWeight });
  }
  const totalWeight = candidates.reduce((total, candidate) => total + candidate.weight, 0);
  if (totalWeight <= 0) return null;
  let selection = selectionDraw * totalWeight;
  for (const candidate of candidates) {
    selection -= candidate.weight;
    if (selection <= 0) return candidate.id;
  }
  return candidates.at(-1)?.id ?? null;
}

function treeHabitatAffinity(speciesId: PlantSpeciesId, cell: NaturalWorldCellState, woodlandProximity: number, pineAffinity: number): number {
  const woodland = cell.terrain.habitat === 'woodland';
  if (speciesId === 'oak') return (woodland ? 0.78 : cell.terrain.habitat === 'meadow' ? 0.075 * woodlandProximity : 0.01) * (1 - pineAffinity * 0.38);
  if (speciesId === 'pine') return woodland ? 0.58 + pineAffinity * 0.3 : cell.terrain.habitat === 'upland' ? 0.18 : cell.terrain.habitat === 'dryland' ? 0.26 : 0.045 * woodlandProximity;
  if (speciesId === 'birch') return woodland ? 0.55 : cell.terrain.habitat === 'meadow' || cell.terrain.habitat === 'upland' ? 0.15 * woodlandProximity : 0.01;
  if (speciesId === 'autumnal') return woodland ? 0.58 : cell.terrain.habitat === 'meadow' ? 0.11 * woodlandProximity : 0.01;
  if (speciesId === 'willow') return cell.terrain.habitat === 'wetland' ? 0.84 : cell.terrain.habitat === 'meadow' ? 0.12 * clamp(cell.climate.relativeHumidity, 0.1, 1) : 0.008;
  return 0;
}

function treeRockAffinity(speciesId: TreeSpeciesId, cell: NaturalWorldCellState): number {
  // Exposed rock is a hard ecological boundary for tree establishment. The
  // renderer also blocks large formations, but this keeps the simulation and
  // its projections consistent for new worlds.
  if (cell.terrain.exposedRock) return 0;
  const speciesTolerance = speciesId === 'pine' ? 0.72 : speciesId === 'birch' ? 0.5 : 0.28;
  const substrateFactor = cell.terrain.soilType === 'rock' ? speciesTolerance : 1;
  return substrateFactor;
}

function initialTemperatureSuitability(value: number, minimum: number, optimum: number, maximum: number): number {
  if (value <= minimum || value >= maximum) return 0;
  if (value <= optimum) return clamp((value - minimum) / Math.max(1e-9, optimum - minimum), 0, 1);
  return clamp((maximum - value) / Math.max(1e-9, maximum - optimum), 0, 1);
}

type OreVeinCenter = { x: number; y: number; potential: number; radiusX: number; radiusY: number; rotation: number };

function addOreVeins(cells: NaturalWorldCellState[], rng: RandomState, seed: string): void {
  const width = NATURAL_SCENARIO.world.width;
  for (const vein of NATURAL_SCENARIO.minerals.veins) {
    const province = normalizeField(buildSpatialField(width, NATURAL_SCENARIO.world.height, rng, seed, `geology:province:${vein.id}`, [
      { columns: 2, rows: 2, weight: 0.62 },
      { columns: 5, rows: 4, weight: 0.28 },
      { columns: 11, rows: 8, weight: 0.10 },
    ]));
    const candidates = cells
      .filter((cell) => vein.hostBedrock.includes(cell.terrain.bedrock))
      .map((cell) => ({ cell, potential: cell.terrain.mineralPotential ?? 0, province: province[cell.index] as number }))
      .filter((candidate) => candidate.potential >= 0.14)
      .map((candidate) => ({ ...candidate, score: Math.pow(candidate.potential, 0.86) * (0.48 + candidate.province * 0.52) }))
      .sort((left, right) => right.score - left.score || left.cell.index - right.cell.index);
    const centers: OreVeinCenter[] = [];
    const minimumSpacing = Math.max(2.2, vein.radiusCells * 0.72);
    for (let center = 0; center < vein.centers && candidates.length > 0; center += 1) {
      const spaced = candidates.filter((candidate) => centers.every((point) => Math.hypot(candidate.cell.x - point.x, candidate.cell.y - point.y) >= minimumSpacing));
      const eligible = spaced.length > 0 ? spaced : candidates.filter((candidate) => centers.every((point) => Math.hypot(candidate.cell.x - point.x, candidate.cell.y - point.y) >= 1.5));
      if (eligible.length === 0) break;
      const topCount = Math.max(1, Math.ceil(eligible.length * 0.32));
      const pool = eligible.slice(0, topCount);
      const totalWeight = pool.reduce((sum, candidate) => sum + candidate.score * candidate.score, 0);
      let draw = nextFloat(rng, seed, `geology:deposits:${vein.id}`) * totalWeight;
      let selected = pool[pool.length - 1]!;
      for (const candidate of pool) {
        draw -= candidate.score * candidate.score;
        if (draw <= 0) { selected = candidate; break; }
      }
      const radiusScale = 0.66 + selected.potential * 0.72;
      const radiusJitter = 0.82 + nextFloat(rng, seed, `geology:deposits:${vein.id}`) * 0.36;
      const baseRadius = vein.radiusCells * radiusScale * radiusJitter;
      const aspect = 0.58 + nextFloat(rng, seed, `geology:deposits:${vein.id}`) * 0.76;
      centers.push({
        x: selected.cell.x,
        y: selected.cell.y,
        potential: selected.potential,
        radiusX: baseRadius * Math.sqrt(aspect),
        radiusY: baseRadius / Math.sqrt(aspect),
        rotation: nextFloat(rng, seed, `geology:deposits:${vein.id}`) * Math.PI,
      });
    }
    for (const cell of cells) {
      if (!vein.hostBedrock.includes(cell.terrain.bedrock) || centers.length === 0) continue;
      let bestRatio = Number.POSITIVE_INFINITY;
      let centerPotential = 0;
      for (const center of centers) {
        const dx = cell.x - center.x;
        const dy = cell.y - center.y;
        const cosine = Math.cos(center.rotation);
        const sine = Math.sin(center.rotation);
        const rotatedX = dx * cosine + dy * sine;
        const rotatedY = -dx * sine + dy * cosine;
        const irregularity = 0.88 + (province[cell.index] as number) * 0.24;
        const ratio = Math.sqrt((rotatedX / center.radiusX) ** 2 + (rotatedY / center.radiusY) ** 2) * irregularity;
        if (ratio < bestRatio) {
          bestRatio = ratio;
          centerPotential = center.potential;
        }
      }
      if (bestRatio >= 1) continue;
      const concentration = Math.pow(1 - bestRatio, 1.25);
      const localPotential = cell.terrain.mineralPotential ?? 0;
      const favorability = clamp(localPotential * 0.72 + centerPotential * 0.18 + (province[cell.index] as number) * 0.10, 0, 1);
      const richness = favorability * Math.sqrt(concentration);
      const sizeClass = richness >= 0.70 && bestRatio <= 0.4 ? 'large'
        : richness >= 0.46 && bestRatio <= 0.72 ? 'medium'
          : richness >= 0.20 ? 'small' : 'trace';
      const depthM = round2(vein.depthM + bestRatio * 3.8 + (cell.terrain.exposedRock ? 0 : 1.4) + (1 - favorability) * 1.6);
      const exposed = depthM <= 1.8 || (cell.terrain.exposedRock && depthM <= 5.8);
      cell.minerals.push({
        resourceId: vein.id as MineralVeinProfile['id'] as 'copper' | 'iron' | 'silver' | 'gold',
        reserveKg: round1(vein.reserveKgPerCell * concentration * (0.28 + favorability * 0.72)),
        grade: round3(clamp(vein.grade * (0.72 + favorability * 0.55) * (1 - bestRatio * 0.42), 0, 1)),
        depthM,
        exposed,
        sizeClass,
      });
    }
  }
  for (const cell of cells) cell.minerals.sort((left, right) => compareAscii(left.resourceId, right.resourceId));
}

function emptyWaterFlows(): NaturalWorldCellState['water']['lastFlows'] {
  return {};
}

function nextFloat(rng: RandomState, seed: string, systemId: string): number {
  return drawFromSystem(rng, seed, systemId) / UINT32_RANGE;
}

function rangeDraw(rng: RandomState, seed: string, systemId: string, range: [number, number]): number {
  return range[0] + nextFloat(rng, seed, systemId) * (range[1] - range[0]);
}

function smooth(value: number): number { return value * value * (3 - 2 * value); }
function lerp(left: number, right: number, amount: number): number { return left + (right - left) * amount; }
function clamp(value: number, minimum: number, maximum: number): number { return Math.min(maximum, Math.max(minimum, value)); }
function round1(value: number): number { return Math.round(value * 10) / 10; }
function round2(value: number): number { return Math.round(value * 100) / 100; }
function round3(value: number): number { return Math.round(value * 1000) / 1000; }
function round4(value: number): number { return Math.round(value * 10_000) / 10_000; }
function round5(value: number): number { return Math.round(value * 100_000) / 100_000; }
function compareAscii(left: string, right: string): number { return left < right ? -1 : left > right ? 1 : 0; }
