import type { SimulationEvent, TickSystem, TickSystemContext, WorldState } from '../types';
import { NATURAL_SCENARIO } from './parameters';
import { naturalScenarioVersionAtLeast } from './versioning';
import { updatePlantMatterTotals, updatePlantWaterTotal, updateVegetationMetrics } from './environment-systems';
import { getNaturalWorld, type NaturalWorldCellState, type NaturalWorldEntity, type PlantCohortState, type PlantSpeciesId, type TreeSpeciesId } from './types';

const PLANT_PROFILES = new Map(NATURAL_SCENARIO.plants.map((profile) => [profile.id, profile]));
const TREE_SPECIES = new Set<TreeSpeciesId>(['oak', 'pine', 'birch', 'autumnal', 'willow']);
const SHADE_NEIGHBORS = Array.from({ length: 7 * 7 }, (_, index) => {
  const dx = index % 7 - 3;
  const dy = Math.floor(index / 7) - 3;
  const distance = Math.hypot(dx, dy);
  return { dx, dy, weight: distance === 0 || distance > 3.6 ? 0 : 0.62 * Math.pow(1 - distance / 4.2, 1.6) };
}).filter((neighbor) => neighbor.weight > 0);

export const VEGETATION_SYSTEM: TickSystem = {
  id: 'vegetation:plant-dynamics',
  order: 40,
  periodTicks: NATURAL_SCENARIO.world.ticksPerDay,
  phaseOffsetTicks: 0,
  run: updateVegetation,
};

type CohortPotential = {
  cohort: PlantCohortState;
  grossGrowthGPerM2: number;
  seedFraction: number;
  nitrogenDemandGPerM2: number;
  factors: { water: number; nitrogen: number; temperature: number; light: number };
};

function updateVegetation(world: WorldState, tick: number, context: TickSystemContext): readonly SimulationEvent[] {
  if (world.scenarioId !== NATURAL_SCENARIO.scenarioId) return [];
  const natural = getNaturalWorld(world);
  const cellAreaM2 = natural.cellSizeM ** 2;
  const elapsedDays = context.elapsedTicks / natural.ticksPerDay;
  const treeCanopies = natural.cells.map(treeCanopyCover);
  let photosynthesisG = 0;
  let respirationG = 0;
  let transpirationMm = 0;
  let nitrogenUptakeG = 0;
  let germinatedMatterG = 0;
  let deadMatterG = 0;
  let germinationCells = 0;
  let deathCells = 0;
  let activeCells = 0;
  let meanLimitation = 0;
  const exposesChannelSeedbank = naturalScenarioVersionAtLeast(natural.scenarioVersion, '1.6.0');

  for (const cell of natural.cells) {
    const cellResult = updateCellPlants(cell, elapsedDays, neighborhoodShade(natural, cell, treeCanopies), exposesChannelSeedbank);
    photosynthesisG += cellResult.photosynthesisG;
    respirationG += cellResult.respirationG;
    transpirationMm += cellResult.transpirationMm;
    nitrogenUptakeG += cellResult.nitrogenUptakeG;
    germinatedMatterG += cellResult.germinatedMatterG;
    deadMatterG += cellResult.deadMatterG;
    if (cellResult.germinatedMatterG > 0.001) germinationCells += 1;
    if (cellResult.deadMatterG > 0.001) deathCells += 1;
    if (cellResult.photosynthesisG > 0.001) activeCells += 1;
    meanLimitation += cellResult.meanGrowthFactor;
  }

  updatePlantWaterTotal(natural, transpirationMm);
  updatePlantMatterTotals(natural, photosynthesisG, respirationG);
  updateVegetationMetrics(world, natural);
  world.metrics['vegetation.photosynthesisG'] = round3(photosynthesisG * cellAreaM2);
  world.metrics['vegetation.respirationG'] = round3(respirationG * cellAreaM2);
  world.metrics['vegetation.transpirationMmM2'] = round3(transpirationMm * cellAreaM2);
  world.metrics['vegetation.nitrogenUptakeG'] = round4(nitrogenUptakeG * cellAreaM2);
  world.metrics['vegetation.meanGrowthFactor'] = round4(meanLimitation / natural.cells.length);

  const events: SimulationEvent[] = [];
  if (germinatedMatterG > 0.01) {
    events.push({
      tick,
      systemId: 'vegetation:plant-dynamics',
      eventType: 'vegetation:germination',
      actorIds: [],
      data: { seedMatterTransferredG: round3(germinatedMatterG * cellAreaM2), affectedCells: germinationCells },
    });
  }
  if (photosynthesisG > 0.01) {
    events.push({
      tick,
      systemId: 'vegetation:plant-dynamics',
      eventType: 'vegetation:growth',
      actorIds: [],
      data: {
        photosynthesisMatterG: round3(photosynthesisG * cellAreaM2),
        nitrogenUptakeG: round4(nitrogenUptakeG * cellAreaM2),
        transpirationMmM2: round3(transpirationMm * cellAreaM2),
        activeCells,
      },
    });
  }
  if (deadMatterG > 0.01) {
    events.push({
      tick,
      systemId: 'vegetation:plant-dynamics',
      eventType: 'vegetation:senescence',
      actorIds: [],
      data: { detritusMatterG: round3(deadMatterG * cellAreaM2), affectedCells: deathCells },
    });
  }
  return events;
}

