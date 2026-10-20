import { drawFromSystem } from '../rng';
import type { SimulationEvent, TickSystem, TickSystemContext, WorldState } from '../types';
import { NATURAL_SCENARIO, type SoilProfile } from './parameters';
import { getNaturalWorld, type NaturalWorldCellState, type NaturalWorldEntity, type SeasonId } from './types';

const SEASON_ORDER: SeasonId[] = ['spring', 'summer', 'autumn', 'winter'];
const SOIL_PROFILES = new Map(NATURAL_SCENARIO.terrain.soilTypes.map((profile) => [profile.id, profile]));
const FLOW_NEIGHBORS = [
  [-1, -1, Math.SQRT2], [0, -1, 1], [1, -1, Math.SQRT2],
  [-1, 0, 1], [1, 0, 1],
  [-1, 1, Math.SQRT2], [0, 1, 1], [1, 1, Math.SQRT2],
] as const;
const UINT32_RANGE = 0x1_0000_0000;

export const ENVIRONMENT_SYSTEMS: readonly TickSystem[] = [
  {
    id: 'climate:seasonal-forcing',
    order: 10,
    periodTicks: NATURAL_SCENARIO.world.ticksPerDay,
    phaseOffsetTicks: 0,
    run: updateClimate,
  },
  {
    id: 'hydrology:surface-and-soil-water',
    order: 20,
    periodTicks: NATURAL_SCENARIO.world.ticksPerDay,
    phaseOffsetTicks: 0,
    run: updateHydrology,
  },
  {
    id: 'soil:decomposition-and-erosion',
    order: 30,
    periodTicks: NATURAL_SCENARIO.world.ticksPerDay,
    phaseOffsetTicks: 0,
    run: updateSoil,
  },
];

function updateClimate(world: WorldState, tick: number, context: TickSystemContext): readonly SimulationEvent[] {
  if (world.scenarioId !== NATURAL_SCENARIO.scenarioId) return [];
  const natural = getNaturalWorld(world);
  const cellAreaM2 = natural.cellSizeM ** 2;
  const elapsedDays = context.elapsedTicks / natural.ticksPerDay;
  const absoluteDay = Math.floor((tick - 1) / natural.ticksPerDay);
  const dayOfYear = absoluteDay % natural.yearLengthDays;
  const seasonIndex = Math.floor(dayOfYear / natural.daysPerSeason) % SEASON_ORDER.length;
  const seasonId = SEASON_ORDER[seasonIndex] as SeasonId;
  const season = NATURAL_SCENARIO.climate.seasonalForcing[seasonIndex]!;
  const previousSeason = natural.seasonId;
  natural.seasonId = seasonId;
  natural.dayOfYear = dayOfYear;
  natural.seasonDay = dayOfYear % natural.daysPerSeason;
  natural.daysSimulated = round6(natural.daysSimulated + elapsedDays);

  const rainOccurs = nextRandomFloat(world, 'climate:weather') < NATURAL_SCENARIO.climate.rainProbability;
  const stormScale = rainOccurs
    ? (0.55 + nextRandomFloat(world, 'climate:weather') * 0.9) / NATURAL_SCENARIO.climate.rainProbability
    : 0;
  const rainIntensity = season.rainMmPerDay * stormScale * elapsedDays;
  let sumRain = 0;
  let temperatureSum = 0;
  let humiditySum = 0;
  for (const cell of natural.cells) {
    const localRain = rainIntensity * (cell.climate.rainfallFactor ?? 1) * orographicFactor(cell);
    const temperatureNoise = (nextRandomFloat(world, 'climate:temperature') * 2 - 1) * NATURAL_SCENARIO.climate.temperatureNoiseC;
    const temperature = season.temperatureC + temperatureNoise - cell.terrain.elevationM * 0.0065;
    const regionalHumidity = ((cell.climate.rainfallFactor ?? 1) - 1) * 0.18;
    const relativeHumidity = clamp(season.relativeHumidity + regionalHumidity + Math.min(0.18, localRain * 0.035) - Math.max(0, temperature - season.temperatureC) * 0.006, 0.1, 0.99);
    const cloudFactor = rainOccurs ? 0.82 : 1;
    cell.climate.temperatureC = round2(temperature);
    cell.climate.relativeHumidity = round3(relativeHumidity);
    cell.climate.solarMjPerM2Day = round2(season.solarMjPerM2Day * cloudFactor * clamp(1 - cell.terrain.slope * 1.2, 0.58, 1));
    cell.climate.precipitationMm = round4(localRain);
    sumRain += localRain;
    temperatureSum += temperature;
    humiditySum += relativeHumidity;
  }

  const meanRain = sumRain / natural.cells.length;
  natural.totals.precipitationMmM2 = round6(natural.totals.precipitationMmM2 + sumRain * cellAreaM2);
  world.metrics['climate.seasonIndex'] = seasonIndex;
  world.metrics['climate.meanTemperatureC'] = round3(temperatureSum / natural.cells.length);
  world.metrics['climate.meanRelativeHumidity'] = round4(humiditySum / natural.cells.length);
  world.metrics['climate.meanPrecipitationMmPerDay'] = round4(meanRain);

  const events: SimulationEvent[] = [];
  if (previousSeason !== seasonId) {
    events.push({
      tick,
      systemId: 'climate:seasonal-forcing',
      eventType: 'climate:season-changed',
      actorIds: [],
      data: { from: previousSeason, to: seasonId, dayOfYear, meanTemperatureC: round3(temperatureSum / natural.cells.length) },
    });
  }
  if (meanRain > 0.01) {
    events.push({
      tick,
      systemId: 'climate:seasonal-forcing',
      eventType: 'climate:rainfall',
      actorIds: [],
      data: { meanPrecipitationMm: round4(meanRain), affectedCells: natural.cells.length, seasonId },
    });
  }
  return events;
}

