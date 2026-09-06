import type { UnitDimensions } from './rodCatalog'

/** Domain units × the grid's pixels per cell, for every pose. */
export function rodSizeStyle(size: UnitDimensions, cellSize: number) {
  return { '--w': `${size.width * cellSize}px`, '--d': `${size.depth * cellSize}px`, '--h': `${size.height * cellSize}px` }
}
