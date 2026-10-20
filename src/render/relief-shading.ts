const VERTICAL_EXAGGERATION = 1.9;
const LIGHT_X = -0.5;
const LIGHT_Y = -0.5;
const LIGHT_Z = Math.SQRT1_2;
const FLAT_ILLUMINATION = LIGHT_Z;

/** Signed hillshade relative to flat terrain; positive faces the northwest light. */
export function reliefShadeForNeighbors(
  westM: number,
  eastM: number,
  northM: number,
  southM: number,
  cellSizeM: number,
): number {
  if (![westM, eastM, northM, southM, cellSizeM].every(Number.isFinite) || cellSizeM <= 0) return 0;

  const slopeX = ((eastM - westM) / (2 * cellSizeM)) * VERTICAL_EXAGGERATION;
  const slopeY = ((southM - northM) / (2 * cellSizeM)) * VERTICAL_EXAGGERATION;
  const normalLength = Math.hypot(slopeX, slopeY, 1);
  const illumination = ((-slopeX * LIGHT_X) + (-slopeY * LIGHT_Y) + LIGHT_Z) / normalLength;
  return clamp((illumination - FLAT_ILLUMINATION) * 3.2, -0.72, 0.72);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
