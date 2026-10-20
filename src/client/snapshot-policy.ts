import type { SystemSchedule } from '../core/types';

/** Fetch a full state only when an advance crosses a scheduled system tick. */
export function shouldFetchSnapshotAfterAdvance(
  schedules: readonly SystemSchedule[] | null,
  tickFrom: number,
  tickTo: number,
): boolean {
  if (schedules === null || !Number.isSafeInteger(tickFrom) || !Number.isSafeInteger(tickTo) || tickTo < tickFrom) return true;
  return schedules.some(({ nextTick }) => nextTick > tickFrom && nextTick <= tickTo);
}
