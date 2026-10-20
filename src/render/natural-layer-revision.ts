export type NaturalLayerRevision = { worldKey: string; daysSimulated: number };

/** Natural map layers only change when the world identity or a daily system changes state. */
export function hasNaturalLayerRevisionChanged(
  previous: NaturalLayerRevision | null,
  next: NaturalLayerRevision,
): boolean {
  return previous === null
    || previous.worldKey !== next.worldKey
    || previous.daysSimulated !== next.daysSimulated;
}
