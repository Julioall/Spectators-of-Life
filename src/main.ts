import Phaser from 'phaser';
import { PerformanceTracker, type RenderLayerId, type TimingSamples } from './client/performance-metrics';
import { shouldFetchSnapshotAfterAdvance } from './client/snapshot-policy';
import { StepDriver, type DriverState } from './client/step-driver';
import { SimulationClient, type WorkerPort } from './client/worker-transport';
import { logicalStateString } from './core/canonical-json';
import { EMPTY_SCENARIO_ID, EMPTY_SCENARIO_VERSION, NATURAL_SCENARIO_ID, NATURAL_SCENARIO_VERSION } from './core/constants';
import { getNaturalWorld, type NaturalWorldCellState, type NaturalWorldEntity, type PlantStageId, type WaterBodyId } from './core/natural/types';
import type { WorkerResponse, WorldState } from './core/types';
import { FoundationScene } from './render/foundation-scene';
import './styles.css';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'world-canvas',
  width: 1280,
  height: 720,
  backgroundColor: '#304536',
  scene: [FoundationScene],
  scale: { mode: Phaser.Scale.RESIZE },
  render: { antialias: false, pixelArt: true },
});

const worker = new Worker(new URL('./worker/entry.ts', import.meta.url), { type: 'module' });
const client = new SimulationClient(worker as unknown as WorkerPort);
let driver: StepDriver | null = null;
let currentTick: number | null = null;
let currentSchedules: WorldState['schedules'] | null = null;

const statusOutput = requiredElement<HTMLOutputElement>('runtime-status');
const seedInput = requiredElement<HTMLInputElement>('seed-input');
const setupPanel = requiredElement<HTMLDetailsElement>('setup-panel');
const worldDetails = requiredElement<HTMLDetailsElement>('world-details');
const createButton = requiredElement<HTMLButtonElement>('create-button');
const newSeedButton = requiredElement<HTMLButtonElement>('new-seed-button');
const resumeButton = requiredElement<HTMLButtonElement>('resume-button');
const pauseButton = requiredElement<HTMLButtonElement>('pause-button');
const stepButton = requiredElement<HTMLButtonElement>('step-button');
const speedSelect = requiredElement<HTMLSelectElement>('speed-select');
const saveButton = requiredElement<HTMLButtonElement>('save-button');
const loadButton = requiredElement<HTMLButtonElement>('load-button');
const loadInput = requiredElement<HTMLInputElement>('load-input');
const performanceToggle = requiredElement<HTMLButtonElement>('performance-toggle');
const performancePanel = requiredElement<HTMLElement>('performance-panel');
const terrainLightingEnabled = requiredElement<HTMLInputElement>('terrain-lighting-enabled');
const terrainSunAngle = requiredElement<HTMLInputElement>('terrain-sun-angle');
const terrainSunAngleValue = requiredElement<HTMLOutputElement>('terrain-sun-angle-value');
const terrainReliefStrength = requiredElement<HTMLInputElement>('terrain-relief-strength');
const terrainReliefStrengthValue = requiredElement<HTMLOutputElement>('terrain-relief-strength-value');
const altitudeMapToggle = requiredElement<HTMLButtonElement>('altitude-map-toggle');
const altitudeMapLegend = requiredElement<HTMLElement>('altitude-map-legend');
const performanceFpsOutput = requiredElement<HTMLElement>('performance-fps');
const performancePhaserFpsOutput = requiredElement<HTMLElement>('performance-phaser-fps');
const performanceFrameOutput = requiredElement<HTMLElement>('performance-frame');
const performanceRenderOutput = requiredElement<HTMLElement>('performance-render');
const performanceLayersOutput = requiredElement<HTMLElement>('performance-layers');
const performanceLayerDetailsOutput = requiredElement<HTMLElement>('performance-layer-details');
const performanceVegetationDetailsOutput = requiredElement<HTMLElement>('performance-vegetation-details');
const performanceMineralDetailsOutput = requiredElement<HTMLElement>('performance-mineral-details');
const performanceWaterOutput = requiredElement<HTMLElement>('performance-water-motion');
const performanceWaterSurfaceOutput = requiredElement<HTMLElement>('performance-water-surface-detail');
const performanceSimulationOutput = requiredElement<HTMLElement>('performance-simulation');
const performanceSnapshotOutput = requiredElement<HTMLElement>('performance-snapshot');
const performanceWorkerOutput = requiredElement<HTMLElement>('performance-worker');
const performanceTicksOutput = requiredElement<HTMLElement>('performance-ticks');
const performanceCellsOutput = requiredElement<HTMLElement>('performance-cells');
const performanceMemoryOutput = requiredElement<HTMLElement>('performance-memory');
const performanceMemoryTotalOutput = requiredElement<HTMLElement>('performance-memory-total');
const performanceMemoryLimitOutput = requiredElement<HTMLElement>('performance-memory-limit');
const tickOutput = requiredElement<HTMLElement>('tick-value');
const seedOutput = requiredElement<HTMLElement>('seed-value');
const versionOutput = requiredElement<HTMLElement>('version-value');
const errorOutput = requiredElement<HTMLElement>('error-output');
const dateOutput = requiredElement<HTMLElement>('world-date');
const waterOutput = requiredElement<HTMLElement>('water-reading');
const climateOutput = requiredElement<HTMLElement>('climate-reading');
const vegetationOutput = requiredElement<HTMLElement>('vegetation-reading');
const mineralsOutput = requiredElement<HTMLElement>('minerals-reading');
const cellInfoOutput = requiredElement<HTMLElement>('cell-info');
let currentNaturalWorld: NaturalWorldEntity | null = null;
let selectedCellIndex: number | null = null;
const performanceTracker = new PerformanceTracker();
let performanceEnabled = false;
let performanceFrameHandle: number | null = null;
let lastPerformancePaintAt = 0;
let performanceRenderStartedAt: number | null = null;
let performanceSceneConfigured = false;