function updateCellPlants(cell: NaturalWorldCellState, elapsedDays: number, surroundingTreeShade: number, exposesChannelSeedbank: boolean): {
  photosynthesisG: number;
  respirationG: number;
  transpirationMm: number;
  nitrogenUptakeG: number;
  germinatedMatterG: number;
  deadMatterG: number;
  meanGrowthFactor: number;
} {
  const waterBody = cell.terrain.waterBody ?? 'none';
  for (const cohort of cell.plants) {
    if (cohort.stress === undefined) {
      const factors = cohort.limitingFactors;
      cohort.stress = factors === undefined ? 1 : Math.min(factors.water, factors.nitrogen, factors.temperature, factors.light);
    }
    delete cohort.limitingFactors;
  }
  if (waterBody !== 'none' && (!exposesChannelSeedbank || cell.water.surfaceMm >= 8)) {
    return { photosynthesisG: 0, respirationG: 0, transpirationMm: 0, nitrogenUptakeG: 0, germinatedMatterG: 0, deadMatterG: 0, meanGrowthFactor: 0 };
  }
  let transpirationDemand = 0;
  for (const cohort of cell.plants) {
    const profile = PLANT_PROFILES.get(cohort.speciesId)!;
    const cover = plantCover(cohort);
    const demand = profile.transpirationMmPerDayAtFullCanopy * cover
      * clamp(cell.climate.solarMjPerM2Day / 18, 0.25, 1.3)
      * temperatureActivity(cell.climate.temperatureC)
      * elapsedDays;
    transpirationDemand += demand;
  }
  const transpiration = Math.min(cell.water.soilMm, transpirationDemand);
  cell.water.soilMm = round4(Math.max(0, cell.water.soilMm - transpiration));
  const transpirationFlow = round4(transpiration);
  if (transpirationFlow > 0) cell.water.lastFlows.transpirationMm = transpirationFlow;
  else delete cell.water.lastFlows.transpirationMm;
  const transpirationFactor = transpirationDemand > 1e-9 ? transpiration / transpirationDemand : 1;
  let germinatedMatter = 0;
  let deadMatter = 0;
  let plantRespiration = 0;
  const potentials: CohortPotential[] = [];
  let totalNitrogenDemand = 0;
  let growthFactorSum = 0;

  for (const cohort of cell.plants) {
    const profile = PLANT_PROFILES.get(cohort.speciesId)!;
    const wasDormant = cohort.biomassGPerM2 < 0.5;
    const temperatureFactor = temperatureSuitability(cell.climate.temperatureC, profile.temperatureMinC, profile.temperatureOptimumC, profile.temperatureMaxC);
    const waterFactor = cell.water.soilMm <= profile.soilWaterMinimumMm
      ? 0
      : clamp((cell.water.soilMm - profile.soilWaterMinimumMm) / Math.max(1, profile.soilWaterOptimumMm - profile.soilWaterMinimumMm), 0, 1);
    const lightBase = clamp(cell.climate.solarMjPerM2Day / profile.solarOptimumMjPerM2Day, 0, 1);
    const ownCover = plantCover(cohort);
    const ownHeight = plantHeight(cohort);
    let tallerTreeCover = 0;
    let peerTreeCover = 0;
    let groundCover = 0;
    for (const other of cell.plants) {
      if (other === cohort) continue;
      const cover = plantCover(other);
      if (isTree(other.speciesId)) {
        if (plantHeight(other) > ownHeight + 0.08) tallerTreeCover += cover;
        else peerTreeCover += cover;
      } else {
        groundCover += cover;
      }
    }
    const selfCrowding = isTree(cohort.speciesId) ? ownCover * 0.12 : 0;
    const shadePressure = tallerTreeCover * 0.9 + peerTreeCover * 0.38 + groundCover * 0.18 + selfCrowding + surroundingTreeShade;
    const competitionFactor = clamp(1 - shadePressure, profile.shadeTolerance, 1);
    const lightFactor = clamp(lightBase * competitionFactor, 0, 1);
    const soilPreferenceFactor = profile.soilPreference.includes(cell.terrain.soilType) ? 1 : 0.58;
    const rockTolerance = cohort.speciesId === 'pine' ? 0.78 : cohort.speciesId === 'birch' ? 0.56 : 0.32;
    const rockFactor = isTree(cohort.speciesId)
      ? cell.terrain.exposedRock ? 0 : (cell.terrain.soilType === 'rock' ? rockTolerance : 1)
      : 1;
    const soilFactor = soilPreferenceFactor * rockFactor;
    const habitatFactor = profile.habitatPreference.includes(cell.terrain.habitat) ? 1 : 0.62;
    const substrateFactor = soilFactor * habitatFactor;
    const emergenceConditions = Math.min(temperatureFactor, waterFactor, lightFactor) * substrateFactor;

    if (cohort.seedBankMatterGPerM2 > 1e-8 && cell.water.surfaceMm < 8 && emergenceConditions > 0.04) {
      const germinationRate = 1 - Math.pow(1 - profile.germinationFractionPerDay, elapsedDays);
      const germinated = Math.min(cohort.seedBankMatterGPerM2, cohort.seedBankMatterGPerM2 * germinationRate * emergenceConditions);
      const seedNitrogen = cohort.seedBankMatterGPerM2 > 0
        ? cohort.seedBankNitrogenGPerM2 * germinated / cohort.seedBankMatterGPerM2
        : 0;
      cohort.seedBankMatterGPerM2 = round5(Math.max(0, cohort.seedBankMatterGPerM2 - germinated));
      cohort.seedBankNitrogenGPerM2 = round6(Math.max(0, cohort.seedBankNitrogenGPerM2 - seedNitrogen));
      cohort.biomassGPerM2 = round4(cohort.biomassGPerM2 + germinated);
      cohort.nitrogenGPerM2 = round6(cohort.nitrogenGPerM2 + seedNitrogen);
      cohort.densityPerM2 = round4(cohort.densityPerM2 + germinated * seedlingsPerGram(cohort.speciesId));
      if (wasDormant && cohort.biomassGPerM2 >= 0.5) cohort.ageDays = 0;
      germinatedMatter += germinated;
    }

    const stress = Math.min(temperatureFactor, waterFactor, lightFactor, substrateFactor);
    const senescenceProgress = clamp((cohort.ageDays / profile.maximumLifespanDays - 0.72) / 0.28, 0, 1);
    const mortalityPressure = 1 + (1 - stress) * 2.4 + senescenceProgress * 9;
    const mortalityFraction = 1 - Math.pow(1 - profile.mortalityRatePerDay * mortalityPressure, elapsedDays);
    const mortality = cohort.biomassGPerM2 * clamp(mortalityFraction, 0, 0.3);
    const mortalityNitrogen = cohort.biomassGPerM2 > 0 ? cohort.nitrogenGPerM2 * mortality / cohort.biomassGPerM2 : 0;
    cohort.biomassGPerM2 = round4(Math.max(0, cohort.biomassGPerM2 - mortality));
    cohort.nitrogenGPerM2 = round6(Math.max(0, cohort.nitrogenGPerM2 - mortalityNitrogen));
    cohort.densityPerM2 = round5(Math.max(0, cohort.densityPerM2 * (1 - clamp(mortalityFraction, 0, 0.3))));
    cell.soil.detritusGPerM2 = round4(cell.soil.detritusGPerM2 + mortality);
    cell.soil.detritusNitrogenGPerM2 = round6(cell.soil.detritusNitrogenGPerM2 + mortalityNitrogen);
    deadMatter += mortality;

    const seedBankDecay = cohort.seedBankMatterGPerM2 * (1 - Math.pow(1 - 0.00065, elapsedDays));
    const decayedSeedNitrogen = cohort.seedBankMatterGPerM2 > 0
      ? cohort.seedBankNitrogenGPerM2 * seedBankDecay / cohort.seedBankMatterGPerM2
      : 0;
    cohort.seedBankMatterGPerM2 = round5(Math.max(0, cohort.seedBankMatterGPerM2 - seedBankDecay));
    cohort.seedBankNitrogenGPerM2 = round6(Math.max(0, cohort.seedBankNitrogenGPerM2 - decayedSeedNitrogen));
    cell.soil.detritusGPerM2 = round4(cell.soil.detritusGPerM2 + seedBankDecay);
    cell.soil.detritusNitrogenGPerM2 = round6(cell.soil.detritusNitrogenGPerM2 + decayedSeedNitrogen);
    deadMatter += seedBankDecay;

    const respirationFraction = clamp(0.0013 * elapsedDays * temperatureActivity(cell.climate.temperatureC), 0, 0.04);
    const respiration = cohort.biomassGPerM2 * respirationFraction;
    cohort.biomassGPerM2 = round4(Math.max(0, cohort.biomassGPerM2 - respiration));
    plantRespiration += respiration;
    if (cohort.biomassGPerM2 >= 0.5) {
      cohort.ageDays = round2(cohort.ageDays + elapsedDays);
      cohort.stage = plantStage(cohort.ageDays, profile.maturityDays, profile.maximumLifespanDays);
    } else if (cohort.seedBankMatterGPerM2 > 1e-8) {
      cohort.ageDays = 0;
      cohort.stage = 'seedling';
    }

    const seedFraction = cohort.stage === 'mature' ? profile.seedProductionFraction
      : cohort.stage === 'senescent' ? profile.seedProductionFraction * 0.35 : 0;
    const grossCapForTissue = seedFraction > 0
      ? Math.max(0, (profile.maximumBiomassGPerM2 - cohort.biomassGPerM2) / (1 - seedFraction))
      : Math.max(0, profile.maximumBiomassGPerM2 - cohort.biomassGPerM2);
    const grossGrowth = cohort.biomassGPerM2 > 0
      ? Math.min(cohort.biomassGPerM2 * profile.maximumGrowthRatePerDay * elapsedDays / (1 - seedFraction), grossCapForTissue)
        * Math.min(temperatureFactor, waterFactor, lightFactor, substrateFactor)
      : 0;
    const nitrogenDemand = grossGrowth * profile.nitrogenDemandGPerGBiomass;
    totalNitrogenDemand += nitrogenDemand;
    growthFactorSum += Math.min(temperatureFactor, waterFactor, lightFactor, substrateFactor) * transpirationFactor;
    potentials.push({
      cohort,
      grossGrowthGPerM2: grossGrowth,
      seedFraction,
      nitrogenDemandGPerM2: nitrogenDemand,
      factors: { water: waterFactor * transpirationFactor, nitrogen: 1, temperature: temperatureFactor, light: lightFactor },
    });
  }

  const nitrogenFactor = totalNitrogenDemand > 0
    ? Math.min(1, cell.soil.mineralNitrogenGPerM2 / totalNitrogenDemand)
    : 1;
  let photosynthesis = 0;
  let nitrogenUptake = 0;
  for (const potential of potentials) {
    const produced = potential.grossGrowthGPerM2 * nitrogenFactor;
    const seedMatter = produced * potential.seedFraction;
    const tissueMatter = produced - seedMatter;
    const nitrogenUsed = potential.nitrogenDemandGPerM2 * nitrogenFactor;
    const seedNitrogen = nitrogenUsed * potential.seedFraction;
    const tissueNitrogen = nitrogenUsed - seedNitrogen;
    potential.cohort.biomassGPerM2 = round4(potential.cohort.biomassGPerM2 + tissueMatter);
    potential.cohort.nitrogenGPerM2 = round6(potential.cohort.nitrogenGPerM2 + tissueNitrogen);
    potential.cohort.seedBankMatterGPerM2 = round5(potential.cohort.seedBankMatterGPerM2 + seedMatter);
    potential.cohort.seedBankNitrogenGPerM2 = round6(potential.cohort.seedBankNitrogenGPerM2 + seedNitrogen);
    potential.cohort.stress = round4(Math.min(
      potential.factors.water,
      nitrogenFactor,
      potential.factors.temperature,
      potential.factors.light,
    ));
    delete potential.cohort.limitingFactors;
    photosynthesis += produced;
    nitrogenUptake += nitrogenUsed;
  }
  cell.soil.mineralNitrogenGPerM2 = round6(Math.max(0, cell.soil.mineralNitrogenGPerM2 - nitrogenUptake));
  for (const cohort of cell.plants) {
    const nitrogenCapacity = round6(cohort.biomassGPerM2 * 0.1);
    if (cohort.nitrogenGPerM2 > nitrogenCapacity + 1e-9) {
      const excessNitrogen = round6(cohort.nitrogenGPerM2 - nitrogenCapacity);
      cohort.nitrogenGPerM2 = nitrogenCapacity;
      cell.soil.mineralNitrogenGPerM2 = round6(cell.soil.mineralNitrogenGPerM2 + excessNitrogen);
    }
  }

  return {
    photosynthesisG: photosynthesis,
    respirationG: plantRespiration,
    transpirationMm: transpiration,
    nitrogenUptakeG: nitrogenUptake,
    germinatedMatterG: germinatedMatter,
    deadMatterG: deadMatter,
    meanGrowthFactor: potentials.length > 0 ? growthFactorSum / potentials.length : 0,
  };
}

