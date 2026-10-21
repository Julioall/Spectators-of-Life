export type MineralSpatialFormation = {
  xCell: number;
  yCell: number;
  source: string;
  visualScale: number;
  raster: { width: number; height: number; anchorX: number; anchorY: number };
  deposit: { tier: string };
};

export type MineralViewportCells = { left: number; top: number; right: number; bottom: number };

/** Detailed rock rasterization is reserved for close inspection to avoid frame stalls at map scale. */
export const MINERAL_DETAILED_RASTER_ZOOM = 1.25;
export const MINERAL_SPATIAL_CHUNK_CELLS = 16;

export function buildMineralSpatialIndex<T extends MineralSpatialFormation>(
  formations: readonly T[],
  worldWidth: number,
  worldHeight: number,
  nativeCellSize: number,
  chunkSize = MINERAL_SPATIAL_CHUNK_CELLS,
): Map<number, number[]> {
  const chunkColumns = Math.ceil(worldWidth / chunkSize);
  const chunkRows = Math.ceil(worldHeight / chunkSize);
  const index = new Map<number, number[]>();
  formations.forEach((formation, formationIndex) => {
    const bounds = mineralVisualBounds(formation, nativeCellSize);
    const minChunkX = Math.max(0, Math.floor(bounds.left / chunkSize));
    const minChunkY = Math.max(0, Math.floor(bounds.top / chunkSize));
    const maxChunkX = Math.min(chunkColumns - 1, Math.floor(bounds.right / chunkSize));
    const maxChunkY = Math.min(chunkRows - 1, Math.floor(bounds.bottom / chunkSize));
    for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY += 1) {
      for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX += 1) {
        const chunkKey = chunkY * chunkColumns + chunkX;
        const members = index.get(chunkKey) ?? [];
        members.push(formationIndex);
        index.set(chunkKey, members);
      }
    }
  });
  return index;
}

export function queryVisibleMineralFormations<T extends MineralSpatialFormation>(
  formations: readonly T[],
  index: ReadonlyMap<number, readonly number[]>,
  worldWidth: number,
  worldHeight: number,
  viewport: MineralViewportCells,
  zoom: number,
  nativeCellSize: number,
  chunkSize = MINERAL_SPATIAL_CHUNK_CELLS,
): Set<number> {
  const chunkColumns = Math.ceil(worldWidth / chunkSize);
  const minChunkX = Math.max(0, Math.floor(viewport.left / chunkSize));
  const minChunkY = Math.max(0, Math.floor(viewport.top / chunkSize));
  const maxChunkX = Math.min(chunkColumns - 1, Math.floor(viewport.right / chunkSize));
  const maxChunkY = Math.min(Math.ceil(worldHeight / chunkSize) - 1, Math.floor(viewport.bottom / chunkSize));
  const zoomLevel = mineralZoomLevel(zoom);
  const visible = new Set<number>();
  for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY += 1) {
    for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX += 1) {
      const members = index.get(chunkY * chunkColumns + chunkX) ?? [];
      for (const formationIndex of members) {
        if (visible.has(formationIndex)) continue;
        const formation = formations[formationIndex];
        if (formation === undefined || !mineralVisibleAtZoom(formation, zoomLevel)) continue;
        const bounds = mineralVisualBounds(formation, nativeCellSize);
        if (bounds.right < viewport.left || bounds.left > viewport.right
          || bounds.bottom < viewport.top || bounds.top > viewport.bottom) continue;
        visible.add(formationIndex);
      }
    }
  }
  return visible;
}

export function mineralZoomLevel(zoom: number): number {
  return zoom < 0.5 ? 0 : zoom < 0.78 ? 1 : 2;
}

export function mineralUsesDetailedRaster(zoom: number): boolean {
  return zoom >= MINERAL_DETAILED_RASTER_ZOOM;
}

export function mineralVisualBounds(formation: MineralSpatialFormation, nativeCellSize: number): MineralViewportCells {
  const scale = formation.visualScale / Math.max(1, nativeCellSize);
  const width = formation.raster.width * scale;
  const height = formation.raster.height * scale;
  const left = formation.xCell - formation.raster.anchorX * scale;
  const top = formation.yCell - formation.raster.anchorY * scale;
  return { left, top, right: left + width, bottom: top + height };
}

function mineralVisibleAtZoom(formation: MineralSpatialFormation, zoomLevel: number): boolean {
  if (zoomLevel === 0) return formation.deposit.tier === 'large'
    || formation.deposit.tier === 'macro'
    || (formation.source === 'ore' && formation.deposit.tier === 'normal');
  if (zoomLevel === 1) return formation.source !== 'scatter' && formation.deposit.tier !== 'small';
  return true;
}
