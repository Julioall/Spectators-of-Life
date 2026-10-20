import { describe, expect, it } from 'vitest';
import { shouldFetchSnapshotAfterAdvance } from '../../src/client/snapshot-policy';
import type { SystemSchedule } from '../../src/core/types';

const dailySchedule: SystemSchedule = { systemId: 'fixture:daily', periodTicks: 4, nextTick: 4 };

describe('política de snapshot por agenda', () => {
  it('evita cópia completa em lotes sem execução de sistemas', () => {
    expect(shouldFetchSnapshotAfterAdvance([dailySchedule], 0, 2)).toBe(false);
    expect(shouldFetchSnapshotAfterAdvance([dailySchedule], 1, 3)).toBe(false);
  });

  it('pede snapshot quando o lote cruza um tick agendado', () => {
    expect(shouldFetchSnapshotAfterAdvance([dailySchedule], 2, 4)).toBe(true);
    expect(shouldFetchSnapshotAfterAdvance([{ ...dailySchedule, nextTick: 8 }], 4, 9)).toBe(true);
  });

  it('não lê novamente o estado quando não há sistemas ativos', () => {
    expect(shouldFetchSnapshotAfterAdvance([], 0, 12)).toBe(false);
  });

  it('falha de forma conservadora quando a agenda é desconhecida ou o intervalo é inválido', () => {
    expect(shouldFetchSnapshotAfterAdvance(null, 0, 1)).toBe(true);
    expect(shouldFetchSnapshotAfterAdvance([dailySchedule], 4, 3)).toBe(true);
  });
});