game.events.on('prerender', () => {
  if (performanceEnabled) performanceRenderStartedAt = now();
});
game.events.on('postrender', () => {
  if (!performanceEnabled || performanceRenderStartedAt === null) return;
  performanceTracker.recordRender(Math.max(0, now() - performanceRenderStartedAt));
  performanceTracker.recordPhaserFps(game.loop.actualFps);
  performanceRenderStartedAt = null;
});

seedInput.value = createRandomSeed();
statusOutput.value = 'Runtime pronto · mundo pausado';

createButton.addEventListener('click', () => void createWorld());
newSeedButton.addEventListener('click', () => { seedInput.value = createRandomSeed(); });
resumeButton.addEventListener('click', () => {
  if (driver === null) return;
  try {
    driver.resume(Number(speedSelect.value));
  } catch (error) {
    showError(error);
  }
});
pauseButton.addEventListener('click', () => void pauseWorld());
stepButton.addEventListener('click', () => void stepOnce());
speedSelect.addEventListener('change', () => {
  try {
    driver?.setSpeed(Number(speedSelect.value));
  } catch (error) {
    showError(error);
  }
});
saveButton.addEventListener('click', () => void exportSave());
loadButton.addEventListener('click', () => loadInput.click());
loadInput.addEventListener('change', () => void importSave());
performanceToggle.addEventListener('click', () => setPerformanceEnabled(!performanceEnabled));
terrainLightingEnabled.addEventListener('change', applyTerrainLightingControls);
terrainSunAngle.addEventListener('input', () => {
  terrainSunAngleValue.value = `${terrainSunAngle.value}°`;
});
terrainSunAngle.addEventListener('change', applyTerrainLightingControls);
terrainReliefStrength.addEventListener('input', () => {
  terrainReliefStrengthValue.value = terrainReliefStrength.value;
});
terrainReliefStrength.addEventListener('change', applyTerrainLightingControls);
altitudeMapToggle.addEventListener('click', () => {
  const visible = altitudeMapToggle.getAttribute('aria-pressed') !== 'true';
  altitudeMapToggle.setAttribute('aria-pressed', String(visible));
  altitudeMapLegend.hidden = !visible;
  getFoundationScene()?.setAltitudeMapVisible(visible);
});
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-map-layer]')) {
  button.addEventListener('click', () => {
    const layer = button.dataset['mapLayer'];
    if (layer !== 'relief' && layer !== 'water' && layer !== 'vegetation' && layer !== 'minerals' && layer !== 'geology') return;
    const enabled = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(enabled));
    getFoundationScene()?.setLayers({ [layer]: enabled });
  });
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && driver?.isRunning() === true) void pauseWorld();
});
window.addEventListener('beforeunload', () => client.close(), { once: true });

async function createWorld(): Promise<void> {
  clearError();
  await pauseDriver();
  createButton.disabled = true;
  try {
    selectedCellIndex = null;
    const ready = await client.createWorld(seedInput.value.trim(), NATURAL_SCENARIO_ID, NATURAL_SCENARIO_VERSION);
    const snapshot = await getSnapshotMeasured();
    updateSnapshot(snapshot.snapshot, ready.worldId, true);
    enableWorldControls(true);
    setupPanel.open = false;
    setStatus('Mundo criado · pausado');
  } catch (error) {
    showError(error);
    setStatus('Não foi possível criar o mundo');
  } finally {
    createButton.disabled = false;
  }
}

async function pauseWorld(): Promise<void> {
  await pauseDriver();
  setStatus('Mundo pausado');
}

async function pauseDriver(): Promise<void> {
  if (driver !== null) await driver.pause();
}

