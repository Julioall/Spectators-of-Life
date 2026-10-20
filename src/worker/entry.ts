import { WorkerEngine } from './engine';
import type { WorkerResponse } from '../core/types';

type WorkerScope = {
  addEventListener: (type: 'message', listener: (event: MessageEvent<unknown>) => void) => void;
  postMessage: (message: WorkerResponse) => void;
};

const scope = globalThis as unknown as WorkerScope;
// postMessage performs the structured clone at the worker boundary. Avoid a
// second full-world clone inside WorkerEngine for snapshots.
const engine = new WorkerEngine({ snapshotOwnership: 'post-message' });

scope.addEventListener('message', (event) => {
  scope.postMessage(engine.handle(event.data));
});