function updateHydrology(world: WorldState, tick: number, context: TickSystemContext): readonly SimulationEvent[] {
  if (world.scenarioId !== NATURAL_SCENARIO.scenarioId) return [];
  const natural = getNaturalWorld(world);
  const cellAreaM2 = natural.cellSizeM ** 2;
  const elapsedDays = context.elapsedTicks / natural.ticksPerDay;
  const incoming = new Array<number>(natural.cells.length).fill(0);
  const outgoing = new Array<number>(natural.cells.length).fill(0);
  const proposals: Array<{
    cell: NaturalWorldCellState;
    soilAfter: number;
    infiltration: number;
    surfaceEvaporation: number;
    soilEvaporation: number;
    remainingSurface: number;
    runoffOut: number;
    boundaryOutflow: number;
    flowTo: number;
    precipitation: number;
  }> = [];
  let precipitationTotal = 0;
  let infiltrationTotal = 0;
  let surfaceEvaporationTotal = 0;
  let soilEvaporationTotal = 0;
  let runoffTotal = 0;
  let boundaryOutflowTotal = 0;

  for (const cell of natural.cells) {
    const precipitation = cell.climate.precipitationMm;
    const surfaceAfterRain = cell.water.surfaceMm + precipitation;
    const freeCapacity = Math.max(0, cell.water.capacityMm - cell.water.soilMm);
    const infiltration = Math.min(surfaceAfterRain, cell.water.infiltrationMmPerDay * elapsedDays, freeCapacity);
    const surfaceRate = NATURAL_SCENARIO.climate.surfaceEvaporationMmPerDayAt20C
      * cell.climate.solarMjPerM2Day / 20
      * temperatureEvaporationFactor(cell.climate.temperatureC);
    const surfaceEvaporation = Math.min(surfaceAfterRain - infiltration, surfaceRate * elapsedDays);
    const soilAfterInfiltration = cell.water.soilMm + infiltration;
    const soilMoistureFactor = clamp(soilAfterInfiltration / cell.water.capacityMm * 1.8, 0.18, 1);
    const soilRate = NATURAL_SCENARIO.climate.soilEvaporationMmPerDayAt20C
      * cell.climate.solarMjPerM2Day / 20
      * temperatureEvaporationFactor(cell.climate.temperatureC)
      * soilMoistureFactor;
    const soilEvaporation = Math.min(soilAfterInfiltration, soilRate * elapsedDays);
    const remainingSurface = Math.max(0, surfaceAfterRain - infiltration - surfaceEvaporation);
    proposals.push({
      cell,
      soilAfter: soilAfterInfiltration - soilEvaporation,
      infiltration,
      surfaceEvaporation,
      soilEvaporation,
      remainingSurface,
      runoffOut: 0,
      boundaryOutflow: 0,
      flowTo: -1,
      precipitation,
    });
    precipitationTotal += precipitation;
    infiltrationTotal += infiltration;
    surfaceEvaporationTotal += surfaceEvaporation;
    soilEvaporationTotal += soilEvaporation;
  }

  const hydraulicHeads = proposals.map(({ cell, remainingSurface }) => cell.terrain.elevationM + remainingSurface / 1000);
  const useDynamicHydraulicHead = ['1.4.0', '1.5.0', '1.6.0', NATURAL_SCENARIO.scenarioVersion].includes(natural.scenarioVersion);
  for (const proposal of proposals) {
    const { cell, remainingSurface } = proposal;
    const downstream = useDynamicHydraulicHead
      ? steepestHydraulicNeighbor(cell, natural.width, natural.height, natural.cellSizeM, hydraulicHeads)
      : cell.terrain.flowTo;
    const hydraulicSlope = downstream < 0
      ? 0
      : useDynamicHydraulicHead
        ? hydraulicSlopeBetween(cell.index, downstream, natural.width, natural.cellSizeM, hydraulicHeads)
        : cell.terrain.slope;
    const soilProfile = SOIL_PROFILES.get(cell.terrain.soilType) as SoilProfile;
    const runoffFraction = downstream < 0 ? 0 : clamp(soilProfile.runoffFraction + hydraulicSlope * 1.55, 0, 0.82);
    const boundaryOutlet = isOpenBoundaryOutlet(natural, cell, downstream);
    proposal.flowTo = downstream;
    proposal.runoffOut = remainingSurface * runoffFraction;
    proposal.boundaryOutflow = boundaryOutlet
      ? remainingSurface * (cell.terrain.waterBody === 'river' ? 0.82 : 0.36)
      : 0;
    outgoing[cell.index] = proposal.runoffOut;
    if (downstream >= 0) incoming[downstream] = (incoming[downstream] as number) + proposal.runoffOut;
    runoffTotal += proposal.runoffOut;
    boundaryOutflowTotal += proposal.boundaryOutflow;
  }

  let surfaceTotal = 0;
  let soilTotal = 0;
  for (const proposal of proposals) {
    const { cell } = proposal;
    const runoffIn = incoming[cell.index] as number;
    if (useDynamicHydraulicHead) cell.water.lastFlowTo = proposal.flowTo;
    const surfaceAfterRain = cell.water.surfaceMm + proposal.precipitation;
    const surfaceRemaining = surfaceAfterRain - proposal.infiltration - proposal.surfaceEvaporation - proposal.runoffOut - proposal.boundaryOutflow;
    cell.water.surfaceMm = round4(Math.max(0, surfaceRemaining + runoffIn));
    cell.water.soilMm = round4(Math.max(0, Math.min(cell.water.capacityMm, proposal.soilAfter)));
    cell.water.lastFlows = nonZeroFlows({
      precipitationMm: round4(proposal.precipitation),
      infiltrationMm: round4(proposal.infiltration),
      runoffOutMm: round4(proposal.runoffOut),
      runoffInMm: round4(runoffIn),
      surfaceEvaporationMm: round4(proposal.surfaceEvaporation),
      soilEvaporationMm: round4(proposal.soilEvaporation),
      transpirationMm: 0,
      boundaryOutflowMm: round4(proposal.boundaryOutflow),
    });
    surfaceTotal += cell.water.surfaceMm;
    soilTotal += cell.water.soilMm;
  }

  const bankSeepageTotal = hasGeomorphology(natural)
    ? transferBankSeepage(natural, elapsedDays)
    : 0;
  surfaceTotal -= bankSeepageTotal;
  soilTotal += bankSeepageTotal;

  natural.totals.surfaceEvaporationMmM2 = round6(natural.totals.surfaceEvaporationMmM2 + surfaceEvaporationTotal * cellAreaM2);
  natural.totals.soilEvaporationMmM2 = round6(natural.totals.soilEvaporationMmM2 + soilEvaporationTotal * cellAreaM2);
  natural.totals.runoffBoundaryMmM2 = round6(natural.totals.runoffBoundaryMmM2 + boundaryOutflowTotal * cellAreaM2);
  world.metrics['hydrology.surfaceWaterMmM2'] = round3(surfaceTotal * cellAreaM2);
  world.metrics['hydrology.soilWaterMmM2'] = round3(soilTotal * cellAreaM2);
  world.metrics['hydrology.meanSurfaceWaterMm'] = round4(surfaceTotal / natural.cells.length);
  world.metrics['hydrology.meanSoilWaterMm'] = round4(soilTotal / natural.cells.length);
  world.metrics['hydrology.meanInfiltrationMm'] = round4(infiltrationTotal / natural.cells.length);
  world.metrics['hydrology.meanRunoffMm'] = round4(runoffTotal / natural.cells.length);
  world.metrics['hydrology.runoffTransfersMmM2'] = round3(runoffTotal * cellAreaM2);
  world.metrics['hydrology.boundaryOutflowMmM2'] = round3(boundaryOutflowTotal * cellAreaM2);
  if (hasGeomorphology(natural)) {
    world.metrics['hydrology.bankSeepageMmM2'] = round3(bankSeepageTotal * cellAreaM2);
    world.metrics['hydrology.meanBankSeepageMm'] = round4(bankSeepageTotal / natural.cells.length);
  }

  const events: SimulationEvent[] = [];
  if (runoffTotal > 0.01 || infiltrationTotal > 0.01 || boundaryOutflowTotal > 0.01) {
    events.push({
      tick,
      systemId: 'hydrology:surface-and-soil-water',
      eventType: runoffTotal > 0.01 ? 'hydrology:runoff' : 'hydrology:infiltration',
      actorIds: [],
      data: {
        infiltrationMmM2: round3(infiltrationTotal * cellAreaM2),
        runoffTransferMmM2: round3(runoffTotal * cellAreaM2),
        surfaceEvaporationMmM2: round3(surfaceEvaporationTotal * cellAreaM2),
        soilEvaporationMmM2: round3(soilEvaporationTotal * cellAreaM2),
        cellsWithRunoff: outgoing.filter((amount) => amount > 0.01).length,
        boundaryOutflowMmM2: round3(boundaryOutflowTotal * cellAreaM2),
      },
    });
  }
  if (bankSeepageTotal > 0.01) {
    events.push({
      tick,
      systemId: 'hydrology:surface-and-soil-water',
      eventType: 'hydrology:bank-seepage',
      actorIds: [],
      data: { bankSeepageMmM2: round3(bankSeepageTotal * cellAreaM2), affectedBanks: natural.cells.filter((cell) => (cell.water.lastFlows.bankSeepageInMm ?? 0) > 0).length },
    });
  }
  return events;
}

