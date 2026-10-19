import Phaser from 'phaser';
import { StepDriver, type DriverState } from './client/step-driver';
import { SimulationClient, type WorkerPort } from './client/worker-transport';
import { logicalStateString } from './core/canonical-json';
import { FoundationScene } from './render/foundation-scene';
import './styles.css';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'world-canvas',
  width: 1280,
  height: 720,
  backgroundColor: '#101916',
  scene: [FoundationScene],
  render: { antialias: false, pixelArt: true },
});

const worker = new Worker(new URL('./worker/entry.ts', import.meta.url), { type: 'module' });
const client = new SimulationClient(worker as unknown as WorkerPort);
let driver: StepDriver | null = null;
let currentTick: number | null = null;

const statusOutput = requiredElement<HTMLOutputElement>('runtime-status');
const seedInput = requiredElement<HTMLInputElement>('seed-input');
const createButton = requiredElement<HTMLButtonElement>('create-button');
const newSeedButton = requiredElement<HTMLButtonElement>('new-seed-button');
const resumeButton = requiredElement<HTMLButtonElement>('resume-button');
const pauseButton = requiredElement<HTMLButtonElement>('pause-button');
const stepButton = requiredElement<HTMLButtonElement>('step-button');
const speedSelect = requiredElement<HTMLSelectElement>('speed-select');
const saveButton = requiredElement<HTMLButtonElement>('save-button');
const loadButton = requiredElement<HTMLButtonElement>('load-button');
const loadInput = requiredElement<HTMLInputElement>('load-input');
const tickOutput = requiredElement<HTMLElement>('tick-value');
const seedOutput = requiredElement<HTMLElement>('seed-value');
const versionOutput = requiredElement<HTMLElement>('version-value');
const errorOutput = requiredElement<HTMLElement>('error-output');

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
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && driver?.isRunning() === true) void pauseWorld();
});
window.addEventListener('beforeunload', () => client.close(), { once: true });

async function createWorld(): Promise<void> {
  clearError();
  await pauseDriver();
  createButton.disabled = true;
  try {
    const ready = await client.createWorld(seedInput.value.trim());
    const snapshot = await client.getSnapshot();
    updateSnapshot(snapshot.snapshot, ready.worldId);
    enableWorldControls(true);
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
    const advanced = await client.step(1);
    const snapshot = await client.getSnapshot();
    updateSnapshot(snapshot.snapshot, advanced.worldId);
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
    const loaded = await client.load(parsed);
    const snapshot = await client.getSnapshot();
    updateSnapshot(snapshot.snapshot, loaded.worldId);
    enableWorldControls(true);
    setStatus(`Save carregado · tick ${loaded.tick}`);
  } catch (error) {
    showError(error);
  }
}

function updateSnapshot(snapshot: { tick: number; seed: string; simulationVersion: string }, _worldId: string): void {
  currentTick = snapshot.tick;
  tickOutput.textContent = snapshot.tick.toLocaleString('pt-BR');
  seedOutput.textContent = snapshot.seed;
  versionOutput.textContent = snapshot.simulationVersion;
  getFoundationScene()?.showTick(snapshot.tick);
  if (driver === null) {
    driver = new StepDriver(client, {
      onState: updateDriverState,
      onAdvanced: async (response) => {
        const current = await client.getSnapshot();
        updateSnapshot(current.snapshot, response.worldId);
      },
      onError: (error) => {
        showError(error);
        setStatus('Simulação pausada por erro');
      },
    });
  }
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

function requiredElement<Type extends HTMLElement>(id: string): Type {
  const element = document.getElementById(id);
  if (element === null) throw new Error(`Elemento obrigatório não encontrado: ${id}.`);
  return element as Type;
}

function getFoundationScene(): FoundationScene | null {
  if (!game.scene.isActive('foundation')) return null;
  return game.scene.getScene('foundation') as FoundationScene;
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
  const panel = document.createElement('section');
  panel.className = 'dev-harness';
  panel.setAttribute('aria-labelledby', 'f0-validation-title');

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
  panel.append(title, description, button, output);
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

  const seed = '0123456789abcdef';
  seedInput.value = seed;
  const ready = await client.createWorld(seed);
  const initial = await client.getSnapshot();
  updateSnapshot(initial.snapshot, ready.worldId);
  enableWorldControls(true);
  const initialSave = (await client.save()).save;
  const profiles: F0PresentationProfile[] = [
    { label: 'render-off', render: false, targetFps: 30, camera: { x: 0, y: 0, zoom: 1 } },
    { label: '30-fps-camera-origin', render: true, targetFps: 30, camera: { x: 0, y: 0, zoom: 1 } },
    { label: '60-fps-camera-east', render: true, targetFps: 60, camera: { x: 320, y: -180, zoom: 1.25 } },
    { label: '60-fps-camera-west', render: true, targetFps: 60, camera: { x: -2048, y: 1024, zoom: 0.75 } },
  ];
  const results: Array<Record<string, unknown>> = [];
  let referenceState: string | null = null;
  let referenceEvents: string | null = null;
  let cleanupHandler: (() => void) | null = null;

  try {
    for (const profile of profiles) {
      setStatus(`Ensaio F0 · preparando ${profile.label}`);
      const loaded = await client.load(initialSave);
      const start = await client.getSnapshot();
      updateSnapshot(start.snapshot, loaded.worldId);
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
        getFoundationScene()?.showTick(advanced.tickTo);
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

      const snapshot = await client.getSnapshot();
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
    const snapshot = await client.getSnapshot();
    updateSnapshot(snapshot.snapshot, restored.worldId);
    enableWorldControls(true);
    setStatus('Mundo de teste restaurado · pausado');
  }

  const passed = results.every((result) => result['passed'] === true);
  setStatus(passed ? 'Ensaio F0 aprovado · mundo restaurado e pausado' : 'Ensaio F0 não aprovado · confira foco e taxa de render');
  return { passed, seed, ticks: 120, results };
}
