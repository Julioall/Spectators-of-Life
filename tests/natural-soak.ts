import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { canonicalStringify, utf8ByteLength } from '../src/core/canonical-json';
import { MAX_WORLD_STATE_BYTES } from '../src/core/constants';
import { NATURAL_SCENARIO } from '../src/core/natural/parameters';
import { createNaturalWorld, NATURAL_SYSTEMS } from '../src/core/natural/scenario';
import { getNaturalWorld, type NaturalWorldEntity } from '../src/core/natural/types';
import { validateWorldState, stepWorld, toSaveDocument } from '../src/core/world';
import type { WorldState } from '../src/core/types';

const SEEDS = ['0000000000000003', '0000000000000006', '000000000000000b'] as const;
const DAYS_PER_YEAR = NATURAL_SCENARIO.world.daysPerSeason * 4;
const WATER_BALANCE_TOLERANCE_M3_PER_DAY = 2;
const CUMULATIVE_WATER_BALANCE_TOLERANCE_M3 = 20;
const RELATIVE_MINERAL_MASS_TOLERANCE = 1e-7;
const RELATIVE_NITROGEN_TOLERANCE = 1e-6;
const CELL_AREA_M2 = NATURAL_SCENARIO.world.cellSizeM ** 2;

type SeasonReport = {
  days: number;
  maximumStateBytes: number;
  maximumSaveBytes: number;
  precipitationM3: number;
  evaporationM3: number;
  transpirationM3: number;
};