function isOpenBoundaryOutlet(natural: NaturalWorldEntity, cell: NaturalWorldCellState, downstream: number): boolean {
  if (natural.boundary !== 'open' || downstream >= 0 || cell.terrain.waterBody === undefined || cell.terrain.waterBody === 'none') return false;
  return cell.x === 0 || cell.y === 0 || cell.x === natural.width - 1 || cell.y === natural.height - 1;
}

function hasGeomorphology(natural: NaturalWorldEntity): boolean {
  return natural.scenarioVersion === '1.6.0' || natural.scenarioVersion === NATURAL_SCENARIO.scenarioVersion;
}

function transferBankSeepage(natural: NaturalWorldEntity, elapsedDays: number): number {
  const outflow = new Array<number>(natural.cells.length).fill(0);
  const inflow = new Array<number>(natural.cells.length).fill(0);
  const room = natural.cells.map((cell) => Math.max(0, cell.water.capacityMm - cell.water.soilMm));
  let total = 0;
  for (const source of natural.cells) {
    if (source.terrain.waterBody === undefined || source.terrain.waterBody === 'none' || source.water.surfaceMm <= 0) continue;
    let targets = FLOW_NEIGHBORS.map(([dx, dy]) => {
      const x = source.x + dx;
      const y = source.y + dy;
      return x < 0 || x >= natural.width || y < 0 || y >= natural.height ? -1 : y * natural.width + x;
    }).filter((index) => index >= 0 && natural.cells[index]!.terrain.waterBody === 'none'
      && natural.cells[index]!.terrain.slope <= NATURAL_SCENARIO.soil.riparianSlopeThreshold
      && (room[index] as number) > 1e-9).sort((left, right) => left - right);
    let remaining = Math.min(source.water.surfaceMm, NATURAL_SCENARIO.soil.bankSeepageMmPerDay * elapsedDays);
    while (remaining > 1e-9 && targets.length > 0) {
      const share = remaining / targets.length;
      const nextTargets: number[] = [];
      for (const targetIndex of targets) {
        const transfer = Math.min(share, room[targetIndex] as number);
        if (transfer <= 0) continue;
        outflow[source.index] = (outflow[source.index] as number) + transfer;
        inflow[targetIndex] = (inflow[targetIndex] as number) + transfer;
        room[targetIndex] = (room[targetIndex] as number) - transfer;
        remaining -= transfer;
        if ((room[targetIndex] as number) > 1e-9) nextTargets.push(targetIndex);
      }
      if (nextTargets.length === targets.length && share <= 1e-9) break;
      targets = nextTargets;
    }
    total += outflow[source.index] as number;
  }
  for (const cell of natural.cells) {
    cell.water.surfaceMm = round4(Math.max(0, cell.water.surfaceMm - (outflow[cell.index] as number)));
    cell.water.soilMm = round4(Math.min(cell.water.capacityMm, cell.water.soilMm + (inflow[cell.index] as number)));
    const seepageOut = round4(outflow[cell.index] as number);
    const seepageIn = round4(inflow[cell.index] as number);
    if (seepageOut > 0) cell.water.lastFlows.bankSeepageOutMm = seepageOut;
    else delete cell.water.lastFlows.bankSeepageOutMm;
    if (seepageIn > 0) cell.water.lastFlows.bankSeepageInMm = seepageIn;
    else delete cell.water.lastFlows.bankSeepageInMm;
  }
  return total;
}