async function stepOnce(): Promise<void> {
  clearError();
  await pauseDriver();
  stepButton.disabled = true;
  try {
    const startedAt = performanceEnabled ? now() : null;
    const advanced = await client.step(1);
    if (startedAt !== null && performanceEnabled) performanceTracker.recordWorker(Math.max(0, now() - startedAt), 1);
    await updateAfterAdvance(advanced);
  } catch (error) {
    showError(error);
  } finally {
    stepButton.disabled = false;
  }
}

async function exportSave(): Promise<void> {
  clearError();
  await pauseDriver();
  try {
    const response = await client.save();
    const blob = new Blob([JSON.stringify(response.save, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `spectators-of-life-tick-${response.tick}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus(`Save exportado · tick ${response.tick}`);
  } catch (error) {
    showError(error);
  }
}

async function importSave(): Promise<void> {
  const file = loadInput.files?.[0];
  loadInput.value = '';
  if (file === undefined) return;
  clearError();
  await pauseDriver();
  try {
    const parsed: unknown = JSON.parse(await file.text());
    selectedCellIndex = null;
    const loaded = await client.load(parsed);
    const snapshot = await getSnapshotMeasured();
    updateSnapshot(snapshot.snapshot, loaded.worldId, true);
    enableWorldControls(true);
    setupPanel.open = false;
    setStatus(`Save carregado · tick ${loaded.tick}`);
  } catch (error) {
    showError(error);
  }
}

function updateSnapshot(snapshot: WorldState, _worldId: string, forceRender = false): void {
  currentTick = snapshot.tick;
  currentSchedules = snapshot.schedules;
  tickOutput.textContent = snapshot.tick.toLocaleString('pt-BR');
  seedOutput.textContent = snapshot.seed;
  versionOutput.textContent = snapshot.simulationVersion;
  currentNaturalWorld = snapshot.scenarioId === NATURAL_SCENARIO_ID ? getNaturalWorld(snapshot) : null;
  performanceTracker.setCells(currentNaturalWorld?.cells.length ?? 0);
  const scene = getFoundationScene();
  scene?.showWorld(currentNaturalWorld, `${snapshot.scenarioId}:${snapshot.scenarioVersion}:${snapshot.seed}`, forceRender);
  scene?.setOnCellSelected((index) => {
    selectedCellIndex = index;
    if (index !== null) worldDetails.open = true;
    updateCellInspection(currentNaturalWorld);
  });
  updateWorldReadings(currentNaturalWorld, snapshot);
  if (driver === null) {
    driver = new StepDriver(client, {
      onState: updateDriverState,
      onAdvanced: updateAfterAdvance,
      onStepTiming: ({ elapsedMs, ticks }) => {
        if (performanceEnabled) performanceTracker.recordWorker(elapsedMs, ticks);
      },
      onError: (error) => {
        showError(error);
        setStatus('Simulação pausada por erro');
      },
    });
  }
}

function applyTerrainLightingControls(): void {
  getFoundationScene()?.setTerrainLightingSettings({
    enabled: terrainLightingEnabled.checked,
    sunAngle: terrainSunAngle.valueAsNumber,
    reliefStrength: terrainReliefStrength.valueAsNumber,
  });
}

async function updateAfterAdvance(advanced: Extract<WorkerResponse, { type: 'ADVANCED' }>): Promise<void> {
  if (performanceEnabled) performanceTracker.recordSimulation(advanced.diagnostics.durationMs);
  if (shouldFetchSnapshotAfterAdvance(currentSchedules, advanced.tickFrom, advanced.tickTo)) {
    const current = await getSnapshotMeasured();
    updateSnapshot(current.snapshot, advanced.worldId);
  } else {
    currentTick = advanced.tickTo;
    tickOutput.textContent = advanced.tickTo.toLocaleString('pt-BR');
  }
}

async function getSnapshotMeasured(): Promise<Extract<WorkerResponse, { type: 'SNAPSHOT' }>> {
  const startedAt = performanceEnabled ? now() : null;
  const response = await client.getSnapshot();
  if (startedAt !== null && performanceEnabled) {
    performanceTracker.recordSnapshot(Math.max(0, now() - startedAt));
  }
  return response;
}

function setPerformanceEnabled(enabled: boolean): void {
  performanceEnabled = enabled;
  performanceToggle.setAttribute('aria-pressed', String(enabled));
  const label = enabled ? 'Ocultar métricas de desempenho' : 'Mostrar métricas de desempenho';
  performanceToggle.setAttribute('aria-label', label);
  performanceToggle.title = label;
  performancePanel.hidden = !enabled;
  if (!enabled) {
    if (performanceFrameHandle !== null) cancelAnimationFrame(performanceFrameHandle);
    performanceFrameHandle = null;
    performanceTracker.reset();
    lastPerformancePaintAt = 0;
    updatePerformancePanel();
    return;
  }
  performanceTracker.reset();
  performanceTracker.setCells(currentNaturalWorld?.cells.length ?? 0);
  updatePerformancePanel();
  schedulePerformanceFrame();
}

function schedulePerformanceFrame(): void {
  if (!performanceEnabled || performanceFrameHandle !== null) return;
  performanceFrameHandle = requestAnimationFrame((timestamp) => {
    performanceFrameHandle = null;
    if (!performanceEnabled) return;
    performanceTracker.recordFrame(timestamp);
    if (timestamp - lastPerformancePaintAt >= 250) {
      updatePerformancePanel();
      lastPerformancePaintAt = timestamp;
    }
    schedulePerformanceFrame();
  });
}

function updatePerformancePanel(): void {
  const metrics = performanceTracker.read();
  performanceFpsOutput.textContent = metric(metrics.fps, ' fps');
  performancePhaserFpsOutput.textContent = metric(metrics.phaserFps, ' fps');
  performanceFrameOutput.textContent = metric(metrics.frameMs, ' ms');
  performanceRenderOutput.textContent = timingMetric(metrics.renderMs, metrics.renderSamples);
  performanceLayersOutput.textContent = metric(metrics.dynamicLayersMs, ' ms');
  performanceLayerDetailsOutput.textContent = formatRenderLayerTimes(metrics.renderLayerMs);
  performanceVegetationDetailsOutput.textContent = `grama ${metric(metrics.vegetationDetailMs.grass, ' ms')} · objetos ${metric(metrics.vegetationDetailMs.objects, ' ms')} · sombras ${metric(metrics.vegetationDetailMs.shadows, ' ms')}`;
  performanceMineralDetailsOutput.textContent = `catálogo ${metric(metrics.mineralDetailMs.catalog, ' ms')} · ${metric(metrics.mineralDetailMs.formations, ' formações')} (${metric(metrics.mineralDetailMs.visible, ' visíveis')} vis.) · raster ${metric(metrics.mineralDetailMs.raster, ' ms')} · sprites ${metric(metrics.mineralDetailMs.sprites, ' ms')} · ${metric(metrics.mineralDetailMs.created, ' criadas')} · ${metric(metrics.mineralDetailMs.pending, ' pendentes')}`;
  performanceWaterOutput.textContent = `movimento ${metric(metrics.waterMotionMs, ' ms')} · prof. ${metric(metrics.waterDetailMs.depth, ' ms')} · desenho ${metric(metrics.waterDetailMs.geometry, ' ms')} · textura ${metric(metrics.waterDetailMs.surface, ' ms')}`;
  performanceWaterSurfaceOutput.textContent = `cache ${metric(metrics.waterSurfaceDetailMs.cache, ' ms')} · máscara ${metric(metrics.waterSurfaceDetailMs.mask, ' ms')} · chunks ${metric(metrics.waterSurfaceDetailMs.chunks, ' ms')} · ${metric(metrics.waterSurfaceDetailMs.dirtyChunks, ' chunks')}`;
  performanceSimulationOutput.textContent = timingMetric(metrics.simulationMs, metrics.simulationSamples);
  performanceSnapshotOutput.textContent = timingMetric(metrics.snapshotMs, metrics.snapshotSamples);
  performanceWorkerOutput.textContent = metric(metrics.workerMs, ' ms');
  performanceTicksOutput.textContent = metrics.ticksPerBatch === null ? '—' : `${metrics.ticksPerBatch.toLocaleString('pt-BR')} ticks`;
  performanceCellsOutput.textContent = metrics.cells.toLocaleString('pt-BR');
  const memory = readMemoryStats();
  performanceTracker.setMemory(memory.usedMb, memory.totalMb, memory.limitMb);
  performanceMemoryOutput.textContent = metric(memory.usedMb, ' MB');
  performanceMemoryTotalOutput.textContent = metric(memory.totalMb, ' MB');
  performanceMemoryLimitOutput.textContent = metric(memory.limitMb, ' MB');
}

function readMemoryStats(): { usedMb: number | null; totalMb: number | null; limitMb: number | null } {
  const performanceApi = globalThis.performance as (Performance & {
    memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
  }) | undefined;
  const memory = performanceApi?.memory;
  if (memory === undefined) return { usedMb: null, totalMb: null, limitMb: null };
  return {
    usedMb: bytesToMb(memory.usedJSHeapSize),
    totalMb: bytesToMb(memory.totalJSHeapSize),
    limitMb: bytesToMb(memory.jsHeapSizeLimit),
  };
}

function bytesToMb(bytes: number): number | null {
  return Number.isFinite(bytes) && bytes >= 0 ? bytes / (1024 * 1024) : null;
}

function metric(value: number | null, suffix: string): string {
  return value === null ? '—' : `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}${suffix}`;
}

function timingMetric(value: number | null, samples: TimingSamples | null): string {
  if (value === null) return '—';
  if (samples === null) return metric(value, ' ms');
  const format = (sample: number) => sample.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  return `${format(value)} ms · P50 ${format(samples.p50Ms)} · P95 ${format(samples.p95Ms)} · n ${samples.samples}`;
}

function formatRenderLayerTimes(values: Record<RenderLayerId, number | null>): string {
  const labels: Record<RenderLayerId, string> = {
    relief: 'relevo', geology: 'geologia', water: 'água', minerals: 'rochas', vegetation: 'flora',
  };
  return (Object.entries(values) as Array<[RenderLayerId, number | null]>)
    .filter((entry): entry is [RenderLayerId, number] => entry[1] !== null)
    .map(([layer, elapsedMs]) => `${labels[layer]} ${metric(elapsedMs, ' ms')}`)
    .join(' · ') || '—';
}

function updateWorldReadings(natural: NaturalWorldEntity | null, snapshot: WorldState): void {
  if (natural === null) {
    dateOutput.textContent = 'Aguardando cenário natural';
    waterOutput.textContent = '—';
    climateOutput.textContent = '—';
    vegetationOutput.textContent = '—';
    mineralsOutput.textContent = '—';
    cellInfoOutput.textContent = snapshot.scenarioId === EMPTY_SCENARIO_ID ? 'Mundo-base vazio · nenhum terreno neste ensaio.' : 'Sem dados ambientais.';
    selectedCellIndex = null;
    return;
  }
  const year = Math.floor(natural.daysSimulated / natural.yearLengthDays) + 1;
  dateOutput.textContent = `Ano ${year} · ${SEASON_LABELS[natural.seasonId]} · dia ${natural.seasonDay + 1}`;
  climateOutput.textContent = `${number(snapshot.metrics['climate.meanTemperatureC'])} °C · ${number((snapshot.metrics['climate.meanRelativeHumidity'] ?? 0) * 100)}% UR`;
  waterOutput.textContent = `${number(snapshot.metrics['hydrology.meanSoilWaterMm'])} mm no solo · ${number(snapshot.metrics['hydrology.meanSurfaceWaterMm'])} mm na superfície`;
  vegetationOutput.textContent = `${number(snapshot.metrics['vegetation.totalBiomassGPerM2'])} g/m² · ${number((snapshot.metrics['vegetation.meanCoverage'] ?? 0) * 100)}% de cobertura`;
  mineralsOutput.textContent = `${Math.round(snapshot.metrics['geology.exposedOreCells'] ?? 0)} células com minério exposto`;
  updateCellInspection(natural);
}

function updateCellInspection(natural: NaturalWorldEntity | null): void {
  const cell = natural?.cells[selectedCellIndex ?? -1];
  if (cell === undefined) {
    cellInfoOutput.textContent = natural === null ? 'Nenhuma célula selecionada.' : 'Clique no mapa para inspecionar uma célula.';
    return;
  }
  const plants = cell.plants.filter((plant) => plant.biomassGPerM2 > 0.1)
    .map((plant) => `${PLANT_LABELS[plant.speciesId]} · ${PLANT_STAGE_LABELS[plant.stage]}${plant.speciesId !== 'grass' && plant.speciesId !== 'shrub' ? `, ${number(plant.ageDays)} dias` : ''} · ${number(plant.biomassGPerM2)} g/m²`).join(' · ') || 'sem biomassa vegetal';
  const resources = cell.minerals.filter((deposit) => deposit.reserveKg > 0)
    .map((deposit) => `${MINERAL_LABELS[deposit.resourceId]} ${number(deposit.reserveKg)} kg${deposit.sizeClass === undefined ? '' : ` · ${MINERAL_SIZE_LABELS[deposit.sizeClass]}`}${deposit.exposed ? ' · aflorado' : ` · ${number(deposit.depthM)} m`}`).join(' · ') || 'sem recurso mineral';
  const rainfall = cell.climate.rainfallFactor === undefined ? '' : ` · chuva regional ×${number(cell.climate.rainfallFactor)}`;
  const mineralPotential = cell.terrain.mineralPotential === undefined ? '' : ` · potencial geológico ${MINERAL_POTENTIAL_LABELS[cell.terrain.mineralPotential >= 0.72 ? 'high' : cell.terrain.mineralPotential >= 0.44 ? 'medium' : 'low']} (${Math.round(cell.terrain.mineralPotential * 100)}%)`;
  const hydraulicHeadM = cell.terrain.elevationM + cell.water.surfaceMm / 1000;
  const waterBody = cell.terrain.waterBody === undefined ? 'none' : cell.terrain.waterBody;
  const waterBodyLabel = waterBody === 'none' ? '' : ` · ${WATER_BODY_LABELS[waterBody]}`;
  const erosion = natural?.scenarioVersion !== NATURAL_SCENARIO_VERSION ? '' : ` · incisão ${number(cell.terrain.channelIncisionM ?? 0)} m · sedimento móvel ${number(cell.soil.sedimentLoadKgPerM2)} kg/m² · erosão recente ${number(cell.soil.lastMineralErosionKgPerM2)} kg/m²`;
  const bankSeepage = cell.water.lastFlows.bankSeepageInMm === undefined ? '' : ` · infiltração da margem ${number(cell.water.lastFlows.bankSeepageInMm)} mm`;
  cellInfoOutput.textContent = `Célula ${cell.x + 1}, ${cell.y + 1} · ${HABITAT_LABELS[cell.terrain.habitat]}${waterBodyLabel} · ${Math.round(cell.terrain.elevationM)} m · declive ${number(cell.terrain.slope * 100)}% · carga hidráulica ${number(hydraulicHeadM)} m · solo ${SOIL_LABELS[cell.terrain.soilType]}${rainfall}${mineralPotential} · água superficial ${number(cell.water.surfaceMm)} mm · água no solo ${number(cell.water.soilMm)}/${number(cell.water.capacityMm)} mm${erosion}${bankSeepage} · ${plants} · ${resources}`;
}

const SEASON_LABELS: Record<NaturalWorldEntity['seasonId'], string> = { spring: 'Primavera', summer: 'Verão', autumn: 'Outono', winter: 'Inverno' };
const PLANT_LABELS: Record<NaturalWorldCellState['plants'][number]['speciesId'], string> = { grass: 'gramínea', shrub: 'arbusto', oak: 'carvalho', pine: 'pinheiro', birch: 'bétula', autumnal: 'árvore outonal', willow: 'salgueiro' };
const PLANT_STAGE_LABELS: Record<PlantStageId, string> = { seedling: 'plântula', sapling: 'muda', juvenile: 'jovem', mature: 'adulta', senescent: 'senescente' };
const MINERAL_LABELS: Record<NaturalWorldCellState['minerals'][number]['resourceId'], string> = { stone: 'pedra', copper: 'cobre', iron: 'ferro', silver: 'prata', gold: 'ouro' };
const MINERAL_SIZE_LABELS: Record<NonNullable<NaturalWorldCellState['minerals'][number]['sizeClass']>, string> = { trace: 'traço', small: 'pequeno', medium: 'médio', large: 'grande' };
const MINERAL_POTENTIAL_LABELS = { low: 'baixo', medium: 'médio', high: 'alto' } as const;
const SOIL_LABELS: Record<NaturalWorldCellState['terrain']['soilType'], string> = { sand: 'arenoso', loam: 'franco', clay: 'argiloso', rock: 'rocha' };
const HABITAT_LABELS: Record<NaturalWorldCellState['terrain']['habitat'], string> = { upland: 'terras altas', woodland: 'floresta', meadow: 'pradaria', wetland: 'pântano', dryland: 'terra seca', desert: 'deserto' };
const WATER_BODY_LABELS: Record<WaterBodyId, string> = { none: 'terra', lake: 'lago', river: 'rio' };

function number(value: number | undefined): string {
  return (value ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}

function updateDriverState(state: DriverState): void {
  const running = state === 'running';
  resumeButton.disabled = currentTick === null || running || state === 'pausing';
  pauseButton.disabled = currentTick === null || !running;
  stepButton.disabled = currentTick === null || running || state === 'pausing';
  saveButton.disabled = currentTick === null || state === 'pausing';
  speedSelect.disabled = currentTick === null;
  if (state === 'running') setStatus('Simulação em execução');
  if (state === 'pausing') setStatus('Aguardando lote em voo terminar…');
  if (state === 'paused') setStatus('Mundo pausado');
}

function enableWorldControls(enabled: boolean): void {
  resumeButton.disabled = !enabled;
  stepButton.disabled = !enabled;
  saveButton.disabled = !enabled;
  speedSelect.disabled = !enabled;
  pauseButton.disabled = true;
}

function setStatus(message: string): void {
  statusOutput.value = message;
}

function showError(error: unknown): void {
  const message = error instanceof Error ? error.message : 'Erro inesperado.';
  errorOutput.textContent = message;
  errorOutput.hidden = false;
}

function clearError(): void {
  errorOutput.textContent = '';
  errorOutput.hidden = true;
}

function createRandomSeed(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function now(): number {
  return globalThis.performance?.now() ?? Date.now();
}

function requiredElement<Type extends HTMLElement>(id: string): Type {
  const element = document.getElementById(id);
  if (element === null) throw new Error(`Elemento obrigatório não encontrado: ${id}.`);
  return element as Type;
}

function getFoundationScene(): FoundationScene | null {
  if (!game.scene.isActive('foundation')) return null;
  const scene = game.scene.getScene('foundation') as FoundationScene;
  if (!performanceSceneConfigured) {
    scene.setPerformanceHooks({
      onDynamicLayersMs: (elapsedMs) => {
        if (performanceEnabled) performanceTracker.recordDynamicLayers(elapsedMs);
      },
      onRenderLayerMs: (layer, elapsedMs) => {
        if (performanceEnabled) performanceTracker.recordRenderLayer(layer, elapsedMs);
      },
      onVegetationCostsMs: (grassMs, objectsMs, shadowsMs) => {
        if (performanceEnabled) performanceTracker.recordVegetationDetail(grassMs, objectsMs, shadowsMs);
      },
      onMineralCatalogMs: (elapsedMs, formationCount, visibleCount) => {
        if (performanceEnabled) performanceTracker.recordMineralCatalog(elapsedMs, formationCount, visibleCount);
      },
      onMineralCreationMs: (rasterMs, spriteMs, created, pending) => {
        if (performanceEnabled) performanceTracker.recordMineralCreation(rasterMs, spriteMs, created, pending);
      },
      onWaterMotionMs: (elapsedMs) => {
        if (performanceEnabled) performanceTracker.recordWaterMotion(elapsedMs);
      },
      onWaterCostsMs: (depthMs, geometryMs, surfaceMs) => {
        if (performanceEnabled) performanceTracker.recordWaterDetail(depthMs, geometryMs, surfaceMs);
      },
      onWaterSurfaceCostsMs: (cacheMs, maskMs, chunkMs, dirtyChunks) => {
        if (performanceEnabled) performanceTracker.recordWaterSurfaceDetail(cacheMs, maskMs, chunkMs, dirtyChunks);
      },
    });
    performanceSceneConfigured = true;
  }
  return scene;
}

if (import.meta.env.DEV) {
  installF0ValidationPanel();
}

type F0PresentationProfile = {
  label: string;
  render: boolean;
  targetFps: number;
  camera: { x: number; y: number; zoom: number };
};

function installF0ValidationPanel(): void {
  const panel = document.createElement('details');
  panel.className = 'dev-harness';
  panel.setAttribute('aria-labelledby', 'f0-validation-title');

  const summary = document.createElement('summary');
  summary.textContent = 'Verificação visual · F0';
  const title = document.createElement('h2');
  title.id = 'f0-validation-title';
  title.textContent = 'Ensaio F0 · renderização e câmera (modo desenvolvimento)';
  const description = document.createElement('p');
  description.textContent = 'Compara 120 ticks com Phaser parado, a 30 e 60 FPS, mudando o enquadramento da câmera.';
  const button = document.createElement('button');
  button.id = 'f0-run-presentation-check';
  button.textContent = 'Executar ensaio F0';
  const output = document.createElement('pre');
  output.id = 'f0-validation-result';
  output.setAttribute('role', 'status');
  output.setAttribute('aria-live', 'polite');
  output.textContent = 'Aguardando execução.';
  panel.append(summary, title, description, button, output);
  document.querySelector('#app')?.append(panel);

  button.addEventListener('click', () => {
    button.disabled = true;
    output.textContent = 'Executando quatro variações; aguarde alguns segundos…';
    void runF0PresentationSweep()
      .then((report) => { output.textContent = JSON.stringify(report, null, 2); })
      .catch((error: unknown) => {
        output.textContent = JSON.stringify({ passed: false, error: error instanceof Error ? error.message : String(error) }, null, 2);
      })
      .finally(() => { button.disabled = false; });
  });
}

async function runF0PresentationSweep(): Promise<{ passed: boolean; seed: string; ticks: number; results: Array<Record<string, unknown>> }> {
  await pauseDriver();
  if (currentTick !== null) await client.dispose();
  currentTick = null;
  currentSchedules = null;

  const seed = '0123456789abcdef';
  seedInput.value = seed;
  const ready = await client.createWorld(seed, EMPTY_SCENARIO_ID, EMPTY_SCENARIO_VERSION);
  const initial = await getSnapshotMeasured();
  updateSnapshot(initial.snapshot, ready.worldId);
  enableWorldControls(true);
  const initialSave = (await client.save()).save;
  const profiles: F0PresentationProfile[] = [
    { label: 'render-off', render: false, targetFps: 30, camera: { x: 0, y: 0, zoom: 1 } },
    { label: '30-fps-camera-origin', render: true, targetFps: 30, camera: { x: 0, y: 0, zoom: 1 } },
    { label: '60-fps-camera-east', render: true, targetFps: 60, camera: { x: 320, y: -180, zoom: 1.25 } },
    { label: '60-fps-camera-west', render: true, targetFps: 60, camera: { x: -800, y: 1024, zoom: 0.75 } },
  ];
  const results: Array<Record<string, unknown>> = [];
  let referenceState: string | null = null;
  let referenceEvents: string | null = null;
  let cleanupHandler: (() => void) | null = null;

  try {
    for (const profile of profiles) {
      setStatus(`Ensaio F0 · preparando ${profile.label}`);
      const loaded = await client.load(initialSave);
      const start = await getSnapshotMeasured();
      updateSnapshot(start.snapshot, loaded.worldId, true);
      getFoundationScene()?.setCameraView(profile.camera.x, profile.camera.y, profile.camera.zoom);
      game.loop.setFPSLimit(profile.targetFps);
      if (profile.render) game.loop.wake();
      else game.loop.sleep();

      let framesDuringSimulation = 0;
      let framesDuringMeasurement = 0;
      let measuring = false;
      cleanupHandler = () => {
        if (measuring) framesDuringMeasurement += 1;
        else framesDuringSimulation += 1;
      };
      game.events.on('postrender', cleanupHandler);
      const events = [] as unknown[];
      for (let tick = 0; tick < 120; tick += 1) {
        const advanced = await client.step(1);
        events.push(...advanced.events);
        if ((tick + 1) % 20 === 0) setStatus(`Ensaio F0 · ${profile.label} · ${tick + 1}/120 ticks`);
      }
      let measuredFps = 0;
      if (profile.render) {
        measuring = true;
        const measurementStartedAt = performance.now();
        await new Promise<void>((resolve) => window.setTimeout(resolve, 1000));
        const measurementDurationMs = performance.now() - measurementStartedAt;
        measuring = false;
        measuredFps = framesDuringMeasurement / (measurementDurationMs / 1000);
      }
      game.events.off('postrender', cleanupHandler);
      cleanupHandler = null;

      const snapshot = await getSnapshotMeasured();
      const canonicalState = logicalStateString(snapshot.snapshot);
      const canonicalEvents = logicalStateString(events);
      const equalToReference = referenceState === null || canonicalState === referenceState;
      const eventsEqualToReference = referenceEvents === null || canonicalEvents === referenceEvents;
      if (referenceState === null) referenceState = canonicalState;
      if (referenceEvents === null) referenceEvents = canonicalEvents;
      const camera = {
        x: getFoundationScene()?.cameras.main.scrollX ?? 0,
        y: getFoundationScene()?.cameras.main.scrollY ?? 0,
        zoomX: getFoundationScene()?.cameras.main.zoomX ?? 1,
        zoomY: getFoundationScene()?.cameras.main.zoomY ?? 1,
      };
      const cameraMatchesProfile = Math.abs(camera.x - profile.camera.x) < 0.001
        && Math.abs(camera.y - profile.camera.y) < 0.001
        && Math.abs(camera.zoomX - profile.camera.zoom) < 0.001
        && Math.abs(camera.zoomY - profile.camera.zoom) < 0.001;
      const measuredFpsWithinTolerance = profile.render
        ? Math.abs(measuredFps - profile.targetFps) <= Math.max(2, profile.targetFps * 0.15)
        : measuredFps === 0;
      const pageVisible = document.visibilityState === 'visible';
      const windowFocused = document.hasFocus();
      const renderModeMatches = profile.render
        ? game.loop.running && framesDuringMeasurement > 0
        : !game.loop.running && framesDuringSimulation === 0;
      const profilePassed = equalToReference && eventsEqualToReference && cameraMatchesProfile
        && measuredFpsWithinTolerance && renderModeMatches;
      results.push({
        profile: profile.label,
        tick: snapshot.snapshot.tick,
        requestedFps: profile.targetFps,
        measuredFps: Number(measuredFps.toFixed(1)),
        loopRunning: game.loop.running,
        camera,
        renderedFrames: framesDuringSimulation + framesDuringMeasurement,
        events: events.length,
        equalToReference,
        eventsEqualToReference,
        cameraMatchesProfile,
        pageVisible,
        windowFocused,
        measuredFpsWithinTolerance,
        renderModeMatches,
        passed: profilePassed,
      });
      updateSnapshot(snapshot.snapshot, snapshot.worldId);
    }
  } finally {
    if (cleanupHandler !== null) game.events.off('postrender', cleanupHandler);
    game.loop.setFPSLimit(0);
    game.loop.wake();
    getFoundationScene()?.setCameraView(0, 0, 1);
    const restored = await client.load(initialSave);
    const snapshot = await getSnapshotMeasured();
    updateSnapshot(snapshot.snapshot, restored.worldId, true);
    enableWorldControls(true);
    setStatus('Mundo de teste restaurado · pausado');
  }

  const passed = results.every((result) => result['passed'] === true);
  setStatus(passed ? 'Ensaio F0 aprovado · mundo restaurado e pausado' : 'Ensaio F0 não aprovado · confira foco e taxa de render');
  return { passed, seed, ticks: 120, results };
}
