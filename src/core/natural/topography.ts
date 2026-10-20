const RELIEF_KERNEL = [1, 4, 6, 4, 1] as const;
const KERNEL_RADIUS = Math.floor(RELIEF_KERNEL.length / 2);

/**
 * Builds a stable landform signal for regional classification.
 * Physical elevation remains unchanged; 75% of the signal comes from a
 * clamped 5×5 Gaussian neighborhood and 25% retains the local elevation.
 */
export function buildLandformElevationField(width: number, height: number, elevations: readonly number[]): number[] {
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1 || elevations.length !== width * height) {
    throw new Error('Dimensões incompatíveis para o campo regional de relevo.');
  }

  const landforms = new Array<number>(elevations.length);
  const kernelWeight = RELIEF_KERNEL.reduce((total, weight) => total + weight, 0);
  const totalWeight = kernelWeight * kernelWeight;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let regionalElevation = 0;
      for (let ky = -KERNEL_RADIUS; ky <= KERNEL_RADIUS; ky += 1) {
        const sampleY = Math.max(0, Math.min(height - 1, y + ky));
        const weightY = RELIEF_KERNEL[ky + KERNEL_RADIUS]!;
        for (let kx = -KERNEL_RADIUS; kx <= KERNEL_RADIUS; kx += 1) {
          const sampleX = Math.max(0, Math.min(width - 1, x + kx));
          const weightX = RELIEF_KERNEL[kx + KERNEL_RADIUS]!;
          regionalElevation += (elevations[sampleY * width + sampleX] as number) * weightX * weightY;
        }
      }
      const index = y * width + x;
      const smoothed = regionalElevation / totalWeight;
      landforms[index] = (elevations[index] as number) * 0.25 + smoothed * 0.75;
    }
  }
  return landforms;
}