function nonZeroFlows(flows: NaturalWorldCellState['water']['lastFlows']): NaturalWorldCellState['water']['lastFlows'] {
  return Object.fromEntries(Object.entries(flows).filter(([, amount]) => amount !== 0)) as NaturalWorldCellState['water']['lastFlows'];
}

function steepestHydraulicNeighbor(cell: NaturalWorldCellState, width: number, height: number, cellSizeM: number, hydraulicHeads: number[]): number {
  let bestIndex = -1;
  let bestSlope = 0;
  for (const [dx, dy, distanceFactor] of FLOW_NEIGHBORS) {
    const x = cell.x + dx;
    const y = cell.y + dy;
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    const neighborIndex = y * width + x;
    const slope = ((hydraulicHeads[cell.index] as number) - (hydraulicHeads[neighborIndex] as number)) / (cellSizeM * distanceFactor);
    if (slope > bestSlope + 1e-12) {
      bestSlope = slope;
      bestIndex = neighborIndex;
    }
  }
  return bestIndex;
}

function hydraulicSlopeBetween(fromIndex: number, toIndex: number, width: number, cellSizeM: number, hydraulicHeads: number[]): number {
  const xDistance = Math.abs((toIndex % width) - (fromIndex % width));
  const yDistance = Math.abs(Math.floor(toIndex / width) - Math.floor(fromIndex / width));
  const distance = cellSizeM * (xDistance === 1 && yDistance === 1 ? Math.SQRT2 : 1);
  return Math.max(0, ((hydraulicHeads[fromIndex] as number) - (hydraulicHeads[toIndex] as number)) / distance);
}