function plantCover(cohort: PlantCohortState): number {
  if (cohort.biomassGPerM2 < 0.5) return 0;
  const profile = PLANT_PROFILES.get(cohort.speciesId)!;
  const biomassCover = cohort.biomassGPerM2 / profile.maximumBiomassGPerM2;
  if (!isTree(cohort.speciesId)) return Math.min(profile.maximumCanopyFraction, profile.maximumCanopyFraction * biomassCover);
  const ageCover = 0.08 + 0.42 * Math.sqrt(clamp(cohort.ageDays / profile.maturityDays, 0, 1));
  const densityFactor = clamp(Math.sqrt(cohort.densityPerM2 / Math.max(1e-9, profile.initialDensityPerM2)), 0.3, 1.4);
  return profile.maximumCanopyFraction * clamp(Math.max(biomassCover, ageCover * densityFactor), 0, 1);
}

function treeCanopyCover(cell: NaturalWorldCellState): number {
  return clamp(sum(cell.plants.filter((cohort) => isTree(cohort.speciesId)).map(plantCover)), 0, 1);
}

function neighborhoodShade(world: NaturalWorldEntity, cell: NaturalWorldCellState, treeCanopies: number[]): number {
  let weightedCover = 0;
  for (const neighbor of SHADE_NEIGHBORS) {
    const x = cell.x + neighbor.dx;
    const y = cell.y + neighbor.dy;
    if (x < 0 || x >= world.width || y < 0 || y >= world.height) continue;
    weightedCover += (treeCanopies[y * world.width + x] ?? 0) * neighbor.weight;
  }
  return clamp(weightedCover, 0, 0.78);
}