describe('ensaio de resistência anual do mundo natural', () => {
  it('mantém estado válido e balanços físicos em três seeds durante as quatro estações', () => {
    const reports = SEEDS.map(runAnnualSoak);
    const report = {
      scenarioId: NATURAL_SCENARIO.scenarioId,
      scenarioVersion: NATURAL_SCENARIO.scenarioVersion,
      daysPerSeed: DAYS_PER_YEAR,
      maximumStateBytesAllowed: MAX_WORLD_STATE_BYTES,
      waterBalanceToleranceM3PerDay: WATER_BALANCE_TOLERANCE_M3_PER_DAY,
      cumulativeWaterBalanceToleranceM3: CUMULATIVE_WATER_BALANCE_TOLERANCE_M3,
      relativeMineralMassTolerance: RELATIVE_MINERAL_MASS_TOLERANCE,
      relativeNitrogenTolerance: RELATIVE_NITROGEN_TOLERANCE,
      units: {
        water: 'm3 over the complete map; daily depths are multiplied by cell area and converted from mm to m',
        mineral: 'kg over the complete map; terrain elevation is used as an equivalent mineral column at configured bulk density, plus mobile sediment',
        nitrogen: 'g over the complete map; all soil and plant nitrogen pools are multiplied by cell area',
      },
      runtime: { node: process.version, platform: process.platform, architecture: process.arch },
      seeds: reports,
    };
    writeFileSync(new URL('../docs/evidence/natural-soak-2026-10-19.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`);

    for (const result of reports) {
      expect(result.finalTick).toBe(DAYS_PER_YEAR * NATURAL_SCENARIO.world.ticksPerDay);
      expect(result.maximumStateBytes).toBeLessThanOrEqual(MAX_WORLD_STATE_BYTES);
      expect(result.maximumDailyWaterBalanceResidualM3).toBeLessThanOrEqual(WATER_BALANCE_TOLERANCE_M3_PER_DAY);
      expect(result.maximumCumulativeWaterBalanceResidualM3).toBeLessThanOrEqual(CUMULATIVE_WATER_BALANCE_TOLERANCE_M3);
      expect(result.maximumRelativeMineralMassResidual).toBeLessThanOrEqual(RELATIVE_MINERAL_MASS_TOLERANCE);
      expect(result.maximumRelativeNitrogenResidual).toBeLessThanOrEqual(RELATIVE_NITROGEN_TOLERANCE);
      expect(result.finalMetrics.annualDecomposedMatterG).toBeGreaterThan(0);
      expect(result.finalMetrics.annualMineralErosionKg).toBeGreaterThan(0);
      expect(result.finalMetrics.annualMineralDepositionKg).toBeGreaterThan(0);
      expect(result.seasons).toHaveProperty('spring');
      expect(result.seasons).toHaveProperty('summer');
      expect(result.seasons).toHaveProperty('autumn');
      expect(result.seasons).toHaveProperty('winter');
      for (const season of Object.values(result.seasons)) expect(season.days).toBe(NATURAL_SCENARIO.world.daysPerSeason);
    }
  }, 360_000);
});

function runAnnualSoak(seed: string) {
  let world = createNaturalWorld(seed);
  const initialNatural = getNaturalWorld(world);
  const initialWater = totalWater(initialNatural);
  const initialMineralMassKg = totalMineralMassKg(initialNatural);
  const initialNitrogenG = totalNitrogenG(initialNatural);
  let maximumStateBytes = sizeBytes(world);
  let maximumDailyWaterBalanceResidualM3 = 0;
  let maximumCumulativeWaterBalanceResidualM3 = 0;
  let maximumMineralMassResidualKg = 0;
  let maximumNitrogenResidualG = 0;
  let maximumRelativeMineralMassResidual = 0;
  let maximumRelativeNitrogenResidual = 0;
  let totalPrecipitationM3 = 0;
  let totalEvaporationM3 = 0;
  let totalTranspirationM3 = 0;
  let totalBoundaryOutflowM3 = 0;
  let annualDecomposedMatterG = 0;
  const seasons: Record<string, SeasonReport> = {};

  for (let day = 1; day <= DAYS_PER_YEAR; day += 1) {
    const beforeNatural = getNaturalWorld(world);
    const waterBefore = totalWater(beforeNatural);
    try {
      world = stepWorld(world, NATURAL_SCENARIO.world.ticksPerDay, NATURAL_SYSTEMS).state;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Seed ${seed}, dia ${day}/${DAYS_PER_YEAR}, tick ${world.tick}: ${detail}`);
    }

    const natural = getNaturalWorld(world);
    annualDecomposedMatterG += world.metrics['soil.decompositionG'] ?? 0;
    const waterAfter = totalWater(natural);
    const precipitationM3 = volumeFromCellDepthsM3(natural.cells.map((cell) => cell.water.lastFlows.precipitationMm ?? 0));
    const evaporationM3 = volumeFromCellDepthsM3(natural.cells.map((cell) => (cell.water.lastFlows.surfaceEvaporationMm ?? 0) + (cell.water.lastFlows.soilEvaporationMm ?? 0)));
    const transpirationM3 = volumeFromCellDepthsM3(natural.cells.map((cell) => cell.water.lastFlows.transpirationMm ?? 0));
    const boundaryOutflowM3 = volumeFromCellDepthsM3(natural.cells.map((cell) => cell.water.lastFlows.boundaryOutflowMm ?? 0));
    const expectedWaterChange = precipitationM3 - evaporationM3 - transpirationM3 - boundaryOutflowM3;
    const dailyWaterResidualM3 = Math.abs((waterAfter - waterBefore) - expectedWaterChange);
    const waterResidualFromStart = Math.abs(waterAfter - initialWater - totalPrecipitationM3 - precipitationM3
      + totalEvaporationM3 + evaporationM3 + totalTranspirationM3 + transpirationM3 + totalBoundaryOutflowM3 + boundaryOutflowM3);

    maximumDailyWaterBalanceResidualM3 = Math.max(maximumDailyWaterBalanceResidualM3, dailyWaterResidualM3);
    maximumCumulativeWaterBalanceResidualM3 = Math.max(maximumCumulativeWaterBalanceResidualM3, waterResidualFromStart);
    totalPrecipitationM3 += precipitationM3;
    totalEvaporationM3 += evaporationM3;
    totalTranspirationM3 += transpirationM3;
    totalBoundaryOutflowM3 += boundaryOutflowM3;

    const mineralMassResidualKg = Math.abs(totalMineralMassKg(natural) - initialMineralMassKg);
    const nitrogenResidualG = Math.abs(totalNitrogenG(natural) - initialNitrogenG);
    maximumMineralMassResidualKg = Math.max(maximumMineralMassResidualKg, mineralMassResidualKg);
    maximumNitrogenResidualG = Math.max(maximumNitrogenResidualG, nitrogenResidualG);
    maximumRelativeMineralMassResidual = Math.max(maximumRelativeMineralMassResidual, mineralMassResidualKg / Math.max(1, initialMineralMassKg));
    maximumRelativeNitrogenResidual = Math.max(maximumRelativeNitrogenResidual, nitrogenResidualG / Math.max(1, initialNitrogenG));

    const currentBytes = sizeBytes(world);
    maximumStateBytes = Math.max(maximumStateBytes, currentBytes);
    const season = seasons[natural.seasonId] ??= {
      days: 0,
      maximumStateBytes: 0,
      maximumSaveBytes: 0,
      precipitationM3: 0,
      evaporationM3: 0,
      transpirationM3: 0,
    };
    season.days += 1;
    season.maximumStateBytes = Math.max(season.maximumStateBytes, currentBytes);
    season.precipitationM3 += precipitationM3;
    season.evaporationM3 += evaporationM3;
    season.transpirationM3 += transpirationM3;
    if (day % NATURAL_SCENARIO.world.daysPerSeason === 0) {
      expect(validateWorldState(world), `save/estado inválido na seed ${seed}, dia ${day}`).toBe(true);
      season.maximumSaveBytes = Math.max(season.maximumSaveBytes, utf8ByteLength(canonicalStringify(toSaveDocument(world))));
    }
  }

  return {
    seed,
    finalTick: world.tick,
    maximumStateBytes,
    waterBudgetM3: {
      initialStored: initialWater,
      precipitation: totalPrecipitationM3,
      evaporation: totalEvaporationM3,
      transpiration: totalTranspirationM3,
      boundaryOutflow: totalBoundaryOutflowM3,
      finalStored: totalWater(getNaturalWorld(world)),
    },
    maximumDailyWaterBalanceResidualM3,
    maximumCumulativeWaterBalanceResidualM3,
    maximumRelativeMineralMassResidual,
    maximumRelativeNitrogenResidual,
    mineralBudgetKg: {
      initialStock: initialMineralMassKg,
      finalStock: totalMineralMassKg(getNaturalWorld(world)),
      maximumAbsoluteResidual: maximumMineralMassResidualKg,
      maximumRelativeResidual: maximumRelativeMineralMassResidual,
    },
    nitrogenBudgetG: {
      initialStock: initialNitrogenG,
      finalStock: totalNitrogenG(getNaturalWorld(world)),
      maximumAbsoluteResidual: maximumNitrogenResidualG,
      maximumRelativeResidual: maximumRelativeNitrogenResidual,
    },
    finalMetrics: {
      vegetationBiomassGPerM2: world.metrics['vegetation.totalBiomassGPerM2'],
      soilMineralNitrogenGPerM2: world.metrics['soil.meanMineralNitrogenGPerM2'],
      soilOrganicMatterGPerM2: world.metrics['soil.meanOrganicMatterGPerM2'],
      sedimentStoredKg: world.metrics['geology.sedimentStoredKg'],
      permanentRiverCells: world.metrics['geology.permanentRiverCells'],
      annualDecomposedMatterG,
      annualDecompositionRespirationG: getNaturalWorld(world).totals.decompositionRespirationG,
      annualMineralErosionKg: getNaturalWorld(world).totals.mineralErosionKg,
      annualMineralDepositionKg: getNaturalWorld(world).totals.mineralDepositionKg,
    },
    seasons,
  };
}

function totalWater(natural: NaturalWorldEntity): number {
  return sum(natural.cells.map((cell) => cell.water.surfaceMm + cell.water.soilMm)) * CELL_AREA_M2 / 1000;
}

function volumeFromCellDepthsM3(depthsMm: number[]): number {
  return sum(depthsMm) * CELL_AREA_M2 / 1000;
}

function totalMineralMassKg(natural: NaturalWorldEntity): number {
  const bulkDensity = NATURAL_SCENARIO.soil.sedimentBulkDensityKgPerM3;
  return sum(natural.cells.map((cell) => (cell.terrain.elevationM - NATURAL_SCENARIO.terrain.minimumElevationM) * bulkDensity * CELL_AREA_M2
    + (cell.soil.sedimentLoadKgPerM2 ?? 0) * CELL_AREA_M2));
}

function totalNitrogenG(natural: NaturalWorldEntity): number {
  return sum(natural.cells.map((cell) => cell.soil.mineralNitrogenGPerM2
    + cell.soil.organicNitrogenGPerM2
    + cell.soil.detritusNitrogenGPerM2
    + sum(cell.plants.map((plant) => plant.nitrogenGPerM2 + plant.seedBankNitrogenGPerM2)))) * CELL_AREA_M2;
}

function sizeBytes(world: WorldState): number {
  return utf8ByteLength(canonicalStringify(world));
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