function updateSoil(world: WorldState, tick: number, context: TickSystemContext): readonly SimulationEvent[] {
  if (world.scenarioId !== NATURAL_SCENARIO.scenarioId) return [];
  const natural = getNaturalWorld(world);
  const cellAreaM2 = natural.cellSizeM ** 2;
  const elapsedDays = context.elapsedTicks / natural.ticksPerDay;
  const erosionMatter = new Array<number>(natural.cells.length).fill(0);
  const erosionNitrogen = new Array<number>(natural.cells.length).fill(0);
  let decompositionTotal = 0;
  let respirationTotal = 0;
  let mineralizedNitrogenTotal = 0;
  let erosionTotal = 0;
  let depositionTotal = 0;

  for (const cell of natural.cells) {
    const moisture = clamp(cell.water.soilMm / cell.water.capacityMm, 0, 1);
    const temperature = temperatureBiologyFactor(cell.climate.temperatureC);
    const activityTarget = clamp((0.18 + moisture * 0.72) * temperature, 0.04, 1);
    cell.soil.decomposerActivity = round4(cell.soil.decomposerActivity + (activityTarget - cell.soil.decomposerActivity) * clamp(0.16 * elapsedDays, 0, 1));
    const decompositionFraction = clamp(NATURAL_SCENARIO.soil.decompositionRatePerDay * cell.soil.decomposerActivity * elapsedDays, 0, 0.25);
    const decomposedMatter = cell.soil.detritusGPerM2 * decompositionFraction;
    const decomposedNitrogen = cell.soil.detritusGPerM2 > 0
      ? cell.soil.detritusNitrogenGPerM2 * (decomposedMatter / cell.soil.detritusGPerM2)
      : 0;
    const humifiedMatter = decomposedMatter * NATURAL_SCENARIO.soil.humificationFraction;
    const mineralizedNitrogen = decomposedNitrogen * NATURAL_SCENARIO.soil.nitrogenMineralizationFraction;
    const organicNitrogen = decomposedNitrogen - mineralizedNitrogen;
    const respiration = decomposedMatter - humifiedMatter;
    cell.soil.detritusGPerM2 = round4(Math.max(0, cell.soil.detritusGPerM2 - decomposedMatter));
    cell.soil.detritusNitrogenGPerM2 = round5(Math.max(0, cell.soil.detritusNitrogenGPerM2 - decomposedNitrogen));
    cell.soil.organicMatterGPerM2 = round4(cell.soil.organicMatterGPerM2 + humifiedMatter);
    cell.soil.organicNitrogenGPerM2 = round5(cell.soil.organicNitrogenGPerM2 + organicNitrogen);
    cell.soil.mineralNitrogenGPerM2 = round5(cell.soil.mineralNitrogenGPerM2 + mineralizedNitrogen);
    decompositionTotal += decomposedMatter * cellAreaM2;
    respirationTotal += respiration * cellAreaM2;
    mineralizedNitrogenTotal += mineralizedNitrogen * cellAreaM2;

    const profile = SOIL_PROFILES.get(cell.terrain.soilType) as SoilProfile;
    const runoff = cell.water.lastFlows.runoffOutMm ?? 0;
    const slopeFactor = clamp(cell.terrain.slope * 13, 0, 1.4);
    const runoffFactor = clamp(runoff / 9, 0, 1.5);
    const erosionFraction = clamp(
      NATURAL_SCENARIO.soil.erosionRateMmPerDay * elapsedDays * runoffFactor * slopeFactor * (1 - profile.erosionResistance) * 0.36,
      0,
      0.025,
    );
    const erodedMatter = cell.soil.organicMatterGPerM2 * erosionFraction;
    const erodedNitrogen = cell.soil.organicNitrogenGPerM2 * erosionFraction;
    cell.soil.organicMatterGPerM2 = round4(Math.max(0, cell.soil.organicMatterGPerM2 - erodedMatter));
    cell.soil.organicNitrogenGPerM2 = round5(Math.max(0, cell.soil.organicNitrogenGPerM2 - erodedNitrogen));
    cell.soil.lastErosionGPerM2 = round4(erodedMatter);
    cell.soil.lastDepositionGPerM2 = 0;
    const sedimentDestination = hasGeomorphology(natural)
      ? cell.water.lastFlowTo ?? cell.terrain.flowTo
      : cell.terrain.flowTo;
    if (sedimentDestination >= 0) {
      const destinationIndex = sedimentDestination;
      erosionMatter[destinationIndex] = (erosionMatter[destinationIndex] as number) + erodedMatter;
      erosionNitrogen[destinationIndex] = (erosionNitrogen[destinationIndex] as number) + erodedNitrogen;
    } else if (hasGeomorphology(natural)) {
      erosionMatter[cell.index] = (erosionMatter[cell.index] as number) + erodedMatter;
      erosionNitrogen[cell.index] = (erosionNitrogen[cell.index] as number) + erodedNitrogen;
    }
    erosionTotal += erodedMatter * cellAreaM2;
  }

  for (const cell of natural.cells) {
    const depositedMatter = erosionMatter[cell.index] as number;
    const depositedNitrogen = erosionNitrogen[cell.index] as number;
    if (depositedMatter > 0) {
      cell.soil.organicMatterGPerM2 = round4(cell.soil.organicMatterGPerM2 + depositedMatter);
      cell.soil.organicNitrogenGPerM2 = round5(cell.soil.organicNitrogenGPerM2 + depositedNitrogen);
      cell.soil.lastDepositionGPerM2 = round4(depositedMatter);
      depositionTotal += depositedMatter * cellAreaM2;
    }
  }

  const geomorphology = hasGeomorphology(natural)
    ? updateGeomorphology(world, natural, elapsedDays)
    : { erodedKg: 0, depositedKg: 0, storedKg: 0, newRiverCells: 0, drownedPlantMatterG: 0 };

  natural.totals.erosionG = round6(natural.totals.erosionG + erosionTotal);
  natural.totals.depositionG = round6(natural.totals.depositionG + depositionTotal);
  if (hasGeomorphology(natural)) {
    natural.totals.mineralErosionKg = round6((natural.totals.mineralErosionKg ?? 0) + geomorphology.erodedKg);
    natural.totals.mineralDepositionKg = round6((natural.totals.mineralDepositionKg ?? 0) + geomorphology.depositedKg);
  }
  natural.totals.decompositionRespirationG = round6(natural.totals.decompositionRespirationG + respirationTotal);
  natural.totals.nitrogenMineralizedG = round6(natural.totals.nitrogenMineralizedG + mineralizedNitrogenTotal);
  world.metrics['soil.meanMineralNitrogenGPerM2'] = round4(sum(natural.cells.map((cell) => cell.soil.mineralNitrogenGPerM2)) / natural.cells.length);
  world.metrics['soil.meanOrganicMatterGPerM2'] = round3(sum(natural.cells.map((cell) => cell.soil.organicMatterGPerM2)) / natural.cells.length);
  world.metrics['soil.meanDetritusGPerM2'] = round3(sum(natural.cells.map((cell) => cell.soil.detritusGPerM2)) / natural.cells.length);
  world.metrics['soil.decompositionG'] = round3(decompositionTotal);
  world.metrics['soil.erosionG'] = round3(erosionTotal);
  world.metrics['soil.depositionG'] = round3(depositionTotal);
  if (hasGeomorphology(natural)) {
    world.metrics['geology.mineralErosionKg'] = round3(geomorphology.erodedKg);
    world.metrics['geology.mineralDepositionKg'] = round3(geomorphology.depositedKg);
    world.metrics['geology.sedimentStoredKg'] = round3(geomorphology.storedKg);
    world.metrics['geology.meanElevationM'] = round3(sum(natural.cells.map((cell) => cell.terrain.elevationM)) / natural.cells.length);
    world.metrics['geology.permanentRiverCells'] = natural.cells.filter((cell) => cell.terrain.waterBody === 'river').length;
    world.metrics['geology.riparianWetlandCells'] = natural.cells.filter((cell) => cell.terrain.habitat === 'wetland' && cell.terrain.waterBody === 'none').length;
  }

  const events: SimulationEvent[] = [];
  if (decompositionTotal > 0.1) {
    events.push({
      tick,
      systemId: 'soil:decomposition-and-erosion',
      eventType: 'soil:decomposition',
      actorIds: [],
      data: { matterDecomposedG: round3(decompositionTotal), matterRespiredG: round3(respirationTotal), nitrogenMineralizedG: round4(mineralizedNitrogenTotal) },
    });
  }
  if (erosionTotal > 0.1 || depositionTotal > 0.1) {
    events.push({
      tick,
      systemId: 'soil:decomposition-and-erosion',
      eventType: 'soil:erosion-transfer',
      actorIds: [],
      data: {
        erodedG: round3(erosionTotal),
        depositedG: round3(depositionTotal),
        netBoundaryLossG: hasGeomorphology(natural) ? 0 : round3(erosionTotal - depositionTotal),
      },
    });
  }
  if (geomorphology.erodedKg > 0.001 || geomorphology.depositedKg > 0.001 || geomorphology.newRiverCells > 0) {
    events.push({
      tick,
      systemId: 'soil:decomposition-and-erosion',
      eventType: geomorphology.newRiverCells > 0 ? 'geology:channel-incision' : 'geology:sediment-transfer',
      actorIds: [],
      data: {
        erodedMineralSedimentKg: round3(geomorphology.erodedKg),
        depositedMineralSedimentKg: round3(geomorphology.depositedKg),
        mobileSedimentKg: round3(geomorphology.storedKg),
        newlyFormedRiverCells: geomorphology.newRiverCells,
        drownedPlantMatterG: round3(geomorphology.drownedPlantMatterG),
      },
    });
  }
  return events;
}

