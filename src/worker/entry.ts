import { WorkerEngine } from './engine';
import type { WorkerResponse } from '../core/types';

type WorkerScope = {
  addEventListener: (type: 'message', listener: (event: MessageEvent<unknown>) => void) => void;
  postMessage: (message: WorkerResponse) => void;
};

const scope = globalThis as unknown as WorkerScope;
const engine = new WorkerEngine();

scope.addEventListener('message', (event) => {
  scope.postMessage(engine.handle(event.data));
});
