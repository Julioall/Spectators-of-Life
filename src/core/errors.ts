import type { FaultDiagnostic, WorldState } from './types';

export class ContractError extends Error {
  readonly code: string;
  readonly recoverable: boolean;

  constructor(code: string, message: string, recoverable = true) {
    super(message);
    this.name = 'ContractError';
    this.code = code;
    this.recoverable = recoverable;
  }
}

export class StepFaultError extends Error {
  readonly lastValidState: WorldState;
  readonly completedTicks: number;
  readonly diagnostic: FaultDiagnostic;

  constructor(lastValidState: WorldState, completedTicks: number, diagnostic: FaultDiagnostic) {
    super(diagnostic.message);
    this.name = 'StepFaultError';
    this.lastValidState = lastValidState;
    this.completedTicks = completedTicks;
    this.diagnostic = diagnostic;
  }
}