type GeomorphologyResult = { erodedKg: number; depositedKg: number; storedKg: number; newRiverCells: number; drownedPlantMatterG: number };

function setOptionalPositive<K extends 'sedimentLoadKgPerM2' | 'lastMineralErosionKgPerM2' | 'lastMineralDepositionKgPerM2'>(
  soil: NaturalWorldCellState['soil'],
  key: K,
  value: number,
): void {
  if (value > 0) soil[key] = value;
  else delete soil[key];
}

function updateGeomorphology(world: WorldState, natural: NaturalWorldEntity, elapsedDays: number): GeomorphologyResult {
  const cellAreaM2 = natural.cellSizeM ** 2;
  const bulkDensity = NATURAL_SCENARIO.soil.sedimentBulkDensityKgPerM3;
  const catchmentCells = accumulateCatchmentCells(natural);
  const incoming = new Array<number>(natural.cells.length).fill(0);
  let erodedKg = 0;
  let depositedKg = 0;
  let drownedPlantMatterG = 0;

  for (const cell of natural.cells) {
    const profile = SOIL_PROFILES.get(cell.terrain.soilType) as SoilProfile;
    const flowMm = (cell.water.lastFlows.runoffOutMm ?? 0) + (cell.water.lastFlows.runoffInMm ?? 0);
    const contributing = catchmentCells[cell.index] as number;
    const runoffFactor = clamp(flowMm / 2.2, 0, 2.4);
    const catchmentFactor = clamp(Math.sqrt(contributing / 16), 0.35, 3.4);
    const slopeFactor = clamp(cell.terrain.slope * 24, 0.12, 1.4);
    const exposedRockFactor = cell.terrain.exposedRock ? 0.38 : 1;
    const channelFactor = cell.terrain.waterBody === 'river' ? 1.65 : 1;
    const erosionMm = Math.min(0.35,
      NATURAL_SCENARIO.soil.erosionRateMmPerDay * elapsedDays * runoffFactor * catchmentFactor
      * slopeFactor * (1 - profile.erosionResistance) * exposedRockFactor * channelFactor);
    const availableDepthMm = Math.max(0, (cell.terrain.elevationM - NATURAL_SCENARIO.terrain.minimumElevationM) * 1000);
    const actualErosionMm = Math.min(erosionMm, availableDepthMm);
    const eroded = actualErosionMm / 1000 * bulkDensity;
    const sedimentLoad = (cell.soil.sedimentLoadKgPerM2 ?? 0) + eroded;
    const downstream = cell.water.lastFlowTo ?? cell.terrain.flowTo;
    const slowFlow = 1 - clamp(flowMm / 3, 0, 1);
    const lowlandSettling = clamp((0.12 - cell.terrain.slope) * 1.7, 0, 0.32);
    const waterSettling = cell.terrain.waterBody === 'lake' ? 0.7 : cell.terrain.waterBody === 'river' ? 0.24 : 0;
    const hasActiveFlow = flowMm > 0.05;
    const settlingFraction = downstream < 0
      ? 1
      : hasActiveFlow
        ? clamp(0.08 + lowlandSettling + waterSettling + slowFlow * 0.18, 0.05, 0.92)
        : 0.02;
    const erosionM = actualErosionMm / 1000;
    const elevationAfterErosion = cell.terrain.elevationM - erosionM;
    const depositCapacity = Math.max(0, (NATURAL_SCENARIO.terrain.maximumElevationM - elevationAfterErosion) * bulkDensity);
    const deposited = Math.min(sedimentLoad * settlingFraction, depositCapacity);
    const transported = sedimentLoad - deposited;
    if (!hasActiveFlow || downstream < 0 || downstream >= natural.cells.length) incoming[cell.index] = (incoming[cell.index] as number) + transported;
    else incoming[downstream] = (incoming[downstream] as number) + transported;

    const depositionM = deposited / bulkDensity;
    cell.terrain.elevationM = round6(clamp(cell.terrain.elevationM - erosionM + depositionM,
      NATURAL_SCENARIO.terrain.minimumElevationM, NATURAL_SCENARIO.terrain.maximumElevationM));
    const incision = round6(Math.max(0, (cell.terrain.channelIncisionM ?? 0) + erosionM - depositionM));
    if (incision > 0) cell.terrain.channelIncisionM = incision;
    else delete cell.terrain.channelIncisionM;
    setOptionalPositive(cell.soil, 'sedimentLoadKgPerM2', round5(transported));
    setOptionalPositive(cell.soil, 'lastMineralErosionKgPerM2', round5(eroded));
    setOptionalPositive(cell.soil, 'lastMineralDepositionKgPerM2', round5(deposited));
    erodedKg += eroded * cellAreaM2;
    depositedKg += deposited * cellAreaM2;
  }

  for (const cell of natural.cells) {
    const load = incoming[cell.index] as number;
    setOptionalPositive(cell.soil, 'sedimentLoadKgPerM2', round5(load));
  }

  recomputeDrainage(natural);
  const updatedCatchmentCells = accumulateCatchmentCells(natural);
  let newRiverCells = 0;
  for (const cell of natural.cells) {
    if (cell.terrain.waterBody !== 'none') continue;
    if ((cell.terrain.channelIncisionM ?? 0) < NATURAL_SCENARIO.terrain.riverFormationMinimumIncisionM) continue;
    if ((updatedCatchmentCells[cell.index] as number) < NATURAL_SCENARIO.terrain.riverFormationMinimumCatchmentCells) continue;
    const drownedTrees = cell.plants.filter((plant) => plant.speciesId !== 'grass' && plant.speciesId !== 'shrub');
    for (const tree of drownedTrees) {
      const matter = tree.biomassGPerM2 + tree.seedBankMatterGPerM2;
      const nitrogen = tree.nitrogenGPerM2 + tree.seedBankNitrogenGPerM2;
      cell.soil.detritusGPerM2 = round4(cell.soil.detritusGPerM2 + matter);
      cell.soil.detritusNitrogenGPerM2 = round5(cell.soil.detritusNitrogenGPerM2 + nitrogen);
      drownedPlantMatterG += matter * cellAreaM2;
    }
    if (drownedTrees.length > 0) cell.plants = cell.plants.filter((plant) => plant.speciesId === 'grass' || plant.speciesId === 'shrub');
    cell.terrain.waterBody = 'river';
    cell.terrain.habitat = 'wetland';
    newRiverCells += 1;
  }
  updateRiparianHabitats(natural);

  const storedKg = sum(natural.cells.map((cell) => (cell.soil.sedimentLoadKgPerM2 ?? 0) * cellAreaM2));
  world.metrics['geology.meanSlope'] = round5(sum(natural.cells.map((cell) => cell.terrain.slope)) / natural.cells.length);
  return { erodedKg, depositedKg, storedKg, newRiverCells, drownedPlantMatterG };
}

