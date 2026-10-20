/** Returns whether a natural-scenario version includes a feature introduced in `minimumVersion`. */
export function naturalScenarioVersionAtLeast(version: string, minimumVersion: string): boolean {
  const parsedVersion = parseVersion(version);
  const parsedMinimum = parseVersion(minimumVersion);
  if (parsedVersion === null || parsedMinimum === null) return false;
  for (let index = 0; index < parsedVersion.length; index += 1) {
    if (parsedVersion[index] !== parsedMinimum[index]) return (parsedVersion[index] as number) > (parsedMinimum[index] as number);
  }
  return true;
}

function parseVersion(version: string): [number, number, number] | null {
  const parts = version.split('.');
  if (parts.length !== 3 || parts.some((part) => !/^\d+$/.test(part))) return null;
  const parsed = parts.map(Number);
  if (parsed.some((part) => !Number.isSafeInteger(part) || part < 0)) return null;
  return parsed as [number, number, number];
}