function plantHeight(cohort: PlantCohortState): number {
  const profile = PLANT_PROFILES.get(cohort.speciesId)!;
  const growthStage = clamp(cohort.ageDays / profile.maturityDays, 0, 1);
  const biomassStage = clamp(cohort.biomassGPerM2 / profile.maximumBiomassGPerM2, 0, 1);
  return isTree(cohort.speciesId) ? growthStage * 0.72 + biomassStage * 0.28 : biomassStage * 0.28;
}

function plantStage(ageDays: number, maturityDays: number, maximumLifespanDays: number): PlantCohortState['stage'] {
  if (ageDays < maturityDays * 0.15) return 'seedling';
  if (ageDays < maturityDays * 0.42) return 'sapling';
  if (ageDays < maturityDays) return 'juvenile';
  if (ageDays >= maximumLifespanDays * 0.78) return 'senescent';
  return 'mature';
}

function isTree(speciesId: PlantSpeciesId): speciesId is TreeSpeciesId {
  return TREE_SPECIES.has(speciesId as TreeSpeciesId);
}

function temperatureSuitability(value: number, minimum: number, optimum: number, maximum: number): number {
  if (value <= minimum || value >= maximum) return 0;
  if (value <= optimum) return clamp((value - minimum) / Math.max(1e-9, optimum - minimum), 0, 1);
  return clamp((maximum - value) / Math.max(1e-9, maximum - optimum), 0, 1);
}

function temperatureActivity(value: number): number { return clamp((value + 3) / 22, 0, 1); }
function seedlingsPerGram(speciesId: PlantCohortState['speciesId']): number { return PLANT_PROFILES.get(speciesId)!.seedlingsPerGramOfSeedMatter; }
function sum(values: number[]): number { return values.reduce((total, value) => total + value, 0); }
function round2(value: number): number { return Math.round(value * 100) / 100; }
function round3(value: number): number { return Math.round(value * 1000) / 1000; }
function round4(value: number): number { return Math.round(value * 10_000) / 10_000; }
function round5(value: number): number { return Math.round(value * 100_000) / 100_000; }
function round6(value: number): number { return Math.round(value * 1_000_000) / 1_000_000; }
function clamp(value: number, minimum: number, maximum: number): number { return Math.min(maximum, Math.max(minimum, value)); }