function accumulateCatchmentCells(natural: NaturalWorldEntity): number[] {
  const contributing = new Array<number>(natural.cells.length).fill(1);
  const downhillOrder = natural.cells.map((cell) => cell.index)
    .sort((left, right) => natural.cells[right]!.terrain.elevationM - natural.cells[left]!.terrain.elevationM || left - right);
  for (const index of downhillOrder) {
    const downstream = natural.cells[index]!.terrain.flowTo;
    if (downstream >= 0 && downstream < natural.cells.length) contributing[downstream] = (contributing[downstream] as number) + (contributing[index] as number);
  }
  return contributing;
}

function recomputeDrainage(natural: NaturalWorldEntity): void {
  for (const cell of natural.cells) {
    let bestIndex = -1;
    let bestSlope = 0;
    for (const [dx, dy, distanceFactor] of FLOW_NEIGHBORS) {
      const x = cell.x + dx;
      const y = cell.y + dy;
      if (x < 0 || x >= natural.width || y < 0 || y >= natural.height) continue;
      const neighborIndex = y * natural.width + x;
      const slope = (cell.terrain.elevationM - natural.cells[neighborIndex]!.terrain.elevationM)
        / (natural.cellSizeM * distanceFactor);
      if (slope > bestSlope + 1e-12) {
        bestSlope = slope;
        bestIndex = neighborIndex;
      }
    }
    cell.terrain.flowTo = bestIndex;
    cell.terrain.slope = round5(bestSlope);
  }
}

function updateRiparianHabitats(natural: NaturalWorldEntity): void {
  for (const source of natural.cells) {
    if (source.terrain.waterBody === undefined || source.terrain.waterBody === 'none') continue;
    for (const [dx, dy] of FLOW_NEIGHBORS) {
      const x = source.x + dx;
      const y = source.y + dy;
      if (x < 0 || x >= natural.width || y < 0 || y >= natural.height) continue;
      const bank = natural.cells[y * natural.width + x]!;
      if (bank.terrain.waterBody !== 'none' || bank.terrain.exposedRock) continue;
      if (bank.terrain.slope <= NATURAL_SCENARIO.soil.riparianSlopeThreshold) bank.terrain.habitat = 'wetland';
    }
  }
}

export function updatePlantWaterTotal(natural: NaturalWorldEntity, transpirationMm: number): void {
  natural.totals.transpirationMmM2 = round6(natural.totals.transpirationMmM2 + transpirationMm * natural.cellSizeM ** 2);
}

export function updatePlantMatterTotals(natural: NaturalWorldEntity, photosynthesisG: number, respirationG: number): void {
  const cellAreaM2 = natural.cellSizeM ** 2;
  natural.totals.photosynthesisG = round6(natural.totals.photosynthesisG + photosynthesisG * cellAreaM2);
  natural.totals.plantRespirationG = round6(natural.totals.plantRespirationG + respirationG * cellAreaM2);
}

export function updateMineralMetrics(world: WorldState, natural: NaturalWorldEntity): void {
  const reserveByResource = new Map<string, number>();
  let exposedCells = 0;
  for (const cell of natural.cells) {
    for (const deposit of cell.minerals) {
      reserveByResource.set(deposit.resourceId, (reserveByResource.get(deposit.resourceId) ?? 0) + deposit.reserveKg);
      if (deposit.resourceId !== 'stone' && deposit.exposed) exposedCells += 1;
    }
  }
  for (const [resourceId, reserve] of reserveByResource) world.metrics[`geology.reserve.${resourceId}Kg`] = round1(reserve);
  world.metrics['geology.exposedOreCells'] = exposedCells;
}

export function updateVegetationMetrics(world: WorldState, natural: NaturalWorldEntity): void {
  const biomassBySpecies = new Map<string, number>();
  const coverBySpecies = new Map<string, number>();
  let totalCoverage = 0;
  let liveCohorts = 0;
  for (const cell of natural.cells) {
    let cellCoverage = 0;
    for (const cohort of cell.plants) {
      const profile = NATURAL_SCENARIO.plants.find((candidate) => candidate.id === cohort.speciesId)!;
      biomassBySpecies.set(cohort.speciesId, (biomassBySpecies.get(cohort.speciesId) ?? 0) + cohort.biomassGPerM2);
      const coverage = Math.min(profile.maximumCanopyFraction, profile.maximumCanopyFraction * cohort.biomassGPerM2 / profile.maximumBiomassGPerM2);
      coverBySpecies.set(cohort.speciesId, (coverBySpecies.get(cohort.speciesId) ?? 0) + coverage);
      cellCoverage += coverage;
      if (cohort.biomassGPerM2 > 1) liveCohorts += 1;
    }
    totalCoverage += clamp(cellCoverage, 0, 1);
  }
  for (const profile of NATURAL_SCENARIO.plants) {
    world.metrics[`vegetation.biomass.${profile.id}GPerM2`] = round3((biomassBySpecies.get(profile.id) ?? 0) / natural.cells.length);
    world.metrics[`vegetation.cover.${profile.id}`] = round4((coverBySpecies.get(profile.id) ?? 0) / natural.cells.length);
  }
  world.metrics['vegetation.meanCoverage'] = round4(totalCoverage / natural.cells.length);
  world.metrics['vegetation.liveCohorts'] = liveCohorts;
  world.metrics['vegetation.totalBiomassGPerM2'] = round3(sum([...biomassBySpecies.values()]) / natural.cells.length);
}

function orographicFactor(cell: NaturalWorldCellState): number {
  const elevationFactor = clamp(0.78 + cell.terrain.elevationM / NATURAL_SCENARIO.terrain.maximumElevationM * 0.42, 0.72, 1.22);
  const slopeFactor = clamp(1 + cell.terrain.slope * 1.7, 0.9, 1.25);
  return elevationFactor * slopeFactor;
}

function temperatureEvaporationFactor(temperatureC: number): number {
  return clamp((temperatureC + 5) / 25, 0, 1.35);
}

function temperatureBiologyFactor(temperatureC: number): number {
  return clamp((temperatureC + 5) / 23, 0, 1);
}

function sum(values: number[]): number { return values.reduce((total, value) => total + value, 0); }
function nextRandomFloat(world: WorldState, systemId: string): number { return drawFromSystem(world.rng, world.seed, systemId) / UINT32_RANGE; }
function round1(value: number): number { return Math.round(value * 10) / 10; }
function round2(value: number): number { return Math.round(value * 100) / 100; }
function round3(value: number): number { return Math.round(value * 1000) / 1000; }
function round4(value: number): number { return Math.round(value * 10_000) / 10_000; }
function round5(value: number): number { return Math.round(value * 100_000) / 100_000; }
function round6(value: number): number { return Math.round(value * 1_000_000) / 1_000_000; }
function clamp(value: number, minimum: number, maximum: number): number { return Math.min(maximum, Math.max(minimum, value)); }
